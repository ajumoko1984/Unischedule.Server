import { Request, Response } from 'express';
import Exam, { IExam } from '../models/Exam.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendEventReminderEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper to send exam notifications and create Notification record
const sendExamNotification = async (exam: IExam, senderId: any, opts: { reason?: string; action?: 'published' | 'updated' } = {}) => {
  try {
    let recipientEmails: string[] = [];
    let notificationFaculty = exam.faculty;
    let notificationLevel = exam.level;
    let notificationCourseOfStudy = exam.courseOfStudy;

    if (exam.students && exam.students.length > 0) {
      // If specific students are assigned to this exam, send to them
      const students = await User.find({ _id: { $in: exam.students }, role: 'student', isActive: true }).select('email faculty level courseOfStudy');
      recipientEmails = students.map(s => s.email);
      // Use faculty/level from first student if not set in exam
      if (students.length > 0 && !notificationFaculty) {
        notificationFaculty = students[0].faculty;
        notificationLevel = students[0].level;
        notificationCourseOfStudy = students[0].courseOfStudy;
      }
    } else {
      // Find approved course forms that contain this course code and match exam scope if available
      const normCodeForLookup = exam.courseCode.toUpperCase().trim();
      const courseFilter: any = {
        'courses.courseCode': normCodeForLookup,
        status: 'approved',
      };
      if (exam.faculty) courseFilter.faculty = exam.faculty;
      if (exam.level) courseFilter.level = exam.level;
      if (exam.courseOfStudy) courseFilter.courseOfStudy = exam.courseOfStudy;

      const courseForms = await CourseFormModel.find(courseFilter);

      if (courseForms.length === 0) {
        console.warn(`No approved course forms found for course code: ${exam.courseCode}`);
        return; // Skip notification if no course forms have this course
      }

      // Collect all unique faculty/level/courseOfStudy combinations
      const targetGroups = courseForms.map(cf => ({
        faculty: cf.faculty,
        level: cf.level,
        courseOfStudy: cf.courseOfStudy,
      }));

      // Find students in all target groups (case-insensitive, trimmed matching)
      const studentEmails = new Set<string>();

      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      for (const group of targetGroups) {
        const q: any = { role: 'student', isActive: true };
        if (group.faculty) q.faculty = { $regex: new RegExp(`^${escapeRegex((group.faculty || '').trim())}$`, 'i') };
        if (group.level) q.level = { $regex: new RegExp(`^${escapeRegex((group.level || '').trim())}$`, 'i') };
        if (group.courseOfStudy) q.courseOfStudy = { $regex: new RegExp(`^${escapeRegex((group.courseOfStudy || '').trim())}$`, 'i') };

        const students = await User.find(q).select('email');
        students.forEach(s => studentEmails.add(s.email));
      }

      recipientEmails = Array.from(studentEmails);
      
      // Use first course form's faculty info for notification
      if (courseForms.length > 0) {
        notificationFaculty = courseForms[0].faculty;
        notificationLevel = courseForms[0].level;
        notificationCourseOfStudy = courseForms[0].courseOfStudy;
      }
    }

    if (recipientEmails.length === 0) return;

    await sendEventReminderEmail(recipientEmails, {
      title: exam.courseTitle || exam.title || 'Exam',
      courseCode: exam.courseCode || '',
      courseTitle: exam.courseTitle || '',
      category: 'exam',
      date: exam.scheduleDate ? exam.scheduleDate.toDateString() : '',
      time: `${exam.startTime || ''}${exam.endTime ? ' – ' + exam.endTime : ''}`,
      venue: exam.venue || '',
      description: opts.reason || exam.instructions || '',
      faculty: notificationFaculty,
      level: notificationLevel,
      courseOfStudy: notificationCourseOfStudy,
    });

    // Only create notification if we have valid faculty info
    if (!notificationFaculty) {
      console.warn(`Cannot create notification: faculty not determined for exam ${exam._id}`);
      return;
    }

    await Notification.create({
      type: 'new_event',
      subject: `${opts.action === 'updated' ? 'Exam updated' : 'Exam announced'}: ${exam.courseCode || exam.title}`,
      message: `${opts.action === 'updated' ? 'An exam was updated' : 'An exam has been announced'}: ${exam.courseTitle || exam.title}` + (opts.reason ? ` — ${opts.reason}` : ''),
      recipients: recipientEmails,
      recipientCount: recipientEmails.length,
      sentBy: senderId,
      faculty: notificationFaculty,
      level: notificationLevel,
      courseOfStudy: notificationCourseOfStudy,
      relatedEvent: exam._id,
      isAutomatic: true,
      deliveryStatus: 'sent',
    });
  } catch (err) {
    console.error('sendExamNotification error', err);
  }
};
import {
  parseJsonTimetable,
  parseCsvTimetable,
  convertToExamData,
  TimetableEntry,
} from '../utils/timetableParser';
import CourseFormModel from '../models/CourseForm.model';
import { normalizeCourseCode, formatExamForStudent } from '../utils/examHelper';

