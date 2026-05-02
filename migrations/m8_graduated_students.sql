-- ============================================
-- MIGRATION: M8 - Aluno Graduado (Graduated Students)
-- ============================================
-- RF47, RF48, RF49, RF50, RF51
-- ============================================

-- 1. Adicionar campo de monitor graduado em enrollments
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS graduated_monitor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Índice para buscar alunos de um graduado
CREATE INDEX IF NOT EXISTS idx_enrollments_graduated_monitor 
  ON enrollments(graduated_monitor_id, status);

-- 3. Tabela para rastrear alertas de baixo score (RF48)
CREATE TABLE IF NOT EXISTS low_score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  graduated_monitor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consecutive_low_weeks INTEGER DEFAULT 1,
  first_low_week_date DATE NOT NULL,
  last_low_week_date DATE NOT NULL,
  alert_status TEXT DEFAULT 'active' CHECK (alert_status IN ('active', 'resolved', 'dismissed')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_low_score_alerts_monitor 
  ON low_score_alerts(graduated_monitor_id, alert_status);
CREATE INDEX IF NOT EXISTS idx_low_score_alerts_aluno 
  ON low_score_alerts(aluno_id, alert_status);

-- 4. RPC para listar alunos sob responsabilidade do graduado com métricas
CREATE OR REPLACE FUNCTION public.get_graduated_students(p_graduated_id UUID)
RETURNS TABLE (
  aluno_id UUID,
  aluno_name TEXT,
  aluno_email TEXT,
  enrollment_id UUID,
  turma_id UUID,
  turma_name TEXT,
  latest_weekly_score NUMERIC,
  latest_score_week DATE,
  weeks_below_60 INTEGER,
  has_active_alert BOOLEAN,
  current_streak INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH student_data AS (
    SELECT
      p.id as aluno_id,
      p.full_name,
      p.email,
      e.id as enrollment_id,
      e.turma_id,
      t.name as turma_name,
      ws.score,
      ws.week_ending,
      ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY ws.week_ending DESC) as score_rank
    FROM profiles p
    INNER JOIN enrollments e ON p.id = e.aluno_id
    LEFT JOIN weekly_scores ws ON p.id = ws.aluno_id
    LEFT JOIN turmas t ON e.turma_id = t.id
    WHERE e.graduated_monitor_id = p_graduated_id
      AND e.status = 'active'
  ),
  latest_scores AS (
    SELECT
      aluno_id,
      full_name,
      email,
      enrollment_id,
      turma_id,
      turma_name,
      score,
      week_ending
    FROM student_data
    WHERE score_rank = 1
  ),
  low_weeks AS (
    SELECT
      aluno_id,
      COUNT(*) as weeks_below_60
    FROM weekly_scores ws
    WHERE ws.aluno_id IN (SELECT aluno_id FROM student_data WHERE score_rank = 1)
      AND ws.score < 60
      AND ws.week_ending >= CURRENT_DATE - INTERVAL '8 weeks'
    GROUP BY aluno_id
  ),
  active_alerts AS (
    SELECT
      aluno_id,
      TRUE as has_alert
    FROM low_score_alerts
    WHERE graduated_monitor_id = p_graduated_id
      AND alert_status = 'active'
  ),
  streaks AS (
    SELECT
      h.aluno_id,
      MAX(
        CASE
          WHEN h.is_paused THEN 0
          ELSE (
            SELECT COUNT(*)
            FROM habit_checkins hc
            WHERE hc.habit_id = h.id
              AND hc.status = true
            ORDER BY hc.date DESC
            LIMIT 1000000  -- just get all recent
          ) % 10000000  -- crude max
        END
      ) as max_streak
    FROM habits h
    WHERE h.aluno_id IN (SELECT aluno_id FROM student_data WHERE score_rank = 1)
    GROUP BY h.aluno_id
  )
  SELECT
    ls.aluno_id,
    ls.full_name,
    ls.email,
    ls.enrollment_id,
    ls.turma_id,
    ls.turma_name,
    COALESCE(ls.score, 0)::NUMERIC,
    ls.week_ending,
    COALESCE(lw.weeks_below_60, 0),
    COALESCE(aa.has_alert, FALSE),
    COALESCE(st.max_streak, 0)::INTEGER
  FROM latest_scores ls
  LEFT JOIN low_weeks lw ON ls.aluno_id = lw.aluno_id
  LEFT JOIN active_alerts aa ON ls.aluno_id = aa.aluno_id
  LEFT JOIN streaks st ON ls.aluno_id = st.aluno_id
  ORDER BY COALESCE(ls.score, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC para verificar e criar alertas de baixo score
CREATE OR REPLACE FUNCTION public.check_and_create_low_score_alerts(p_graduated_id UUID)
RETURNS TABLE (
  aluno_id UUID,
  alert_created BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_student RECORD;
  v_low_week_count INTEGER;
  v_first_low_date DATE;
  v_existing_alert RECORD;
BEGIN
  -- Iterar sobre alunos do graduado
  FOR v_student IN
    SELECT DISTINCT
      e.aluno_id,
      p.full_name
    FROM enrollments e
    INNER JOIN profiles p ON e.aluno_id = p.id
    WHERE e.graduated_monitor_id = p_graduated_id
      AND e.status = 'active'
  LOOP
    -- Contar semanas nos últimos 4 meses com score < 60%
    SELECT COUNT(*), MIN(week_ending)
    INTO v_low_week_count, v_first_low_date
    FROM weekly_scores
    WHERE aluno_id = v_student.aluno_id
      AND score < 60
      AND week_ending >= CURRENT_DATE - INTERVAL '16 weeks';

    -- Se 2 ou mais semanas abaixo de 60%, criar/atualizar alerta
    IF v_low_week_count >= 2 THEN
      -- Verificar se já existe alerta ativo
      SELECT *
      INTO v_existing_alert
      FROM low_score_alerts
      WHERE aluno_id = v_student.aluno_id
        AND graduated_monitor_id = p_graduated_id
        AND alert_status = 'active'
      LIMIT 1;

      IF v_existing_alert IS NULL THEN
        INSERT INTO low_score_alerts (
          aluno_id,
          graduated_monitor_id,
          consecutive_low_weeks,
          first_low_week_date,
          last_low_week_date
        ) VALUES (
          v_student.aluno_id,
          p_graduated_id,
          v_low_week_count,
          v_first_low_date,
          CURRENT_DATE
        );

        RETURN QUERY SELECT
          v_student.aluno_id,
          TRUE,
          'Alerta criado: ' || v_student.full_name || ' com ' || v_low_week_count || ' semanas abaixo de 60%';
      ELSE
        -- Atualizar data e contador
        UPDATE low_score_alerts
        SET
          consecutive_low_weeks = v_low_week_count,
          last_low_week_date = CURRENT_DATE,
          updated_at = timezone('utc'::text, now())
        WHERE id = v_existing_alert.id;

        RETURN QUERY SELECT
          v_student.aluno_id,
          FALSE,
          'Alerta atualizado para ' || v_student.full_name;
      END IF;
    ELSE
      -- Se menos de 2 semanas baixas, desativar alerta se existir
      UPDATE low_score_alerts
      SET
        alert_status = 'resolved',
        resolved_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
      WHERE aluno_id = v_student.aluno_id
        AND graduated_monitor_id = p_graduated_id
        AND alert_status = 'active'
        AND consecutive_low_weeks < 2;

      RETURN QUERY SELECT
        v_student.aluno_id,
        FALSE,
        'Alerta resolvido para ' || v_student.full_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC para respeitar limite de alunos por graduado (RF51)
CREATE OR REPLACE FUNCTION public.validate_graduated_monitor_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_monitor_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Se não há graduated_monitor_id sendo atribuído, continuar
  IF NEW.graduated_monitor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar limite do monitor
  SELECT monitor_limit
  INTO v_monitor_limit
  FROM profiles
  WHERE id = NEW.graduated_monitor_id;

  -- Se não tem limite configurado, permitir
  IF v_monitor_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Contar alunos já atribuídos (excluindo a inscrição atual)
  SELECT COUNT(*)
  INTO v_current_count
  FROM enrollments
  WHERE graduated_monitor_id = NEW.graduated_monitor_id
    AND status = 'active'
    AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000');

  -- Validar limite
  IF v_current_count >= v_monitor_limit THEN
    RAISE EXCEPTION 'Limite de alunos para este monitor excedido (limite: %)', v_monitor_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_graduated_monitor_limit ON enrollments;
CREATE TRIGGER check_graduated_monitor_limit
  BEFORE INSERT OR UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_graduated_monitor_limit();

-- 7. RLS para coach_notes (reutilizar para mensagens de graduado)
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_notes_visibility_policy ON coach_notes;
CREATE POLICY coach_notes_visibility_policy ON coach_notes
  FOR SELECT
  USING (
    -- Aluno pode ver notas sobre si mesmo
    aluno_id = auth.uid()
    -- Treinador/staff pode ver notas dos alunos
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'ALUNO_GRADUADO')
    )
    -- Graduado pode ver notas dos alunos que monitora
    OR EXISTS (
      SELECT 1 FROM enrollments e
      INNER JOIN profiles p ON e.graduated_monitor_id = p.id
      WHERE e.aluno_id = coach_notes.aluno_id
        AND p.id = auth.uid()
        AND p.role = 'ALUNO_GRADUADO'
    )
  );

-- 8. Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_graduated_students(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_and_create_low_score_alerts(UUID) TO authenticated, service_role;
