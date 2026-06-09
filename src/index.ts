import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import { startCronJobs } from './utils/cronJobs';

import authRoutes from './routes/auth.routes';
import timetableRoutes from './routes/timetable.routes';
import eventRoutes from './routes/event.routes';
import notificationRoutes from './routes/notification.routes';
import userRoutes from './routes/user.routes';
import messageRoutes from './routes/message.routes';
import studyPlanRoutes from './routes/studyplan.routes';
import { protect } from './middleware/auth.middleware';
import { searchLecturers } from './controllers/user.controller';
import assignmentRoutes from './routes/assignment.routes';
import courseForm from './routes/courseform.routes';
import exams from './routes/exam.routes';
import tests from './routes/test.routes';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  // origin: process.env.CLIENT_URL || 'https://unischedule-two.vercel.app',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.get('/api/search/lecturers', protect, searchLecturers);
app.use('/api/study-plan', studyPlanRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/course-forms', courseForm);
app.use('/api/exams', exams);
app.use('/api/tests', tests);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'UniSchedule API is running', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  startCronJobs();

  // Log mail config on startup so you can verify env vars loaded correctly
  console.log('📧 Mail config:', {
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS ? `${process.env.MAIL_PASS.slice(0, 4)}****` : 'NOT SET',
  });

  app.listen(PORT, () => {
    console.log(`🚀 UniSchedule server running on port ${PORT}`);
  });
};

start();

export default app;