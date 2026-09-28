import { defineConfig } from 'vitest/config';

// Banco de teste: MESMO MariaDB do dev, mas em outro banco ("projectmed_test"),
// para não tocar nos dados de desenvolvimento.
const TEST_DATABASE_URL = 'mysql://projectmed:projectmed@localhost:3306/projectmed_test';

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
      JWT_EXPIRES_IN: '1h',
      REFRESH_TOKEN_DIAS: '7',
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      DATA_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
      PORT: '3334',
      NODE_ENV: 'test',
      WEB_ORIGIN: 'http://localhost:5173',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_WEBHOOK_SECRET: 'test-webhook',
    },
  },
});
