// /src/schemas/updatePassword.ts (Revised for Admin Reset)

import { z } from 'zod';

export const updatePasswordSchema = z.object({

    oldPassword: z.string()
        .min(8, 'Old password must be at least 8 characters long.').optional(),
    newPassword: z.string()
        .min(8, 'New password must be at least 8 characters long.'),

    confirmPassword: z.string()
        .min(8, 'Confirm password must be at least 8 characters long.'),
})
.refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation password do not match.",
    path: ["confirmPassword"],
});

export type UpdatePasswordType = z.infer<typeof updatePasswordSchema>;