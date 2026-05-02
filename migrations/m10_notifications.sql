-- ============================================
-- MIGRATION: M10 - Notificacoes (Notifications)
-- ============================================
-- RF57: Lembrete diario de habitos com horario configuravel (UI)
-- RF58: Lembrete de fechamento semanal da turma
-- RF59: Alerta de score baixo para treinador e graduado
-- RF60: Celebracao de badge via push e banner interno
-- RF61: Notificar quando o graduado enviar mensagem
-- RF62: Notificar quando o aluno responder ao graduado
-- RF63: Preferencias por tipo e canal de notificacao
-- ============================================
--
-- NOTA: O cliente MCP nao tem permissao para acessar este projeto Supabase.
-- Aplicar este SQL via Supabase SQL Editor manualmente.
-- Padrao seguido: m8_graduated_students.sql, m9_gamification.sql.
-- ============================================

-- =====================================================
-- 0. CAMPO NOVO em turmas: weekly_closure_day
-- =====================================================
-- Já existe `fechamento_dia` (numerico 0-6) em turmas, mas adicionamos
-- um alias semantico se ainda nao existir, garantindo compatibilidade.
ALTER TABLE turmas
  ADD COLUMN IF NOT EXISTS weekly_closure_day INTEGER;

-- Backfill: usar fechamento_dia se weekly_closure_day for NULL
UPDATE turmas
  SET weekly_closure_day = fechamento_dia
  WHERE weekly_closure_day IS NULL;

-- =====================================================
-- 1. TABELA notification_log
-- =====================================================
-- Persistencia de notificacoes ja enviadas para evitar reenvio
-- e alimentar o NotificationCenter / Bell.
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'HABIT_REMINDER',
    'WEEKLY_CLOSURE',
    'LOW_SCORE_ALERT',
    'BADGE_UNLOCK',
    'MESSAGE_RECEIVED'
  )),
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON notification_log(user_id, read_at, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_type
  ON notification_log(user_id, type, sent_at DESC);

-- =====================================================
-- 2. TABELA notification_preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'HABIT_REMINDER',
    'WEEKLY_CLOSURE',
    'LOW_SCORE_ALERT',
    'BADGE_UNLOCK',
    'MESSAGE_RECEIVED'
  )),
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);

-- =====================================================
-- 3. TABELA messages (canal bidirecional graduado <-> aluno)
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient
  ON messages(recipient_id, read_at, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages(sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread
  ON messages(parent_message_id);

-- =====================================================
-- 4. TABELA push_subscriptions
-- =====================================================
-- Reservada para futuro envio server-side via Web Push (VAPID).
-- Atualmente nao temos backend para disparar push, entao notificacoes
-- locais sao usadas via registration.showNotification (ver pushSubscription.ts).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions(user_id);

-- =====================================================
-- 5. RLS - notification_log
-- =====================================================
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_log_select_self ON notification_log;
CREATE POLICY notification_log_select_self ON notification_log
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_log_insert_self_or_staff ON notification_log;
CREATE POLICY notification_log_insert_self_or_staff ON notification_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR', 'ALUNO_GRADUADO')
    )
  );

DROP POLICY IF EXISTS notification_log_update_self ON notification_log;
CREATE POLICY notification_log_update_self ON notification_log
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_log_delete_self ON notification_log;
CREATE POLICY notification_log_delete_self ON notification_log
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- 6. RLS - notification_preferences
-- =====================================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_select_self ON notification_preferences;
CREATE POLICY notification_preferences_select_self ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_insert_self ON notification_preferences;
CREATE POLICY notification_preferences_insert_self ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_self ON notification_preferences;
CREATE POLICY notification_preferences_update_self ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 7. RLS - messages
-- =====================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select_participant ON messages;
CREATE POLICY messages_select_participant ON messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    -- Staff de turma do aluno tambem pode ler
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR')
    )
  );

