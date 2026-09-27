import { buildApp } from './app.js';
import { env } from './shared/env.js';

async function main() {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 DALK API rodando em http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
