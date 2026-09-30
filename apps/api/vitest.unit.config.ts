import { defineConfig } from 'vitest/config';

// Testes de unidade: funções puras (algoritmos, criptografia). Não usam banco,
// então rodam sem o MariaDB de teste. Uso: npm run test:unit
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    env: {
      DATABASE_URL: 'mysql://nao-usado@localhost:3306/nao-usado',
      JWT_SECRET: 'test-secret-0123456789',
      DATA_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      DATA_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
      NODE_ENV: 'test',
    },
  },
});
