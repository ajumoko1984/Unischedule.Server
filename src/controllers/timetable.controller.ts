import { Response } from 'express';
import Timetable from '../models/Timetable.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendVenueChangeEmail } from '../utils/mailer';
import { AuthRequest } from '../middleware/auth.middleware';

export const getTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, courseOfStudy, faculty, semester, academicYear } = req.query;
    const filter: Record<string, unknown> = { isActive: true };

    if (req.user && req.user.role !== 'super_admin') {
      // Non-admins ALWAYS see only their own faculty + level + courseOfStudy
      filter.faculty = req.user.faculty;
      filter.level = req.user.level;
      filter.courseOfStudy = req.user.courseOfStudy;
    } else {
      // Super admin can filter by query params
      if (faculty) filter.faculty = faculty;
      if (level) filter.level = level;
      if (courseOfStudy) filter.courseOfStudy = courseOfStudy;
    }

    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;

    const timetables = await Timetable.find(filter).populate('createdBy', 'fullName role');
    res.json({ success: true, data: timetables });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    // Always stamp the creator's own faculty/level/courseOfStudy — never trust the request body for these
    const timetable = await Timetable.create({
      ...req.body,
      faculty: req.user.faculty,
      level: req.user.level,
      courseOfStudy: req.user.courseOfStudy,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: timetable });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const timetable = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!timetable) { res.status(404).json({ success: false, message: 'Timetable not found' }); return; }

    res.json({ success: true, data: timetable });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateVenue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { timetableId, slotId, newVenue, reason } = req.body;
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) { res.status(404).json({ success: false, message: 'Timetable not found' }); return; }

    const slot = timetable.slots.find(s => String(s._id) === slotId);
    if (!slot) { res.status(404).json({ success: false, message: 'Slot not found' }); return; }

    const oldVenue = slot.venue;
    // Push to history
    slot.venueHistory.push({ venue: oldVenue, changedBy: req.user.fullName, changedAt: new Date(), reason });
    slot.venue = newVenue;
    await timetable.save();

    // Notify all students
    const students = await User.find({
      level: timetable.level,
      courseOfStudy: timetable.courseOfStudy,
      role: 'student',
      isActive: true,
    }).select('email');

    const emails = students.map(s => s.email);

    if (emails.length > 0) {
      await sendVenueChangeEmail(emails, {
        courseCode: slot.courseCode,
        courseTitle: slot.courseTitle,
        oldVenue,
        newVenue,
        day: slot.day,
        time: `${slot.startTime} – ${slot.endTime}`,
        changedBy: req.user.fullName,
        reason,
        faculty: timetable.faculty,
        level: timetable.level,
        courseOfStudy: timetable.courseOfStudy,
      });

      await Notification.create({
        type: 'venue_change',
        subject: `Venue Change: ${slot.courseCode} – ${slot.day}`,
        message: `Venue changed from ${oldVenue} to ${newVenue}`,
        recipients: emails,
        recipientCount: emails.length,
        sentBy: req.user._id,
        faculty: timetable.faculty,
        level: timetable.level,
        courseOfStudy: timetable.courseOfStudy,
        relatedTimetableId: timetable._id,
        isAutomatic: false,
        deliveryStatus: 'sent',
      });
    }

    res.json({ success: true, data: timetable, message: `Venue updated and ${emails.length} students notified` });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timetable = await Timetable.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!timetable) { res.status(404).json({ success: false, message: 'Timetable not found' }); return; }
    res.json({ success: true, message: 'Timetable deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};