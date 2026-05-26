import { Request, Response } from 'express';
import ExamComplaint, { IExamComplaint } from '../models/ExamComplaint.model';
import Exam from '../models/Exam.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Student: Submit exam complaint
 */
export const submitExamComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'student') {
      res.status(403).json({ success: false, message: 'Only students can submit complaints' });
      return;
    }

    const { examId, category, title, description, priority } = req.body;

    if (!examId || !category || !title || !description) {
      res.status(400).json({ success: false, message: 'Missing required fields' });
      return;
    }

    // Verify exam exists and student is registered for it
    const exam = await Exam.findById(examId);
    if (!exam) {
      res.status(404).json({ success: false, message: 'Exam not found' });
      return;
    }

    if (!exam.students.includes(req.user._id)) {
      res.status(403).json({ success: false, message: 'You are not registered for this exam' });
      return;
    }

    // Check if complaint already exists for this exam
    const existingComplaint = await ExamComplaint.findOne({
      studentId: req.user._id,
      examId,
      status: { $nin: ['resolved', 'closed'] },
    });

    if (existingComplaint) {
      res.status(400).json({
        success: false,
        message: 'You already have an active complaint for this exam',
      });
      return;
    }

    const complaint = await ExamComplaint.create({
      studentId: req.user._id,
      examId,
      category,
      title,
      description,
      priority: priority || 'medium',
    });

    await complaint.populate('studentId', 'fullName email matricNumber');
    await complaint.populate('examId', 'title courseCode');

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully. Your class rep will review it.',
      complaint,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Student: Get their own complaints
 */
export const getMyComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'student') {
      res.status(403).json({ success: false, message: 'Only students can view their complaints' });
      return;
    }

    const { status } = req.query;
    const filter: any = { studentId: req.user._id };

    if (status) filter.status = status;

    const complaints = await ExamComplaint.find(filter)
      .populate('examId', 'title courseCode scheduleDate venue')
      .populate('classRepId', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Class Rep: Get complaints from their level/course
 */
export const getComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'class_rep') {
      res.status(403).json({ success: false, message: 'Only class reps can access this' });
      return;
    }

    const { status, priority, category } = req.query;

    // Get students in the same level and course
    const students = await User.find({
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      role: 'student',
    });

    const studentIds = students.map((s) => s._id);

    const filter: any = { studentId: { $in: studentIds } };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    const complaints = await ExamComplaint.find(filter)
      .populate('studentId', 'fullName email matricNumber')
      .populate('examId', 'title courseCode scheduleDate venue')
      .populate('classRepId', 'fullName email')
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Class Rep: Acknowledge complaint
 */
