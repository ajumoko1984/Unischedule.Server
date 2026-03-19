import { Router } from 'express';
import { getTimetable, createTimetable, updateTimetable, updateVenue, deleteTimetable } from '../controllers/timetable.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/', getTimetable);
router.post('/', authorize('super_admin', 'level_adviser', 'class_rep'), createTimetable);
router.put('/venue', authorize('super_admin', 'level_adviser', 'class_rep'), updateVenue);
router.put('/:id', authorize('super_admin', 'level_adviser', 'class_rep'), updateTimetable);
router.delete('/:id', authorize('super_admin', 'level_adviser'), deleteTimetable);

export default router;
