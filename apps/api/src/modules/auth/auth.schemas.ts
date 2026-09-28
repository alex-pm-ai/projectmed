import { z } from 'zod';
import { senhaEhComum } from '../../shared/password.js';

// E-mail sempre normalizado, para "Alex@X.com " e "alex@x.com" serem a mesma conta.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido')
  .max(254);

export const registerSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email,
  senha: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres')
    .max(128)
    .refine((s) => !senhaEhComum(s), 'Essa senha é muito comum, escolha outra'),
  tipo: z.string().default('R1'),
});

export const loginSchema = z.object({
  email,
  senha: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
