-- ============================================
-- MIGRATION: ENHANCEMENTS FOR COACH NOTES
-- ============================================
-- Adiciona campos para suportar fluxo completo de notas privadas:
-- - Edição e histórico de alterações
-- - Categorização com tags
-- - Controle de leitura para notificações
-- ============================================

-- Adicionar novos campos à tabela coach_notes
ALTER TABLE coach_notes
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_coach_notes_aluno_created ON coach_notes (aluno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_notes_aluno_read ON coach_notes (aluno_id, is_read);
CREATE INDEX IF NOT EXISTS idx_coach_notes_tags ON coach_notes USING GIN (tags);

-- Trigger para atualizar updated_at e edit_count
CREATE OR REPLACE FUNCTION public.update_coach_note_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  -- Incrementar contador de edições apenas em UPDATE
  IF TG_OP = 'UPDATE' THEN
    NEW.edit_count := COALESCE(OLD.edit_count, 0) + 1;
    NEW.last_edited_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_coach_note_timestamp ON coach_notes;
CREATE TRIGGER update_coach_note_timestamp
  BEFORE INSERT OR UPDATE ON coach_notes
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_coach_note_timestamp();

-- Função para marcar notas como lidas
CREATE OR REPLACE FUNCTION public.mark_notes_as_read(p_aluno_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Verificar se é staff
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
  ) THEN
    RAISE EXCEPTION 'Apenas staff pode marcar notas como lidas.';
  END IF;

  UPDATE coach_notes
  SET
    is_read = TRUE,
    read_at = timezone('utc'::text, now())
  WHERE aluno_id = p_aluno_id
    AND is_read = FALSE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Função para marcar uma nota específica como lida
CREATE OR REPLACE FUNCTION public.mark_note_as_read(p_note_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é staff
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
  ) THEN
    RAISE EXCEPTION 'Apenas staff pode marcar notas como lidas.';
  END IF;

  UPDATE coach_notes
  SET
    is_read = TRUE,
    read_at = timezone('utc'::text, now())
  WHERE id = p_note_id
    AND is_read = FALSE;

  RETURN FOUND;
END;
$$;

-- Função para obter contagem de notas não lidas por aluno
CREATE OR REPLACE FUNCTION public.get_unread_notes_count(p_aluno_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM coach_notes
  WHERE aluno_id = p_aluno_id
    AND is_read = FALSE;
$$;

-- Função para obter notas recentes (últimas 24h) por aluno
CREATE OR REPLACE FUNCTION public.get_recent_notes(p_aluno_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS SETOF coach_notes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM coach_notes
  WHERE aluno_id = p_aluno_id
    AND created_at >= timezone('utc'::text, now()) - (p_hours || ' hours')::INTERVAL
  ORDER BY created_at DESC;
$$;

-- View para estatísticas de notas por aluno
CREATE OR REPLACE VIEW coach_notes_stats AS
SELECT
  aluno_id,
  COUNT(*)::INTEGER as total_notes,
  COUNT(*) FILTER (WHERE is_read = FALSE)::INTEGER as unread_notes,
  COUNT(*) FILTER (WHERE created_at >= timezone('utc'::text, now()) - INTERVAL '24 hours')::INTEGER as recent_notes_24h,
  MAX(created_at) as last_note_at,
  MAX(created_at) FILTER (WHERE is_read = FALSE) as last_unread_note_at
FROM coach_notes
GROUP BY aluno_id;

-- Habilitar RLS na tabela coach_notes
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- Política: Staff pode ver todas as notas
DROP POLICY IF EXISTS "Staff can view all coach notes" ON coach_notes;
CREATE POLICY "Staff can view all coach notes"
  ON coach_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
    )
  );

-- Política: Staff pode inserir notas
DROP POLICY IF EXISTS "Staff can insert coach notes" ON coach_notes;
CREATE POLICY "Staff can insert coach notes"
  ON coach_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
    )
    AND treinador_id = auth.uid()
  );

-- Política: Staff pode atualizar notas
DROP POLICY IF EXISTS "Staff can update coach notes" ON coach_notes;
CREATE POLICY "Staff can update coach notes"
  ON coach_notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
    )
  );

-- Política: Staff pode deletar notas
DROP POLICY IF EXISTS "Staff can delete coach notes" ON coach_notes;
CREATE POLICY "Staff can delete coach notes"
  ON coach_notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'admin', 'coach')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON coach_notes TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notes_as_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_note_as_read(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_notes_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_notes(UUID, INTEGER) TO authenticated, service_role;
GRANT SELECT ON coach_notes_stats TO authenticated, service_role;
