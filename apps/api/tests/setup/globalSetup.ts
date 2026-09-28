import { execSync } from 'node:child_process';

/**
 * Roda UMA vez antes de toda a suíte: aplica as migrations do Prisma no banco
 * "projectmed_test" do MariaDB local (isolado dos dados de desenvolvimento).
 * Requer o MariaDB no ar e o banco projectmed_test criado (ver tests/README.md).
 */
export default function setup() {
  process.env.DATABASE_URL = 'mysql://projectmed:projectmed@localhost:3306/projectmed_test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