DROP POLICY IF EXISTS messages_insert_sender ON messages;
CREATE POLICY messages_insert_sender ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS messages_update_recipient ON messages;
CREATE POLICY messages_update_recipient ON messages
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- =====================================================
-- 8. RLS - push_subscriptions
-- =====================================================
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_self ON push_subscriptions;
CREATE POLICY push_subscriptions_self ON push_subscriptions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 9. RPC: send_message
-- =====================================================
CREATE OR REPLACE FUNCTION public.send_message(
  p_recipient_id UUID,
  p_content TEXT,
  p_parent_id UUID DEFAULT NULL
) RETURNS messages AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_message messages;
  v_recipient_role TEXT;
  v_sender_role TEXT;
  v_pref RECORD;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_recipient_id IS NULL OR length(coalesce(p_content, '')) = 0 THEN
    RAISE EXCEPTION 'Destinatario e conteudo sao obrigatorios';
  END IF;

  IF p_recipient_id = v_sender_id THEN
    RAISE EXCEPTION 'Destinatario nao pode ser voce mesmo';
  END IF;

  -- Validar canal: graduado <-> aluno (apenas alunos do graduado)
  SELECT role INTO v_sender_role FROM profiles WHERE id = v_sender_id;
  SELECT role INTO v_recipient_role FROM profiles WHERE id = p_recipient_id;

  -- Aluno so pode responder ao graduado que o monitora
  IF v_sender_role = 'ALUNO' THEN
    IF NOT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.aluno_id = v_sender_id
        AND e.graduated_monitor_id = p_recipient_id
        AND e.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Aluno so pode enviar mensagens ao seu monitor graduado';
    END IF;
  END IF;

  -- Graduado so pode iniciar conversa com seus alunos
  IF v_sender_role = 'ALUNO_GRADUADO' THEN
    IF NOT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.graduated_monitor_id = v_sender_id
        AND e.aluno_id = p_recipient_id
        AND e.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Graduado so pode enviar mensagens aos seus alunos';
    END IF;
  END IF;

  INSERT INTO messages (sender_id, recipient_id, content, parent_message_id)
  VALUES (v_sender_id, p_recipient_id, p_content, p_parent_id)
  RETURNING * INTO v_message;

  -- Verificar preferencias e gravar notification_log para o destinatario
  SELECT
    coalesce(np.in_app_enabled, TRUE) AS in_app_enabled
  INTO v_pref
  FROM (SELECT 1) base
  LEFT JOIN notification_preferences np
    ON np.user_id = p_recipient_id AND np.notification_type = 'MESSAGE_RECEIVED';

  IF v_pref.in_app_enabled IS NOT FALSE THEN
    INSERT INTO notification_log (user_id, type, title, body, url, payload)
    VALUES (
      p_recipient_id,
      'MESSAGE_RECEIVED',
      'Nova mensagem',
      substring(p_content from 1 for 140),
      '/messages',
      jsonb_build_object('message_id', v_message.id, 'sender_id', v_sender_id)
    );
  END IF;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. RPC: mark_message_read
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS messages AS $$
DECLARE
  v_user UUID := auth.uid();
  v_msg messages;
BEGIN
  UPDATE messages
    SET read_at = COALESCE(read_at, timezone('utc'::text, now()))
    WHERE id = p_message_id
      AND recipient_id = v_user
    RETURNING * INTO v_msg;

  IF v_msg.id IS NULL THEN
    RAISE EXCEPTION 'Mensagem nao encontrada ou sem permissao';
  END IF;

  RETURN v_msg;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. RPC: mark_notification_read
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS notification_log AS $$
DECLARE
  v_user UUID := auth.uid();
  v_notif notification_log;
BEGIN
  UPDATE notification_log
    SET read_at = COALESCE(read_at, timezone('utc'::text, now()))
    WHERE id = p_notification_id
      AND user_id = v_user
    RETURNING * INTO v_notif;

  IF v_notif.id IS NULL THEN
    RAISE EXCEPTION 'Notificacao nao encontrada ou sem permissao';
  END IF;

  RETURN v_notif;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. RPC: mark_all_notifications_read
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INTEGER;
BEGIN
  UPDATE notification_log
    SET read_at = timezone('utc'::text, now())
    WHERE user_id = v_user
      AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. RPC: get_trainer_low_score_alerts
