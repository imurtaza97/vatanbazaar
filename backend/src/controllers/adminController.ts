// /src/controllers/adminController.ts

import { Request, Response } from 'express';
import { hashPassword, comparePassword, generateToken, generateRefreshToken } from '../utils/auth';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';
import { PrismaClient, Admin } from '@prisma/client';

const prisma = new PrismaClient();

//dummy hash for timing attack prevention
const DUMMY_HASH = '$2b$10$iCrTW6CQ.m6FghhgIUYVQuxv0sgpdBP/zwxdzZNuBQ3u2G2rc6bYS';

//token expiration time
const ACCESS_TOKEN_EXPIRY = '1m';
const REFRESH_TOKEN_EXPIRY = '7d';

//max age for cookies in milliseconds
const ACCESS_TOKEN_EXPIRY_MS = 30 * 60 * 1000; //30 minutes
const REFRESH_TOKEN_EXPIRY_MS= 7 * 24 * 60 * 60 * 1000; //7 days

/**
 * Controller to handle admin login
 */
export async function adminLogin(request: Request, response: Response) {
    const { email, password } = request.body;
    
    if (!email || !password) {
        return response.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const admin = await prisma.admin.findUnique({ where: { email } });

        const hashToCompare = admin ? admin.passwordHash : DUMMY_HASH;
        
        const isPasswordValid = await comparePassword(password, hashToCompare);

        if (!admin || !isPasswordValid) {
            return response.status(401).json({ message: 'Invalid email or password' });
        }

        const accessToken = generateToken({ adminId: admin.id, role: admin.role }, ACCESS_TOKEN_EXPIRY);

        const refreshToken = generateRefreshToken({ adminId: admin.id }, REFRESH_TOKEN_EXPIRY);

        const refreshTokenHash = await hashPassword(refreshToken);

        await prisma.admin.update({
            where: { id: admin.id },
            data: { refreshTokenHash }
        });
        response.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: ACCESS_TOKEN_EXPIRY_MS // 30 minutes max age
        });

        response.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:  REFRESH_TOKEN_EXPIRY_MS // 7 days max age
        });

        return response.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Admin login fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}