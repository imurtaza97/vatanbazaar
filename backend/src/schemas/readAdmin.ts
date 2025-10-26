// /src/schemas/readAdmin.ts

import { z } from 'zod';

export const adminListSchema = z.object({

    page: z.preprocess(
        (val) => parseInt(z.string().parse(val), 10), 
        z.number().min(1, 'Page number must be at least 1').default(1)
    ).optional(),

    limit: z.preprocess(
        (val) => parseInt(z.string().parse(val), 10), 
        z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10)
    ).optional(),

});