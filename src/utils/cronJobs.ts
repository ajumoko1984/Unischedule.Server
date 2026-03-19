import cron from 'node-cron';
import Event from '../models/Event.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import { sendEventReminderEmail } from './mailer';

export const startCronJobs = (): void => {
  // Run every day at 8:00 PM — send reminder for tomorrow's tests/exams
  cron.schedule('0 20 * * *', async () => {
    console.log('⏰ Running nightly reminder cron job...');
    await sendTomorrowReminders();
  });

  // Run every day at 8:00 AM — send morning summary for today's events
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running morning summary cron job...');
    await markCompletedEvents();
  });

  console.log('✅ Cron jobs started');
};

async function sendTomorrowReminders(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const events = await Event.findOne({
      date: { $gte: tomorrow, $lt: dayAfterTomorrow },
      category: { $in: ['test', 'exam'] },
      status: 'upcoming',
      reminderSent: false,
    });

    if (!events) return;

    // Find all upcoming events for tomorrow
    const upcomingEvents = await Event.find({
      date: { $gte: tomorrow, $lt: dayAfterTomorrow },
      category: { $in: ['test', 'exam'] },
      status: 'upcoming',
      reminderSent: false,
    });

    for (const event of upcomingEvents) {
      // Get all students in the same level + course
      const students = await User.find({
        level: event.level,
        courseOfStudy: event.courseOfStudy,
        role: 'student',
        isActive: true,
      }).select('email');

      const systemUser = await User.findOne({ role: 'super_admin' });
      if (!systemUser) continue;

      const recipientEmails = students.map(s => s.email);
      if (recipientEmails.length === 0) continue;

      const dateStr = event.date.toLocaleDateString('en-NG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      await sendEventReminderEmail(recipientEmails, {
        title: event.title,
        courseCode: event.courseCode,
        courseTitle: event.courseTitle,
        category: event.category,
        date: dateStr,
        time: event.startTime,
        venue: event.venue,
        description: event.description,
      });

      // Log the notification
      await Notification.create({
        type: 'reminder',
        subject: `Reminder: ${event.title} – Tomorrow`,
        message: `Automated reminder for ${event.category}: ${event.courseCode}`,
        recipients: recipientEmails,
        recipientCount: recipientEmails.length,
        sentBy: systemUser._id,
        faculty: event.faculty,
        level: event.level,
        courseOfStudy: event.courseOfStudy,
        relatedEvent: event._id,
        isAutomatic: true,
        deliveryStatus: 'sent',
      });

      // Mark reminder as sent
      event.reminderSent = true;
      event.reminderSentAt = new Date();
      await event.save();

      console.log(`✅ Reminder sent for ${event.courseCode} to ${recipientEmails.length} students`);
    }
  } catch (error) {
    console.error('❌ Error in nightly reminder cron:', error);
  }
}

async function markCompletedEvents(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Event.updateMany(
      { date: { $lt: today }, status: 'upcoming' },
      { $set: { status: 'completed' } }
    );
  } catch (error) {
    console.error('❌ Error marking completed events:', error);
  }
}
