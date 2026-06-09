import { Router } from 'express';
import {
  getAllUsers,
  createUserByAdmin,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getDashboardStats,
  getStudentsForLevel,
  assignClassRep,
  revokeClassRep,
  checkLevelAdviserExists,
  searchLecturers,
} from '../controllers/user.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public endpoint used during registration to verify whether a level adviser already exists
router.get('/level-adviser-exists', checkLevelAdviserExists);

router.use(protect);

// Stats — all authenticated roles
router.get('/stats', getDashboardStats);

// Search lecturers (for exam officer invigilator selection)
router.get('/search/lecturers', searchLecturers);

// Named routes — must come BEFORE /:id to avoid param conflicts
router.get('/students-for-level', authorize('super_admin', 'level_adviser'), getStudentsForLevel);
router.post('/assign-rep', authorize('super_admin', 'level_adviser'), assignClassRep);

// Super Admin only — full CRUD
router.get('/', authorize('super_admin', 'level_adviser'), getAllUsers);
router.post('/', authorize('super_admin'), createUserByAdmin);
router.put('/:id', authorize('super_admin'), updateUser);
router.patch('/:id/toggle', authorize('super_admin'), toggleUserStatus);
router.delete('/:id', authorize('super_admin'), deleteUser);

// Revoke class rep — super admin + level adviser
router.patch('/:id/revoke-rep', authorize('super_admin', 'level_adviser'), revokeClassRep);

export default router;