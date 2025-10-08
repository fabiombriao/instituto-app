const personas = [
  {
    title: "Solo Pro",
    description: "Empreendedores que precisam transformar visão em rituais semanais.",
    needs: [
      "Metas de negócio claras",
      "Prioridades semanais",
      "Score simples para accountability"
    ]
  },
  {
    title: "Squad Líder",
    description: "Gestores que coordenam squads e precisam de visibilidade do time.",
    needs: [
      "Placar do time",
      "Integração com calendário/CRM",
      "Rituais de WAM consistentes"
    ]
  },
  {
    title: "Coach/Consultor",
    description: "Profissionais que acompanham múltiplos clientes e ciclos.",
    needs: [
      "Templates replicáveis",
      "Relatórios rápidos",
      "Compartilhamento de score"
    ]
  }
];

export function PersonaCards() {
  return (
    <section className="space-y-3">
      {personas.map((persona) => (
        <div key={persona.title} className="card space-y-2">
          <div>
            <p className="text-sm font-semibold text-white">{persona.title}</p>
            <p className="text-xs text-slate-300">{persona.description}</p>
          </div>
          <ul className="space-y-1 text-xs text-brand-200">
            {persona.needs.map((need) => (
              <li key={need} className="rounded-lg bg-brand-500/10 px-3 py-1">
                {need}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
