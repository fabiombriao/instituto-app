# TrainerCharts - Guia de Uso

## Visão Geral

O componente `TrainerCharts` exibe gráficos de evolução semanal de scores para uma turma, mostrando o desempenho individual de cada aluno e a média da turma.

## Arquivos Criados

1. **`src/hooks/useTurmaWeeklyScores.ts`** - Hook personalizado para buscar dados de weekly_scores da turma
2. **`src/components/TrainerCharts.tsx`** - Componente principal do gráfico

## Como Usar

### Integração no AdminDashboard

O componente já está integrado no `AdminDashboard.tsx`. Para usá-lo:

1. Selecione uma turma na lista de turmas
2. Clique no botão "Mostrar Gráficos"
3. O gráfico será exibido com os dados da turma selecionada

### Uso Standalone

Você também pode usar o componente em outras páginas:

```tsx
import TrainerCharts from '../components/TrainerCharts';

function MinhaPagina() {
  const [turmaId, setTurmaId] = useState<string | null>(null);

  return (
    <div>
      <TrainerCharts turmaId={turmaId} className="minha-classe-customizada" />
    </div>
  );
}
```

## Funcionalidades

### Gráfico de Linhas
- **Eixo X**: Semanas (1-12)
- **Eixo Y**: Score (0-100%)
- **Linhas individuais**: Uma linha por aluno com cores diferentes
- **Linha da média**: Linha branca tracejada e mais grossa para destacar a média da turma

### Interatividade
- **Tooltip**: Ao passar o mouse sobre o gráfico, exibe os detalhes de cada aluno
- **Legenda**: Mostra o nome de cada aluno (truncado se necessário)
- **Responsivo**: Adapta-se a diferentes tamanhos de tela

### Estatísticas Exibidas
- Total de alunos na turma
- Média atual da turma (última semana)
- Número de semanas registradas

### Estados de Carregamento
- **Loading**: Mostra spinner enquanto carrega os dados
- **Error**: Exibe mensagem de erro se falhar ao carregar
- **Vazio**: Mostra mensagem quando não há dados disponíveis

## Personalização

### Cores
As cores das linhas são geradas automaticamente usando uma paleta de 12 cores definida em `generatePalette()`.

### Nomes
Nomes de alunos com mais de 12 caracteres são truncados e terminados com ".." para manter a legibilidade.

### Tooltip Customizado
O componente usa um `CustomTooltip` que formata os dados de forma clara e legível.

## Dados Esperados

O componente espera dados da seguinte estrutura:

```typescript
interface TurmaWeeklyScoreData {
  alunoId: string;
  profile: Profile | null;
  scores: WeeklyScore[];
}
```

O hook `useTurmaWeeklyScores` busca automaticamente:
- Ciclos ativos da turma
- Perfis dos alunos
- Scores semanais de cada ciclo

## Performance

- Os dados são processados usando `useMemo` para otimização
- Animações do Recharts são desabilitadas para melhor performance
- Timeout de 8 segundos para evitar carregamento infinito

## Exemplo de Uso Completo

```tsx
import React, { useState } from 'react';
import TrainerCharts from '../components/TrainerCharts';

function PaginaDeTurmas() {
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);

  return (
    <div className="p-8">
      <h1>Turmas Disponíveis</h1>
      
      <select 
        value={selectedTurma || ''} 
        onChange={(e) => setSelectedTurma(e.target.value || null)}
      >
        <option value="">Selecione uma turma</option>
        <option value="turma-id-1">Turma A</option>
        <option value="turma-id-2">Turma B</option>
      </select>

      <TrainerCharts turmaId={selectedTurma} />
    </div>
  );
}
```

## Troubleshooting

### Gráfico não aparece
- Verifique se `turmaId` está definido
- Confirme que a turma tem ciclos ativos
- Verifique se há weekly_scores registradas para os ciclos

### Nomes dos alunos muito longos
- Nomes são automaticamente truncados para 12 caracteres
- Ajuste a função `truncateName()` se necessário

### Cores repetidas
- Se houver mais de 12 alunos, as cores se repetem cyclicamente
- Ajuste a paleta em `generatePalette()` se necessário

## Requisitos

- React 19+
- Recharts 3.8+ (já instalado no projeto)
- Supabase client configurado
- Tabelas: `cycles`, `weekly_scores`, `profiles`
