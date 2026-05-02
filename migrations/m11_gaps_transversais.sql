-- ============================================
-- MIGRATION: M11 - Gaps Transversais
-- ============================================
-- 1. LGPD e auditoria de acesso a dados sensiveis
-- 2. Logs de acesso ao ROI
-- 3. Backup, recuperacao e confiabilidade (so doc)
-- 4. Offline real com sincronizacao posterior (cliente)
-- 5. Push notifications PWA (cliente + edge function)
-- 6. Validar performance e limites do PRD (so doc)
-- ============================================
--
-- NOTA: O cliente MCP nao tem permissao para acessar este projeto Supabase.
-- Aplicar este SQL via Supabase SQL Editor manualmente.
-- Padrao seguido: m8_graduated_students.sql, m9_gamification.sql, m10_notifications.sql.
-- ============================================

-- =====================================================
-- 0. EXTENSAO necessaria para inet
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. TABELA audit_log
-- =====================================================
-- Registro generico de acoes sensiveis para auditoria SUPER_ADMIN.
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON audit_log(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log(action, created_at DESC);

-- =====================================================
-- 2. TABELA consent_log
-- =====================================================
-- Registro de consentimento explicito do usuario para LGPD.
CREATE TABLE IF NOT EXISTS consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'terms_of_use',
    'privacy_policy',
    'data_processing',
    'marketing'
  )),
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_consent_log_user
  ON consent_log(user_id, consent_type, created_at DESC);

-- =====================================================
-- 3. TABELA roi_access_log
-- =====================================================
-- Registro especifico de acesso ao ROI de outro aluno
-- (LGPD - quem viu o ROI de quem e quando).
CREATE TABLE IF NOT EXISTS roi_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_roi_access_log_target
  ON roi_access_log(target_user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_access_log_accessor
  ON roi_access_log(accessor_user_id, accessed_at DESC);

-- =====================================================
-- 4. RLS - audit_log
-- =====================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_admin ON audit_log;
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'SUPER_ADMIN'
    )
  );

-- INSERTs sao feitos via SECURITY DEFINER RPC `log_audit`
-- Nao permitir DELETE/UPDATE direto.

-- =====================================================
-- 5. RLS - consent_log
-- =====================================================
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_log_select_self_or_admin ON consent_log;
CREATE POLICY consent_log_select_self_or_admin ON consent_log
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'SUPER_ADMIN'
    )
  );

DROP POLICY IF EXISTS consent_log_insert_self ON consent_log;
CREATE POLICY consent_log_insert_self ON consent_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 6. RLS - roi_access_log
-- =====================================================
ALTER TABLE roi_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roi_access_log_select_target_or_staff ON roi_access_log;
CREATE POLICY roi_access_log_select_target_or_staff ON roi_access_log
  FOR SELECT USING (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('SUPER_ADMIN', 'TREINADOR')
    )
  );

-- INSERTs via RPC SECURITY DEFINER `log_roi_access`.

