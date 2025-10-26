// /src/controllers/adminController.ts

import { Request, Response } from 'express';
import { hashPassword, comparePassword, generateToken, generateRefreshToken } from '../utils/auth';
import { PrismaClient, Admin } from '@prisma/client';
import { registerAdminSchema, RegisterAdminType } from '../schemas/registerAdmin';
import { adminListSchema } from '../schemas/readAdmin';
import { ZodError } from 'zod';
import { idParamSchema } from '../schemas/params';
import { updateAdminSchema, UpdateAdminType } from '../schemas/updateAdmin';
import { updatePasswordSchema, UpdatePasswordType } from '../schemas/updatePassword';

const prisma = new PrismaClient();

//dummy hash for timing attack prevention
const DUMMY_HASH = '$2b$10$iCrTW6CQ.m6FghhgIUYVQuxv0sgpdBP/zwxdzZNuBQ3u2G2rc6bYS';

//token expiration time
const ACCESS_TOKEN_EXPIRY = '30m';
const REFRESH_TOKEN_EXPIRY = '7d';

//max age for cookies in milliseconds
const ACCESS_TOKEN_EXPIRY_MS = 30 * 60 * 1000; //30 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; //7 days

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
            maxAge: REFRESH_TOKEN_EXPIRY_MS // 7 days max age
        });

        return response.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Admin login fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Controller to handle regiter/add new admin
 */
