import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  submitExamComplaint,
  getMyComplaints,
  getComplaints,
  acknowledgeComplaint,
  respondToComplaint,
  escalateComplaint,
  resolveComplaint,
  getEscalatedComplaints,
  getExamOfficerEscalatedComplaints,
  getComplaintDetails,
} from '../controllers/exam-complaint.controller';

const router = Router();

// Get complaint details (must be before other :id routes)
router.get('/:id', protect, getComplaintDetails);

// Student routes
router.post('/', protect, authorize('student'), submitExamComplaint); // Submit complaint
router.get('/my-complaints', protect, authorize('student'), getMyComplaints); // Get my complaints

// Class Rep routes
router.get('/class-rep/list', protect, authorize('class_rep'), getComplaints); // Get complaints for their level
router.post('/:id/acknowledge', protect, authorize('class_rep'), acknowledgeComplaint); // Take ownership
router.post('/:id/respond', protect, authorize('class_rep'), respondToComplaint); // Respond to student
router.post('/:id/escalate', protect, authorize('class_rep'), escalateComplaint); // Escalate to adviser/officer
router.post('/:id/resolve', protect, authorize('class_rep'), resolveComplaint); // Mark resolved

// Level Adviser routes
router.get('/level-adviser/escalated', protect, authorize('level_adviser'), getEscalatedComplaints); // View escalated complaints

// Exam Officer routes
router.get('/exam-officer/escalated', protect, authorize('exam_officer'), getExamOfficerEscalatedComplaints); // View escalated complaints

export default router;
