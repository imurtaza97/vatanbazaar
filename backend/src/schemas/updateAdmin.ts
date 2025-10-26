import z from "zod";
import { id } from "zod/v4/locales";

// Schema for a valid, non-optional phone string
const PhoneString = z.string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .min(1, 'Phone number must not be empty if provided');

export const updateAdminSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long').trim().optional(),
    email: z.string().email('Invalid email address').trim().optional(),
    role: z.enum(['admin', 'moderator', 'super_admin'], 'Invalid role specified'),
    
    phone: PhoneString
        .optional() // Allows undefined
        .or(z.literal('').transform(() => undefined)) // Allows ""
        .or(z.null().transform(() => undefined)) // Allows null
});

// The type needed in the controller
export type UpdateAdminType = z.infer<typeof updateAdminSchema>;