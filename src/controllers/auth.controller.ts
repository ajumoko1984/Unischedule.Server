import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser } from '../models/User.model';
import crypto from 'crypto';
import { sendAnnouncementEmail } from '../utils/mailer';

const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id }, secret, { expiresIn } as any);
};

const sanitizeUser = (user: IUser) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  faculty: user.faculty,
  level: user.level,
  courseOfStudy: user.courseOfStudy,
  matricNumber: user.matricNumber,
});

export const checkRoleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, level, courseOfStudy } = req.query;

    if (!role || !level || !courseOfStudy) {
      res.status(400).json({ success: false, message: 'role, level, and courseOfStudy are required' });
      return;
    }

    if (!['class_rep', 'level_adviser'].includes(role as string)) {
      res.status(400).json({ success: false, message: 'Only class_rep and level_adviser can be checked' });
      return;
    }

    const existing = await User.findOne({ role, level, courseOfStudy });
    res.json({
      success: true,
      available: !existing,
      message: existing
        ? `A ${(role as string).replace('_', ' ')} already exists for ${courseOfStudy} – ${level} Level`
        : `This role is available for ${courseOfStudy} – ${level} Level`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role, faculty, level, courseOfStudy, matricNumber } = req.body;

    // super_admin can never be self-registered
    if (role === 'super_admin') {
      res.status(403).json({ success: false, message: 'Super Admin accounts cannot be self-registered' });
      return;
    }

    if (!faculty || !level || !courseOfStudy) {
  res.status(400).json({ success: false, message: 'Faculty, level, and courseOfStudy are required' });
  return;
}
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    // For class_rep and level_adviser: only allow if slot is still vacant
    let assignedRole = 'student';
    if (role === 'class_rep' || role === 'level_adviser') {
      if (!level || !courseOfStudy) {
        res.status(400).json({ success: false, message: 'Level and course of study are required to claim this role' });
        return;
      }
      const slotTaken = await User.findOne({ role, level, courseOfStudy });
      if (slotTaken) {
        res.status(409).json({
          success: false,
          message: `A ${role.replace('_', ' ')} already exists for ${courseOfStudy} – ${level} Level. You have been registered as a student instead.`,
          registeredAs: 'student',
        });
        return;
      }
      assignedRole = role;
    }

    const user = await User.create({
      fullName, email, password,
      role: assignedRole,
      faculty, level, courseOfStudy, matricNumber,
    });
    const token = generateToken(String(user._id));

    res.status(201).json({ success: true, token, user: sanitizeUser(user) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ success: false, message: 'Account has been deactivated' });
      return;
    }

    const token = generateToken(String(user._id));
    res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
};

export const getMe = async (req: Request & { user?: IUser }, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }
    res.json({ success: true, user: sanitizeUser(req.user) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ success: false, message: 'No user with this email' });
      return;
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash token (for DB)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await user.save();

    // Create reset URL
    const resetUrl = `https://unischedule.vercel.app/reset-password/${resetToken}`;

    // Send email
    await sendAnnouncementEmail([user.email], {
      subject: 'Password Reset',
      message: `Click to reset your password: ${resetUrl}`,
      sentBy: 'UniSchedule',
      faculty: '',
      level: ''
    });

    res.json({ success: true, message: 'Reset link sent to email' });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash incoming token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    // Set new password
    user.password = password;
   user.resetPasswordToken = undefined as any;
user.resetPasswordExpire = undefined as any;

    await user.save();

    res.json({ success: true, message: 'Password reset successful' });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};