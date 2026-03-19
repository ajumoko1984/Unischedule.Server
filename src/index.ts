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

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://unischedule-client.vercel.app',
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