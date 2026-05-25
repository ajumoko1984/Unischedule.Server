import { Request, Response } from 'express';
import CourseForm from '../models/CourseForm.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Helper function to validate course structure
 */
const validateCourses = (courses: any[]): { valid: boolean; error?: string } => {
  if (!Array.isArray(courses) || courses.length === 0) {
    return { valid: false, error: 'At least one course is required' };
  }

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];

    if (!course.courseCode || typeof course.courseCode !== 'string' || course.courseCode.trim().length === 0) {
      return { valid: false, error: `Course ${i + 1}: Course code is required` };
    }

    if (!course.courseTitle || typeof course.courseTitle !== 'string' || course.courseTitle.trim().length === 0) {
      return { valid: false, error: `Course ${i + 1}: Course title is required` };
    }

    if (course.courseCode.trim().length > 20) {
      return { valid: false, error: `Course ${i + 1}: Course code is too long (max 20 characters)` };
    }

    if (course.courseTitle.trim().length > 200) {
      return { valid: false, error: `Course ${i + 1}: Course title is too long (max 200 characters)` };
    }
  }

  return { valid: true };
};

/**
 * Create a course form for a level/department (level adviser/class rep only)
 */
export const createCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'level_adviser' && req.user.role !== 'class_rep')) {
      res.status(403).json({ success: false, message: 'Only level advisers and class reps can create course forms' });
      return;
    }

    const { courses, faculty, level, academicYear, semester, notes } = req.body;

    // Validation
    if (!faculty || !level) {
      res.status(400).json({ success: false, message: 'Faculty, and level are required' });
      return;
    }

    if (!academicYear || !semester) {
      res.status(400).json({ success: false, message: 'Academic year and semester are required' });
      return;
    }

    // Normalize semester to lowercase
    const normalizedSemester = semester.toLowerCase();

    // Validate courses structure
    const courseValidation = validateCourses(courses);
    if (!courseValidation.valid) {
      res.status(400).json({ success: false, message: courseValidation.error });
      return;
    }

    // Check if already submitted for this level/department/academic year/semester
    const existingForm = await CourseForm.findOne({
      faculty,
      level,
      academicYear,
      semester: normalizedSemester,
      status: { $in: ['submitted', 'approved'] },
    });

    if (existingForm) {
      res.status(400).json({
        success: false,
        message: 'A submitted course form already exists for this level and department in this academic year and semester',
      });
      return;
    }

    // Normalize courses: trim and uppercase course codes
    const normalizedCourses = courses.map((course: any) => ({
      courseCode: course.courseCode.trim().toUpperCase(),
      courseTitle: course.courseTitle.trim(),
      faculty,
      level,
      semester: course.semester,
      creditUnits: course.creditUnits,
    }));

    // Find or create/update course form
    let courseForm = await CourseForm.findOne({
      faculty,
      level,
      academicYear,
      semester: normalizedSemester,
      status: 'draft',
    });

    if (!courseForm) {
      courseForm = new CourseForm({
        courses: normalizedCourses,
        academicYear,
        semester: normalizedSemester,
        faculty,
        level,
        notes,
      });
    } else {
      courseForm.courses = normalizedCourses;
      courseForm.notes = notes;
    }

    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form created/updated successfully',
      courseForm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update course form - add/drop courses (level adviser/class rep only)
 */
export const updateCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'level_adviser' && req.user.role !== 'class_rep')) {
      res.status(403).json({ success: false, message: 'Only level advisers and class reps can update course forms' });
      return;
    }

    const { id } = req.params;
    const { courses, notes } = req.body;

    const courseForm = await CourseForm.findById(id);

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

    if (courseForm.status === 'rejected') {
      res.status(400).json({ success: false, message: 'Rejected forms cannot be updated' });
      return;
    }

    if (courses) {
      // Validate courses structure
      const courseValidation = validateCourses(courses);
      if (!courseValidation.valid) {
        res.status(400).json({ success: false, message: courseValidation.error });
        return;
      }

      // Normalize courses: trim and uppercase course codes
      const normalizedCourses = courses.map((course: any) => ({
        courseCode: course.courseCode.trim().toUpperCase(),
        courseTitle: course.courseTitle.trim(),
        faculty: course.faculty || courseForm.faculty,
        level: course.level || courseForm.level,
        semester: course.semester,
        creditUnits: course.creditUnits,
      }));

      courseForm.courses = normalizedCourses;
    }

    if (notes) {
      courseForm.notes = notes;
    }

    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form updated successfully',
      courseForm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Submit a course form (level adviser/class rep only) - Auto approves immediately
 */
