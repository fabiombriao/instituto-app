import { CycleSummary, Goal, TemplateKit, WamAgenda, WeeklyScore } from "./types";

export const cycleSummary: CycleSummary = {
  id: "cycle-1",
  name: "Crescer MRR em 40%",
  startDate: "2024-01-08",
  endDate: "2024-03-31",
  currentWeek: 4,
  totalWeeks: 12,
  scoreTrend: [68, 74, 79, 82]
};

export const goals: Goal[] = [
  {
    id: "goal-1",
    title: "Expandir carteira de clientes",
    description: "Gerar 40 novos clientes com ticket médio de R$1.200",
    targetValue: 40,
    metricUnit: "clientes",
    metricType: "lagging",
    currentValue: 12,
    weeklyScore: 78,
    laggingValue: 12,
    tactics: [
      {
        id: "tactic-1",
        title: "Prospectar 50 leads qualificados",
        cadenceWeekly: 5,
        weight: 40,
        behaviorType: "task",
        completion: 0.82,
        trend: "up",
        tasks: [
          { id: "task-1", title: "Rodar cadência outbound", dueDate: "2024-02-05", status: "in_progress", effort: "M" },
          { id: "task-2", title: "Enviar follow-ups", dueDate: "2024-02-07", status: "todo", effort: "S" }
        ]
      },
      {
        id: "tactic-2",
        title: "Realizar 10 reuniões de diagnóstico",
        cadenceWeekly: 10,
        weight: 35,
        behaviorType: "task",
        completion: 0.72,
        trend: "steady",
        tasks: [
          { id: "task-3", title: "Confirmar reuniões marcadas", dueDate: "2024-02-06", status: "done", effort: "S" }
        ]
      },
      {
        id: "tactic-3",
        title: "Atualizar pipeline no CRM diariamente",
        cadenceWeekly: 5,
        weight: 25,
        behaviorType: "habit",
        completion: 0.92,
        trend: "up",
        habits: [
          { id: "habit-1", title: "Pipeline atualizado", freqPerWeek: 5, streak: 8, progress: 0.8 }
        ]
      }
    ]
  },
  {
    id: "goal-2",
    title: "Aumentar retenção",
    description: "Subir NRR para 105% com upgrades e prevenção de churn",
    targetValue: 105,
    metricUnit: "%",
    metricType: "leading",
    currentValue: 101,
    weeklyScore: 84,
    leadingValue: 101,
    tactics: [
      {
        id: "tactic-4",
        title: "Realizar 5 reuniões de sucesso com clientes chave",
        cadenceWeekly: 5,
        weight: 45,
        behaviorType: "task",
        completion: 0.9,
        trend: "up",
        tasks: [
          { id: "task-4", title: "Reunião com conta Alfa", dueDate: "2024-02-06", status: "done", effort: "M" }
        ]
      },
      {
        id: "tactic-5",
        title: "Monitorar health score diariamente",
        cadenceWeekly: 5,
        weight: 30,
        behaviorType: "habit",
        completion: 0.76,
        trend: "down",
        habits: [
          { id: "habit-2", title: "Check health score", freqPerWeek: 5, streak: 3, progress: 0.6 }
        ],
        notes: "Alertar suporte sobre contas em risco."
      },
      {
        id: "tactic-6",
        title: "Publicar uma história de case por semana",
        cadenceWeekly: 1,
        weight: 25,
        behaviorType: "task",
        completion: 0.6,
        trend: "steady"
      }
    ]
  }
];

export const weeklyScores: WeeklyScore[] = [
  {
    weekIndex: 1,
    scorePct: 68,
    highlights: "Onboarding concluído e CRM configurado",
    blockers: "Pouco tempo para follow-ups",
    commitments: "Reservar blocos diários para prospecção"
  },
  {
    weekIndex: 2,
    scorePct: 74,
    highlights: "Táticas de retenção acima de 80%",
    blockers: "Agenda de reuniões lotada",
    commitments: "Delegar triagem de leads"
  },
  {
    weekIndex: 3,
    scorePct: 79,
    highlights: "Primeiros upgrades fechados",
    blockers: "Sem rotina de health score",
    commitments: "Criar alerta diário"
  },
  {
    weekIndex: 4,
    scorePct: 82,
    highlights: "Pipeline atualizado todos os dias",
    blockers: "Produção de conteúdo atrasada",
    commitments: "Agendar gravação de case"
  }
];

export const wamAgenda: WamAgenda = {
  pastScore: 82,
  retrospective: {
    worked: "Pipeline atualizado diariamente elevou previsibilidade.",
    blocked: "Criação de conteúdo ficou para o fim da semana.",
    adjustments: "Reservar manhãs de quinta para gravar cases."
  },
  bigThree: [
    "Fechar 3 novos contratos enterprise",
    "Reforçar hábito de health score",
    "Rodar campanha de upgrade"
  ],
  calendarBlocks: [
    "Seg 08h - WAM Squad",
    "Ter/Qui 10h - Bloco de Prospecção",
    "Sex 15h - Revisão de Conteúdo"
  ]
};

export const templateKits: TemplateKit[] = [
  {
    id: "template-sales",
    name: "Vendas B2B",
    focus: "Crescer MRR com cadência forte e pipeline atualizado",
    leading: ["# de prospecções/dia", "# de follow-ups/dia", "# de reuniões/semana"],
    lagging: ["MRR", "# de fechamentos"]
  },
  {
    id: "template-content",
    name: "Conteúdo & Marca Pessoal",
    focus: "Construir presença consistente e gerar leads inbound",
    leading: ["5 posts/semana", "2 colabs", "1 live/semana"],
    lagging: ["Leads inbound", "Tráfego do site"]
  },
  {
    id: "template-ops",
    name: "Operacional/Implantação",
    focus: "Entregar projetos no prazo com visibilidade clara",
    leading: ["Entregáveis por sprint", "Reuniões de status"],
    lagging: ["Tempo de implantação", "NPS"]
  },
  {
    id: "template-health",
    name: "Saúde & Performance",
    focus: "Rotinas saudáveis sem perder consistência",
    leading: ["Treinos/semana", "Passos/dia", "Ingestão de água"],
    lagging: ["% de gordura", "VO2", "PRs"]
  },
  {
    id: "template-finance",
    name: "Finanças Pessoais",
    focus: "Equilibrar orçamento e acelerar reserva",
    leading: ["Lançamentos semanais", "Revisão orçamentária"],
    lagging: ["% poupança", "Redução despesas"]
  }
];
