import React, { useMemo, useState } from 'react';
import { MailCheck, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canResend = useMemo(() => email.trim().length > 0, [email]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canResend) {
      setError('Informe um e-mail para reenviar a confirmação.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess('Confirmação reenviada. Verifique sua caixa de entrada e spam.');
    }

    setLoading(false);
  };

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
            <MailCheck className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
            Confirme seu e-mail
          </h1>
          <p className="mt-4 max-w-md text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 leading-relaxed">
            A conta só conclui o cadastro depois da confirmação no e-mail.
          </p>
        </div>

        <form onSubmit={handleResend} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              E-mail da conta
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
              placeholder="seu@email.com"
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">E-mail reenviado</p>
              <p className="mt-2 text-sm text-emerald-50/90">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient text-black py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-[0.2em] uppercase hover:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none mt-4 shadow-lg shadow-emerald-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Reenviar confirmação
          </button>
        </form>

        <div className="mt-8 text-center relative z-10 flex flex-col gap-4">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar ao login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
