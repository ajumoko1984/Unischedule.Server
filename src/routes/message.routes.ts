import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { sendMessageToSuperAdmin, sendMessageToClassRep, getMessages, replyToMessage } from '../controllers/message.controller';

const router = Router();

router.use(protect);

router.get('/', getMessages);
router.post('/', sendMessageToSuperAdmin);
router.post('/class-rep', authorize('student'), sendMessageToClassRep);
router.post('/:id/reply', replyToMessage);

export default router;
