import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  createExam,
  getMyExams,
  getExamById,
  updateExam,
  deleteExam,
  addStudentsToExam,
  removeStudentsFromExam,
  publishExam,
  getExamCalendar,
  getExamsByCourse,
  bulkImportExamsJson,
  bulkImportExamsCsv,
} from '../controllers/exam.controller';

const router = Router();

// Public routes (no auth needed)
router.get('/course', getExamsByCourse); // Students: Get exams by course (timetable view)

// Student & Exam Officer routes (both can view their exams)
router.get('/my-exams', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep', 'lecturer'), getMyExams); // Get enrolled/created exams
router.get('/calendar', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep', 'lecturer'), getExamCalendar); // Calendar events

// Exam Officer routes (only exam_officer and super_admin can create/manage)
router.post('/', protect, authorize('exam_officer', 'super_admin'), createExam); // Create exam/test
router.post('/bulk/json', protect, authorize('exam_officer', 'super_admin'), bulkImportExamsJson); // Bulk import from JSON
router.post('/bulk/csv', protect, authorize('exam_officer', 'super_admin'), bulkImportExamsCsv); // Bulk import from CSV
router.post('/:id/publish', protect, authorize('exam_officer', 'super_admin'), publishExam); // Publish to timetable
router.put('/:id', protect, authorize('exam_officer', 'super_admin'), updateExam); // Update exam
router.delete('/:id', protect, authorize('exam_officer', 'super_admin'), deleteExam); // Delete exam
router.post('/:id/add-students', protect, authorize('exam_officer', 'super_admin'), addStudentsToExam); // Add students
router.post('/:id/remove-students', protect, authorize('exam_officer', 'super_admin'), removeStudentsFromExam); // Remove students

// Get exam details (students can view exams they're enrolled in)
router.get('/:id', protect, authorize('student', 'exam_officer', 'super_admin', 'class_rep'), getExamById); // Get exam details

export default router;