/**
 * Create a new exam/CBT test
 */
export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'exam_officer') {
      res.status(403).json({ success: false, message: 'Only exam officers can create exams' });
      return;
    }

    const {
      title,
      courseCode,
      courseTitle,
      examType,
      duration,
      totalMarks,
      scheduleDate,
      date,
      startTime,
      endTime,
      venue,
      location,
      faculty,
      level,
      courseOfStudy,
      semester,
      academicYear,
      students,
      invigilators,
      instructions,
    } = req.body;

    const examScheduleDate = scheduleDate ? new Date(scheduleDate) : date ? new Date(date) : undefined;
    const examVenue = examType === 'cbt' ? 'CBT CENTRE' : venue || location;

    // For non-CBT exams, venue/location is required
    if (examType !== 'cbt' && !examVenue) {
      res.status(400).json({ success: false, message: 'Venue is required for non-CBT exams' });
      return;
    }

    if (!examScheduleDate) {
      res.status(400).json({ success: false, message: 'Exam date is required' });
      return;
    }

    // Validate student IDs if provided
    if (students && students.length > 0) {
      const validStudents = await User.find({ _id: { $in: students }, role: 'student' });
      if (validStudents.length !== students.length) {
        res.status(400).json({ success: false, message: 'Some student IDs are invalid' });
        return;
      }
    }

    const normalizedInvigilators = Array.isArray(invigilators)
      ? invigilators
          .filter((name: any) => typeof name === 'string' && name.trim().length > 0)
          .map((name: string) => name.trim())
      : [];

    const exam = await Exam.create({
      title,
      courseCode,
      courseTitle,
      examType,
      duration,
      scheduleDate: examScheduleDate,
      startTime,
      endTime,
      venue: examVenue,
      semester,
      academicYear,
      createdBy: req.user._id,
      students: Array.isArray(students) ? students : [],
      invigilators: normalizedInvigilators,
      instructions,
      // Store optional admin fields so notifications can target students
      faculty: faculty || req.user.faculty,
      level: level || req.user.level,
      courseOfStudy: courseOfStudy || req.user.courseOfStudy,
    });

    res.status(201).json({
      success: true,
      message: `${examType.toUpperCase()} exam created successfully and added to timetable`,
      exam,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all exams created by the exam officer
 */
export const getMyExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { status, courseCode, academicYear } = req.query;

    const filter: any = { createdBy: req.user._id };

    if (req.user.role === 'student' || req.user.role === 'class_rep') {
      const student = await User.findById(req.user._id);
      if (!student) {
        res.status(404).json({ success: false, message: 'Student not found' });
        return;
      }

      // Check personal course form first (carry-over / custom courses), fall back to dept form
      let courseForm = await CourseFormModel.findOne({
        studentId: student._id,
        status: 'approved',
      });

      if (!courseForm) {
        courseForm = await CourseFormModel.findOne({
          faculty: student.faculty,
          level: student.level,
          status: 'approved',
        });
      }

      if (!courseForm) {
        res.json({ success: true, count: 0, exams: [] });
        return;
      }

      const courseCodesFromForm = courseForm.courses.map((c) =>
        normalizeCourseCode(c.courseCode)
      );

      // Get ALL published exams, filter by matching course codes
      const allPublishedExams = await Exam.find({ status: 'published' })
        .populate('createdBy', 'fullName email')
        .sort({ scheduleDate: 1 });

      const matchedExams = allPublishedExams.filter((exam) =>
        courseCodesFromForm.includes(normalizeCourseCode(exam.courseCode))
      );

      const formattedExams = matchedExams.map(formatExamForStudent);

      res.json({ success: true, count: formattedExams.length, exams: formattedExams });
      return;
    }
    if (status) filter.status = status;
    if (courseCode) filter.courseCode = normalizeCourseCode(courseCode.toString());
    if (academicYear) filter.academicYear = academicYear;

    const exams = await Exam.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('students', 'fullName email matricNumber')
      .sort({ scheduleDate: -1 });

    res.json({
      success: true,
      count: exams.length,
      exams,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific exam by ID
 */
export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const exam = await Exam.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('students', 'fullName email matricNumber');

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check if user is the creator or super_admin
    if (exam.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to view this exam' });
      return;
    }

    res.json({ success: true, exam });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an exam
 */
export const updateExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check authorization
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to update this exam' });
      return;
    }

    // Cannot edit scheduled, ongoing, or completed exams
    if (['scheduled', 'ongoing', 'completed'].includes(exam.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot edit an exam that is already ${exam.status}. Contact your exam officer.`,
      });
      return;
    }

    const {
      title,
      courseCode,
      courseTitle,
      examType,
      duration,
      scheduleDate,
      date,
      startTime,
      endTime,
      venue,
      location,
      semester,
      academicYear,
      status,
      invigilators,
      instructions,
    } = req.body;

    const updateScheduleDate = scheduleDate ? new Date(scheduleDate) : date ? new Date(date) : undefined;
    const updateVenue = venue || location;

    // Preserve old timing/venue to detect changes for notifications
    const oldSchedule = exam.scheduleDate ? exam.scheduleDate.toISOString() : undefined;
    const oldStart = exam.startTime;
    const oldEnd = exam.endTime;
    const oldVenue = exam.venue;

    // Update fields
    if (title) exam.title = title;
    if (courseCode) exam.courseCode = courseCode;
    if (courseTitle) exam.courseTitle = courseTitle;
    if (examType) exam.examType = examType;
    if (duration) exam.duration = duration;
    if (updateScheduleDate) exam.scheduleDate = updateScheduleDate;
    if (startTime) exam.startTime = startTime;
    if (endTime) exam.endTime = endTime;
    if (updateVenue) exam.venue = updateVenue;
    if (semester) exam.semester = semester;
    if (academicYear) exam.academicYear = academicYear;
    if (status) exam.status = status;
    if (Array.isArray(invigilators)) {
      exam.invigilators = invigilators
        .filter((name: any) => typeof name === 'string' && name.trim().length > 0)
        .map((name: string) => name.trim());
    }
    if (typeof instructions === 'string') {
      exam.instructions = instructions;
    }

    await exam.save();

    // After saving, detect relevant changes and notify students
    try {
      const changes: string[] = [];
      if (updateScheduleDate && oldSchedule !== (exam.scheduleDate ? exam.scheduleDate.toISOString() : undefined)) changes.push('date');
      if (startTime && oldStart !== exam.startTime) changes.push('startTime');
      if (endTime && oldEnd !== exam.endTime) changes.push('endTime');
      if (updateVenue && oldVenue !== exam.venue) changes.push('venue');

      if (changes.length > 0) {
        await sendExamNotification(exam, req.user._id, { action: 'updated', reason: `Changed: ${changes.join(', ')}` });
      }
    } catch (notifyErr) {
      console.error('Failed to send update notifications:', notifyErr);
    }

    res.json({
      success: true,
      message: 'Exam updated successfully',
      exam,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete an exam
 */
export const deleteExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check authorization
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to delete this exam' });
      return;
    }

    // Cannot delete scheduled, ongoing, or completed exams
    if (['scheduled', 'ongoing', 'completed'].includes(exam.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot delete an exam that is already ${exam.status}`,
      });
      return;
    }

    await Exam.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Exam deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add students to an exam
 */
export const addStudentsToExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid student IDs provided' });
      return;
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check authorization
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to add students to this exam' });
      return;
    }

    // Validate student IDs
    const validStudents = await User.find({ _id: { $in: studentIds }, role: 'student' });
    if (validStudents.length !== studentIds.length) {
      res.status(400).json({ success: false, message: 'Some student IDs are invalid' });
      return;
    }

    // Add new students, avoiding duplicates
    const newStudents = studentIds.filter((id: string) => !exam.students.map((s) => s.toString()).includes(id));
    exam.students.push(...newStudents);

    await exam.save();

    res.json({
      success: true,
      message: `${newStudents.length} student(s) added to the exam`,
      exam: await exam.populate('students', 'fullName email matricNumber'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove students from an exam
 */
export const removeStudentsFromExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid student IDs provided' });
      return;
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check authorization
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to remove students from this exam' });
      return;
    }

    exam.students = exam.students.filter((id) => !studentIds.includes(id.toString()));
    await exam.save();

    res.json({
      success: true,
      message: `${studentIds.length} student(s) removed from the exam`,
      exam: await exam.populate('students', 'fullName email matricNumber'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Publish an exam (change status from draft to published)
 */
export const publishExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    // Check authorization
    if (exam.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to publish this exam' });
      return;
    }

    if (exam.status !== 'draft') {
      res.status(400).json({
        success: false,
        message: `Can only publish exams with draft status. Current status: ${exam.status}`,
      });
      return;
    }

    exam.status = 'published';
    await exam.save();

    // Send notifications (best-effort)
    await sendExamNotification(exam, req.user._id, { action: 'published' });

    res.json({
      success: true,
      message: 'Exam published successfully',
      exam,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all exams for a specific course (for students)
 */
export const getExamsByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseCode, academicYear } = req.query;

    if (!courseCode) {
      res.status(400).json({ success: false, message: 'Course code is required' });
      return;
    }

    const exams = await Exam.find({
      courseCode: (courseCode as string).toUpperCase(),
      academicYear: academicYear || new Date().getFullYear().toString(),
      status: { $in: ['published', 'active', 'closed'] },
    })
      .populate('createdBy', 'fullName email')
      .sort({ scheduleDate: 1 });

    res.json({
      success: true,
      count: exams.length,
      exams,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk import exams from timetable data (JSON format)
 * This endpoint accepts timetable data and creates multiple exams at once
 */
export const bulkImportExamsJson = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'exam_officer') {
      res.status(403).json({ success: false, message: 'Only exam officers can import exams' });
      return;
    }

    const { timetableData, semester, academicYear, defaults } = req.body;

    if (!timetableData || !Array.isArray(timetableData)) {
      res.status(400).json({ success: false, message: 'Timetable data must be an array' });
      return;
    }

    if (!semester || !academicYear) {
      res.status(400).json({ success: false, message: 'Semester and academic year are required' });
      return;
    }

    try {
      // Parse timetable entries
      const entries = parseJsonTimetable(timetableData, semester, academicYear);

      if (entries.length === 0) {
        res.status(400).json({ success: false, message: 'No valid exam entries found in timetable data' });
        return;
      }

      // Create exams from entries
      const createdExams: IExam[] = [];
      const errors: any[] = [];

      for (let i = 0; i < entries.length; i++) {
        try {
          const entry = entries[i];
          const examData = convertToExamData(entry, defaults || {});

          const exam = await Exam.create({
            ...examData,
            createdBy: req.user._id,
            status: 'draft',
          });

          createdExams.push(exam);
        } catch (error: any) {
          errors.push({
            index: i,
            courseCode: entries[i].courseCode,
            error: error.message,
          });
        }
      }

      res.status(201).json({
        success: errors.length === 0,
        message: `${createdExams.length} exams created successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        createdCount: createdExams.length,
        failedCount: errors.length,
        createdExams,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (parseError: any) {
      res.status(400).json({
        success: false,
        message: `Failed to parse timetable data: ${parseError.message}`,
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk import exams from CSV format
 */
export const bulkImportExamsCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'exam_officer') {
      res.status(403).json({ success: false, message: 'Only exam officers can import exams' });
      return;
    }

    const { csvData, semester, academicYear, defaults } = req.body;

    if (!csvData || typeof csvData !== 'string') {
      res.status(400).json({ success: false, message: 'CSV data must be a string' });
      return;
    }

    if (!semester || !academicYear) {
      res.status(400).json({ success: false, message: 'Semester and academic year are required' });
      return;
    }

    try {
      // Parse CSV timetable entries
      const entries = parseCsvTimetable(csvData, semester, academicYear);

      if (entries.length === 0) {
        res.status(400).json({ success: false, message: 'No valid exam entries found zin CSV data' });
        return;
      }

      // Create exams from entries
      const createdExams: IExam[] = [];
      const errors: any[] = [];

      for (let i = 0; i < entries.length; i++) {
        try {
          const entry = entries[i];
          const examData = convertToExamData(entry, defaults || {});

          const exam = await Exam.create({
            ...examData,
            createdBy: req.user._id,
            status: 'draft',
          });

          createdExams.push(exam);
        } catch (error: any) {
          errors.push({
            rowIndex: i + 1, // +1 because of header row
            courseCode: entries[i].courseCode,
            error: error.message,
          });
        }
      }

      res.status(201).json({
        success: errors.length === 0,
        message: `${createdExams.length} exams created successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        createdCount: createdExams.length,
        failedCount: errors.length,
        createdExams,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (parseError: any) {
      res.status(400).json({
        success: false,
        message: `Failed to parse CSV data: ${parseError.message}`,
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Return exams as calendar events for frontend consumption
export const getExamCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    let exams: IExam[] = [];

    if (req.user.role === 'student' || req.user.role === 'class_rep') {
      // reuse student view: get published exams matching student's approved course form
      const student = await User.findById(req.user._id);
      if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }

      const courseForm = await CourseFormModel.findOne({ faculty: student.faculty, level: student.level, status: 'approved' });
      if (!courseForm) { res.json({ success: true, events: [] }); return; }

      const courseCodesFromForm = courseForm.courses.map((c) => normalizeCourseCode(c.courseCode));
      const allPublishedExams = await Exam.find({ status: 'published' }).sort({ scheduleDate: 1 });
      exams = allPublishedExams.filter((exam) => courseCodesFromForm.includes(normalizeCourseCode(exam.courseCode)));
    } else if (req.user.role === 'exam_officer') {
      exams = await Exam.find({ createdBy: req.user._id }).sort({ scheduleDate: 1 });
    } else {
      exams = await Exam.find({}).sort({ scheduleDate: 1 });
    }

    const toISO = (date: Date | undefined, time?: string) => {
      if (!date) return null;
      const d = new Date(date);
      if (time && /^\d{1,2}:\d{2}/.test(time)) {
        const [h, m] = time.split(':').map(Number);
        d.setHours(h, m || 0, 0, 0);
      }
      return d.toISOString();
    };

    const events = exams.map((e) => ({
      id: e._id,
      title: e.courseTitle || e.title || e.courseCode,
      start: toISO(e.scheduleDate, e.startTime),
      end: toISO(e.scheduleDate, e.endTime) || toISO(e.scheduleDate, e.startTime),
      allDay: false,
      meta: {
        examId: e._id,
        courseCode: e.courseCode,
        venue: e.venue,
        faculty: e.faculty,
        level: e.level,
        courseOfStudy: e.courseOfStudy,
      },
    }));

    res.json({ success: true, count: events.length, events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};