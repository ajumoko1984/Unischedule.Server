import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User.model';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../utils/mailer';
import { getFaculties, getDepartmentsByFaculty, isValidFacultyDepartment, getFacultyNameById } from '../config/faculties';

const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const expiresIn = process.env.JWT_EXPIRES_IN || '5h';
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

/**
 * Get all faculties (for dropdown)
 */
export const getFacultiesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const faculties = getFaculties();
    res.json({
      success: true,
      count: faculties.length,
      faculties,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get departments for a specific faculty
 */
export const getDepartmentsByFacultyId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { facultyId } = req.params;

    if (!facultyId) {
      res.status(400).json({ success: false, message: 'Faculty ID is required' });
      return;
    }

    const departments = getDepartmentsByFaculty(facultyId);

    if (!departments) {
      res.status(404).json({ success: false, message: 'Faculty not found' });
      return;
    }

    res.json({
      success: true,
      facultyId,
      count: departments.length,
      departments,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkRoleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, level, courseOfStudy } = req.query;

    if (!role) {
      res.status(400).json({ success: false, message: 'role is required' });
      return;
    }

    if (role === 'exam_officer') {
      // exam_officer doesn't require level and courseOfStudy
      const existing = await User.findOne({ role: 'exam_officer', email: req.query.email });
      res.json({
        success: true,
        available: !existing,
        message: existing ? 'An exam officer with this email already exists' : 'Exam officer role is available',
      });
      return;
    }

    if (!level || !courseOfStudy) {
      res.status(400).json({ success: false, message: 'level and courseOfStudy are required for this role' });
      return;
    }

    if (!['class_rep', 'level_adviser'].includes(role as string)) {
      res.status(400).json({ success: false, message: 'Only class_rep, level_adviser, and exam_officer can be checked' });
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

/**
 * PUBLIC ENDPOINT - Student Registration Only
 * Students register here. They are automatically linked to their Level Adviser
 * if one exists for their faculty+level+courseOfStudy
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, facultyId, level, courseOfStudy, matricNumber } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !facultyId || !level || !courseOfStudy) {
      res.status(400).json({ 
        success: false, 
        message: 'fullName, email, password, facultyId, level, and courseOfStudy are required' 
      });
      return;
    }

    // Validate facultyId and courseOfStudy are valid
    if (!isValidFacultyDepartment(facultyId, courseOfStudy)) {
      res.status(400).json({
        success: false,
        message: `Invalid department "${courseOfStudy}" for the selected faculty. Please select a valid department.`,
      });
      return;
    }

    // Get full faculty name from facultyId
    const facultyName = getFacultyNameById(facultyId);
    if (!facultyName) {
      res.status(400).json({ success: false, message: 'Invalid faculty selected' });
      return;
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Find Level Adviser for this faculty+level
    const levelAdviser = await User.findOne({
      role: 'level_adviser',
      facultyId,
      level,
    });

    const studentPayload: any = {
      fullName,
      email,
      password,
      role: 'student',
      faculty: facultyName,
      facultyId,
      level,
      courseOfStudy,
      matricNumber,
    };

    if (levelAdviser) {
      studentPayload.levelAdviserUserId = levelAdviser._id;
    }

    const user = await User.create(studentPayload);
    const token = generateToken(String(user._id));

    res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
      message: levelAdviser
        ? `Successfully registered as student. Linked to Level Adviser: ${levelAdviser.fullName}`
        : 'Successfully registered as student. No Level Adviser assigned yet.',
    });
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
  const resetUrl = `https://unischedule-two.vercel.app/reset-password/${resetToken}`;

    // Send email
    await sendPasswordResetEmail(user.email, {
      resetUrl,
      fullName: user.fullName
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

/**
 * Update user profile (name, matric number)
 */
export const updateProfile = async (req: Request & { user?: IUser }, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { fullName, matricNumber } = req.body;

    // Validate input
    if (!fullName && !matricNumber) {
      res.status(400).json({ success: false, message: 'At least one field must be provided (fullName or matricNumber)' });
      return;
    }

    // Only update provided fields
    if (fullName) {
      req.user.fullName = fullName.trim();
    }
    if (matricNumber) {
      req.user.matricNumber = matricNumber.trim();
    }

    await req.user.save();

    console.log(`✅ Profile updated for user: ${req.user.email}`);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUser(req.user)
    });

  } catch (error: any) {
    console.error('❌ Error updating profile:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update user email
 */
export const updateEmail = async (req: Request & { user?: IUser }, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { newEmail, password } = req.body;

    // Validate input
    if (!newEmail || !password) {
      res.status(400).json({ success: false, message: 'New email and password are required' });
      return;
    }

    // Verify password
    const isMatch = await req.user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid password' });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser && String(existingUser._id) !== String(req.user._id)) {
      res.status(400).json({ success: false, message: 'This email is already in use' });
      return;
    }

    req.user.email = newEmail.toLowerCase().trim();
    await req.user.save();

    console.log(`✅ Email updated for user: ${req.user._id}`);
    res.json({
      success: true,
      message: 'Email updated successfully',
      user: sanitizeUser(req.user)
    });

  } catch (error: any) {
    console.error('❌ Error updating email:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request & { user?: IUser }, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, message: 'Current password, new password, and confirmation are required' });
      return;
    }

    // Verify current password
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'New passwords do not match' });
      return;
    }

    // Check new password is different from current
    const isSamePassword = await req.user.comparePassword(newPassword);
    if (isSamePassword) {
      res.status(400).json({ success: false, message: 'New password must be different from current password' });
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      return;
    }

    // Update password
    req.user.password = newPassword;
    await req.user.save();

    console.log(`✅ Password changed for user: ${req.user.email}`);
    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    console.error('❌ Error changing password:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ADMIN: Create users with any role (Level Adviser, Exam Officer, Class Rep, etc.)
 * Only super_admin can create privileged role users
 */
export const createUser = async (req: Request & { user?: IUser }, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Only super admins can create users' });
      return;
    }

    const { fullName, email, password, role, facultyId, level, courseOfStudy, matricNumber } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !role) {
      res.status(400).json({ 
        success: false, 
        message: 'fullName, email, password, and role are required' 
      });
      return;
    }

    // Validate role
    const validRoles: UserRole[] = ['super_admin', 'level_adviser', 'exam_officer', 'class_rep', 'lecturer', 'student'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    // Validate role-specific requirements
    if (role === 'level_adviser') {
      if (!facultyId || !level) {
        res.status(400).json({ 
          success: false, 
          message: 'Faculty ID and level are required for Level Adviser role' 
        });
        return;
      }
    }

    if (role === 'exam_officer') {
      if (!facultyId) {
        res.status(400).json({ 
          success: false, 
          message: 'Faculty ID is required for Exam Officer role' 
        });
        return;
      }
    }

    if (role === 'class_rep' || role === 'student') {
      if (!facultyId || !level || !courseOfStudy) {
        res.status(400).json({ 
          success: false, 
          message: 'Faculty ID, level, and course of study are required for this role' 
        });
        return;
      }
    }

    // For lecturer: require facultyId so they can be assigned as invigilators/supervisors
    if (role === 'lecturer') {
      if (!facultyId) {
        res.status(400).json({ 
          success: false, 
          message: 'Faculty ID is required for Lecturer role' 
        });
        return;
      }
    }

    // Validate facultyId and courseOfStudy (if needed)
    if (courseOfStudy && facultyId) {
      if (!isValidFacultyDepartment(facultyId, courseOfStudy)) {
        res.status(400).json({
          success: false,
          message: `Invalid department "${courseOfStudy}" for the selected faculty.`,
        });
        return;
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already in use' });
      return;
    }

    // For level_adviser: check if one already exists
    if (role === 'level_adviser') {
      const existingLA = await User.findOne({ role: 'level_adviser', facultyId, level });
      if (existingLA) {
        res.status(409).json({
          success: false,
          message: `A Level Adviser already exists for this faculty and level`,
          existingAdviser: sanitizeUser(existingLA)
        });
        return;
      }
    }

    // For class_rep: check if one already exists
    if (role === 'class_rep') {
      const existingRep = await User.findOne({ role: 'class_rep', level, courseOfStudy });
      if (existingRep) {
        res.status(409).json({
          success: false,
          message: `A class representative already exists for this level and course`,
          existingRep: sanitizeUser(existingRep)
        });
        return;
      }
    }

    // Get full faculty name
    const facultyName = facultyId ? getFacultyNameById(facultyId) : null;

    // Create the user
    const user = await User.create({
      fullName,
      email,
      password,
      role,
      faculty: facultyName || undefined,
      facultyId,
      level: role === 'exam_officer' || role === 'lecturer' ? undefined : level,
      courseOfStudy: role === 'exam_officer' || role === 'lecturer' ? undefined : courseOfStudy,
      matricNumber,
    });

    res.status(201).json({
      success: true,
      message: `${role.replace('_', ' ')} created successfully`,
      user: sanitizeUser(user),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};