import { Response } from 'express';
import Notification from '../models/Notification.model';
import User from '../models/User.model';
import { sendAnnouncementEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user && req.user.role !== 'super_admin') {
      filter.level = req.user.level;
      filter.courseOfStudy = req.user.courseOfStudy;
    }
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sentBy', 'fullName role');
    res.json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { subject, message } = req.body;
    const students = await User.find({
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      role: { $in: ['student', 'class_rep'] },
      isActive: true,
    }).select('email');

    console.log(students);

    const emails = students.map(s => s.email);

    if (emails.length > 0) {
      await sendAnnouncementEmail(emails, {
        subject,
        message,
        sentBy: req.user.fullName,
        faculty: req.user.faculty,
        level: req.user.level,
      });
    }

    const notification = await Notification.create({
      type: 'announcement',
      subject,
      message,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: req.user.faculty,
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      isAutomatic: false,
      deliveryStatus: emails.length > 0 ? 'sent' : 'pending',
    });

    res.status(201).json({ success: true, data: notification, message: `Announcement sent to ${emails.length} students` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Notify students about a specific timetable slot or event ─────────────────
export const sendTimetableNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const {
      subject,       // e.g. "Reminder: EDT 401 lecture tomorrow"
      message,       // full body text
      type,          // 'reminder' | 'new_event' | 'announcement'
      courseCode,
      courseTitle,
      venue,
      day,
      time,
    } = req.body;

    if (!subject || !message) {
      res.status(400).json({ success: false, message: 'subject and message are required' });
      return;
    }

    // Always scoped to the sender's own level + course
    const students = await User.find({
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      role: { $in: ['student', 'class_rep'] },
      isActive: true,
    }).select('email');

    const emails = students.map(s => s.email);

    if (emails.length > 0) {
      // Reuse the announcement email template — it handles any freeform message
      await sendAnnouncementEmail(emails, {
        subject,
        message,
        sentBy: req.user.fullName,
        faculty: req.user.faculty,
        level: req.user.level

      });
    }

    await Notification.create({
      type: type || 'reminder',
      subject,
      message,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: req.user.faculty,
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      isAutomatic: false,
      deliveryStatus: emails.length > 0 ? 'sent' : 'pending',
    });

    res.status(201).json({
      success: true,
      message: `Notification sent to ${emails.length} student${emails.length !== 1 ? 's' : ''}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};