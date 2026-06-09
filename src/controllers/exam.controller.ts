import { Request, Response } from 'express';
import Exam, { IExam } from '../models/Exam.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendEventReminderEmail, sendInvigilatorAssignmentEmail } from '../utils/mailer';
import { sendBulkSms } from '../utils/sms';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper to send exam notifications and create Notification record
const sendExamNotification = async (exam: IExam, senderId: any, opts: { reason?: string; action?: 'published' | 'updated' } = {}) => {
  try {
    let recipientEmails: string[] = [];
    let recipientPhones: string[] = [];
    let notificationFaculty = exam.faculty;
    let notificationLevel = exam.level;
    let notificationCourseOfStudy = exam.courseOfStudy;

    if (exam.students && exam.students.length > 0) {
      // If specific students are assigned to this exam, send to them
      const students = await User.find({ _id: { $in: exam.students }, role: 'student', isActive: true }).select('email phone faculty level courseOfStudy');
      recipientEmails = students.map(s => s.email);
      recipientPhones = students.map(s => (s as any).phone).filter(Boolean);
      // Use faculty/level from first student if not set in exam
      if (students.length > 0 && !notificationFaculty) {
        notificationFaculty = students[0].faculty;
        notificationLevel = students[0].level;
        notificationCourseOfStudy = students[0].courseOfStudy;
      }
    } else {
      console.warn(`Exam ${exam._id} has no student list; notifications require explicit students`);
      return;
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
      smsRecipients: recipientPhones,
      smsRecipientCount: recipientPhones.length,
      sentBy: senderId,
      faculty: notificationFaculty,
      level: notificationLevel,
      courseOfStudy: notificationCourseOfStudy,
      relatedEvent: exam._id,
      isAutomatic: true,
      deliveryStatus: 'sent',
    });
    // send SMS if we collected any
    if (recipientPhones.length > 0) {
      const smsText = `${opts.action === 'updated' ? 'Exam updated' : 'Exam announced'}: ${exam.courseCode || exam.title} — ${exam.scheduleDate ? exam.scheduleDate.toDateString() : ''} ${exam.startTime || ''}`;
      await sendBulkSms(recipientPhones, smsText);
    }
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
      studentPopulation,
      invigilators,
      instructions,
    } = req.body;

    const population = studentPopulation !== undefined && studentPopulation !== null
      ? Number(studentPopulation)
      : undefined;

    if (population !== undefined && (Number.isNaN(population) || !Number.isInteger(population) || population < 0)) {
      res.status(400).json({ success: false, message: 'studentPopulation must be a non-negative integer' });
      return;
    }

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

    if (studentPopulation === undefined || studentPopulation === null) {
      res.status(400).json({ success: false, message: 'studentPopulation is required' });
      return;
    }

    // Validate student IDs if provided
    let validatedStudents: any[] = [];
    if (Array.isArray(students) && students.length > 0) {
      validatedStudents = await User.find({ _id: { $in: students }, role: 'student' });
      if (validatedStudents.length !== students.length) {
        res.status(400).json({ success: false, message: 'Some student IDs are invalid' });
        return;
      }
    }

    // Validate invigilator IDs if provided (must be lecturer/staff accounts)
    let validatedInvigilators: any[] = [];
    if (Array.isArray(invigilators) && invigilators.length > 0) {
      validatedInvigilators = await User.find({ _id: { $in: invigilators }, role: 'lecturer', isActive: true });
      if (validatedInvigilators.length !== invigilators.length) {
        res.status(400).json({ success: false, message: 'Some invigilator IDs are invalid or inactive' });
        return;
      }
    }

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
      studentPopulation: population,
      invigilators: Array.isArray(invigilators) ? invigilators : [],
      instructions,
      // Store optional admin fields so notifications can target students
      faculty: faculty || req.user.faculty,
      level: level || req.user.level,
      courseOfStudy: courseOfStudy || req.user.courseOfStudy,
    });

    // Populate invigilators before responding
    await exam.populate('invigilators', 'fullName email');

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

    if (req.user.role === 'lecturer') {
      // For lecturers, show exams they've been assigned to invigilate
      const publishedExams = await Exam.find({ status: 'published', invigilators: req.user._id })
        .populate('createdBy', 'fullName email')
        .populate('invigilators', 'fullName email')
        .sort({ scheduleDate: 1 });

      res.json({
        success: true,
        count: publishedExams.length,
        exams: publishedExams,
      });
      return;
    }
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

      const courseCodesFromForm = courseForm.courses.map((c: { courseCode?: string }) =>
        normalizeCourseCode(c.courseCode || '')
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
      .populate('invigilators', 'fullName email')
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
      .populate('students', 'fullName email matricNumber')
      .populate('invigilators', 'fullName email');

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
      studentPopulation,
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
    const oldInvigilators = exam.invigilators ? exam.invigilators.map((inv: any) => inv.toString()) : [];

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

    const population = studentPopulation !== undefined && studentPopulation !== null
      ? Number(studentPopulation)
      : undefined;

    if (population !== undefined) {
      if (Number.isNaN(population) || !Number.isInteger(population) || population < 0) {
        res.status(400).json({ success: false, message: 'studentPopulation must be a non-negative integer' });
        return;
      }
      exam.studentPopulation = population;
    }

    // Validate and update invigilators (must be active lecturer accounts)
    if (Array.isArray(invigilators) && invigilators.length > 0) {
      const validatedInvigilators = await User.find({ _id: { $in: invigilators }, role: 'lecturer', isActive: true });
      if (validatedInvigilators.length !== invigilators.length) {
        res.status(400).json({ success: false, message: 'Some invigilator IDs are invalid or inactive' });
        return;
      }
      exam.invigilators = invigilators;
    } else if (Array.isArray(invigilators) && invigilators.length === 0) {
      exam.invigilators = [];
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

      // Check if invigilators changed
      const newInvigilators = exam.invigilators ? exam.invigilators.map((inv: any) => inv.toString()) : [];
      const invigilatorsChanged = oldInvigilators.length !== newInvigilators.length || 
        !oldInvigilators.every((inv: string) => newInvigilators.includes(inv));

      if (changes.length > 0) {
        await sendExamNotification(exam, req.user._id, { action: 'updated', reason: `Changed: ${changes.join(', ')}` });
      }
    } catch (notifyErr) {
      console.error('Failed to send update notifications:', notifyErr);
    }

    // Populate invigilators before responding
    await exam.populate('invigilators', 'fullName email');

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

    const exam = await Exam.findById(req.params.id)
      .populate('invigilators', 'email fullName');

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

    // Send notifications to students (best-effort)
    await sendExamNotification(exam, req.user._id, { action: 'published' });

    // Send invigilator assignment emails if any invigilators are assigned
    if (exam.invigilators && exam.invigilators.length > 0) {
      try {
        const invigilatorEmails = (exam.invigilators as any[]).map((inv: any) => inv.email).filter(Boolean);
        if (invigilatorEmails.length > 0) {
          await sendInvigilatorAssignmentEmail(invigilatorEmails, {
            courseCode: exam.courseCode || '',
            courseTitle: exam.courseTitle || '',
            date: exam.scheduleDate ? exam.scheduleDate.toDateString() : '',
            startTime: exam.startTime || '',
            endTime: exam.endTime || '',
            venue: exam.venue || '',
            studentPopulation: exam.studentPopulation,
          });
        }
      } catch (emailErr) {
        console.error('Failed to send invigilator assignment emails:', emailErr);
      }
    }

    // Populate invigilators for response
    await exam.populate('invigilators', 'fullName email');

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
      .populate('invigilators', 'fullName email')
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
 * Get all published exams
 */
export const getPublishedExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { courseCode, academicYear, semester, faculty } = req.query;
    const filter: any = { status: 'published' };

    if (courseCode) {
      filter.courseCode = normalizeCourseCode(courseCode.toString());
    }
    if (academicYear) {
      filter.academicYear = academicYear;
    }
    if (semester) {
      filter.semester = semester;
    }
    if (faculty) {
      filter.faculty = faculty;
    }

    const exams = await Exam.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('invigilators', 'fullName email')
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

      const courseCodesFromForm = courseForm.courses.map((c: { courseCode?: string }) => normalizeCourseCode(c.courseCode || ''));
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