export const acknowledgeComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'class_rep') {
      res.status(403).json({ success: false, message: 'Only class reps can acknowledge complaints' });
      return;
    }

    const complaint = await ExamComplaint.findById(req.params.id);

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    // Verify class rep is from the same level/course as the student
    const student = await User.findById(complaint.studentId);
    if (
      student?.level !== req.user.level ||
      student?.courseOfStudy !== req.user.courseOfStudy
    ) {
      res.status(403).json({
        success: false,
        message: 'You can only handle complaints from your level and course',
      });
      return;
    }

    complaint.status = 'acknowledged';
    complaint.classRepId = req.user._id;
    await complaint.save();

    await complaint.populate('studentId', 'fullName email');
    await complaint.populate('examId', 'title courseCode');

    res.json({
      success: true,
      message: 'Complaint acknowledged. You are now handling this.',
      complaint,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Class Rep: Respond to complaint
 */
export const respondToComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'class_rep') {
      res.status(403).json({ success: false, message: 'Only class reps can respond to complaints' });
      return;
    }

    const { response } = req.body;

    if (!response) {
      res.status(400).json({ success: false, message: 'Response text is required' });
      return;
    }

    const complaint = await ExamComplaint.findById(req.params.id);

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    const isSuperAdmin = req.user && 'role' in req.user && (req.user as any).role === 'super_admin';
    if (complaint.classRepId?.toString() !== req.user._id.toString() && !isSuperAdmin) {
      res.status(403).json({ success: false, message: 'You are not handling this complaint' });
      return;
    }

    complaint.classRepResponse = response;
    complaint.classRepResponseDate = new Date();
    complaint.status = 'acknowledged';
    await complaint.save();

    await complaint.populate('studentId', 'fullName email');
    await complaint.populate('examId', 'title courseCode');

    res.json({
      success: true,
      message: 'Response sent to student',
      complaint,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Class Rep: Escalate complaint to Level Adviser or Exam Officer
 */
export const escalateComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'class_rep') {
      res.status(403).json({ success: false, message: 'Only class reps can escalate complaints' });
      return;
    }

    const { escalateTo, reason } = req.body;

    if (!escalateTo || !['level_adviser', 'exam_officer'].includes(escalateTo)) {
      res.status(400).json({
        success: false,
        message: 'escalateTo must be "level_adviser" or "exam_officer"',
      });
      return;
    }

    if (!reason) {
      res.status(400).json({ success: false, message: 'Escalation reason is required' });
      return;
    }

    const complaint = await ExamComplaint.findById(req.params.id);

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    const isSuperAdmin = req.user && 'role' in req.user && (req.user as any).role === 'super_admin';
    if (complaint.classRepId?.toString() !== req.user._id.toString() && !isSuperAdmin) {
      res.status(403).json({ success: false, message: 'You are not handling this complaint' });
      return;
    }

    complaint.status = 'escalated';
    complaint.escalatedTo = escalateTo;
    complaint.escalationReason = reason;

    if (escalateTo === 'level_adviser') {
      complaint.levelAdviserNotified = true;
    } else {
      complaint.examOfficerNotified = true;
    }

    await complaint.save();

    await complaint.populate('studentId', 'fullName email');
    await complaint.populate('examId', 'title courseCode');

    res.json({
      success: true,
      message: `Complaint escalated to ${escalateTo === 'level_adviser' ? 'Level Adviser' : 'Exam Officer'}`,
      complaint,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Class Rep: Mark complaint as resolved
 */
export const resolveComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'class_rep') {
      res.status(403).json({ success: false, message: 'Only class reps can resolve complaints' });
      return;
    }

    const { resolution } = req.body;

    if (!resolution) {
      res.status(400).json({ success: false, message: 'Resolution details are required' });
      return;
    }

    const complaint = await ExamComplaint.findById(req.params.id);

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    const isSuperAdmin = req.user && 'role' in req.user && (req.user as any).role === 'super_admin';
    if (complaint.classRepId?.toString() !== req.user._id.toString() && !isSuperAdmin) {
      res.status(403).json({ success: false, message: 'You are not handling this complaint' });
      return;
    }

    complaint.status = 'resolved';
    complaint.resolution = resolution;
    complaint.resolvedDate = new Date();
    await complaint.save();

    await complaint.populate('studentId', 'fullName email');
    await complaint.populate('examId', 'title courseCode');

    res.json({
      success: true,
      message: 'Complaint marked as resolved',
      complaint,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Level Adviser: Get escalated complaints for their level
 */
export const getEscalatedComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'level_adviser') {
      res.status(403).json({ success: false, message: 'Only level advisers can access this' });
      return;
    }

    const filter: any = {
      status: 'escalated',
      escalatedTo: 'level_adviser',
      levelAdviserNotified: true,
    };

    // Get students from their level
    const students = await User.find({
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      role: 'student',
    });

    const studentIds = students.map((s) => s._id);
    filter.studentId = { $in: studentIds };

    const complaints = await ExamComplaint.find(filter)
      .populate('studentId', 'fullName email matricNumber')
      .populate('examId', 'title courseCode scheduleDate')
      .populate('classRepId', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Exam Officer: Get escalated complaints
 */
export const getExamOfficerEscalatedComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'exam_officer') {
      res.status(403).json({ success: false, message: 'Only exam officers can access this' });
      return;
    }

    const filter: any = {
      status: 'escalated',
      escalatedTo: 'exam_officer',
      examOfficerNotified: true,
    };

    const complaints = await ExamComplaint.find(filter)
      .populate('studentId', 'fullName email matricNumber')
      .populate('examId', 'title courseCode scheduleDate')
      .populate('classRepId', 'fullName email')
      .sort({ priority: -1, createdAt: -1 });

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single complaint details
 */
export const getComplaintDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const complaint = await ExamComplaint.findById(req.params.id)
      .populate('studentId', 'fullName email matricNumber')
      .populate('examId', 'title courseCode scheduleDate venue startTime endTime invigilators')
      .populate('classRepId', 'fullName email');

    if (!complaint) {
      res.status(404).json({ success: false, message: 'Complaint not found' });
      return;
    }

    // Authorization check
    if (req.user.role === 'student' && complaint.studentId._id.toString() !== req.user._id.toString()) {
      res.status(403).json({ success: false, message: 'Not authorized to view this complaint' });
      return;
    }

    if (
      req.user.role === 'class_rep' &&
      complaint.classRepId?.toString() !== req.user._id.toString()
    ) {
      const student = await User.findById(complaint.studentId);
      if (student?.level !== req.user.level || student?.courseOfStudy !== req.user.courseOfStudy) {
        res.status(403).json({ success: false, message: 'Not authorized to view this complaint' });
        return;
      }
    }

    res.json({ success: true, complaint });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
