import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Program, TurmaInvite } from '../types';
import { formatTurmaInviteLabel } from '../lib/turmaLabel';

export default function InviteAccept() {
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<TurmaInvite | null>(null);
  const [turmaLabel, setTurmaLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_turma_invite_by_token', {
        p_token: token,
      });

      if (!mounted) return;

      if (error) {
        setError('Não foi possível carregar o convite.');
      } else if (!data) {
        setError('Convite não encontrado ou indisponível.');
      } else {
        const inviteData = data as TurmaInvite;
        setInvite(inviteData);

        const { data: turmaData, error: turmaError } = await supabase
          .from('turmas')
          .select('id, name, program_id, created_at')
          .eq('id', inviteData.turma_id)
          .maybeSingle();

        if (!mounted) return;

        if (turmaError || !turmaData) {
          setTurmaLabel(formatTurmaInviteLabel('Turma', { mode: 'standard' }));
        } else {
          const [programResult, turmaRowsResult] = await Promise.all([
            turmaData.program_id
              ? supabase.from('programs').select('id, name').eq('id', turmaData.program_id).maybeSingle()
              : Promise.resolve({ data: null as Program | null, error: null }),
            turmaData.program_id
              ? supabase
                  .from('turmas')
                  .select('id, created_at')
                  .eq('program_id', turmaData.program_id)
                  .order('created_at', { ascending: true })
            : Promise.resolve({ data: [] as Array<{ id: string; created_at: string }>, error: null }),
          ]);

          const programData = programResult.data;
          const turmaRows = turmaRowsResult.data ?? [];
          const turmaIndex = turmaRows.findIndex((row) => row.id === turmaData.id);

          setTurmaLabel(
            formatTurmaInviteLabel(turmaData.name, {
              programName: programData?.name ?? null,
              turmaNumber: turmaIndex >= 0 ? turmaIndex + 1 : null,
              mode: 'standard',
            })
          );
        }
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    setError(null);

    const { error } = await supabase.rpc('accept_turma_invite', {
      p_token: token,
    });

    if (error) {
      setError(error.message);
      setAccepting(false);
      return;
    }

    setSuccess('Convite aceito com sucesso. Você já pode acessar sua turma.');
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 900);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-[#050505] rounded-[32px] p-10 card-border shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 brand-gradient blur-[100px] opacity-20" />

        <div className="flex flex-col items-center mb-10 relative z-10 text-center">
          <div className="w-16 h-16 brand-gradient rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
            <Link2 className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
            Convite de turma
          </h1>
          <p className="mt-4 max-w-md text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 leading-relaxed">
            Aceite o vínculo para entrar na turma do instituto.
          </p>
        </div>

        {!user ? (
          <div className="relative z-10 rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              Faça login para continuar
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Entre com a conta que recebeu o convite para poder aceitar o vínculo.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black"
              >
                <ArrowLeft className="h-4 w-4" />
                Ir para login
              </Link>
              <Link
                to={`/signup?invite_token=${encodeURIComponent(token)}${invite?.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#1a1a1a] px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300"
              >
                Criar conta
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative z-10 space-y-6">
            {invite ? (
              <div className="rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Convite detectado</p>
                <p className="mt-3 text-2xl font-black italic uppercase tracking-tighter text-white">
                  {turmaLabel ?? formatTurmaInviteLabel('Turma', { mode: 'standard' })}
                </p>
                <div className="mt-4 space-y-2 text-sm text-neutral-400">
                  <p>Tipo: {invite.invite_type}</p>
                  <p>Status: {invite.status}</p>
                  {invite.email && <p>E-mail esperado: {invite.email}</p>}
                  {profile?.email && invite.email && profile.email.toLowerCase() !== invite.email.toLowerCase() && (
                    <p className="text-amber-300">
                      O convite foi emitido para outro e-mail. Faça login com a conta correta.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6 text-amber-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Convite indisponível</p>
                <p className="mt-3 text-sm text-amber-50/90">
                  Não foi possível localizar este convite. Verifique se o link está correto.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-5 text-rose-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Atenção</p>
                <p className="mt-2 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Tudo certo</p>
                <p className="mt-2 text-sm">{success}</p>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={!invite || accepting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98] disabled:opacity-50"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aceitar convite
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