export async function registerAdmin(request: Request, response: Response) {

    const { name, phone, email, password, role } = request.body;

    let validatedData: RegisterAdminType;

    try {
        validatedData = registerAdminSchema.parse({ name, phone, email, password, role });
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Register admin validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
        return response.status(409).json({ message: 'Admin with this email already exists' });
    }

    try {

        const requestingAdminRole = request.admin?.role;
        const roleBeingAssigned = validatedData.role;

        if (requestingAdminRole !== 'super_admin') {
            // Moderators cannot create anyone
            if (requestingAdminRole === 'moderator') {
                return response.status(403).json({
                    message: 'Forbidden: Moderators cannot register new admins.',
                });
            }

            if (requestingAdminRole === 'admin') {
                if (roleBeingAssigned !== 'moderator') {
                    return response.status(403).json({
                        message: 'Forbidden: Admins can only create moderators.',
                    });
                }
            }
        }

        const passwordHash = await hashPassword(validatedData.password);
        const newAdmin = await prisma.admin.create({
            data: {
                name: validatedData.name,
                email: validatedData.email,
                passwordHash,
                role: validatedData.role,
                phone: validatedData.phone || null
            }
        });

        return response.status(201).json({ message: 'Admin registered successfully', adminId: newAdmin.id });
    } catch (error) {
        console.error('Register admin fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Controller to handle admin logout
 */
export async function adminLogout(request: Request, response: Response) {
    const adminId = request.admin?.id;

    response.clearCookie('accessToken');
    response.clearCookie('refreshToken');

    if (!adminId) {
        return response.status(200).json({ message: 'Logout successful' });
    }
    try {

        await prisma.admin.update({
            where: { id: adminId },
            data: { refreshTokenHash: null }
        });

    } catch (error) {
        console.error('Admin logout fatal error:', error);
    }
    return response.status(200).json({ message: 'Logout successful' });
}


/**
 * Get admin list with pagination
 */
export async function getAdminList(request: Request, response: Response) {
    let validatedQuery;

    try {
        validatedQuery = adminListSchema.parse(request.query);
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Get admin list validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    const page = validatedQuery.page || 1;
    const limit = validatedQuery.limit || 10;
    const offset = (page - 1) * limit;

    try {
        const [admins, totalAdmins] = await Promise.all([
            prisma.admin.findMany({
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.admin.count()
        ]);

        const totalPages = Math.ceil(totalAdmins / limit);

        return response.status(200).json({
            admins,
            pagination: {
                totalAdmins,
                totalPages,
                currentPage: page,
                pageSize: limit
            }
        });
    } catch (error) {
        console.error('Get admin list fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Get admin by ID
 */
export async function getAdminById(request: Request, response: Response) {
    let adminId: number;

    try {
        const parsedParams = idParamSchema.parse(request.params);
        adminId = parsedParams.id;
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Get admin by ID validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    try {
        const admin = await prisma.admin.findUnique({
            where: { id: adminId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!admin) {
            return response.status(404).json({ message: 'Admin not found' });
        }

        return response.status(200).json({ admin });
    } catch (error) {
        console.error('Get admin by ID fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Update admin details by ID
 */
export async function updateAdminDetails(request: Request, response: Response) {
    let adminId: number;

    try {
        const parsedParams = idParamSchema.parse(request.params);
        adminId = parsedParams.id;
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Update admin by ID validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    let validatedData: UpdateAdminType;

    try {
        validatedData = updateAdminSchema.parse(request.body);
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Update admin details validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    try {
        const existingAdmin = await prisma.admin.findUnique({ where: { id: adminId } });

        if (!existingAdmin) {
            return response.status(404).json({ message: 'Admin not found' });
        }

        //verify email and phone uniqueness if being updated
        if (validatedData.email && validatedData.email !== existingAdmin.email) {
            const emailTaken = await prisma.admin.findUnique({ where: { email: validatedData.email } });
            if (emailTaken) {
                return response.status(409).json({ message: 'Email is already taken by another admin' });
            }
        }

        if (validatedData.phone && validatedData.phone !== existingAdmin.phone) {
            const phoneTaken = await prisma.admin.findFirst({ where: { phone: validatedData.phone } });
            if (phoneTaken) {
                return response.status(409).json({ message: 'Phone number is already taken by another admin' });
            }
        }

        const requestingAdminRole = request.admin?.role;
        const roleBeingAssigned = validatedData.role;

        const roleHierarchy: Record<string, number> = {
            'super_admin': 3,
            'admin': 2,
            'moderator': 1,
        };

        if (requestingAdminRole !== 'super_admin') {
            if (requestingAdminRole === 'moderator' && roleBeingAssigned) {
                return response.status(403).json({
                    message: 'Forbidden: Moderators cannot change roles.',
                });
            }

            if (requestingAdminRole === 'admin') {
                if (existingAdmin.role !== 'moderator') {
                    return response.status(403).json({
                        message: 'Forbidden: Admins can only update moderators.',
                    });
                }

                if (roleBeingAssigned && roleHierarchy[roleBeingAssigned] >= roleHierarchy['admin']) {
                    return response.status(403).json({
                        message: 'Forbidden: Admins cannot assign admin or super_admin roles.',
                    });
                }
            }
        }

        if (request.admin?.id === adminId && roleBeingAssigned && roleBeingAssigned !== existingAdmin.role) {
            return response.status(403).json({
                message: 'Forbidden: You cannot change your own role.',
            });
        }

        const updatedAdmin = await prisma.admin.update({
            where: { id: adminId },
            data: validatedData,
            select: { id: true },
        });

        return response.status(200).json({
            message: 'Admin details updated successfully',
            adminId: updatedAdmin.id,
        });
    } catch (error) {
        console.error('Update admin details fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}

/**
 * Update admin password by ID
 */
export async function updateAdminPassword(request: Request, response: Response) {
    let adminId: number;

    try {
        const parsedParams = idParamSchema.parse(request.params);
        adminId = parsedParams.id;
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Update admin password validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    let validatedData: UpdatePasswordType;

    try {
        validatedData = updatePasswordSchema.parse(request.body);
    } catch (error) {
        if (error instanceof ZodError) {
            const validationErrors = error.issues.map((err) => err.message);
            return response.status(400).json({ message: 'Validation errors', errors: validationErrors });
        } else {
            console.error('Update admin password validation fatal error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    }

    try {
        const existingAdmin = await prisma.admin.findUnique({ where: { id: adminId } });

        if (!existingAdmin) {
            return response.status(404).json({ message: 'Admin not found' });
        }

        const requestingAdminId = request.admin?.id;
        const requestingAdminRole = request.admin?.role;
        const targetAdminRole = existingAdmin.role;

        let isAuthorized = false;

        if (requestingAdminRole === 'super_admin') {
            isAuthorized = true;
        } else if (requestingAdminRole === 'admin') {
            const isSelf = requestingAdminId === adminId;
            const isTargetingModerator = targetAdminRole === 'moderator';

            if (isTargetingModerator || isSelf) {
                isAuthorized = true;
            }
        } else if (requestingAdminRole === 'moderator') {
            const isSelf = requestingAdminId === adminId;
            if (isSelf) {
                isAuthorized = true;
            }
        }

        if (requestingAdminId === adminId) {
            
            if (!validatedData.oldPassword) {
                return response.status(400).json({ message: 'Old password is required to change your own password.' });
            }

            const isOldPasswordValid = await comparePassword(validatedData.oldPassword, existingAdmin.passwordHash);

            if (!isOldPasswordValid) {
                return response.status(401).json({ message: 'The provided old password is incorrect.' });
            }
        }

        if (!isAuthorized) {
            return response.status(403).json({ message: 'Forbidden: You do not have permission to update this admin\'s password.' });
        }

        const newPasswordHash = await hashPassword(validatedData.newPassword!);

        await prisma.admin.update({
            where: { id: adminId },
            data: {
                passwordHash: newPasswordHash,
                refreshTokenHash: null
            },
            select: { id: true }
        });

        return response.status(200).json({ message: 'Admin password updated successfully', adminId: adminId });
    } catch (error) {
        console.error('Update admin password fatal error:', error);
        return response.status(500).json({ message: 'Internal server error' });
    }
}