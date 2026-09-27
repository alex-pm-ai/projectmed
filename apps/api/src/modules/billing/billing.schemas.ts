import { z } from 'zod';

export const checkoutSchema = z.object({
  planoId: z.string().min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
