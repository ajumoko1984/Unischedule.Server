import { Response } from 'express';
import StudyPlan from '../models/StudyPlan.model';
import { AuthRequest } from '../middleware/auth.middleware';

// Get or create the user's study plan
export const getStudyPlan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    let plan = await StudyPlan.findOne({ owner: req.user._id });
    if (!plan) {
      plan = await StudyPlan.create({
        owner: req.user._id,
        level: req.user.level,
        courseOfStudy: req.user.courseOfStudy,
        tasks: [],
      });
    }
    res.json({ success: true, data: plan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a study task
export const addTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { courseCode, courseTitle, task, scheduledAt, durationMinutes, notes } = req.body;
    if (!courseCode || !task || !scheduledAt) {
      res.status(400).json({ success: false, message: 'courseCode, task and scheduledAt are required' });
      return;
    }

    let plan = await StudyPlan.findOne({ owner: req.user._id });
    if (!plan) {
      plan = await StudyPlan.create({ owner: req.user._id, level: req.user.level, courseOfStudy: req.user.courseOfStudy, tasks: [] });
    }

    plan.tasks.push({ courseCode, courseTitle, task, scheduledAt: new Date(scheduledAt), durationMinutes: durationMinutes || 60, notes, status: 'pending', reminderSent: false } as any);
    await plan.save();

    res.status(201).json({ success: true, data: plan });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update task status (complete, in_progress, etc.)
export const updateTaskStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { taskId } = req.params;
    const { status, notes } = req.body;

    const plan = await StudyPlan.findOne({ owner: req.user._id });
    if (!plan) { res.status(404).json({ success: false, message: 'Study plan not found' }); return; }

    const task = plan.tasks.find(t => String(t._id) === taskId);
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }

    task.status = status;
    if (status === 'completed') task.completedAt = new Date();
    if (notes) task.notes = notes;
    await plan.save();

    res.json({ success: true, data: plan, message: status === 'completed' ? '✅ Task marked as complete!' : 'Task updated' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a task
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const { taskId } = req.params;
    const plan = await StudyPlan.findOne({ owner: req.user._id });
    if (!plan) { res.status(404).json({ success: false, message: 'Study plan not found' }); return; }

    plan.tasks = plan.tasks.filter(t => String(t._id) !== taskId) as any;
    await plan.save();

    res.json({ success: true, data: plan, message: 'Task deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Weekly summary for the logged-in student
export const getWeeklySummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authorized' }); return; }

    const Assignment = (await import('../models/Assignment.model')).default;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const plan = await StudyPlan.findOne({ owner: req.user._id });
    const tasks = plan?.tasks.filter(t => {
      const d = new Date(t.scheduledAt);
      return d >= weekStart && d < weekEnd;
    }) || [];

    const studyCompleted  = tasks.filter(t => t.status === 'completed').length;
    const studyTotal      = tasks.length;
    const studyMissed     = tasks.filter(t => t.status === 'missed').length;

    const assignments = await Assignment.find({
      owner: req.user._id,
      deadline: { $gte: weekStart, $lt: weekEnd },
    });
    const assignCompleted = assignments.filter(a => a.status === 'completed').length;
    const assignTotal     = assignments.length;
    const assignOverdue   = assignments.filter(a => a.status === 'overdue').length;

    // Progress per course (study tasks this week)
    const courseMap: Record<string, { total: number; completed: number; courseTitle: string }> = {};
    for (const t of plan?.tasks || []) {
      if (!courseMap[t.courseCode]) courseMap[t.courseCode] = { total: 0, completed: 0, courseTitle: t.courseTitle };
      courseMap[t.courseCode].total++;
      if (t.status === 'completed') courseMap[t.courseCode].completed++;
    }
    const courseProgress = Object.entries(courseMap).map(([code, v]) => ({
      courseCode: code,
      courseTitle: v.courseTitle,
      percent: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
      completed: v.completed,
      total: v.total,
    }));

    // Smart motivational message
    const completionRate = studyTotal > 0 ? studyCompleted / studyTotal : 0;
    let message = '';
    if (studyTotal === 0 && assignTotal === 0) {
      message = "No tasks planned this week. Add study sessions to stay on track! 📅";
    } else if (completionRate >= 0.8 && assignOverdue === 0) {
      message = "Excellent work this week! You're building great study habits. Keep it up! 🎉";
    } else if (completionRate >= 0.5) {
      message = "Good progress! You completed more than half your tasks. Push a bit harder next week! 💪";
    } else if (studyMissed > 0 || assignOverdue > 0) {
      message = "You missed some tasks this week. Don't worry — plan better next week and you'll get there! 📈";
    } else {
      message = "You're just getting started. Consistency is key — keep showing up! 🚀";
    }

    res.json({
      success: true,
      data: {
        weekStart, weekEnd,
        study: { total: studyTotal, completed: studyCompleted, missed: studyMissed },
        assignments: { total: assignTotal, completed: assignCompleted, overdue: assignOverdue },
        courseProgress,
        message,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};