import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { WeeklyScore, Profile } from '../types';

const FETCH_TIMEOUT_MS = 8000;

function createLoadingFinisher(setLoading: (value: boolean) => void) {
  let settled = false;

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      setLoading(false);
    }
  }, FETCH_TIMEOUT_MS);

  return () => {
    if (settled) return false;
    settled = true;
    clearTimeout(timeout);
    setLoading(false);
    return true;
  };
}

export interface TurmaWeeklyScoreData {
  alunoId: string;
  profile: Profile | null;
  scores: WeeklyScore[];
}

export function useTurmaWeeklyScores(turmaId: string | null) {
  const [weeklyScoresData, setWeeklyScoresData] = useState<TurmaWeeklyScoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTurmaWeeklyScores = async () => {
    if (!turmaId) {
      setWeeklyScoresData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const finishLoading = createLoadingFinisher(setLoading);
    setError(null);

    try {
      // Buscar todos os ciclos ativos da turma
      const { data: cycles, error: cyclesError } = await supabase
        .from('cycles')
        .select('id, aluno_id')
        .eq('turma_id', turmaId)
        .eq('status', 'active');

      if (cyclesError) {
        throw cyclesError;
      }

      if (!cycles || cycles.length === 0) {
        setWeeklyScoresData([]);
        return;
      }

      // Buscar os perfis dos alunos
      const alunoIds = cycles.map((cycle) => cycle.aluno_id).filter(Boolean);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', alunoIds);

      if (profilesError) {
        throw profilesError;
      }

      const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));

      // Buscar os weekly scores para cada ciclo
      const cycleIds = cycles.map((cycle) => cycle.id);
      const { data: weeklyScores, error: scoresError } = await supabase
        .from('weekly_scores')
        .select('*')
        .in('cycle_id', cycleIds)
        .order('week_number', { ascending: true });

      if (scoresError) {
        throw scoresError;
      }

      // Agrupar os scores por aluno
      const scoresByAluno = new Map<string, WeeklyScore[]>();
      (weeklyScores || []).forEach((score) => {
        const cycle = cycles.find((c) => c.id === score.cycle_id);
        if (cycle?.aluno_id) {
          if (!scoresByAluno.has(cycle.aluno_id)) {
            scoresByAluno.set(cycle.aluno_id, []);
          }
          scoresByAluno.get(cycle.aluno_id)?.push(score);
        }
      });

      // Criar o array final com os dados combinados
      const data: TurmaWeeklyScoreData[] = Array.from(scoresByAluno.entries()).map(([alunoId, scores]) => ({
        alunoId,
        profile: profilesMap.get(alunoId) || null,
        scores,
      }));

      setWeeklyScoresData(data);
    } catch (err) {
      console.error('Error fetching turma weekly scores:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os scores semanais da turma.');
    } finally {
      finishLoading();
    }
  };

  useEffect(() => {
    fetchTurmaWeeklyScores();
  }, [turmaId]);

  return {
    weeklyScoresData,
    loading,
    error,
    refetch: fetchTurmaWeeklyScores,
  };
}
