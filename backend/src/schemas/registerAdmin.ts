import { z } from 'zod';

// Schema for a valid, non-optional phone string
const PhoneString = z.string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .min(1, 'Phone number must not be empty if provided');

export const registerAdminSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').trim(),
    email: z.string().email('Invalid email address').trim(),
    password: z.string().min(8, 'Password must be at least 8 characters long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[\W_]/, 'Password must contain at least one special character'),
    role: z.enum(['admin', 'moderator', 'super_admin'], 'Invalid role specified'),
    
    // Correct handling for optional phone: allows a valid string, undefined, null, or empty string.
    // Transforms null/empty string to undefined for consistency (e.g., for Prisma).
    phone: PhoneString
        .optional() // Allows undefined
        .or(z.literal('').transform(() => undefined)) // Allows ""
        .or(z.null().transform(() => undefined)) // Allows null
});

// The type needed in the controller
export type RegisterAdminType = z.infer<typeof registerAdminSchema>;
