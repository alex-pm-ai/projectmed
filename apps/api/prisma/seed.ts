import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const planos = [
    { nome: 'Mensal', preco: 4990, intervalo: 'month' },
    { nome: 'Anual', preco: 47900, intervalo: 'year' },
  ];

  for (const p of planos) {
    const existe = await prisma.plano.findFirst({ where: { nome: p.nome } });
    if (!existe) {
      await prisma.plano.create({ data: p });
      console.log(`Plano criado: ${p.nome} — R$ ${(p.preco / 100).toFixed(2)}`);
    } else {
      console.log(`Plano já existe: ${p.nome}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
