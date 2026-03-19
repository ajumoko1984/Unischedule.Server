import { Response } from 'express';
import Event from '../models/Event.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendEventReminderEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';

export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, status, upcoming } = req.query;
    const filter: Record<string, unknown> = {};

    if (req.user && req.user.role !== 'super_admin') {
      filter.level = req.user.level;
      filter.courseOfStudy = req.user.courseOfStudy;
    }

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (upcoming === 'true') {
      filter.date = { $gte: new Date() };
      filter.status = 'upcoming';
    }

    const events = await Event.find(filter).sort({ date: 1 }).populate('createdBy', 'fullName role');
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const event = await Event.create({ ...req.body, createdBy: req.user._id });

    // Optionally send email immediately if requested
    if (req.body.sendEmailNow) {
      const students = await User.find({
        level: event.level,
        courseOfStudy: event.courseOfStudy,
        role: 'student',
        isActive: true,
      }).select('email');

      const emails = students.map(s => s.email);

      if (emails.length > 0) {
        const dateStr = event.date.toLocaleDateString('en-NG', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        await sendEventReminderEmail(emails, {
          title: event.title,
          courseCode: event.courseCode,
          courseTitle: event.courseTitle,
          category: event.category,
          date: dateStr,
          time: event.startTime,
          venue: event.venue,
          description: event.description,
          faculty: event.faculty,
          level: event.level,
          courseOfStudy: event.courseOfStudy,
        });

        await Notification.create({
          type: 'new_event',
          subject: `New ${event.category}: ${event.title}`,
          message: `${event.category} scheduled for ${dateStr} at ${event.startTime}`,
          recipients: emails,
          recipientCount: emails.length,
          sentBy: req.user._id,
          faculty: event.faculty,
          level: event.level,
          courseOfStudy: event.courseOfStudy,
          relatedEvent: event._id,
          isAutomatic: false,
          deliveryStatus: 'sent',
        });

        event.emailSent = true;
        event.emailSentAt = new Date();
        await event.save();
      }
    }

    res.status(201).json({ success: true, data: event });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const sendManualReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const event = await Event.findById(req.params.id);
    if (!event) { res.status(404).json({ success: false, message: 'Event not found' }); return; }

    const students = await User.find({
      level: event.level,
      courseOfStudy: event.courseOfStudy,
      role: 'student',
      isActive: true,
    }).select('email');

    const emails = students.map(s => s.email);
    if (emails.length === 0) {
      res.json({ success: true, message: 'No students to notify' });
      return;
    }

    const dateStr = event.date.toLocaleDateString('en-NG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await sendEventReminderEmail(emails, {
      title: event.title,
      courseCode: event.courseCode,
      courseTitle: event.courseTitle,
      category: event.category,
      date: dateStr,
      time: event.startTime,
      venue: event.venue,
      description: event.description,
      faculty: event.faculty,
      level: event.level,
      courseOfStudy: event.courseOfStudy,
    });

    await Notification.create({
      type: 'reminder',
      subject: `Reminder: ${event.title}`,
      message: `Manual reminder sent for ${event.courseCode}`,
      recipients: emails,
      recipientCount: emails.length,
      sentBy: req.user._id,
      faculty: event.faculty,
      level: event.level,
      courseOfStudy: event.courseOfStudy,
      relatedEvent: event._id,
      isAutomatic: false,
      deliveryStatus: 'sent',
    });

    res.json({ success: true, message: `Reminder sent to ${emails.length} students` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};