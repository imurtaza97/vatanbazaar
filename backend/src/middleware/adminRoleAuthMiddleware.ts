// /src/middleware/adminRoleAuthMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { Admin } from '@prisma/client';

/**
 * Middleware to authorize admin users based on their role
 */
export function adminRoleAuthMiddleware(requiredRoles: Admin['role'][]) {
    return (request: Request, response: Response, next: NextFunction) => {
        const userRole = request.admin?.role;

        if (!userRole) {
            return response.status(401).json({ message: 'Unauthorized: Admin not found in request' });
        }

        if (requiredRoles.includes(userRole)) {
            next()
        } else {
            return response.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
        }
    }
}