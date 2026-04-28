# RF40 - Notas Privadas do Treinador

## Visão Geral

Implementação completa do fluxo de notas privadas do treinador para acompanhamento de alunos, com funcionalidades avançadas de CRUD, categorização, filtros e notificações.

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`/home/fabio/Área de trabalho/Caminhos do Êxito/migrations/add_coach_notes_enhancements.sql`**
   - Migração SQL para adicionar campos avançados à tabela `coach_notes`
   - Adiciona: tags, updated_at, is_read, read_at, edit_count, last_edited_by
   - Cria índices para performance
   - Cria triggers para atualização automática de timestamps
   - Cria funções auxiliares para marcar notas como lidas
   - Cria view `coach_notes_stats` para estatísticas agregadas
   - Configura RLS (Row Level Security) para controle de acesso

2. **`/home/fabio/Área de trabalho/Caminhos do Êxito/src/components/CoachNotesPanel.tsx`**
   - Componente React completo para gerenciamento de notas
   - Funcionalidades:
     - Criar novas notas com tags
     - Listar notas com filtros por tag e status de leitura
     - Editar notas inline
     - Excluir notas com confirmação
     - Marcar notas como lidas (individual ou em lote)
     - Badge de notas recentes (últimas 24h)
     - Contador de notas não lidas
     - Interface responsiva com animações

### Arquivos Modificados

1. **`/home/fabio/Área de trabalho/Caminhos do Êxito/src/types/index.ts`**
   - Atualizado interface `CoachNote` com novos campos
   - Adicionado tipo `CoachNoteTag` com 8 categorias
   - Adicionado constante `COACH_NOTE_TAGS` com configurações visuais
   - Adicionado interface `CoachNotesStats` para estatísticas

2. **`/home/fabio/Área de trabalho/Caminhos do Êxito/src/pages/AdminDashboard.tsx`**
   - Integrado componente `CoachNotesPanel`
   - Adicionada coluna "Notas" na tabela de usuários com:
     - Contador total de notas
     - Badge de notas não lidas
     - Indicador de notas recentes (24h)
   - Carregamento de estatísticas de notas na inicialização

## Instruções de Instalação

### 1. Aplicar Migração SQL

Execute o arquivo de migração no Supabase:

```bash
# Via dashboard do Supabase
# 1. Acesse https://app.supabase.com
# 2. Selecione seu projeto
# 3. Vá em SQL Editor
# 4. Cole o conteúdo de migrations/add_coach_notes_enhancements.sql
# 5. Execute

# Ou via CLI
supabase db push
```

### 2. Campos Adicionados à Tabela `coach_notes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tags` | `TEXT[]` | Array de tags para categorização |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | Timestamp da última atualização |
| `is_read` | `BOOLEAN` | Indica se a nota foi lida |
| `read_at` | `TIMESTAMP WITH TIME ZONE` | Timestamp quando a nota foi marcada como lida |
| `edit_count` | `INTEGER` | Contador de vezes que a nota foi editada |
| `last_edited_by` | `UUID` | ID do último usuário a editar a nota |

### 3. Novas Funções SQL

- **`mark_notes_as_read(p_aluno_id UUID)`** - Marca todas as notas de um aluno como lidas
- **`mark_note_as_read(p_note_id UUID)`** - Marca uma nota específica como lida
- **`get_unread_notes_count(p_aluno_id UUID)`** - Retorna contagem de notas não lidas
- **`get_recent_notes(p_aluno_id UUID, p_hours INTEGER)`** - Retorna notas recentes

### 4. View de Estatísticas

**`coach_notes_stats`** - View agregada com estatísticas por aluno:
```sql
SELECT * FROM coach_notes_stats WHERE aluno_id = 'user-uuid';
```

Campos retornados:
- `total_notes` - Total de notas do aluno
- `unread_notes` - Notas não lidas
- `recent_notes_24h` - Notas nas últimas 24h
- `last_note_at` - Data da última nota
- `last_unread_note_at` - Data da última nota não lida

## Tags Disponíveis

| Tag | Descrição | Cor |
|-----|-----------|-----|
| `comportamental` | Aspectos comportamentais | Azul |
| `técnica` | Questões técnicas | Roxo |
| `elogio` | Feedback positivo | Verde |
| `atenção` | Pontos que necessitam atenção | Amarelo |
| `progresso` | Acompanhamento de evolução | Ciano |
| `desafio` | Desafios identificados | Rosa |
| `meta` | Metas e objetivos | Violeta |
| `outro` | Outras categorias | Cinza |

## Funcionalidades Implementadas

### 1. CRUD Completo
- ✅ Criar nota
- ✅ Listar notas do aluno
- ✅ Editar nota existente
- ✅ Deletar nota com confirmação
- ✅ Histórico de alterações (edit_count)

### 2. Melhorias na UI
- ✅ Timestamp formatado (dd MMM yyyy HH:mm)
- ✅ Nome do treinador que criou/editou
- ✅ Edição inline
- ✅ Confirmação antes de deletar
- ✅ Badge de "nova nota" (últimas 24h)

### 3. Categorização
- ✅ Tags coloridas para notas
- ✅ 8 categorias pré-definidas
- ✅ Filtro por tag
- ✅ Múltiplas tags por nota

### 4. Visão Consolidada
- ✅ Lista de alunos com contador de notas
- ✅ Badge de alunos com notas não lidas
- ✅ Indicador de notas recentes
- ✅ View `coach_notes_stats` para consultas agregadas

### 5. Notificações
- ✅ Indicador visual de notas não lidas
- ✅ Badge "NOVA" para notas recentes
- ✅ Contador de notas não lidas por aluno
- ✅ Botão "Marcar todas como lidas"

## Políticas de Segurança (RLS)

- Apenas staff (SUPER_ADMIN, TREINADOR, admin, coach) pode ver notas
- Apenas staff pode criar notas (vinculadas ao próprio ID)
- Apenas staff pode editar notas
- Apenas staff pode deletar notas
- Apenas staff pode marcar notas como lidas

## Performance

- Índices criados para:
  - `coach_notes(aluno_id, created_at DESC)`
  - `coach_notes(aluno_id, is_read)`
  - `coach_notes(tags)` usando GIN
- Triggers para atualização automática de timestamps
- View materializada (estatísticas) para consultas rápidas

## Testando a Implementação

1. **Acesse o AdminDashboard**
2. **Clique em um aluno** na tabela de perfis
3. **Modal abrirá** com o CoachNotesPanel
4. **Adicione uma nota** com tags
5. **Veja a coluna "Notas"** na tabela atualizar com o contador
6. **Filtre por tags** ou "não lidas"
7. **Edite uma nota** clicando no ícone de lápis
8. **Exclua uma nota** com confirmação

## Troubleshooting

### Erro: "relation coach_notes_stats does not exist"
- Certifique-se de executar a migração SQL completa
- A view `coach_notes_stats` é criada no final da migração

### Tags não aparecem
- Verifique se o campo `tags` foi adicionado à tabela
- Confirme que a migração foi executada sem erros

### Estatísticas não carregam
- Verifique as permissões da view `coach_notes_stats`
- Confirme que o usuário tem acesso de SELECT

## Próximos Passos (Opcionais)

- [ ] Adicionar notificações push para novas notas
- [ ] Exportar notas em PDF
- [ ] Adicionar busca full-text nas notas
- [ ] Implementar versão mobile otimizada
- [ ] Adicionar gráficos de evolução de notas por aluno
