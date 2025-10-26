// /src/routes/adminRoute.ts

import { Router } from 'express';
import { adminLogin, adminLogout, getAdminById, getAdminList, registerAdmin, updateAdminDetails, updateAdminPassword } from '../controllers/adminController';
import { adminRefreshToken } from '../controllers/adminRefreshController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';
import { adminRoleAuthMiddleware } from '../middleware/adminRoleAuthMiddleware';

const router = Router();

// Admin login route
router.post('/login', adminLogin);

// Route for refreshing admin access token
router.post('/refresh-token', adminRefreshToken);

// Route for registering a new admin (protected, super_admin only)
router.post('/register',adminAuthMiddleware, adminRoleAuthMiddleware(['super_admin','admin']), registerAdmin);

// Admin logout route
router.post('/logout', adminAuthMiddleware, adminLogout);

// Get admins list route
router.get('/', adminAuthMiddleware, getAdminList);

// Get admin by id route
router.get('/:id', adminAuthMiddleware, adminRoleAuthMiddleware(['super_admin','admin']), getAdminById);

// Update admin details by id route
router.put('/update/:id', adminAuthMiddleware, adminRoleAuthMiddleware(['super_admin','admin']), updateAdminDetails);

// Update admin Password by id route
router.put('/update-password/:id', adminAuthMiddleware, adminRoleAuthMiddleware(['super_admin','admin','moderator']), updateAdminPassword);

export default router;