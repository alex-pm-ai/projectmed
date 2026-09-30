import { Navigate, Link } from 'react-router-dom';
import {
  Calendar, BarChart2, History, TrendingUp, Target, Repeat, CheckSquare, Smartphone,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { SiteHeader } from '../../components/site/SiteHeader';
import { SiteFooter } from '../../components/site/SiteFooter';

const FUNCIONALIDADES = [
  { icon: Calendar, titulo: 'Cronograma de estudos', texto: 'Organize suas revisões por data, sem precisar montar planilha nenhuma.' },
  { icon: BarChart2, titulo: 'Dashboard de desempenho', texto: 'Acompanhe sua taxa de acertos e evolução semana a semana.' },
  { icon: History, titulo: 'Histórico completo', texto: 'Toda questão e simulado registrados, sempre disponíveis para consulta.' },
  { icon: TrendingUp, titulo: 'Evolução por matéria', texto: 'Veja onde você está indo bem e onde precisa reforçar — por área.' },
  { icon: Target, titulo: 'Metas semanais', texto: 'Defina quantas questões quer resolver por semana e acompanhe o progresso.' },
  { icon: Repeat, titulo: 'Foco Prova', texto: 'Repetição espaçada: revisa mais o que você erra, menos o que já domina.' },
  { icon: CheckSquare, titulo: 'To-Do & Pomodoro', texto: 'Liste tarefas do dia e estude com ciclos de foco integrados.' },
  { icon: Smartphone, titulo: 'Web e mobile', texto: 'Acesse pelo computador ou pelo celular, onde for mais conveniente.' },
];

const FAQ = [
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta: 'Sim, sem multa nem fidelidade. Você cancela em "Minha assinatura" e o acesso continua valendo até o fim do período que já pagou. Nos primeiros 7 dias, você pode pedir o reembolso integral.',
  },
  {
    pergunta: 'Posso trocar do plano mensal para o anual?',
    resposta: 'Pode. Cancele a assinatura mensal em "Minha assinatura" e assine o plano anual — seu acesso atual continua valendo até o fim do período já pago.',
  },
  {
    pergunta: 'A Mindfast tem aulas ou questões comentadas?',
    resposta: 'Não. A Mindfast é uma ferramenta de organização e acompanhamento de estudo — você estuda com o material que já usa, e a plataforma cuida do cronograma, das métricas e da repetição espaçada.',
  },
  {
    pergunta: 'Serve para qualquer prova ou área de estudo?',
    resposta: 'Sim. Você cria as suas próprias áreas e conteúdos — vestibular, concursos, residência, certificações, faculdade ou o que estiver estudando — e a plataforma monta o cronograma a partir do seu desempenho em cada um.',
  },
  {
    pergunta: 'Quais formas de pagamento são aceitas?',
    resposta: 'Cartão de crédito, pelo Mercado Pago, com renovação automática. A Mindfast não recebe nem guarda os dados do seu cartão.',
  },
];

export function Home() {
  const usuario = useAuthStore((s) => s.usuario);
  if (usuario) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative max-w-3xl mx-auto px-4 py-20 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-10 -z-0 mx-auto h-64 max-w-xl rounded-full bg-brand-gradient opacity-20 blur-3xl" />
        <h1 className="relative font-heading text-4xl font-bold text-white mb-4">
          Estude com método. <span className="text-brand-gradient">Evolua com dados.</span>
        </h1>
        <p className="relative text-gray-400 text-lg mb-8">
          A Mindfast organiza sua rotina de estudos e mostra exatamente onde você está evoluindo —
          para quem se prepara para provas, concursos, vestibulares e residência.
        </p>
        <div className="relative flex items-center justify-center gap-3">
          <Link
            to="/planos"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Ver planos
          </Link>
          <Link
            to="/login"
            className="border border-card-border hover:bg-white/5 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="font-heading text-2xl font-bold text-white text-center mb-10">
          O que você tem na Mindfast
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FUNCIONALIDADES.map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo} className="bg-card border border-card-border rounded-xl p-5">
              <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center mb-3">
                <Icon size={18} className="text-accent" />
              </div>
              <h3 className="text-sm font-medium text-white mb-1">{titulo}</h3>
              <p className="text-xs text-gray-500">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="font-heading text-2xl font-bold text-white text-center mb-8">
          Perguntas frequentes
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ pergunta, resposta }) => (
            <details key={pergunta} className="bg-card border border-card-border rounded-lg p-4 group">
              <summary className="text-sm font-medium text-white cursor-pointer list-none flex items-center justify-between">
                {pergunta}
                <span className="text-gray-500 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
              </summary>
              <p className="text-sm text-gray-400 mt-3">{resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-heading text-2xl font-bold text-white mb-3">
          Comece hoje a acompanhar sua evolução
        </h2>
        <Link
          to="/planos"
          className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Ver planos
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
