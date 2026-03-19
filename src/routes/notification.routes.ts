import { Router } from 'express';
import { getNotifications, sendAnnouncement, sendTimetableNotification } from '../controllers/notification.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getNotifications);
router.post('/announce', authorize('super_admin', 'level_adviser', 'class_rep'), sendAnnouncement);
router.post('/notify-slot', authorize('super_admin', 'level_adviser', 'class_rep'), sendTimetableNotification);

export default router;