-- =====================================================
-- Lista alunos das turmas do treinador com baixo score recente.
-- Banner do TrainerDashboard consome esta RPC.
CREATE OR REPLACE FUNCTION public.get_trainer_low_score_alerts(p_treinador_id UUID DEFAULT NULL)
RETURNS TABLE (
  alert_id UUID,
  aluno_id UUID,
  aluno_name TEXT,
  aluno_email TEXT,
  turma_id UUID,
  turma_name TEXT,
  latest_weekly_score NUMERIC,
  weeks_below_60 INTEGER,
  alert_status TEXT,
  graduated_monitor_id UUID,
  graduated_monitor_name TEXT,
  first_low_week_date DATE,
  last_low_week_date DATE
) AS $$
DECLARE
  v_treinador_id UUID := COALESCE(p_treinador_id, auth.uid());
BEGIN
  RETURN QUERY
  WITH trainer_turmas AS (
    SELECT t.id AS turma_id, t.name AS turma_name
    FROM turmas t
    WHERE t.treinador_id = v_treinador_id
  ),
  trainer_aluno_enrollments AS (
    SELECT DISTINCT e.aluno_id, e.turma_id, e.graduated_monitor_id
    FROM enrollments e
    INNER JOIN trainer_turmas tt ON tt.turma_id = e.turma_id
    WHERE e.status = 'active'
  ),
  latest_scores AS (
    SELECT DISTINCT ON (ws.aluno_id) ws.aluno_id, ws.score
    FROM weekly_scores ws
    INNER JOIN trainer_aluno_enrollments tae ON tae.aluno_id = ws.aluno_id
    ORDER BY ws.aluno_id, ws.week_ending DESC NULLS LAST, ws.created_at DESC
  )
  SELECT
    lsa.id::UUID AS alert_id,
    p.id::UUID AS aluno_id,
    p.full_name::TEXT AS aluno_name,
    p.email::TEXT AS aluno_email,
    tt.turma_id::UUID,
    tt.turma_name::TEXT,
    COALESCE(ls.score, 0)::NUMERIC AS latest_weekly_score,
    COALESCE(lsa.consecutive_low_weeks, 0)::INTEGER AS weeks_below_60,
    COALESCE(lsa.alert_status, 'active')::TEXT AS alert_status,
    tae.graduated_monitor_id::UUID,
    gp.full_name::TEXT AS graduated_monitor_name,
    lsa.first_low_week_date::DATE,
    lsa.last_low_week_date::DATE
  FROM trainer_aluno_enrollments tae
  INNER JOIN trainer_turmas tt ON tt.turma_id = tae.turma_id
  INNER JOIN profiles p ON p.id = tae.aluno_id
  LEFT JOIN latest_scores ls ON ls.aluno_id = tae.aluno_id
  LEFT JOIN low_score_alerts lsa
    ON lsa.aluno_id = tae.aluno_id
    AND lsa.alert_status = 'active'
  LEFT JOIN profiles gp ON gp.id = tae.graduated_monitor_id
  WHERE lsa.id IS NOT NULL
     OR COALESCE(ls.score, 0) < 60
  ORDER BY COALESCE(ls.score, 0) ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 14. RPC: trainer_resolve_alert
-- =====================================================
CREATE OR REPLACE FUNCTION public.trainer_resolve_alert(
  p_alert_id UUID,
  p_action TEXT
)
RETURNS low_score_alerts AS $$
DECLARE
  v_user UUID := auth.uid();
  v_alert low_score_alerts;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_user;

  IF v_role NOT IN ('SUPER_ADMIN', 'TREINADOR', 'ALUNO_GRADUADO') THEN
    RAISE EXCEPTION 'Sem permissao para gerenciar alertas';
  END IF;

  IF p_action NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Acao invalida (resolved|dismissed)';
  END IF;

  UPDATE low_score_alerts
    SET
      alert_status = p_action,
      resolved_at = CASE WHEN p_action = 'resolved' THEN timezone('utc'::text, now()) ELSE resolved_at END,
      dismissed_at = CASE WHEN p_action = 'dismissed' THEN timezone('utc'::text, now()) ELSE dismissed_at END,
      updated_at = timezone('utc'::text, now())
    WHERE id = p_alert_id
    RETURNING * INTO v_alert;

  IF v_alert.id IS NULL THEN
    RAISE EXCEPTION 'Alerta nao encontrado';
  END IF;

  RETURN v_alert;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 15. RPC: should_send_weekly_closure_reminder
