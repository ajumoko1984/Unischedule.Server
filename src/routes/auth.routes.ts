import { Router } from 'express';
import { register, login, getMe, checkRoleAvailability, forgotPassword, resetPassword, getFacultiesHandler, getDepartmentsByFacultyId, createUser, updateProfile, updateEmail, changePassword } from '../controllers/auth.controller';
import { protect, authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/role-availability', checkRoleAvailability); 
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/faculties', getFacultiesHandler);
router.get('/departments/:facultyId', getDepartmentsByFacultyId);
router.post('/admin/create-user', protect, authorize('super_admin'), createUser);
router.put('/profile', protect, updateProfile);
router.put('/email', protect, updateEmail);
router.post('/change-password', protect, changePassword);

export default router;