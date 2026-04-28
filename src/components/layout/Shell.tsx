import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Target,
  History,
  TrendingUp,
  Users,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

function getReminderStorageKey(profileId: string) {
  return `habit-reminder:last-fired:${profileId}`;
}

function parseReminderTime(value: string | null | undefined) {
  const [hourString, minuteString] = (value ?? '08:00').split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 8, minute: 0 };
  }

  return { hour, minute };
}

const ADMIN_NAV_ITEMS = [
  { icon: LayoutDashboard, label: '00. ADMIN GERAL', path: '/admin', superAdminOnly: true },
  { icon: BarChart3, label: '01. DASHBOARD TREINADOR', path: '/trainer-dashboard', superAdminOnly: false },
  { icon: Settings, label: '02. TURMA SETUP', path: '/turma/setup', superAdminOnly: false },
];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: '01. DASHBOARD', path: '/' },
  { icon: Target, label: '02. PLANO 12WY', path: '/plano' },
  { icon: History, label: '03. HÁBITOS', path: '/habitos' },
  { icon: TrendingUp, label: '04. ROI', path: '/roi' },
  { icon: Users, label: '05. TURMA', path: '/turma' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!profile?.habit_reminder_enabled || !profile.habit_reminder_time) {
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    let cancelled = false;
    const { hour, minute } = parseReminderTime(profile.habit_reminder_time);
    const storageKey = getReminderStorageKey(profile.id);

    const fireReminder = async () => {
      if (cancelled) return;

      const now = new Date();
      const reminderTime = new Date(now);
      reminderTime.setHours(hour, minute, 0, 0);

      const todayKey = now.toISOString().split('T')[0];
      const lastFired = window.localStorage.getItem(storageKey);

      if (now < reminderTime || lastFired === todayKey) {
        return;
      }

      const payload = {
        title: 'Lembrete de hábitos',
        body: 'Abra Hábitos e faça o check-in de hoje.',
        url: '/habitos',
      };

      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(payload.title, {
          body: payload.body,
          icon: '/pwa-icon.svg',
          badge: '/pwa-icon.svg',
          data: { url: payload.url },
        });
      } catch {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/pwa-icon.svg',
        });
      }

      window.localStorage.setItem(storageKey, todayKey);
    };

    void fireReminder();
    const interval = window.setInterval(() => {
      void fireReminder();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [profile?.habit_reminder_enabled, profile?.habit_reminder_time, profile?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';
  const canAccessTrainerTools = profile?.role === 'SUPER_ADMIN' || profile?.role === 'TREINADOR';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <header className="md:hidden h-16 bg-[#050505] border-b border-[#262626] px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 brand-gradient rounded-lg flex items-center justify-center shadow-lg shadow-brand-green/20">
            <div className="w-4 h-4 bg-black rounded-sm" />
          </div>
          <span className="font-sans font-black tracking-tighter uppercase text-xs">Instituto CE</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-[#262626] rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 bg-[#050505] sidebar-border flex-col sticky top-0 h-screen">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center shadow-lg shadow-brand-green/20">
              <div className="w-5 h-5 bg-black rounded-md" />
            </div>
            <div>
              <h2 className="font-black text-lg tracking-tighter uppercase leading-none">Instituto</h2>
              <p className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase">Caminhos do Êxito</p>
            </div>
          </div>

          <nav className="flex flex-col gap-4">
            {ADMIN_NAV_ITEMS.filter((item) => (item.superAdminOnly ? isSuperAdmin : canAccessTrainerTools)).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "block text-[11px] font-black tracking-[0.2em] transition-all uppercase border-l-2 pl-3",
                  isActive 
                    ? "text-brand-green border-brand-green" 
                    : "text-neutral-600 border-transparent hover:text-white"
                )}
              >
                {item.label}
              </NavLink>
            ))}

            {canAccessTrainerTools && (
              <div className="my-1 border-t border-[#1a1a1a]" />
            )}

            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "block text-[11px] font-black tracking-[0.2em] transition-all uppercase",
                  isActive 
                    ? "text-brand-green pl-3 border-l-2 border-brand-green font-black" 
                    : "text-neutral-500 hover:text-white font-bold"
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-8">
          <div className="p-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
             <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Suporte</p>
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                <span className="text-[10px] font-mono text-brand-green">ONLINE</span>
             </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-black">
                    {profile?.full_name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{profile?.full_name}</p>
                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">{profile?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 py-2 text-neutral-500 hover:text-rose-500 transition-all font-black text-[10px] tracking-widest uppercase"
            >
              <LogOut className="w-4 h-4" />
              Encerrar Sessão
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 z-40 md:hidden flex"
          >
            <div className="w-4/5 bg-[#050505] h-full shadow-2xl flex flex-col p-8">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 brand-gradient rounded-xl flex items-center justify-center">
                  <div className="w-5 h-5 bg-black rounded-md" />
                </div>
                <h2 className="font-black text-lg tracking-tighter uppercase">Instituto CE</h2>
              </div>
              <nav className="flex flex-col gap-6">
                {ADMIN_NAV_ITEMS.filter((item) => (item.superAdminOnly ? isSuperAdmin : canAccessTrainerTools)).map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "text-sm font-black tracking-[0.2em] uppercase transition-all",
                      isActive ? "text-brand-green" : "text-neutral-500"
                    )}
                  >
                    {item.label}
                  </NavLink>
                ))}

                {canAccessTrainerTools && <div className="border-t border-[#1a1a1a] pt-4" />}

                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "text-sm font-black tracking-[0.2em] uppercase transition-all",
                      isActive ? "text-brand-green" : "text-neutral-500"
                    )}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <button 
                onClick={handleSignOut}
                className="mt-auto flex items-center gap-3 py-4 text-rose-500 font-black text-xs tracking-widest uppercase"
              >
                <LogOut className="w-5 h-5" />
                Encerrar Sessão
              </button>
            </div>
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-8 md:p-12 overflow-auto bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
