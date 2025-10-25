// /src/routes/adminRoute.ts

import { Router } from 'express';
import { adminLogin } from '../controllers/adminController';
import { adminRefreshToken } from '../controllers/adminRefreshController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';

const router = Router();

/**
 * Route for admin login
 */
router.post('/login', adminLogin);

/**
 * Route for admin token refresh
 */
router.post('/refresh-token', adminRefreshToken);

/**
 * Example of a protected admin route
 */
router.get('/protected', adminAuthMiddleware, (req, res) => {
    res.status(200).json({ message: 'Access granted to protected admin route' });
});

export default router;