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
  PAYMENT_PROVIDER: z.enum(['mock', 'asaas', 'stripe', 'mercadopago']).default('mock'),
  PAYMENT_WEBHOOK_SECRET: segredo.default('segredo-do-webhook'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
