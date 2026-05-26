import { Request, Response } from 'express';
import Test, { ITest } from '../models/Test.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendEventReminderEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';

// Helper to send test notifications and create Notification record
const sendTestNotification = async (test: ITest, senderId: any, opts: { reason?: string; action?: 'published' | 'updated' } = {}) => {
  try {
    let recipientEmails: string[] = [];
    let notificationFaculty = test.faculty;
    let notificationLevel = test.level;
    let notificationCourseOfStudy = test.courseOfStudy;

    if (test.students && test.students.length > 0) {
      // If specific students are assigned to this test, send to them
      const students = await User.find({ _id: { $in: test.students }, role: 'student', isActive: true }).select('email faculty level courseOfStudy');
      recipientEmails = students.map(s => s.email);
      // Use faculty/level from first student if not set in test
      if (students.length > 0 && !notificationFaculty) {
        notificationFaculty = students[0].faculty;
        notificationLevel = students[0].level;
        notificationCourseOfStudy = students[0].courseOfStudy;
      }
    } else {
      // Find approved course forms that contain this course code and match test scope if available
      const normCodeForLookup = test.courseCode.toUpperCase().trim();
      const courseFilter: any = {
        'courses.courseCode': normCodeForLookup,
        status: 'approved',
      };
      if (test.faculty) courseFilter.faculty = test.faculty;
      if (test.level) courseFilter.level = test.level;
      if (test.courseOfStudy) courseFilter.courseOfStudy = test.courseOfStudy;

      const courseForms = await CourseFormModel.find(courseFilter);

      if (courseForms.length === 0) {
        console.warn(`No approved course forms found for course code: ${test.courseCode}`);
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
      title: test.courseTitle || test.title || 'Test',
      courseCode: test.courseCode || '',
      courseTitle: test.courseTitle || '',
      category: 'test',
      date: test.scheduleDate ? test.scheduleDate.toDateString() : '',
      time: `${test.startTime || ''}${test.endTime ? ' – ' + test.endTime : ''}`,
      venue: test.venue || '',
      description: opts.reason || test.instructions || '',
      faculty: notificationFaculty,
      level: notificationLevel,
      courseOfStudy: notificationCourseOfStudy,
    });

    // Only create notification if we have valid faculty info
    if (!notificationFaculty) {
      console.warn(`Cannot create notification: faculty not determined for test ${test._id}`);
      return;
    }

    await Notification.create({
      type: 'new_event',
      subject: `${opts.action === 'updated' ? 'Test updated' : 'Test announced'}: ${test.courseCode || test.title}`,
      message: `${opts.action === 'updated' ? 'A test was updated' : 'A test has been announced'}: ${test.courseTitle || test.title}` + (opts.reason ? ` — ${opts.reason}` : ''),
      recipients: recipientEmails,
      recipientCount: recipientEmails.length,
      sentBy: senderId,
      faculty: notificationFaculty,
      level: notificationLevel,
      courseOfStudy: notificationCourseOfStudy,
      relatedEvent: test._id,
      isAutomatic: true,
      deliveryStatus: 'sent',
    });
  } catch (err) {
    console.error('sendTestNotification error', err);
  }
};

import CourseFormModel from '../models/CourseForm.model';
import { normalizeCourseCode, formatTestForStudent } from '../utils/testHelper';

/**
 * Create a new test/CBT test
 */
