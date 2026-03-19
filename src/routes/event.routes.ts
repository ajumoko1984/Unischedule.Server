import { Router } from 'express';
import { getEvents, createEvent, updateEvent, deleteEvent, sendManualReminder } from '../controllers/event.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getEvents);
router.post('/', authorize('super_admin', 'level_adviser', 'class_rep'), createEvent);
router.put('/:id', authorize('super_admin', 'level_adviser', 'class_rep'), updateEvent);
router.delete('/:id', authorize('super_admin', 'level_adviser', 'class_rep'), deleteEvent);
router.post('/:id/remind', authorize('super_admin', 'level_adviser', 'class_rep'), sendManualReminder);

export default router;
