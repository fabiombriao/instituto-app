import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Loader2, ArrowLeft, Link2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

type InviteContext = {
  token: string;
  email: string | null;
  inviteType: string | null;
  status: string | null;
  turmaName: string | null;
  role: string | null;
};

async function acceptInviteAfterSignup(token: string, email: string, fullName: string) {
  const rpcCandidates = [
    { name: 'accept_user_invite', payloads: [{ p_token: token }] },
    { name: 'accept_profile_invite', payloads: [{ p_token: token }, { p_token: token, p_email: email, p_full_name: fullName }] },
    { name: 'accept_invite_after_signup', payloads: [{ p_token: token }, { p_token: token, p_email: email, p_full_name: fullName }] },
    { name: 'accept_turma_invite_after_signup', payloads: [{ p_token: token }, { p_token: token, p_email: email, p_full_name: fullName }] },
    { name: 'accept_turma_invite', payloads: [{ p_token: token }, { p_token: token, p_email: email, p_full_name: fullName }] },
  ] as const;

  let lastError: unknown = null;

  for (const candidate of rpcCandidates) {
    for (const payload of candidate.payloads) {
      const { error } = await supabase.rpc(candidate.name, payload as Record<string, unknown>);
      if (!error) {
        return;
      }

      lastError = error;
      const message = error.message?.toLowerCase?.() ?? '';
      if (
        message.includes('function') ||
        message.includes('could not find') ||
        message.includes('not exist') ||
        message.includes('unknown') ||
        message.includes('convite inválido') ||
        message.includes('convite expirado') ||
        message.includes('convite já foi utilizado') ||
        message.includes('token inválido')
      ) {
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Não foi possível aceitar o convite.');
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);
  const [emailLocked, setEmailLocked] = useState(false);

  const inviteToken = useMemo(() => {
    return (
      searchParams.get('invite_token') ||
      searchParams.get('token') ||
      searchParams.get('invite') ||
      ''
    ).trim();
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    const loadInviteContext = async () => {
      if (!inviteToken) {
        setInviteContext(null);
        setEmailLocked(false);
        return;
      }

      setInviteLoading(true);

      const { data: userInviteData, error: userInviteError } = await supabase.rpc('get_user_invite_by_token', {
        p_token: inviteToken,
      });

      if (!mounted) return;

      if (!userInviteError && userInviteData) {
        const inviteData = userInviteData as Record<string, unknown>;
        const inviteEmail = typeof inviteData.email === 'string' ? inviteData.email : null;
        const inviteFullName = typeof inviteData.full_name === 'string' ? inviteData.full_name : null;
        const role = typeof inviteData.role === 'string' ? inviteData.role : null;

        setInviteContext({
          token: inviteToken,
          email: inviteEmail ?? searchParams.get('email'),
          inviteType: 'profile',
          status: typeof inviteData.status === 'string' ? inviteData.status : null,
          turmaName: null,
          role,
        });

        if (inviteEmail) {
          setEmail(inviteEmail);
          setEmailLocked(true);
        } else if (searchParams.get('email')) {
          setEmail(searchParams.get('email') ?? '');
          setEmailLocked(true);
        }

        if (inviteFullName) {
          setFullName(inviteFullName);
        }

        setInviteLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_turma_invite_by_token', {
        p_token: inviteToken,
      });

      if (!mounted) return;

      if (error || !data) {
        setInviteContext({
          token: inviteToken,
          email: searchParams.get('email'),
          inviteType: null,
          status: null,
          turmaName: null,
          role: null,
        });
        setEmailLocked(Boolean(searchParams.get('email')));
        setInviteLoading(false);
        return;
      }

      const inviteData = data as Record<string, unknown>;
      const inviteEmail = typeof inviteData.email === 'string' ? inviteData.email : null;
      const turmaName = typeof inviteData.turma_name === 'string'
        ? inviteData.turma_name
        : typeof inviteData.name === 'string'
          ? inviteData.name
          : null;

      setInviteContext({
        token: inviteToken,
        email: inviteEmail ?? searchParams.get('email'),
        inviteType: typeof inviteData.invite_type === 'string' ? inviteData.invite_type : null,
        status: typeof inviteData.status === 'string' ? inviteData.status : null,
        turmaName,
        role: null,
      });

      if (inviteEmail) {
        setEmail(inviteEmail);
        setEmailLocked(true);
      } else if (searchParams.get('email')) {
        setEmail(searchParams.get('email') ?? '');
        setEmailLocked(true);
      }

      setInviteLoading(false);
    };

    void loadInviteContext();

    return () => {
      mounted = false;
    };
  }, [inviteToken, searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session && inviteContext?.token) {
        await acceptInviteAfterSignup(inviteContext.token, email, fullName);
      } else if (inviteContext?.token) {
        window.sessionStorage.setItem('pending-invite-token', inviteContext.token);
        window.sessionStorage.setItem('pending-invite-email', email);
      }

      if (data.session) {
        if (inviteContext?.token && inviteContext.role && inviteContext.role !== 'ALUNO') {
          window.location.replace('/');
          return;
        }

        navigate('/onboarding', { replace: true });
        return;
      }

      navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true });
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  const inviteBanner = inviteContext ? (
    <div className="relative z-10 mb-8 rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Link2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">
            Convite detectado
          </p>
          <p className="mt-1 text-sm text-emerald-50/90">
            {inviteContext.turmaName ? `${inviteContext.turmaName}` : 'Você veio por um link de convite.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/80">
        {inviteContext.email && <p>E-mail do convite: {inviteContext.email}</p>}
        {inviteContext.role && <p>Papel: {inviteContext.role.replaceAll('_', ' ')}</p>}
        {inviteContext.inviteType && <p>Tipo: {inviteContext.inviteType}</p>}
        {inviteContext.status && <p>Status: {inviteContext.status}</p>}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#050505] rounded-[32px] p-10 card-border shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 brand-gradient blur-[100px] opacity-20" />

        <div className="flex flex-col items-center mb-10 relative z-10">
          <div className="w-16 h-16 brand-gradient rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
            <UserPlus className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-center leading-none">
            Criar
            <br />
            Conta
          </h1>
        </div>

        {inviteLoading ? (
          <div className="relative z-10 mb-8 rounded-[28px] border border-[#1a1a1a] bg-[#0a0a0a] p-5 text-neutral-400">
            Carregando convite...
          </div>
        ) : inviteBanner}

        <form onSubmit={handleSignup} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              01. Nome Completo
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
              placeholder="Ex: Fábio Morales"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              02. E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailLocked}
              className={`w-full border rounded-xl px-4 py-4 text-sm font-mono outline-none transition-all placeholder:text-neutral-700 ${
                emailLocked
                  ? 'bg-[#111111] border-emerald-500/30 text-neutral-200 cursor-not-allowed'
                  : 'bg-[#0a0a0a] border-[#262626] focus:border-emerald-500'
              }`}
              placeholder="seu@email.com"
              required
            />
            {emailLocked && (
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                E-mail travado pelo convite
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              03. Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
              placeholder="No mínimo 6 caracteres"
              required
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-rose-200">
              <p className="text-[10px] font-black uppercase tracking-widest">Atenção</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}

          {inviteContext?.token && (
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3 text-neutral-400">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Fluxo convidado
              </div>
              <p className="mt-2 text-sm">
                Ao concluir o cadastro, este convite será aceito automaticamente quando a sessão ficar disponível.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient text-black py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-[0.2em] uppercase hover:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4 shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar no Instituto'}
          </button>
        </form>

        <div className="mt-8 text-center relative z-10">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Já tenho uma conta
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
