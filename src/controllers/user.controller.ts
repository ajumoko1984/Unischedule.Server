import { Response } from 'express';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Get all users (scoped by role) ───────────────────────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, level, courseOfStudy } = req.query;
    const filter: Record<string, unknown> = {};

    // Level adviser sees only their own level + course
    if (req.user?.role === 'level_adviser') {
      filter.level = req.user.level;
      filter.courseOfStudy = req.user.courseOfStudy;
    } else {
      if (role) filter.role = role;
      if (level) filter.level = level;
      if (courseOfStudy) filter.courseOfStudy = courseOfStudy;
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Create user (super admin only) ───────────────────────────────────────────
export const createUserByAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role, faculty, level, courseOfStudy, matricNumber } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Enforce one level_adviser per level+course
    if (role === 'level_adviser') {
      const exists = await User.findOne({ role: 'level_adviser', level, courseOfStudy });
      if (exists) {
        res.status(400).json({
          success: false,
          message: `A Level Adviser already exists for ${courseOfStudy} – ${level} Level`,
        });
        return;
      }
    }

    const user = await User.create({ fullName, email, password, role, faculty, level, courseOfStudy, matricNumber });
    const { password: _, ...safeUser } = user.toObject();
    res.status(201).json({ success: true, data: safeUser });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── Update user ───────────────────────────────────────────────────────────────
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, ...updateData } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── Toggle active status ──────────────────────────────────────────────────────
export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    user.isActive = !user.isActive;
    await user.save();
    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      data: { isActive: user.isActive },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── Delete user ───────────────────────────────────────────────────────────────
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ── Get students for a level+course (used by assign-rep dropdown) ─────────────
export const getStudentsForLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const level = req.query.level as string | undefined;
    const courseOfStudy = req.query.courseOfStudy as string | undefined;

    // Level adviser: always scoped to their own level — ignore query params
    const targetLevel = req.user?.role === 'level_adviser' ? req.user.level : level;
    const targetCourse = req.user?.role === 'level_adviser' ? req.user.courseOfStudy : courseOfStudy;

    if (!targetLevel || !targetCourse) {
      res.status(400).json({ success: false, message: 'level and courseOfStudy are required' });
      return;
    }

    const [students, currentRep] = await Promise.all([
      User.find({ level: targetLevel, courseOfStudy: targetCourse, role: 'student', isActive: true })
        .select('-password')
        .sort({ fullName: 1 }),
      User.findOne({ level: targetLevel, courseOfStudy: targetCourse, role: 'class_rep' })
        .select('-password'),
    ]);

    res.json({ success: true, data: { students, currentRep } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Assign class rep ──────────────────────────────────────────────────────────
export const assignClassRep = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { studentId } = req.body;
    if (!studentId) {
      res.status(400).json({ success: false, message: 'studentId is required' });
      return;
    }

    const student = await User.findById(studentId);
    if (!student) { res.status(404).json({ success: false, message: 'Student not found' }); return; }
    if (student.role !== 'student') {
      res.status(400).json({ success: false, message: 'Only a student can be assigned as class rep' });
      return;
    }

    // Level adviser can only assign within their own level + course
    if (req.user.role === 'level_adviser') {
      if (student.level !== req.user.level || student.courseOfStudy !== req.user.courseOfStudy) {
        res.status(403).json({
          success: false,
          message: 'You can only assign a class rep within your own level and course of study',
        });
        return;
      }
    }

    // Demote existing class rep (if any) back to student
    const existingRep = await User.findOne({
      role: 'class_rep',
      level: student.level,
      courseOfStudy: student.courseOfStudy,
    });
    if (existingRep) {
      existingRep.role = 'student';
      await existingRep.save();
    }

    // Promote selected student
    student.role = 'class_rep';
    await student.save();

    const { password: _, ...safeStudent } = student.toObject();
    res.json({
      success: true,
      message: `${student.fullName} has been assigned as Class Rep${
        existingRep ? `. ${existingRep.fullName} has been returned to Student.` : '.'
      }`,
      data: safeStudent,
      demoted: existingRep ? { _id: existingRep._id, fullName: existingRep.fullName } : null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Revoke class rep → back to student ───────────────────────────────────────
export const revokeClassRep = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const rep = await User.findById(req.params.id);
    if (!rep) { res.status(404).json({ success: false, message: 'User not found' }); return; }
    if (rep.role !== 'class_rep') {
      res.status(400).json({ success: false, message: 'This user is not a class rep' });
      return;
    }

    // Level adviser scope check
    if (req.user.role === 'level_adviser') {
      if (rep.level !== req.user.level || rep.courseOfStudy !== req.user.courseOfStudy) {
        res.status(403).json({ success: false, message: 'You can only manage class reps in your own level' });
        return;
      }
    }

    rep.role = 'student';
    await rep.save();

    res.json({
      success: true,
      message: `${rep.fullName}'s class rep role has been revoked. They are now a Student.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Dashboard stats ───────────────────────────────────────────────────────────
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Event = (await import('../models/Event.model')).default;
    const Notification = (await import('../models/Notification.model')).default;

    const filter: Record<string, unknown> = {};
    if (req.user && req.user.role !== 'super_admin') {
      filter.level = req.user.level;
      filter.courseOfStudy = req.user.courseOfStudy;
    }

    const [totalStudents, upcomingTests, upcomingExams, recentNotifications] = await Promise.all([
      User.countDocuments({ ...filter, role: 'student', isActive: true }),
      Event.countDocuments({ ...filter, category: 'test', status: 'upcoming' }),
      Event.countDocuments({ ...filter, category: 'exam', status: 'upcoming' }),
      Notification.find(filter).sort({ createdAt: -1 }).limit(5).populate('sentBy', 'fullName role'),
    ]);

    res.json({ success: true, data: { totalStudents, upcomingTests, upcomingExams, recentNotifications } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};