-- =====================================================
-- Retorna TRUE se hoje for o dia de fechamento da turma do usuario
-- e ainda nao foi enviado lembrete para esse usuario nesta data.
CREATE OR REPLACE FUNCTION public.should_send_weekly_closure_reminder(
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  user_id UUID,
  turma_id UUID,
  turma_name TEXT,
  fechamento_dia INTEGER,
  fechamento_hora TEXT
) AS $$
DECLARE
  v_user UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  SELECT
    v_user::UUID AS user_id,
    t.id::UUID AS turma_id,
    t.name::TEXT AS turma_name,
    COALESCE(t.weekly_closure_day, t.fechamento_dia)::INTEGER AS fechamento_dia,
    t.fechamento_hora::TEXT AS fechamento_hora
  FROM enrollments e
  INNER JOIN turmas t ON t.id = e.turma_id
  WHERE e.aluno_id = v_user
    AND e.status = 'active'
    AND COALESCE(t.weekly_closure_day, t.fechamento_dia) = EXTRACT(DOW FROM CURRENT_DATE)::INTEGER
    AND NOT EXISTS (
      SELECT 1 FROM notification_log nl
      WHERE nl.user_id = v_user
        AND nl.type = 'WEEKLY_CLOSURE'
        AND nl.sent_at::DATE = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 16. RPC: log_notification (helper para o cliente)
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_notification(
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS notification_log AS $$
DECLARE
  v_user UUID := auth.uid();
  v_notif notification_log;
  v_pref RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_type NOT IN ('HABIT_REMINDER','WEEKLY_CLOSURE','LOW_SCORE_ALERT','BADGE_UNLOCK','MESSAGE_RECEIVED') THEN
    RAISE EXCEPTION 'Tipo invalido';
  END IF;

  -- Verificar preferencia in_app
  SELECT
    coalesce(np.in_app_enabled, TRUE) AS in_app_enabled
  INTO v_pref
  FROM (SELECT 1) base
  LEFT JOIN notification_preferences np
    ON np.user_id = v_user AND np.notification_type = p_type;

  IF v_pref.in_app_enabled IS FALSE THEN
    RETURN NULL;
  END IF;

  INSERT INTO notification_log (user_id, type, title, body, url, payload)
  VALUES (v_user, p_type, p_title, p_body, p_url, COALESCE(p_payload, '{}'::jsonb))
  RETURNING * INTO v_notif;

  RETURN v_notif;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 17. RPC: upsert_notification_preference
-- =====================================================
CREATE OR REPLACE FUNCTION public.upsert_notification_preference(
  p_type TEXT,
  p_push_enabled BOOLEAN,
  p_email_enabled BOOLEAN,
  p_in_app_enabled BOOLEAN
) RETURNS notification_preferences AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pref notification_preferences;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_type NOT IN ('HABIT_REMINDER','WEEKLY_CLOSURE','LOW_SCORE_ALERT','BADGE_UNLOCK','MESSAGE_RECEIVED') THEN
    RAISE EXCEPTION 'Tipo invalido';
  END IF;

  INSERT INTO notification_preferences (user_id, notification_type, push_enabled, email_enabled, in_app_enabled)
  VALUES (v_user, p_type, p_push_enabled, p_email_enabled, p_in_app_enabled)
  ON CONFLICT (user_id, notification_type) DO UPDATE
    SET
      push_enabled = EXCLUDED.push_enabled,
      email_enabled = EXCLUDED.email_enabled,
      in_app_enabled = EXCLUDED.in_app_enabled,
      updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_pref;

  RETURN v_pref;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 18. RPC: get_unread_messages_count
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_unread_messages_count()
RETURNS INTEGER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM messages
  WHERE recipient_id = v_user
    AND read_at IS NULL;
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 19. GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trainer_low_score_alerts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trainer_resolve_alert(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.should_send_weekly_closure_reminder(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_notification(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_notification_preference(TEXT, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_messages_count() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON notification_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;

-- =====================================================
-- NOTAS FINAIS
-- =====================================================
-- 1. Aplicar via Supabase SQL Editor (MCP nao tem permissao no projeto).
-- 2. Como nao temos backend para enviar Web Push real (VAPID), as notificacoes
--    sao disparadas LOCALMENTE via registration.showNotification no cliente.
--    A tabela push_subscriptions fica preparada para evolucao futura.
-- 3. Todas as RPCs sao SECURITY DEFINER. RLS protege as tabelas.
-- 4. Validar smoke real apos aplicar.
