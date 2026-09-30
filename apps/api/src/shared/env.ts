import { z } from 'zod';

const producao = process.env.NODE_ENV === 'production';

// Em produção os segredos precisam ser longos e aleatórios; em dev/teste basta existir.
const segredo = z.string().min(producao ? 32 : 8);
const chave32Bytes = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'precisa ter 32 bytes em base64');

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: segredo,
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_DIAS: z.coerce.number().default(7),
  // Chaves de criptografia de dados pessoais — gerar com:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  DATA_ENCRYPTION_KEY: chave32Bytes,
  DATA_HMAC_KEY: chave32Bytes,
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  // Endereço público do app (usado no retorno do Mercado Pago). O MP não aceita
  // localhost: em desenvolvimento a volta é feita pela própria tela de assinatura.
  APP_URL: z.string().url().default('http://localhost:5173'),
  PAYMENT_PROVIDER: z.enum(['mock', 'mercadopago']).default('mock'),
  PAYMENT_WEBHOOK_SECRET: segredo.default('segredo-do-webhook'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY: z.string().optional(),
  // SÓ EM TESTE: o Mercado Pago exige que quem paga também seja um usuário de teste.
  // Preencha com o e-mail do "comprador de teste" (ex.: test_user_123@testuser.com).
  // Em produção deixe vazio — vale o e-mail de cada pessoa.
  MERCADOPAGO_EMAIL_COMPRADOR_TESTE: z.string().email().optional().or(z.literal('')),
  // Chave secreta dos webhooks (painel do MP > Webhooks). Só existe depois de publicar.
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
}).superRefine((e, ctx) => {
  if (e.PAYMENT_PROVIDER === 'mercadopago' && !e.MERCADOPAGO_ACCESS_TOKEN) {
    ctx.addIssue({ code: 'custom', path: ['MERCADOPAGO_ACCESS_TOKEN'], message: 'obrigatório com PAYMENT_PROVIDER=mercadopago' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
