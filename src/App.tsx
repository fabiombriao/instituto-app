import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Shell from './components/layout/Shell';
import { Loader2 } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const TurmaSetup = lazy(() => import('./pages/TurmaSetup'));
const TurmaDetail = lazy(() => import('./pages/TurmaDetail'));
const InviteAccept = lazy(() => import('./pages/InviteAccept'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TrainerDashboard = lazy(() => import('./pages/TrainerDashboard'));
const Plan12WY = lazy(() => import('./pages/Plan12WY'));
const Habits = lazy(() => import('./pages/Habits'));
const ROI = lazy(() => import('./pages/ROI'));
const Ranking = lazy(() => import('./pages/Ranking'));

function AppRoutes() {
  const { user, profile, loading, signOut } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const isStandaloneAuthRoute =
    pathname.startsWith('/invite/') ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/onboarding' ||
    pathname === '/turma/setup';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  const needsStudentOnboarding =
    profile?.role === 'ALUNO' && !profile?.onboarding_completed_at && !isStandaloneAuthRoute;

  if (needsStudentOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: pathname }} />;
  }

  if (profile?.disabled_at && !isStandaloneAuthRoute) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-xl rounded-[32px] border border-[#1a1a1a] bg-[#050505] p-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">Conta desativada</p>
          <h1 className="mt-4 text-4xl font-black italic uppercase tracking-tighter text-white">
            Acesso bloqueado
          </h1>
          <p className="mt-4 text-sm text-neutral-400">
            Este acesso foi desativado pelo super admin. Entre em contato com a equipe responsável se isso parecer incorreto.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-8 inline-flex items-center justify-center rounded-2xl brand-gradient px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-[0.98]"
          >
            Encerrar sessão
          </button>
        </div>
      </div>
    );
  }

  if (isStandaloneAuthRoute) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/turma/setup" element={<TurmaSetup />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Shell>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/admin"
            element={
              profile?.role === 'SUPER_ADMIN'
                ? <AdminDashboard />
                : <Navigate to="/" replace />
            }
          />
          <Route
            path="/trainer-dashboard"
            element={
              profile?.role === 'SUPER_ADMIN' || profile?.role === 'TREINADOR'
                ? <TrainerDashboard />
                : <Navigate to="/" replace />
            }
          />
          <Route path="/plano" element={<Plan12WY />} />
          <Route path="/habitos" element={<Habits />} />
          <Route path="/roi" element={<ROI />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/turma" element={<Ranking />} />
          <Route path="/turma/:turmaId" element={<TurmaDetail />} />
          <Route path="/turma/setup" element={<TurmaSetup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
