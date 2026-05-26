import { Router } from 'express';
import { getNotifications, sendAnnouncement, sendCourseNotification, sendTimetableNotification } from '../controllers/notification.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/announce', authorize('super_admin', 'level_adviser', 'class_rep','exam_officer'), sendAnnouncement);
router.post('/course', authorize('super_admin', 'level_adviser', 'class_rep','exam_officer'), sendCourseNotification);
router.post('/notify-slot', authorize('super_admin', 'level_adviser', 'class_rep','exam_officer'), sendTimetableNotification);

export default router;