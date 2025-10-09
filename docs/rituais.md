# Manual de Rituais - 12 Week Year Method

## Objetivo do documento
Orientar squads, solos e coaches a rodarem o método com consistência: planejar ciclos de 12 semanas, executar com foco semanal e medir score de maneira transparente.

## Ritmo oficial da semana
1. **Planejamento leve (dom/domingo à noite)**
   - Revise o backlog de táticas e hábitos do ciclo.
   - Ajuste pesos se houver mudança estrutural (máx. 10% do total por semana).
   - Pré-selecione candidatos para os "Três Grandes".
2. **Execução diária (segunda a sexta)**
   - Comece o dia abrindo a tela "Semana Atual" e marque os hábitos críticos.
   - Use o Pomodoro embutido para blocos de foco nas táticas prioritárias.
   - Capture tarefas novas na inbox "Hoje/Semana" para renegociar no WAM.
3. **Pontuação semanal (sexta até domingo)**
   - Feche tarefas/hábitos e registre percentuais (0-100%).
   - Cada tática recebe score = (`entregas realizadas` ÷ `cadência esperada`).
   - Objetivo recebe média ponderada das táticas; ciclo recebe média dos objetivos.
4. **WAM (segunda 8h-11h)**
   - Revisar score anterior, retro rápida (Funcionou/Travou/Ajustes).
   - Definir "Três Grandes" e confirmar blocos no calendário.
   - Gerar ata automática e compartilhar com time/coach.

## Como calcular o score
- **Tática hábito**: (`dias cumpridos` ÷ `frequência semanal`).
- **Tática tarefa**: (`entregas feitas` ÷ `entregas planejadas`).
- **Peso**: mantenha soma das táticas de um objetivo = 100.
- **Score do objetivo**: Σ (`score da tática` × `peso`) ÷ Σ `peso`.
- **Score do ciclo**: média dos objetivos ou pesos opcionais por objetivo.

## Checklist do WAM
- [ ] Score da semana anterior publicado.
- [ ] Retrospectiva respondida (3 perguntas).
- [ ] Score leading x lagging comparado.
- [ ] Prioridades semanais definidas.
- [ ] Blocos de calendário confirmados e sincronizados.
- [ ] Ata exportada (PDF/Markdown) e enviada ao squad/coach.

## Boas práticas por persona
### Solo Pro
- Use lembretes push/e-mail para os "Três Grandes".
- Limite objetivos a no máximo 3 para evitar dispersão.
- Publique seu score em um link compartilhável para mentor/par.

### Squad Líder
- Agende o WAM do time com integração ao Google Calendar.
- Puxe dados do CRM via webhook `score.updated` para atualizar pipeline.
- Use heatmap de hábitos para encontrar gargalos de execução.

### Coach/Consultor
- Crie templates personalizados e distribua via biblioteca.
- Revise relatórios semanais e marque tendências (up/down) com comentários.
- Utilize integrações n8n para notificações automáticas (WhatsApp/Slack).

## Próximos passos
- Testar permissões com RLS para garantir privacidade entre squads.
- Preparar variantes dark/light quando habilitar PWA offline-first.
- Validar métricas de sucesso (ativação, engajamento, retenção) com painel Supabase + Metabase.