export const submitCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'level_adviser' && req.user.role !== 'class_rep')) {
      res.status(403).json({ success: false, message: 'Only level advisers and class reps can submit course forms' });
      return;
    }

    const { id } = req.params;

    const courseForm = await CourseForm.findById(id);

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

    if (courseForm.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Only draft forms can be submitted' });
      return;
    }

    // Change status to submitted (not approved yet)
    courseForm.status = 'submitted';
    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form submitted successfully',
      courseForm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get course forms
 */
export const getCourseForms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { faculty, level, academicYear, semester, status } = req.query;

    let filter: any = {};

    // Add filters if provided
    if (faculty) filter.faculty = faculty;
    if (level) filter.level = level;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = (semester as string).toLowerCase();
    if (status) filter.status = status;

    const forms = await CourseForm.find(filter)
      .populate('approvedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: forms.length,
      forms,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a single course form
 */
export const getCourseFormById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { id } = req.params;

    const courseForm = await CourseForm.findById(id)
      .populate('approvedBy', 'fullName email');

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

    res.json({ success: true, courseForm });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Approve a course form (admin only)
 */
export const approveCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
   

    const { id } = req.params;
    const { notes } = req.body;

    const courseForm = await CourseForm.findById(id);

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

    if (courseForm.status !== 'submitted') {
      res.status(400).json({ success: false, message: 'Only submitted forms can be approved' });
      return;
    }

    courseForm.status = 'approved';
    courseForm.approvedBy = req.user._id;
    courseForm.approvalDate = new Date();
    if (notes) courseForm.notes = notes;

    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form approved successfully',
      courseForm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reject a course form (admin only)
 */
export const rejectCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only admins can reject forms' });
      return;
    }

    const { id } = req.params;
    const { notes } = req.body;

    const courseForm = await CourseForm.findById(id);

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

    if (courseForm.status !== 'submitted') {
      res.status(400).json({ success: false, message: 'Only submitted forms can be rejected' });
      return;
    }

    courseForm.status = 'rejected';
    if (notes) courseForm.notes = notes;

    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form rejected',
      courseForm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get approved course form for a student's level/department (for exam filtering)
 */
export const getApprovedCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    // Default to current academic year and first semester if not provided
    let { academicYear, semester } = req.query;
    
    if (!academicYear) {
      const now = new Date();
      const year = now.getFullYear();
      const nextYear = year + 1;
      academicYear = `${year}/${nextYear}`;
    }
    
    if (!semester) {
      semester = 'first';
    }

    // Normalize semester to lowercase
    const normalizedSemester = (semester as string).toLowerCase();

    // Get the student's info to determine their faculty and level
    const student = await User.findById(req.user._id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const courseForm = await CourseForm.findOne({
      faculty: student.faculty,
      level: student.level,
      academicYear,
      semester: normalizedSemester,
      status: 'approved',
    });

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'No approved course form found for your level and department' });
      return;
    }

    res.json({ success: true, courseForm });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a course form (level adviser/class rep only) - Only draft forms can be deleted
 */
export const deleteCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'level_adviser' && req.user.role !== 'class_rep')) {
      res.status(403).json({ success: false, message: 'Only level advisers and class reps can delete course forms' });
      return;
    }

    const { id } = req.params;

    const courseForm = await CourseForm.findById(id);

    if (!courseForm) {
      res.status(404).json({ success: false, message: 'Course form not found' });
      return;
    }

 

    await CourseForm.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Course form deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