export const createTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'exam_officer') {
      res.status(403).json({ success: false, message: 'Only exam officers can create tests' });
      return;
    }

    const {
      title,
      courseCode,
      courseTitle,
      testType,
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

    const testScheduleDate = scheduleDate ? new Date(scheduleDate) : date ? new Date(date) : undefined;
    const testVenue = testType === 'cbt' ? 'CBT CENTRE' : venue || location;

    // For non-CBT tests, venue/location is required
    if (testType !== 'cbt' && !testVenue) {
      res.status(400).json({ success: false, message: 'Venue is required for non-CBT tests' });
      return;
    }

    if (!testScheduleDate) {
      res.status(400).json({ success: false, message: 'Test date is required' });
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

    const test = await Test.create({
      title,
      courseCode,
      courseTitle,
      testType,
      duration,
      scheduleDate: testScheduleDate,
      startTime,
      endTime,
      venue: testVenue,
      semester,
      academicYear,
      createdBy: req.user._id,
      // Store optional admin fields so notifications can target students
      faculty: faculty || req.user.faculty,
      level: level || req.user.level,
      courseOfStudy: courseOfStudy || req.user.courseOfStudy,
    });

    res.status(201).json({
      success: true,
      message: `${testType.toUpperCase()} test created successfully and added to timetable`,
      test,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all tests created by the exam officer
 */
export const getMyTests = async (req: AuthRequest, res: Response): Promise<void> => {
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

      // Get their approved course form
      const courseForm = await CourseFormModel.findOne({
        faculty: student.faculty,
        level: student.level,
        status: 'approved',
      });

      if (!courseForm) {
        res.json({ success: true, count: 0, tests: [] });
        return;
      }

      const courseCodesFromForm = courseForm.courses.map((c) =>
        normalizeCourseCode(c.courseCode)
      );

      // Get ALL published tests, filter by matching course codes
      const allPublishedTests = await Test.find({ status: 'published' })
        .populate('createdBy', 'fullName email')
        .sort({ scheduleDate: 1 });

      const matchedTests = allPublishedTests.filter((test) =>
        courseCodesFromForm.includes(normalizeCourseCode(test.courseCode))
      );

      const formattedTests = matchedTests.map(formatTestForStudent);

      res.json({ success: true, count: formattedTests.length, tests: formattedTests });
      return;
    }
    if (status) filter.status = status;
    if (courseCode) filter.courseCode = normalizeCourseCode(courseCode.toString());
    if (academicYear) filter.academicYear = academicYear;

    const tests = await Test.find(filter)
      .populate('createdBy', 'fullName email')
      .populate('students', 'fullName email matricNumber')
      .sort({ scheduleDate: -1 });

    res.json({
      success: true,
      count: tests.length,
      tests,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific test by ID
 */
export const getTestById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('students', 'fullName email matricNumber');

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check if user is the creator or super_admin
    if (test.createdBy._id.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to view this test' });
      return;
    }

    res.json({ success: true, test });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update a test
 */
export const updateTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check authorization
    if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to update this test' });
      return;
    }

    // Cannot edit scheduled, ongoing, or completed tests
    if (['scheduled', 'ongoing', 'completed'].includes(test.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot edit a test that is already ${test.status}. Contact your exam officer.`,
      });
      return;
    }

    const {
      title,
      courseCode,
      courseTitle,
      testType,
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
    } = req.body;

    const updateScheduleDate = scheduleDate ? new Date(scheduleDate) : date ? new Date(date) : undefined;
    const updateVenue = venue || location;

    // Preserve old timing/venue to detect changes for notifications
    const oldSchedule = test.scheduleDate ? test.scheduleDate.toISOString() : undefined;
    const oldStart = test.startTime;
    const oldEnd = test.endTime;
    const oldVenue = test.venue;

    // Update fields
    if (title) test.title = title;
    if (courseCode) test.courseCode = courseCode;
    if (courseTitle) test.courseTitle = courseTitle;
    if (testType) test.testType = testType;
    if (duration) test.duration = duration;
    if (updateScheduleDate) test.scheduleDate = updateScheduleDate;
    if (startTime) test.startTime = startTime;
    if (endTime) test.endTime = endTime;
    if (updateVenue) test.venue = updateVenue;
    if (semester) test.semester = semester;
    if (academicYear) test.academicYear = academicYear;
    if (status) test.status = status;

    await test.save();

    // After saving, detect relevant changes and notify students
    try {
      const changes: string[] = [];
      if (updateScheduleDate && oldSchedule !== (test.scheduleDate ? test.scheduleDate.toISOString() : undefined)) changes.push('date');
      if (startTime && oldStart !== test.startTime) changes.push('startTime');
      if (endTime && oldEnd !== test.endTime) changes.push('endTime');
      if (updateVenue && oldVenue !== test.venue) changes.push('venue');

      if (changes.length > 0) {
        await sendTestNotification(test, req.user._id, { action: 'updated', reason: `Changed: ${changes.join(', ')}` });
      }
    } catch (notifyErr) {
      console.error('Failed to send update notifications:', notifyErr);
    }

    res.json({
      success: true,
      message: 'Test updated successfully',
      test,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a test
 */
export const deleteTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check authorization
    if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to delete this test' });
      return;
    }

    // Cannot delete scheduled, ongoing, or completed tests
    if (['scheduled', 'ongoing', 'completed'].includes(test.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot delete a test that is already ${test.status}`,
      });
      return;
    }

    await Test.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Test deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add students to a test
 */
export const addStudentsToTest = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check authorization
    if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to add students to this test' });
      return;
    }

    // Validate student IDs
    const validStudents = await User.find({ _id: { $in: studentIds }, role: 'student' });
    if (validStudents.length !== studentIds.length) {
      res.status(400).json({ success: false, message: 'Some student IDs are invalid' });
      return;
    }

    // Add new students, avoiding duplicates
    const newStudents = studentIds.filter((id: string) => !test.students.map((s) => s.toString()).includes(id));
    test.students.push(...newStudents);

    await test.save();

    res.json({
      success: true,
      message: `${newStudents.length} student(s) added to the test`,
      test: await test.populate('students', 'fullName email matricNumber'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove students from a test
 */
export const removeStudentsFromTest = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check authorization
    if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to remove students from this test' });
      return;
    }

    test.students = test.students.filter((id) => !studentIds.includes(id.toString()));
    await test.save();

    res.json({
      success: true,
      message: `${studentIds.length} student(s) removed from the test`,
      test: await test.populate('students', 'fullName email matricNumber'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Publish a test (change status from draft to published)
 */
export const publishTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404).json({ success: false, message: 'Test not found' });
      return;
    }

    // Check authorization
    if (test.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Not authorized to publish this test' });
      return;
    }

    if (test.status !== 'draft') {
      res.status(400).json({
        success: false,
        message: `Can only publish tests with draft status. Current status: ${test.status}`,
      });
      return;
    }

    test.status = 'published';
    await test.save();

    // Send notifications (best-effort)
    await sendTestNotification(test, req.user._id, { action: 'published' });

    res.json({
      success: true,
      message: 'Test published successfully',
      test,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all tests for a specific course (for students)
 */
export const getTestsByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseCode, academicYear } = req.query;

    if (!courseCode) {
      res.status(400).json({ success: false, message: 'Course code is required' });
      return;
    }

    const tests = await Test.find({
      courseCode: (courseCode as string).toUpperCase(),
      academicYear: academicYear || new Date().getFullYear().toString(),
      status: { $in: ['published', 'active', 'closed'] },
    })
      .populate('createdBy', 'fullName email')
      .sort({ scheduleDate: 1 });

    res.json({
      success: true,
      count: tests.length,
      tests,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get test calendar events for frontend consumption
 */
export const getTestCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { 
      res.status(401).json({ success: false, message: 'Not authorized' }); 
      return; 
    }

    let tests: ITest[] = [];

    if (req.user.role === 'student' || req.user.role === 'class_rep') {
      // reuse student view: get published tests matching student's approved course form
      const student = await User.findById(req.user._id);
      if (!student) { 
        res.status(404).json({ success: false, message: 'Student not found' }); 
        return; 
      }

      const courseForm = await CourseFormModel.findOne({ 
        faculty: student.faculty, 
        level: student.level, 
        status: 'approved' 
      });
      if (!courseForm) { 
        res.json({ success: true, events: [] }); 
        return; 
      }

      const courseCodesFromForm = courseForm.courses.map((c) => normalizeCourseCode(c.courseCode));
      const allPublishedTests = await Test.find({ status: 'published' }).sort({ scheduleDate: 1 });
      tests = allPublishedTests.filter((test) => courseCodesFromForm.includes(normalizeCourseCode(test.courseCode)));
    } else if (req.user.role === 'exam_officer') {
      tests = await Test.find({ createdBy: req.user._id }).sort({ scheduleDate: 1 });
    } else {
      tests = await Test.find({}).sort({ scheduleDate: 1 });
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

    const events = tests.map((t) => ({
      id: t._id,
      title: t.courseTitle || t.title || t.courseCode,
      start: toISO(t.scheduleDate, t.startTime),
      end: toISO(t.scheduleDate, t.endTime) || toISO(t.scheduleDate, t.startTime),
      allDay: false,
      meta: {
        testId: t._id,
        courseCode: t.courseCode,
        venue: t.venue,
        faculty: t.faculty,
        level: t.level,
        courseOfStudy: t.courseOfStudy,
      },
    }));

    res.json({ success: true, count: events.length, events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
