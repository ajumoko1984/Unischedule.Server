import { Router } from 'express';
import { getStudyPlan, addTask, updateTaskStatus, deleteTask, getWeeklySummary } from '../controllers/studyplan.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/',              getStudyPlan);
router.post('/tasks',        addTask);
router.patch('/tasks/:taskId/status', updateTaskStatus);
router.delete('/tasks/:taskId',       deleteTask);
router.get('/weekly-summary',         getWeeklySummary);

export default router;