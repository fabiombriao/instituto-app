-- RF33: Visão consolidada por turma com métricas de desempenho
--
-- Esta RPC calcula:
-- 1. Número total de alunos na turma
-- 2. Score médio da turma (baseado nos weekly_scores dos alunos)
-- 3. Percentual de alunos em risco (score < 60%)

-- Criar ou substituir a função
CREATE OR REPLACE FUNCTION public.get_turma_metrics(p_turma_id UUID)
RETURNS TABLE (
  total_alunos INTEGER,
  average_score NUMERIC,
  risk_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH turma_cycles AS (
    SELECT id, aluno_id
    FROM cycles
    WHERE turma_id = p_turma_id
  ),
  cycle_weekly_scores AS (
    SELECT
      ws.aluno_id,
      ws.score
    FROM weekly_scores ws
    INNER JOIN turma_cycles tc ON ws.cycle_id = tc.id
  ),
  aluno_avg_scores AS (
    SELECT
      aluno_id,
      AVG(score) as avg_score
    FROM cycle_weekly_scores
    GROUP BY aluno_id
  )
  SELECT
    (SELECT COUNT(DISTINCT aluno_id) FROM turma_cycles) as total_alunos,
    (SELECT COALESCE(AVG(score), 0) FROM cycle_weekly_scores) as average_score,
    (SELECT COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE avg_score < 60)::NUMERIC /
        NULLIF(COUNT(*), 0)) * 100
      ), 0)
     FROM aluno_avg_scores) as risk_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_turma_metrics(UUID) TO authenticated, service_role;

-- Comentário para documentação
COMMENT ON FUNCTION public.get_turma_metrics IS 'Calcula métricas consolidadas por turma: total de alunos, score médio e percentual em risco (score < 60%)';
