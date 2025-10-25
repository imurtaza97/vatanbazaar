// /src/contollres/adminRefreshController.ts

import { Request, Response } from 'express';
import { verifyToken, comparePassword, generateToken, generateRefreshToken, hashPassword } from '../utils/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

//token expiration time
const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';

//max age for cookies in milliseconds
const ACCESS_TOKEN_EXPIRY_MS = 30 * 60 * 1000; //30 minutes
const REFRESH_TOKEN_EXPIRY_MS= 7 * 24 * 60 * 60 * 1000; //7 days

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
}
/**
 * Controller to handle admin token refresh
 */
export async function adminRefreshToken(request: Request, response: Response) {
    const { refreshToken } = request.cookies;
    
    if (!refreshToken) {
        return response.status(401).json({ message: 'Refresh token is required' });
    }
    try {

        const decodedPayload = verifyToken(refreshToken, JWT_REFRESH_SECRET);
        const adminId = (decodedPayload as { adminId: number }).adminId;

        const admin = await prisma.admin.findUnique({ where: { id: adminId } });

        if (!admin || !admin.refreshTokenHash) {
            return response.status(401).json({ message: 'Unauthorized: Invalid session' });
        }

        const isTokenValid = await comparePassword(refreshToken, admin.refreshTokenHash);

        if (!isTokenValid) {
            await prisma.admin.update({ where: { id: adminId }, data: { refreshTokenHash: null } });
            console.error(`Token reuse detected for Admin ID: ${adminId}`);
            return response.status(401).json({ message: 'Unauthorized: Session compromised' });
        }

        const newAccessToken = generateToken({ adminId: admin.id, role: admin.role }, ACCESS_TOKEN_EXPIRY);
        const newRefreshToken = generateRefreshToken({ adminId: admin.id });

        const newRefreshTokenHash = await hashPassword(newRefreshToken);
        await prisma.admin.update({ where: { id: admin.id }, data: { refreshTokenHash: newRefreshTokenHash } });

        response.cookie('accessToken', newAccessToken, { 
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: ACCESS_TOKEN_EXPIRY_MS 
        });
        response.cookie('refreshToken', newRefreshToken, { 
            httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: REFRESH_TOKEN_EXPIRY_MS 
        });

        return response.status(200).json({ message: 'Tokens refreshed successfully' });
    } catch (error){
        console.log('Refresh token error:', error)
        return response.status(500).json({ message: 'Unauthorized: Session invalid or expired' });
    }
}