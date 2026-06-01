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
 * or for a specific student (carry-over/overload case)
 */
export const createCourseForm = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'super_admin' && req.user.role !== 'level_adviser' && req.user.role !== 'class_rep')) {
      res.status(403).json({ success: false, message: 'Only level advisers and class reps can create course forms' });
      return;
    }

    const { courses, faculty, courseOfStudy, level, academicYear, semester, notes, studentId } = req.body;

    // If creating a form for a specific student, validate the student exists and access
    if (studentId) {
      const student = await User.findById(studentId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Student not found' });
        return;
      }

      // Permission check: level adviser/class rep can only edit students in their scope
      if (req.user.role === 'level_adviser' && 
          (req.user.faculty !== student.faculty || 
           req.user.courseOfStudy !== student.courseOfStudy || 
           req.user.level !== student.level)) {
        res.status(403).json({ success: false, message: 'You can only manage forms for students in your level/department' });
        return;
      }

      if (req.user.role === 'class_rep' && req.user._id.toString() !== studentId) {
        res.status(403).json({ success: false, message: 'Class reps can only edit their own course form' });
        return;
      }
    }

    // Validation
    if (!faculty || !courseOfStudy || !level) {
      res.status(400).json({ success: false, message: 'Faculty, courseOfStudy, and level are required' });
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

    // Check if already submitted for this level/department (only for non-student forms)
    if (!studentId) {
      const existingForm = await CourseForm.findOne({
        faculty,
        courseOfStudy,
        level,
        academicYear,
        semester: normalizedSemester,
        studentId: null,
        status: { $in: ['submitted', 'approved'] },
      });

      if (existingForm) {
        res.status(400).json({
          success: false,
          message: 'A submitted course form already exists for this level and department in this academic year and semester',
        });
        return;
      }
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

    // If creating a student-specific form, merge with department-level courses
    let finalCourses = normalizedCourses;
    if (studentId) {
      // Fetch the department-level form for this faculty/courseOfStudy/level/academicYear/semester
      const departmentForm = await CourseForm.findOne({
        faculty,
        courseOfStudy,
        level,
        academicYear,
        semester: normalizedSemester,
        studentId: null,
        status: { $in: ['draft', 'submitted', 'approved'] },
      });

      if (departmentForm && departmentForm.courses.length > 0) {
        // Merge: start with department courses, then add any new courses not already in the list
        const deptCourseCodes = new Set(departmentForm.courses.map(c => c.courseCode.toUpperCase()));
        const newCourses = normalizedCourses.filter((c: any) => !deptCourseCodes.has(c.courseCode.toUpperCase()));
        finalCourses = [...departmentForm.courses, ...newCourses];
      }
    }

    // Find or create/update course form
    let courseForm = await CourseForm.findOne({
      faculty,
      courseOfStudy,
      level,
      academicYear,
      semester: normalizedSemester,
      studentId: studentId || null,
      status: 'draft',
    });

    if (!courseForm) {
      courseForm = new CourseForm({
        courses: finalCourses,
        academicYear,
        semester: normalizedSemester,
        faculty,
        courseOfStudy,
        level,
        studentId: studentId || undefined,
        notes,
      });
    } else {
      courseForm.courses = finalCourses;
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

    // Permission check for student-specific forms
    if (courseForm.studentId) {
      const student = await User.findById(courseForm.studentId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Associated student not found' });
        return;
      }

      // Level adviser must be in student's scope
      if (req.user.role === 'level_adviser' && 
          (req.user.faculty !== student.faculty || 
           req.user.courseOfStudy !== student.courseOfStudy || 
           req.user.level !== student.level)) {
        res.status(403).json({ success: false, message: 'You can only manage forms for students in your level/department' });
        return;
      }

      // Class rep must be the student
      if (req.user.role === 'class_rep' && req.user._id.toString() !== courseForm.studentId.toString()) {
        res.status(403).json({ success: false, message: 'Class reps can only edit their own course form' });
        return;
      }
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

      // If this is a student-specific form, merge with department-level courses
      let finalCourses = normalizedCourses;
      if (courseForm.studentId) {
        // Fetch the department-level form for this faculty/courseOfStudy/level/academicYear/semester
        const departmentForm = await CourseForm.findOne({
          faculty: courseForm.faculty,
          courseOfStudy: courseForm.courseOfStudy,
          level: courseForm.level,
          academicYear: courseForm.academicYear,
          semester: courseForm.semester,
          studentId: null,
          status: { $in: ['draft', 'submitted', 'approved'] },
        });

        if (departmentForm && departmentForm.courses.length > 0) {
          // Merge: start with department courses, then add any new courses not already in the list
          const deptCourseCodes = new Set(departmentForm.courses.map(c => c.courseCode.toUpperCase()));
          const newCourses = normalizedCourses.filter((c: any) => !deptCourseCodes.has(c.courseCode.toUpperCase()));
          finalCourses = [...departmentForm.courses, ...newCourses];
        }
      }

      courseForm.courses = finalCourses;
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

    
    courseForm.status = 'approved';
    await courseForm.save();

    res.json({
      success: true,
      message: 'Course form submitted and approved successfully',
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

    const { faculty, courseOfStudy, level, academicYear, semester, status, studentId } = req.query;

    let filter: any = {};

    // If filtering by specific studentId, validate permissions first
    if (studentId) {
      const targetStudent = await User.findById(studentId);
      if (!targetStudent) {
        res.status(404).json({ success: false, message: 'Student not found' });
        return;
      }

      // Permission check: only the student, their level adviser, or their class rep can see their forms
      if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
        res.status(403).json({ success: false, message: 'You can only view your own course forms' });
        return;
      }

      if (req.user.role === 'class_rep' && req.user._id.toString() !== studentId) {
        res.status(403).json({ success: false, message: 'Class reps can only view their own course forms' });
        return;
      }

      if (req.user.role === 'level_adviser' && 
          (req.user.faculty !== targetStudent.faculty || 
           req.user.courseOfStudy !== targetStudent.courseOfStudy || 
           req.user.level !== targetStudent.level)) {
        res.status(403).json({ success: false, message: 'You can only view forms for students in your level/department' });
        return;
      }

      filter.studentId = studentId;
    } else {
      if (req.user.role === 'level_adviser') {
        // Level advisers should see both department-level and student-specific forms
        // for their faculty/department/level.
      } else {
        // If no studentId specified, only return department-level forms (where studentId is null)
        // This is the default behavior for viewing course forms by students and class reps.
        filter.studentId = null;
      }
    }

    // Add other filters if provided
    if (faculty) filter.faculty = faculty;
    if (courseOfStudy) filter.courseOfStudy = courseOfStudy;
    if (level) filter.level = level;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = (semester as string).toLowerCase();
    if (status) filter.status = status;

    if (req.user.role === 'student' && !studentId) {
      const student = await User.findById(req.user._id).select('faculty level courseOfStudy');
      if (student) {
        filter.faculty = student.faculty;
        filter.level = student.level;
        filter.courseOfStudy = student.courseOfStudy;
        if (!status) filter.status = 'approved';
      }
    } else if (req.user.role === 'class_rep' && !studentId) {
      // Class reps see approved forms for their faculty/level/courseOfStudy (only department-level)
      if (!faculty && req.user.faculty) filter.faculty = req.user.faculty;
      if (!courseOfStudy && req.user.courseOfStudy) filter.courseOfStudy = req.user.courseOfStudy;
      if (!level && req.user.level) filter.level = req.user.level;
      if (!status) filter.status = 'approved';
    } else if (req.user.role === 'level_adviser' && !studentId) {
      // Level advisers see all department-level forms for their faculty
      if (!faculty && req.user.faculty) filter.faculty = req.user.faculty;
      if (!courseOfStudy && req.user.courseOfStudy) filter.courseOfStudy = req.user.courseOfStudy;
      if (!level && req.user.level) filter.level = req.user.level;
    }

    const forms = await CourseForm.find(filter)
      .populate('approvedBy', 'fullName email')
      .populate('studentId', 'fullName email matricNumber')
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

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    if (courseForm.status !== 'submitted') {
      res.status(400).json({ success: false, message: 'Only submitted forms can be approved' });
      return;
    }

    courseForm.status = 'approved';
    courseForm.approvedBy = req.user._id as any;
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
  

    // Default semester to current term if not provided, then normalize to lowercase
    if (!semester) {
      const now = new Date();
      semester = now.getMonth() < 6 ? 'first' : 'second';
    }

    const normalizedSemester = (semester as string).toLowerCase();

    // Get the student's info to determine their faculty and level
    const student = await User.findById(req.user._id);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const courseForm = await CourseForm.findOne({
      faculty: student.faculty,
      courseOfStudy: student.courseOfStudy,
      level: student.level,
      academicYear,
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

/**
 * Get course forms by student ID (for level adviser/class rep to edit student forms)
 */
export const getCourseFormsByStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { studentId } = req.params;
    const { academicYear, semester } = req.query;

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    // Permission check
    if (req.user.role === 'level_adviser' && 
        (req.user.faculty !== student.faculty || 
         req.user.courseOfStudy !== student.courseOfStudy || 
         req.user.level !== student.level)) {
      res.status(403).json({ success: false, message: 'You can only view forms for students in your level/department' });
      return;
    }

    if (req.user.role === 'class_rep' && req.user._id.toString() !== studentId) {
      res.status(403).json({ success: false, message: 'You can only view your own course forms' });
      return;
    }

    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      res.status(403).json({ success: false, message: 'You can only view your own course forms' });
      return;
    }

    let filter: any = { studentId };

    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = (semester as string).toLowerCase();

    const forms = await CourseForm.find(filter)
      .populate('studentId', 'fullName email matricNumber')
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
