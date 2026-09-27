import { execSync } from 'node:child_process';

/**
 * Roda UMA vez antes de toda a suíte: aplica as migrations do Prisma no
 * schema "test" do Postgres (cria as tabelas isoladas dos dados de dev).
 * Requer o Postgres no ar (docker compose up -d na pasta apps/api).
 */
export default function setup() {
  process.env.DATABASE_URL = 'postgresql://dalk:dalk@localhost:5433/dalk?schema=test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
