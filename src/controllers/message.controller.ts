import { Response } from 'express';
import Message from '../models/Message.model';
import User from '../models/User.model';
import { AuthRequest } from '../middleware/auth.middleware';

const findClassRepForStudent = async (userId: string) => {
  const student = await User.findById(userId).select('level courseOfStudy');
  if (!student) return null;
  return User.findOne({
    role: 'class_rep',
    level: student.level,
    courseOfStudy: student.courseOfStudy,
    isActive: true,
  }).select('_id fullName email');
};

export const sendMessageToSuperAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { subject, message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ success: false, message: 'Message text is required' });
      return;
    }

    const superAdmins = await User.find({ role: 'super_admin', isActive: true }).select('_id');
    if (!superAdmins.length) {
      res.status(500).json({ success: false, message: 'No super admin account found' });
      return;
    }

    const recipients = superAdmins.map((admin) => admin._id);
    const createdMessage = await Message.create({
      sender: req.user._id,
      recipients,
      subject: subject?.toString().trim() || 'Contact super admin',
      message: message.trim(),
    });

    res.status(201).json({ success: true, data: createdMessage, message: 'Message sent to super admin' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessageToClassRep = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }
    if (req.user.role !== 'student') {
      res.status(403).json({ success: false, message: 'Only students can contact a class rep' });
      return;
    }

    const { subject, message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ success: false, message: 'Message text is required' });
      return;
    }

    const classRep = await findClassRepForStudent(req.user._id.toString());
    if (!classRep) {
      res.status(404).json({ success: false, message: 'Class rep not found for your level and course' });
      return;
    }

    const createdMessage = await Message.create({
      sender: req.user._id,
      recipients: [classRep._id],
      subject: subject?.toString().trim() || 'Contact class rep',
      message: message.trim(),
    });

    res.status(201).json({ success: true, data: createdMessage, message: 'Message sent to class rep' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const replyToMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const currentUser = req.user; // ✅ narrowed to defined, TypeScript is happy from here down
    const { id } = req.params;
    const { subject, message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ success: false, message: 'Reply message is required' });
      return;
    }

    const originalMessage = await Message.findById(id);
    if (!originalMessage) {
      res.status(404).json({ success: false, message: 'Original message not found' });
      return;
    }

    const isSender = originalMessage.sender.equals(currentUser._id);
    const isRecipient = originalMessage.recipients.some((recipient) => recipient.equals(currentUser._id));
    if (!isSender && !isRecipient) {
      res.status(403).json({ success: false, message: 'You are not part of this conversation' });
      return;
    }

    const recipients = isSender
      ? originalMessage.recipients.filter((recipient) => !recipient.equals(currentUser._id))
      : [originalMessage.sender];

    if (!recipients.length) {
      res.status(400).json({ success: false, message: 'No valid recipient for reply' });
      return;
    }

    const reply = await Message.create({
      sender: currentUser._id,
      recipients,
      subject: subject?.toString().trim() || `Re: ${originalMessage.subject || 'Your message'}`,
      message: message.trim(),
      replyTo: originalMessage._id,
    });

    res.status(201).json({ success: true, data: reply, message: 'Reply sent successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { recipients: req.user._id }],
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'fullName email role')
      .populate('recipients', 'fullName email role');

    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
