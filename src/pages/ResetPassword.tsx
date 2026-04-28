import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');

      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // Ignore and fall back to the current session check below.
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setLoadingSession(false);
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas informadas não conferem.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  if (loadingSession) {
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
            <Lock className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
            Redefinir senha
          </h1>
          <p className="mt-4 max-w-md text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 leading-relaxed">
            Crie uma nova senha para concluir a recuperação de acesso.
          </p>
        </div>

        {!hasSession ? (
          <div className="relative z-10 rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6 text-amber-100">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Link inválido ou expirado</p>
            <p className="mt-2 text-sm text-amber-50/90">
              O link de recuperação não abriu uma sessão válida. Solicite um novo e-mail de redefinição.
            </p>
            <div className="mt-6">
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-100 hover:text-white"
              >
                <ArrowLeft className="w-3 h-3" />
                Solicitar novo link
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
                Nova senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
                placeholder="Repita a nova senha"
                required
              />
            </div>

            {error && (
              <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-2 ml-1">
                {error}
              </p>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-emerald-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Senha atualizada</p>
                <p className="mt-2 text-sm text-emerald-50/90">
                  A senha foi alterada com sucesso. Você será redirecionado para o login.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full brand-gradient text-black py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-[0.2em] uppercase hover:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4 shadow-lg shadow-emerald-500/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar nova senha
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
