import cron from 'node-cron';
import Event from '../models/Event.model';
import User from '../models/User.model';
import Notification from '../models/Notification.model';
import StudyPlan from '../models/StudyPlan.model';
import Assignment from '../models/Assignment.model';
import { sendEventReminderEmail, sendAnnouncementEmail } from './mailer';

export const startCronJobs = (): void => {
  // 8:00 PM — send reminder for tomorrow's tests/exams
  cron.schedule('0 20 * * *', async () => {
    console.log('⏰ Running nightly event reminder cron...');
    await sendTomorrowEventReminders();
  });

  // 8:00 AM — mark past events as completed
  cron.schedule('0 8 * * *', async () => {
    await markCompletedEvents();
    await markOverdueAssignments();
  });

  // Every hour — send study session reminders 1hr before
  cron.schedule('0 * * * *', async () => {
    await sendStudySessionReminders();
  });

  // 9:00 PM — send assignment deadline reminders (due tomorrow)
  cron.schedule('0 21 * * *', async () => {
    await sendAssignmentDeadlineReminders();
  });

  // Every Sunday 8:00 PM — mark missed study tasks from the past week
  cron.schedule('0 20 * * 0', async () => {
    await markMissedStudyTasks();
  });

  console.log('✅ Cron jobs started');
};

// ── Tomorrow's test/exam reminders ───────────────────────────────────────────
async function sendTomorrowEventReminders(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const upcomingEvents = await Event.find({
      date: { $gte: tomorrow, $lt: dayAfter },
      category: { $in: ['test', 'exam'] },
      status: 'upcoming',
      reminderSent: false,
    });

    for (const event of upcomingEvents) {
      const students = await User.find({
        level: event.level,
        courseOfStudy: event.courseOfStudy,
        role: 'student',
        isActive: true,
      }).select('email');

      const systemUser = await User.findOne({ role: 'super_admin' });
      if (!systemUser) continue;

      const recipientEmails = students.map(s => s.email);
      if (!recipientEmails.length) continue;

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
        faculty: event.faculty,
        level: event.level,
        courseOfStudy: event.courseOfStudy,
      });

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

      event.reminderSent = true;
      event.reminderSentAt = new Date();
      await event.save();

      console.log(`✅ Event reminder sent for ${event.courseCode} to ${recipientEmails.length} students`);
    }
  } catch (error) {
    console.error('❌ Error in nightly event reminder cron:', error);
  }
}

// ── Study session reminders — 1 hour before scheduled time ───────────────────
async function sendStudySessionReminders(): Promise<void> {
  try {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const inOneHourEnd = new Date(inOneHour.getTime() + 60 * 1000); // 1-minute window

    const plans = await StudyPlan.find({}).populate('owner', 'email fullName isActive');

    for (const plan of plans) {
      const owner = plan.owner as any;
      if (!owner?.isActive || !owner?.email) continue;

      const dueTasks = plan.tasks.filter(t => {
        const scheduled = new Date(t.scheduledAt);
        return (
          scheduled >= inOneHour &&
          scheduled < inOneHourEnd &&
          t.status === 'pending' &&
          !t.reminderSent
        );
      });

      for (const task of dueTasks) {
        await sendAnnouncementEmail([owner.email], {
          subject: `📚 Study reminder: ${task.courseCode} in 1 hour`,
          message: `Your study session starts in 1 hour.\n\nCourse: ${task.courseCode} – ${task.courseTitle}\nTask: ${task.task}\nTime: ${new Date(task.scheduledAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}\nDuration: ${task.durationMinutes} minutes\n\nLog in to UniSchedule to track your progress.`,
          sentBy: 'UniSchedule Smart Reminders',
          faculty: '',
          level: plan.level,
          courseOfStudy: plan.courseOfStudy,
        });

        task.reminderSent = true;
        console.log(`✅ Study reminder sent to ${owner.email} for ${task.courseCode}`);
      }

      if (dueTasks.length > 0) await plan.save();
    }
  } catch (error) {
    console.error('❌ Error in study session reminder cron:', error);
  }
}

// ── Assignment deadline reminders — due tomorrow ──────────────────────────────
async function sendAssignmentDeadlineReminders(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const dueTomorrow = await Assignment.find({
      deadline: { $gte: tomorrow, $lt: dayAfter },
      status: { $in: ['pending', 'in_progress'] },
      reminderSent: false,
    }).populate('owner', 'email fullName isActive');

    for (const assignment of dueTomorrow) {
      const owner = assignment.owner as any;
      if (!owner?.isActive || !owner?.email) continue;

      await sendAnnouncementEmail([owner.email], {
        subject: `⏰ Assignment due tomorrow: ${assignment.courseCode}`,
        message: `Your assignment is due tomorrow!\n\nCourse: ${assignment.courseCode} – ${assignment.courseTitle}\nAssignment: ${assignment.title}\nDeadline: ${assignment.deadline.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\nPriority: ${assignment.priority.toUpperCase()}\n${assignment.description ? `\nNotes: ${assignment.description}` : ''}\n\nDon't wait — log in to UniSchedule and mark it done when you're finished.`,
        sentBy: 'UniSchedule Smart Reminders',
        faculty: '',
        level: assignment.level,
        courseOfStudy: assignment.courseOfStudy,
      });

      assignment.reminderSent = true;
      await assignment.save();
      console.log(`✅ Assignment reminder sent to ${owner.email} for ${assignment.courseCode}`);
    }
  } catch (error) {
    console.error('❌ Error in assignment deadline reminder cron:', error);
  }
}

// ── Mark past events as completed ─────────────────────────────────────────────
async function markCompletedEvents(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await Event.updateMany({ date: { $lt: today }, status: 'upcoming' }, { $set: { status: 'completed' } });
  } catch (error) {
    console.error('❌ Error marking completed events:', error);
  }
}

// ── Mark overdue assignments ───────────────────────────────────────────────────
async function markOverdueAssignments(): Promise<void> {
  try {
    const now = new Date();
    await Assignment.updateMany(
      { deadline: { $lt: now }, status: { $in: ['pending', 'in_progress'] } },
      { $set: { status: 'overdue' } }
    );
  } catch (error) {
    console.error('❌ Error marking overdue assignments:', error);
  }
}

// ── Mark missed study tasks (past + still pending) ────────────────────────────
async function markMissedStudyTasks(): Promise<void> {
  try {
    const now = new Date();
    const plans = await StudyPlan.find({});
    for (const plan of plans) {
      let changed = false;
      for (const task of plan.tasks) {
        if (task.status === 'pending' && new Date(task.scheduledAt) < now) {
          task.status = 'missed';
          changed = true;
        }
      }
      if (changed) await plan.save();
    }
    console.log('✅ Missed study tasks marked');
  } catch (error) {
    console.error('❌ Error marking missed study tasks:', error);
  }
}