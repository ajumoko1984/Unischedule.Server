import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  createTest,
  getMyTests,
  getTestById,
  updateTest,
  deleteTest,
  addStudentsToTest,
  removeStudentsFromTest,
  publishTest,
  getTestCalendar,
  getTestsByCourse,
} from '../controllers/test.controller';

const router = Router();

// Public routes (no auth needed)
router.get('/course', getTestsByCourse); // Students: Get tests by course (timetable view)

// Student & Exam Officer routes (both can view their tests)
router.get('/my-tests', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep'), getMyTests); // Get enrolled/created tests
router.get('/calendar', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep'), getTestCalendar); // Calendar events

// Exam Officer routes (only exam_officer and super_admin can create/manage)
router.post('/', protect, authorize('exam_officer', 'super_admin'), createTest); // Create test
router.post('/:id/publish', protect, authorize('exam_officer', 'super_admin'), publishTest); // Publish to timetable
router.put('/:id', protect, authorize('exam_officer', 'super_admin'), updateTest); // Update test
router.delete('/:id', protect, authorize('exam_officer', 'super_admin'), deleteTest); // Delete test
router.post('/:id/add-students', protect, authorize('exam_officer', 'super_admin'), addStudentsToTest); // Add students
router.post('/:id/remove-students', protect, authorize('exam_officer', 'super_admin'), removeStudentsFromTest); // Remove students

// Get test details (students can view tests they're enrolled in)
router.get('/:id', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep'), getTestById); // Get test details

export default router;
