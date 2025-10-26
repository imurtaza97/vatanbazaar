// /src/schemas/params.ts (Ensure your schema looks like this)

import { z } from 'zod';

export const idParamSchema = z.object({
    id: z.string()
        .transform((val, ctx) => {
            const parsed = parseInt(val, 10);
            if (isNaN(parsed) || parsed <= 0) {
                ctx.addIssue({
                    code: 'custom',
                    message: "Admin ID must be a positive integer."
                });
                return z.NEVER;
            }
            return parsed; // This returns the actual number
        })
        .pipe(z.number()) // <--- CRITICAL: This tells Zod/TS the final type is number
});