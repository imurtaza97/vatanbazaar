// /src/middleware/adminAuthMiddleware.ts

import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { PrismaClient, Admin } from '@prisma/client';

const prisma = new PrismaClient();

interface JwtPayloadWithUserId extends jwt.JwtPayload {
    adminId: number;
}

declare global {
    namespace Express {
        interface Request {
            admin?: Admin; 
        }
    }
}
/** 
 * middleware function to verify user for routes
 */

async function adminAuthMiddleware(request: Request, response: Response, next:NextFunction) {
   const token = request.cookies['accessToken'];

   if(!token) {
    return response.status(401).json({ message: 'Unauthorized: Missing token' });
   }
   try {
    const decodedPayload = verifyToken(token) as JwtPayloadWithUserId;
 
    const admin = await prisma.admin.findUnique({
        where: { id: decodedPayload.adminId },

        select: { id: true, email: true, role: true, name: true } 
    });
    //check if admin exists and has appropriate role
    if (!admin || admin.role !== 'admin' && admin.role !== 'super_admin') {
        return response.status(403).json({ message: 'Forbidden: Insufficient privileges.'});
    }

    request.admin = admin as Admin; 

    next();
   } catch(error) {
    console.error('Admin auth middleware error:', error);
    return response.status(401).json({ message: 'Unauthorized: Invalid token' });
   }
}

export { adminAuthMiddleware };