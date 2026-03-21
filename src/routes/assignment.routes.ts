import { Router } from 'express';
import { getAssignments, createAssignment, updateAssignment, deleteAssignment, toggleComplete } from '../controllers/assignment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

router.get('/',              getAssignments);
router.post('/',             createAssignment);
router.put('/:id',           updateAssignment);
router.delete('/:id',        deleteAssignment);
router.patch('/:id/toggle',  toggleComplete);

export default router;