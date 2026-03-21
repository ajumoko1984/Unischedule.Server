import { Response } from 'express';
import Assignment from '../models/Assignment.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const getAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { status } = req.query;
    const filter: Record<string, unknown> = { owner: req.user._id };
    if (status) filter.status = status;

    const assignments = await Assignment.find(filter).sort({ deadline: 1 });
    res.json({ success: true, data: assignments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const assignment = await Assignment.create({
      ...req.body,
      owner: req.user._id,
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
    });
    res.status(201).json({ success: true, data: assignment });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const assignment = await Assignment.findOne({ _id: req.params.id, owner: req.user._id });
    if (!assignment) { res.status(404).json({ success: false, message: 'Assignment not found' }); return; }

    Object.assign(assignment, req.body);
    if (req.body.status === 'completed' && !assignment.completedAt) {
      assignment.completedAt = new Date();
    }
    await assignment.save();

    res.json({ success: true, data: assignment });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    await Assignment.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const toggleComplete = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const assignment = await Assignment.findOne({ _id: req.params.id, owner: req.user._id });
    if (!assignment) { res.status(404).json({ success: false, message: 'Assignment not found' }); return; }

    if (assignment.status === 'completed') {
      assignment.status = 'pending';
      assignment.completedAt = undefined;
    } else {
      assignment.status = 'completed';
      assignment.completedAt = new Date();
    }
    await assignment.save();

    res.json({
      success: true,
      data: assignment,
      message: assignment.status === 'completed' ? '✅ Assignment marked as done!' : 'Assignment reopened',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};