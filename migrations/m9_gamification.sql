-- M9: Gamification
-- RF54: Automatizar desbloqueio de badges por regra
-- RF55: Feed de conquistas da turma

-- =====================================================
-- 1. EXTENDED BADGES TABLE (if needed)
-- =====================================================
-- Adiciona campos para rastrear tipo de badge e regra de desbloqueio
ALTER TABLE badges ADD COLUMN IF NOT EXISTS badge_type TEXT;
-- Tipos: 'achievement', 'milestone', 'challenge', 'social'
-- Regras podem ser armazenadas em description ou em tabela separada

-- =====================================================
-- 2. RPC: check_and_unlock_badges
-- =====================================================
-- Verifica quais badges o usuário desbloqueou e insere os novos
CREATE OR REPLACE FUNCTION check_and_unlock_badges(user_id UUID)
RETURNS TABLE(
  newly_unlocked_ids UUID[],
  badge_count INT
) AS $$
DECLARE
  v_newly_unlocked UUID[] := ARRAY[]::UUID[];
  v_cycle_id UUID;
  v_score_this_week INT;
  v_streak_max INT;
  v_roi_total NUMERIC;
  v_habit_count INT;
  v_habit_active_count INT;
  v_task_checkins_count INT;
  v_rank_position INT;
  v_badge_id UUID;
BEGIN
  -- Buscar ciclo ativo do usuário
  SELECT c.id INTO v_cycle_id
  FROM cycles c
  JOIN profiles p ON c.aluno_id = p.id
  WHERE c.aluno_id = user_id
    AND (c.status = 'active' OR c.status IS NULL)
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- Score da semana atual
  SELECT COALESCE(ws.score, 0) INTO v_score_this_week
  FROM weekly_scores ws
  WHERE ws.cycle_id = v_cycle_id
    AND ws.week_number = (
      SELECT CEIL(EXTRACT(DOY FROM NOW())::numeric / 7)::INT
    )
  LIMIT 1;

  -- Streak máximo (maior streak entre hábitos ativos)
  SELECT COALESCE(MAX(
    (SELECT COUNT(*)::INT
     FROM habit_checkins hc
     WHERE hc.habit_id = h.id
       AND hc.status = true
       AND hc.date >= (CURRENT_DATE - INTERVAL '100 days')
       AND hc.date <= CURRENT_DATE
     )
  ), 0) INTO v_streak_max
  FROM habits h
  WHERE h.aluno_id = user_id
    AND h.is_paused = false;

  -- ROI total
  SELECT COALESCE(SUM(rr.amount), 0) INTO v_roi_total
  FROM roi_results rr
  WHERE rr.aluno_id = user_id;

  -- Contagem de hábitos
  SELECT COUNT(*) INTO v_habit_count
  FROM habits h
  WHERE h.aluno_id = user_id;

  SELECT COUNT(*) INTO v_habit_active_count
  FROM habits h
  WHERE h.aluno_id = user_id AND h.is_paused = false;

  -- Contagem de check-ins de tarefas
  SELECT COUNT(*) INTO v_task_checkins_count
  FROM task_checkins tc
  WHERE tc.aluno_id = user_id AND tc.status = true;

  -- =====================================================
  -- BADGE UNLOCK RULES
  -- =====================================================

  -- 1. "Iniciante": 1o check-in (1 hábito ativo ou 1 tarefa feita)
  IF v_habit_active_count > 0 OR v_task_checkins_count > 0 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Iniciante' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 2. "Semana Cheia": Score >= 80% em uma semana
  IF v_score_this_week >= 80 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Semana Cheia' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 3. "Streak Infernal": 7+ dias de streak
  IF v_streak_max >= 7 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Streak Infernal' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 4. "Pesquisador": 10+ check-ins de tarefas
  IF v_task_checkins_count >= 10 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Pesquisador' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 5. "Mestre do Tempo": 30+ dias de streak
  IF v_streak_max >= 30 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Mestre do Tempo' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 6. "Generoso": 100+ de ROI gerado (apenas se role pode ver ROI)
  IF v_roi_total >= 100 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Generoso' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- 7. "Construtor": 5+ hábitos criados
  IF v_habit_count >= 5 THEN
    v_badge_id := (SELECT id FROM badges WHERE name ILIKE 'Construtor' LIMIT 1);
    IF v_badge_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM user_badges WHERE user_id = check_and_unlock_badges.user_id AND badge_id = v_badge_id)
    THEN
      INSERT INTO user_badges (user_id, badge_id, unlocked_at)
      VALUES (check_and_unlock_badges.user_id, v_badge_id, NOW())
      ON CONFLICT DO NOTHING;
      v_newly_unlocked := array_append(v_newly_unlocked, v_badge_id);
    END IF;
  END IF;

  -- Retornar resultado
  RETURN QUERY
  SELECT
    v_newly_unlocked,
    COALESCE((SELECT COUNT(*) FROM user_badges WHERE user_id = check_and_unlock_badges.user_id), 0)::INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. RPC: get_team_achievements
