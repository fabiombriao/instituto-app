import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, MailQuestion, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

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
            <div className="w-8 h-8 bg-black rounded-lg" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-center leading-none">Mundo<br/>Melhor</h1>
          <p className="text-neutral-500 text-[10px] font-bold tracking-[0.3em] uppercase mt-4">
            Instituto Caminhos do Êxito
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              01. E-mail de Acesso
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
              placeholder="dev@projeto.br"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 ml-1">
              02. Senha de Segurança
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-xl px-4 py-4 text-sm font-mono focus:border-emerald-500 outline-none transition-all placeholder:text-neutral-700"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest mt-2 ml-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-gradient text-black py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-[0.2em] uppercase hover:scale-[0.98] active:scale-[0.95] transition-all disabled:opacity-50 disabled:pointer-events-none mt-8 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Autenticar Acesso'
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-[#262626] text-center relative z-10 flex flex-col gap-4">
          <Link
            to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <KeyRound className="w-3 h-3" />
            Esqueci minha senha
          </Link>
          <Link
            to={`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ''}`}
            className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <MailQuestion className="w-3 h-3" />
            Reenviar confirmação de e-mail
          </Link>
          <Link to="/signup" className="text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:underline">
            Não tem uma conta? Criar acesso
          </Link>
          <button className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-colors">
            Problemas com o acesso? Falar com Suporte
          </button>
        </div>
      </motion.div>
    </div>
  );
}