-- =====================================================
-- 7. RPC: log_audit
-- =====================================================
-- Cliente chama para registrar acao sensivel.
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_user_agent TEXT DEFAULT NULL
) RETURNS audit_log AS $$
DECLARE
  v_user UUID := auth.uid();
  v_log audit_log;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  INSERT INTO audit_log (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    target_user_id,
    details,
    user_agent
  ) VALUES (
    v_user,
    p_action,
    p_resource_type,
    p_resource_id,
    p_target_user_id,
    COALESCE(p_details, '{}'::jsonb),
    p_user_agent
  ) RETURNING * INTO v_log;

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. RPC: log_roi_access
-- =====================================================
-- Registra que alguem (treinador, graduado, super admin)
-- visualizou o ROI de um aluno especifico.
CREATE OR REPLACE FUNCTION public.log_roi_access(
  p_target_user_id UUID,
  p_context TEXT DEFAULT NULL
) RETURNS roi_access_log AS $$
DECLARE
  v_user UUID := auth.uid();
  v_log roi_access_log;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  -- Sem registro quando o proprio aluno ve o seu ROI
  IF v_user = p_target_user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO roi_access_log (accessor_user_id, target_user_id, context)
  VALUES (v_user, p_target_user_id, p_context)
  RETURNING * INTO v_log;

  -- Tambem registra no audit_log generico
  INSERT INTO audit_log (
    actor_user_id, action, resource_type, resource_id, target_user_id, details
  ) VALUES (
    v_user, 'ROI_VIEW', 'roi', NULL, p_target_user_id,
    jsonb_build_object('context', COALESCE(p_context, ''))
  );

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. RPC: get_roi_access_count_for_user
-- =====================================================
-- Conta quantas visualizacoes de outros usuarios o aluno teve no periodo.
CREATE OR REPLACE FUNCTION public.get_roi_access_count_for_user(
  p_period_days INTEGER DEFAULT 30
) RETURNS TABLE (
  total_accesses BIGINT,
  unique_accessors BIGINT,
  last_accessed_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_accesses,
    COUNT(DISTINCT accessor_user_id)::BIGINT AS unique_accessors,
    MAX(accessed_at) AS last_accessed_at
  FROM roi_access_log
  WHERE target_user_id = v_user
    AND accessed_at >= now() - (p_period_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. RPC: get_audit_log
-- =====================================================
-- SUPER_ADMIN consulta historico filtrado.
CREATE OR REPLACE FUNCTION public.get_audit_log(
  p_action TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
) RETURNS TABLE (
  id UUID,
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id UUID,
  target_user_id UUID,
  target_name TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT p.role INTO v_role FROM profiles p WHERE p.id = v_user;

  IF v_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Apenas SUPER_ADMIN pode ler audit_log';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_user_id,
    pa.full_name::TEXT AS actor_name,
    pa.email::TEXT AS actor_email,
    al.action,
    al.resource_type,
    al.resource_id,
    al.target_user_id,
    pt.full_name::TEXT AS target_name,
    al.details,
    al.ip_address,
    al.user_agent,
    al.created_at
  FROM audit_log al
  LEFT JOIN profiles pa ON pa.id = al.actor_user_id
  LEFT JOIN profiles pt ON pt.id = al.target_user_id
  WHERE
    (p_action IS NULL OR al.action = p_action)
    AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    AND (p_actor_user_id IS NULL OR al.actor_user_id = p_actor_user_id)
    AND (p_target_user_id IS NULL OR al.target_user_id = p_target_user_id)
    AND (p_from IS NULL OR al.created_at >= p_from)
    AND (p_to IS NULL OR al.created_at <= p_to)
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. RPC: register_consent
-- =====================================================
CREATE OR REPLACE FUNCTION public.register_consent(
  p_consent_type TEXT,
  p_granted BOOLEAN,
  p_user_agent TEXT DEFAULT NULL
) RETURNS consent_log AS $$
DECLARE
  v_user UUID := auth.uid();
  v_log consent_log;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_consent_type NOT IN ('terms_of_use', 'privacy_policy', 'data_processing', 'marketing') THEN
    RAISE EXCEPTION 'Tipo de consentimento invalido';
  END IF;

  INSERT INTO consent_log (
    user_id, consent_type,
    granted_at, revoked_at, user_agent
  ) VALUES (
    v_user, p_consent_type,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    CASE WHEN NOT p_granted THEN now() ELSE NULL END,
    p_user_agent
  ) RETURNING * INTO v_log;

  -- Auditar
  INSERT INTO audit_log (
    actor_user_id, action, resource_type, resource_id, target_user_id, details
  ) VALUES (
    v_user,
    CASE WHEN p_granted THEN 'CONSENT_GRANTED' ELSE 'CONSENT_REVOKED' END,
    'consent', v_log.id, v_user,
    jsonb_build_object('consent_type', p_consent_type)
  );

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. RPC: get_user_consents
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_consents()
RETURNS TABLE (
  consent_type TEXT,
  is_granted BOOLEAN,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (cl.consent_type)
    cl.consent_type::TEXT,
    (cl.granted_at IS NOT NULL AND cl.revoked_at IS NULL) AS is_granted,
    cl.granted_at,
    cl.revoked_at
  FROM consent_log cl
  WHERE cl.user_id = v_user
  ORDER BY cl.consent_type, cl.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. RPC: export_user_data (LGPD - portabilidade)
-- =====================================================
-- Retorna jsonb com todos os dados do usuario (so o proprio ou SUPER_ADMIN).
CREATE OR REPLACE FUNCTION public.export_user_data(
  p_user_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_target UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
  v_result JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user;

  IF v_target <> v_user AND v_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Sem permissao para exportar dados de outro usuario';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id', v_target,
    'profile', (
      SELECT to_jsonb(p) FROM profiles p WHERE p.id = v_target
    ),
    'enrollments', COALESCE(
      (SELECT jsonb_agg(to_jsonb(e)) FROM enrollments e WHERE e.aluno_id = v_target),
      '[]'::jsonb
    ),
    'cycles', COALESCE(
      (SELECT jsonb_agg(to_jsonb(c)) FROM cycles c WHERE c.aluno_id = v_target),
      '[]'::jsonb
    ),
    'goals', COALESCE(
      (SELECT jsonb_agg(to_jsonb(g)) FROM goals g
        WHERE g.cycle_id IN (SELECT id FROM cycles WHERE aluno_id = v_target)),
      '[]'::jsonb
    ),
    'tactics', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM tactics t
        WHERE t.goal_id IN (
          SELECT g.id FROM goals g
          WHERE g.cycle_id IN (SELECT id FROM cycles WHERE aluno_id = v_target)
        )),
      '[]'::jsonb
    ),
    'tasks', COALESCE(
      (SELECT jsonb_agg(to_jsonb(t)) FROM tasks t
        WHERE t.tactic_id IN (
          SELECT ta.id FROM tactics ta
          WHERE ta.goal_id IN (
            SELECT g.id FROM goals g
            WHERE g.cycle_id IN (SELECT id FROM cycles WHERE aluno_id = v_target)
          )
        )),
      '[]'::jsonb
    ),
    'task_checkins', COALESCE(
      (SELECT jsonb_agg(to_jsonb(tc)) FROM task_checkins tc
        WHERE tc.task_id IN (
          SELECT t.id FROM tasks t
          WHERE t.tactic_id IN (
            SELECT ta.id FROM tactics ta
            WHERE ta.goal_id IN (
              SELECT g.id FROM goals g
              WHERE g.cycle_id IN (SELECT id FROM cycles WHERE aluno_id = v_target)
            )
          )
        )),
      '[]'::jsonb
    ),
    'habits', COALESCE(
      (SELECT jsonb_agg(to_jsonb(h)) FROM habits h WHERE h.aluno_id = v_target),
      '[]'::jsonb
    ),
    'habit_checkins', COALESCE(
      (SELECT jsonb_agg(to_jsonb(hc)) FROM habit_checkins hc
        WHERE hc.habit_id IN (SELECT id FROM habits WHERE aluno_id = v_target)),
      '[]'::jsonb
    ),
    'roi_baselines', COALESCE(
      (SELECT jsonb_agg(to_jsonb(rb)) FROM roi_baselines rb WHERE rb.aluno_id = v_target),
      '[]'::jsonb
    ),
    'roi_results', COALESCE(
      (SELECT jsonb_agg(to_jsonb(rr)) FROM roi_results rr WHERE rr.aluno_id = v_target),
      '[]'::jsonb
    ),
    'weekly_scores', COALESCE(
      (SELECT jsonb_agg(to_jsonb(ws)) FROM weekly_scores ws WHERE ws.aluno_id = v_target),
      '[]'::jsonb
    ),
    'badges', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'badge_id', ub.badge_id,
        'unlocked_at', ub.unlocked_at,
        'badge_name', b.name,
        'badge_description', b.description
      )) FROM user_badges ub
        LEFT JOIN badges b ON b.id = ub.badge_id
        WHERE ub.user_id = v_target),
      '[]'::jsonb
    ),
    'coach_notes', COALESCE(
      (SELECT jsonb_agg(to_jsonb(cn)) FROM coach_notes cn WHERE cn.aluno_id = v_target),
      '[]'::jsonb
    ),
    'messages_sent', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m)) FROM messages m WHERE m.sender_id = v_target),
      '[]'::jsonb
    ),
    'messages_received', COALESCE(
      (SELECT jsonb_agg(to_jsonb(m)) FROM messages m WHERE m.recipient_id = v_target),
      '[]'::jsonb
    ),
    'consents', COALESCE(
      (SELECT jsonb_agg(to_jsonb(cl)) FROM consent_log cl WHERE cl.user_id = v_target),
      '[]'::jsonb
    )
  ) INTO v_result;

  -- Auditar exportacao
  INSERT INTO audit_log (
    actor_user_id, action, resource_type, target_user_id, details
  ) VALUES (
    v_user, 'DATA_EXPORT', 'profile', v_target,
    jsonb_build_object('export_size_estimate', length(v_result::TEXT))
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 14. RPC: delete_user_data (LGPD - direito ao esquecimento)
-- =====================================================
-- Soft delete + anonimizacao de PII. Mantem registros agregados,
-- desidentificando o profile. So o proprio ou SUPER_ADMIN.
CREATE OR REPLACE FUNCTION public.delete_user_data(
  p_user_id UUID DEFAULT NULL,
  p_confirm TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_target UUID := COALESCE(p_user_id, auth.uid());
  v_role TEXT;
  v_anonymized_email TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  IF p_confirm <> 'CONFIRMO_APAGAR_MEUS_DADOS' THEN
    RAISE EXCEPTION 'Confirmacao obrigatoria. Envie p_confirm = ''CONFIRMO_APAGAR_MEUS_DADOS''';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user;

  IF v_target <> v_user AND v_role <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Sem permissao para apagar dados de outro usuario';
  END IF;

  v_anonymized_email := 'deleted-' || replace(v_target::TEXT, '-', '') || '@anonymized.local';

  -- Anonimizar profile (soft delete - mantem id para integridade referencial)
  UPDATE profiles
    SET
      full_name = 'Usuario Removido',
      email = v_anonymized_email,
      avatar_url = NULL,
      disabled_at = COALESCE(disabled_at, now()),
      habit_reminder_enabled = FALSE
    WHERE id = v_target;

  -- Apagar dados sensiveis financeiros e mensagens
  DELETE FROM roi_results WHERE aluno_id = v_target;
  DELETE FROM roi_baselines WHERE aluno_id = v_target;
  DELETE FROM messages WHERE sender_id = v_target OR recipient_id = v_target;
  DELETE FROM coach_notes WHERE aluno_id = v_target;
  DELETE FROM push_subscriptions WHERE user_id = v_target;
  DELETE FROM notification_preferences WHERE user_id = v_target;
  DELETE FROM notification_log WHERE user_id = v_target;

  -- Habitos / tarefas / ciclo: mantemos para integridade de turma agregada,
  -- mas desidentificamos relacao removendo enrollments individuais.
  UPDATE enrollments SET status = 'inactive' WHERE aluno_id = v_target;

  -- Auditar exclusao
  INSERT INTO audit_log (
    actor_user_id, action, resource_type, target_user_id, details
  ) VALUES (
    v_user, 'DATA_DELETE', 'profile', v_target,
    jsonb_build_object('initiator_role', v_role, 'anonymized_email', v_anonymized_email)
  );

  RETURN jsonb_build_object(
    'status', 'ok',
    'user_id', v_target,
    'anonymized_at', now(),
    'anonymized_email', v_anonymized_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 15. TRIGGER: log de UPDATE/DELETE em tabelas sensiveis
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_action TEXT;
  v_resource_id UUID;
  v_target_user UUID;
  v_details JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_action := TG_OP;
  v_resource_id := COALESCE((NEW->>'id')::UUID, (OLD->>'id')::UUID, NULL);

  -- Determinar target_user
  IF TG_TABLE_NAME = 'profiles' THEN
    v_target_user := COALESCE((NEW->>'id')::UUID, (OLD->>'id')::UUID);
  ELSIF TG_TABLE_NAME IN ('roi_baselines', 'roi_results', 'coach_notes') THEN
    v_target_user := COALESCE((NEW->>'aluno_id')::UUID, (OLD->>'aluno_id')::UUID);
  ELSIF TG_TABLE_NAME = 'messages' THEN
    v_target_user := COALESCE((NEW->>'recipient_id')::UUID, (OLD->>'recipient_id')::UUID);
  END IF;

  v_details := jsonb_build_object(
    'op', TG_OP,
    'table', TG_TABLE_NAME
  );

  IF TG_OP = 'UPDATE' THEN
    v_details := v_details || jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_details := v_details || jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- Inserir audit_log usando privilegios SECURITY DEFINER da funcao trigger
  INSERT INTO audit_log (
    actor_user_id, action, resource_type, resource_id, target_user_id, details
  ) VALUES (
    v_actor,
    TG_TABLE_NAME || '_' || v_action,
    TG_TABLE_NAME,
    v_resource_id,
    v_target_user,
    v_details
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Nunca falhar a operacao por causa do log
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers em tabelas sensiveis (idempotentes)
DROP TRIGGER IF EXISTS audit_profiles_change ON profiles;
CREATE TRIGGER audit_profiles_change
  AFTER UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_roi_baselines_change ON roi_baselines;
CREATE TRIGGER audit_roi_baselines_change
  AFTER UPDATE OR DELETE ON roi_baselines
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_roi_results_change ON roi_results;
CREATE TRIGGER audit_roi_results_change
  AFTER UPDATE OR DELETE ON roi_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_coach_notes_change ON coach_notes;
CREATE TRIGGER audit_coach_notes_change
  AFTER UPDATE OR DELETE ON coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS audit_messages_change ON messages;
CREATE TRIGGER audit_messages_change
  AFTER UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- =====================================================
-- 16. GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, UUID, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_roi_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_roi_access_count_for_user(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_log(TEXT, TEXT, UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_consent(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_consents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(UUID, TEXT) TO authenticated;

GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT, INSERT ON consent_log TO authenticated;
GRANT SELECT ON roi_access_log TO authenticated;

-- =====================================================
-- NOTAS FINAIS
-- =====================================================
-- 1. Aplicar via Supabase SQL Editor (MCP nao tem permissao no projeto).
-- 2. Triggers em UPDATE/DELETE de tabelas sensiveis registram em audit_log.
--    Para auditar SELECT use a RPC log_roi_access (chamada explicitamente do client).
-- 3. delete_user_data exige p_confirm = 'CONFIRMO_APAGAR_MEUS_DADOS'.
-- 4. Triggers swallow erros para nao quebrar fluxo de negocio. Validar logs no Supabase.
-- 5. Backup PITR e responsabilidade do plano Pro do Supabase. Ver docs/BACKUP_RUNBOOK.md.
