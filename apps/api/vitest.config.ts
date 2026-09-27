import { defineConfig } from 'vitest/config';

// Banco de teste: MESMO Postgres do dev, mas em um SCHEMA isolado ("test"),
// para não tocar nos dados de desenvolvimento (schema "public").
const TEST_DATABASE_URL = 'postgresql://dalk:dalk@localhost:5433/dalk?schema=test';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.ts'],
    // Os arquivos de teste compartilham o mesmo banco → rodam em série.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-0123456789',
      JWT_REFRESH_SECRET: 'test-refresh-0123456789',
      JWT_EXPIRES_IN: '1h',
      JWT_REFRESH_EXPIRES_IN: '7d',
      PORT: '3334',
      NODE_ENV: 'test',
      WEB_ORIGIN: 'http://localhost:5173',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook',
    },
  },
});