-- =====================================================
-- Retorna badges desbloqueadas recentemente na turma do usuário
CREATE OR REPLACE FUNCTION get_team_achievements(user_id UUID, limit_count INT DEFAULT 20)
RETURNS TABLE(
  id UUID,
  user_full_name TEXT,
  badge_id UUID,
  badge_name TEXT,
  badge_description TEXT,
  badge_icon TEXT,
  unlocked_at TIMESTAMP,
  user_id_achievement UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ub.id,
    p.full_name,
    b.id,
    b.name,
    b.description,
    b.icon,
    ub.unlocked_at,
    ub.user_id
  FROM user_badges ub
  JOIN profiles p ON ub.user_id = p.id
  JOIN badges b ON ub.badge_id = b.id
  WHERE ub.user_id IN (
    -- Todos os alunos da mesma turma(s) do usuário
    SELECT DISTINCT e.aluno_id
    FROM enrollments e
    WHERE e.turma_id IN (
      SELECT DISTINCT turma_id
      FROM enrollments
      WHERE aluno_id = get_team_achievements.user_id
    )
      AND e.status = 'active'
  )
  ORDER BY ub.unlocked_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. TRIGGER: Auto-unlock badges após check-in de hábito
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_unlock_badges_on_habit_checkin()
RETURNS TRIGGER AS $$
DECLARE
  v_habit_aluno_id UUID;
BEGIN
  -- Buscar aluno_id do hábito
  SELECT aluno_id INTO v_habit_aluno_id FROM habits WHERE id = NEW.habit_id LIMIT 1;

  -- Chamar RPC para verificar e desbloquear badges
  IF v_habit_aluno_id IS NOT NULL THEN
    PERFORM check_and_unlock_badges(v_habit_aluno_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_unlock_badges_on_habit_checkin_trigger ON habit_checkins;
CREATE TRIGGER trigger_unlock_badges_on_habit_checkin_trigger
AFTER INSERT OR UPDATE ON habit_checkins
FOR EACH ROW
EXECUTE FUNCTION trigger_unlock_badges_on_habit_checkin();

-- =====================================================
-- 5. TRIGGER: Auto-unlock badges após check-in de tarefa
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_unlock_badges_on_task_checkin()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar RPC para verificar e desbloquear badges
  IF NEW.aluno_id IS NOT NULL THEN
    PERFORM check_and_unlock_badges(NEW.aluno_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_unlock_badges_on_task_checkin_trigger ON task_checkins;
CREATE TRIGGER trigger_unlock_badges_on_task_checkin_trigger
AFTER INSERT OR UPDATE ON task_checkins
FOR EACH ROW
EXECUTE FUNCTION trigger_unlock_badges_on_task_checkin();

-- =====================================================
-- 6. TRIGGER: Auto-unlock badges após lançamento de ROI
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_unlock_badges_on_roi_result()
RETURNS TRIGGER AS $$
BEGIN
  -- Chamar RPC para verificar e desbloquear badges
  IF NEW.aluno_id IS NOT NULL THEN
    PERFORM check_and_unlock_badges(NEW.aluno_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_unlock_badges_on_roi_result_trigger ON roi_results;
CREATE TRIGGER trigger_unlock_badges_on_roi_result_trigger
AFTER INSERT OR UPDATE ON roi_results
FOR EACH ROW
EXECUTE FUNCTION trigger_unlock_badges_on_roi_result();

-- =====================================================
-- 7. SEED: Popular badges padrão (se não existem)
-- =====================================================
INSERT INTO badges (name, description, icon, secret_code, badge_type)
VALUES
  ('Iniciante', 'Registrou o primeiro check-in de um hábito ou tarefa', 'Sparkles', 'badge_iniciante', 'achievement'),
  ('Semana Cheia', 'Alcançou 80% ou mais de score em uma semana', 'Star', 'badge_semana_cheia', 'milestone'),
  ('Streak Infernal', 'Manteve uma sequência de 7 dias consecutivos', 'Flame', 'badge_streak_7', 'challenge'),
  ('Pesquisador', 'Completou 10 ou mais tarefas', 'BookOpen', 'badge_pesquisador', 'achievement'),
  ('Mestre do Tempo', 'Alcançou 30 dias de streak', 'Clock', 'badge_mestre_tempo', 'milestone'),
  ('Generoso', 'Gerou 100 ou mais em ROI', 'Heart', 'badge_generoso', 'achievement'),
  ('Construtor', 'Criou 5 ou mais hábitos', 'Hammer', 'badge_construtor', 'achievement')
ON CONFLICT (secret_code) DO NOTHING;

-- =====================================================
-- 8. RLS POLICIES (verificar/atualizar se necessário)
-- =====================================================
-- Badges são públicas (todos podem ler)
-- user_badges: cada um vê só suas, mas admins veem todas

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION check_and_unlock_badges(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_achievements(UUID, INT) TO authenticated;

-- =====================================================
-- NOTES
-- =====================================================
-- Esta migration assume que as tabelas badges, user_badges, habits,
-- habit_checkins, task_checkins, roi_results, weekly_scores, cycles,
-- enrollments, turmas e profiles já existem com os campos necessários.
--
-- Se houver conflitos com triggers ou RPCs existentes, eles serão
-- substituídos (DROP IF EXISTS).
--
-- Triggers são definidos com SECURITY DEFINER para executar com
-- permissões do proprietário (server-side automatic unlock).
