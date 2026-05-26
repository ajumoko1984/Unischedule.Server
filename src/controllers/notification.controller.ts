import { Response } from 'express';
import Notification from '../models/Notification.model';
import User from '../models/User.model';
import { sendAnnouncementEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';
import { getNotificationRecipientEmails, resolveNotificationScope } from '../utils/notificationHelper';

const normalizeNotificationType = (type?: string) => {
  const normalized = type ? type.toString().trim().toLowerCase() : '';
  if (['venue_change', 'new_event', 'reminder', 'announcement', 'cancellation'].includes(normalized)) {
    return normalized;
  }
  if (normalized === 'exam_update') {
    return 'new_event';
  }
  return 'announcement';
};

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (req.user && req.user.role !== 'super_admin') {
      if (req.user.role === 'exam_officer') {
        if (req.user.faculty) filter.faculty = req.user.faculty;
      } else {
        filter.faculty = req.user.faculty;
        filter.level = req.user.level;
        filter.courseOfStudy = req.user.courseOfStudy;
      }
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
    if (!subject || !message) {
      res.status(400).json({ success: false, message: 'subject and message are required' });
      return;
    }

    const scope = resolveNotificationScope(req);
    const emails = await getNotificationRecipientEmails(scope);

    if (emails.length > 0) {
      await sendAnnouncementEmail(emails, {
        subject,
        message,
        sentBy: req.user.fullName,
        faculty: scope.faculty || req.user.faculty || 'University',
        level: scope.level || '',
        courseOfStudy: scope.courseOfStudy || '',
      });
    }

    const notification = await Notification.create({
      type: 'announcement',
      subject,
      message,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: scope.faculty || req.user.faculty || 'University',
      level: scope.level,
      courseOfStudy: scope.courseOfStudy,
      isAutomatic: false,
      deliveryStatus: emails.length > 0 ? 'sent' : 'pending',
    });

    res.status(201).json({ success: true, data: notification, message: `Announcement sent to ${emails.length} student${emails.length !== 1 ? 's' : ''}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendCourseNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { subject, message, courseCode, type } = req.body;
    if (!subject || !message || !courseCode) {
      res.status(400).json({ success: false, message: 'subject, message and courseCode are required' });
      return;
    }

    const scope = resolveNotificationScope(req);
    const emails = await getNotificationRecipientEmails(scope);

    if (emails.length > 0) {
      await sendAnnouncementEmail(emails, {
        subject,
        message,
        sentBy: req.user.fullName,
        faculty: scope.faculty || req.user.faculty || 'University',
        level: scope.level || '',
        courseOfStudy: scope.courseOfStudy || '',
      });
    }

    const notification = await Notification.create({
      type: normalizeNotificationType(type),
      subject,
      message,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: scope.faculty || req.user.faculty || 'University',
      level: scope.level,
      courseOfStudy: scope.courseOfStudy,
      isAutomatic: false,
      deliveryStatus: emails.length > 0 ? 'sent' : 'pending',
    });

    res.status(201).json({ success: true, data: notification, message: `Course notification sent to ${emails.length} student${emails.length !== 1 ? 's' : ''}` });
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

    const scope = resolveNotificationScope(req);
    const emails = await getNotificationRecipientEmails(scope);

    if (emails.length > 0) {
      await sendAnnouncementEmail(emails, {
        subject,
        message,
        sentBy: req.user.fullName,
        faculty: scope.faculty || req.user.faculty || 'University',
        level: scope.level || '',
        courseOfStudy: scope.courseOfStudy || '',
      });
    }

    await Notification.create({
      type: normalizeNotificationType(type) || 'reminder',
      subject,
      message,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: scope.faculty || req.user.faculty || 'University',
      level: scope.level,
      courseOfStudy: scope.courseOfStudy,
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