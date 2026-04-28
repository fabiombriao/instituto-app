# Como Executar a Migração SQL no Supabase

## Opção 1: Via Dashboard Supabase (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/cqspjsyiycoksvsorpzh/sql
2. Copie o conteúdo do arquivo `migrations/add_coach_notes_enhancements.sql`
3. Cole no SQL Editor do dashboard
4. Clique em "Run" ou pressione Ctrl+Enter

## Opção 2: Via CLI (se tiver Supabase CLI instalado)

```bash
npx supabase db execute --file migrations/add_coach_notes_enhancements.sql
```

## Opção 3: Via psql direto

```bash
psql "$SUPABASE_DIRECT_CONNECTION_STRING" -f migrations/add_coach_notes_enhancements.sql
```

## O que a migração faz?

- Adiciona campos: `tags`, `updated_at`, `is_read`, `read_at`, `edit_count`, `last_edited_by`
- Cria índices para performance
- Configura triggers para atualizar timestamps automaticamente
- Cria funções auxiliares: `mark_notes_as_read`, `get_unread_notes_count`, `get_recent_notes`
- Cria view `coach_notes_stats` para estatísticas
- Configura RLS (Row Level Security) para controle de acesso

## Validação

Após executar, confirme no dashboard:
- Tabela `coach_notes` tem os novos campos
- Índices criados: `idx_coach_notes_aluno_created`, `idx_coach_notes_aluno_read`, `idx_coach_notes_tags`
- Funções criadas: `mark_notes_as_read`, `mark_note_as_read`, `get_unread_notes_count`, `get_recent_notes`
- View criada: `coach_notes_stats`
- RLS habilitado na tabela `coach_notes`
