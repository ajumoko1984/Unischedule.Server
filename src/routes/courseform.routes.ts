import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  createCourseForm,
  updateCourseForm,
  submitCourseForm,
  getCourseForms,
  getCourseFormById,
  approveCourseForm,
  rejectCourseForm,
  getApprovedCourseForm,
  deleteCourseForm,
  getCourseFormsByStudent,
} from '../controllers/courseform.controller';

const router = Router();

// Student and Level Adviser routes - VIEW ONLY
router.get('/', protect, authorize('student', 'super_admin', 'level_adviser', 'class_rep'), getCourseForms); // List course forms
router.get('/my-approved', protect, authorize('student', 'level_adviser', 'super_admin', 'class_rep'), getApprovedCourseForm); // Get approved course form
router.get('/student/:studentId', protect, authorize('student', 'super_admin', 'level_adviser', 'class_rep'), getCourseFormsByStudent); // Get forms for specific student
router.get('/:id', protect, authorize('student', 'super_admin', 'level_adviser', 'class_rep'), getCourseFormById); // View specific form

// Level Adviser & Class Rep routes - MANAGE FOR STUDENTS
router.post('/', protect, authorize('super_admin', 'level_adviser', 'class_rep'), createCourseForm); // Create course form for student
router.put('/:id', protect, authorize('super_admin', 'level_adviser', 'class_rep'), updateCourseForm); // Update/add/drop courses
router.delete('/:id', protect, authorize('super_admin', 'level_adviser', 'class_rep'), deleteCourseForm); // Delete draft course form
router.post('/:id/submit', protect, authorize('super_admin', 'level_adviser', 'class_rep'), submitCourseForm); // Submit form for approval

// Admin only - APPROVE/REJECT
router.post('/:id/approve', protect, authorize('super_admin', 'level_adviser'), approveCourseForm); // Approve form
router.post('/:id/reject', protect, authorize('super_admin', 'level_adviser'), rejectCourseForm); // Reject form

export default router;
