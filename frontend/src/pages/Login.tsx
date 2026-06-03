import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers, Eye, EyeOff, Lock, Mail, AlertCircle,
  CheckCircle2, GitBranch, ShieldCheck, Zap, Sun, Moon,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  {
    email: 'admin@qa.com',
    role: 'QA Admin',
    icon: '🔑',
    gradient: 'from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/50',
    text: 'text-red-700 dark:text-red-300',
  },
  {
    email: 'lead@qa.com',
    role: 'QA Lead',
    icon: '⭐',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-300',
  },
  {
    email: 'engineer1@qa.com',
    role: 'QA Engineer',
    icon: '⚙️',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-700 dark:text-blue-300',
  },
  {
    email: 'viewer@qa.com',
    role: 'Viewer',
    icon: '👁️',
    gradient: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50 dark:bg-slate-800/60',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Enterprise-Grade Security',
    desc: 'Role-based access control with full audit logging',
  },
  {
    icon: GitBranch,
    title: 'Version-Controlled Assets',
    desc: 'Track every change with complete history',
  },
  {
    icon: Zap,
    title: 'Smart Approval Workflows',
    desc: 'Automated review pipelines with notifications',
  },
];

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filledRole, setFilledRole] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: typeof DEMO_USERS[0]) => {
    setEmail(u.email);
    setPassword('password123');
    setFilledRole(u.role);
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* ── Theme Toggle ── */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-600 dark:text-slate-300 hover:text-[#08a49c] transition-all hover:scale-105 shadow-md"
        title="Toggle theme"
      >
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* ══════════════════════════════════════════
          LEFT PANEL — Animated Brand Hero (60%)
      ══════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[60%] relative flex-col justify-between overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #06736d 0%, #08a49c 30%, #06b6d4 65%, #0891b2 100%)',
          backgroundSize: '300% 300%',
          animation: 'gradient-shift 10s ease infinite',
        }}
      >
        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(145deg, rgba(4,50,47,0.55) 0%, rgba(6,60,56,0.3) 50%, rgba(4,40,55,0.5) 100%)',
          }}
        />

        {/* Floating blobs */}
        <div
          className="login-blob w-96 h-96 opacity-30"
          style={{
            background: 'rgba(94,234,212,0.5)',
            top: '-80px',
            left: '-80px',
            animation: 'blobFloat1 14s ease-in-out infinite',
          }}
        />
        <div
          className="login-blob w-80 h-80 opacity-20"
          style={{
            background: 'rgba(6,182,212,0.6)',
            bottom: '80px',
            right: '-60px',
            animation: 'blobFloat2 17s ease-in-out infinite',
          }}
        />
        <div
          className="login-blob w-64 h-64 opacity-25"
          style={{
            background: 'rgba(8,164,156,0.5)',
            top: '40%',
            left: '45%',
            animation: 'blobFloat3 11s ease-in-out infinite',
          }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-12 justify-between">
          {/* Top: Logo */}
          <div className="animate-fade-in-up stagger-1">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              >
                <Layers size={22} className="text-white" />
              </div>
              <div>
                <span className="text-white font-extrabold text-xl tracking-tight">Q-KTAMP</span>
                <div className="text-xs text-teal-200/80 font-medium tracking-wide">QA Asset Platform</div>
              </div>
            </div>
          </div>

          {/* Middle: Main copy */}
          <div className="space-y-8">
            <div className="animate-fade-in-up stagger-2">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-semibold text-teal-100 tracking-wider uppercase"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-teal-300"
                  style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
                />
                Enterprise QA Platform
              </div>
              <h1
                className="text-5xl font-black text-white leading-tight tracking-tight"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
              >
                Manage QA Assets
                <br />
                <span
                  style={{
                    background: 'linear-gradient(90deg, #a7f3d0, #5eead4, #a5f3fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  With Confidence.
                </span>
              </h1>
              <p className="text-teal-100/80 text-lg mt-4 leading-relaxed max-w-md">
                A unified platform for your test data, documentation, and approval workflows — built for modern QA teams.
              </p>
            </div>

            {/* Feature rows */}
            <div className="space-y-3 animate-fade-in-up stagger-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="feature-row"
                  style={{ animationDelay: `${(i + 4) * 80}ms` }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(255,255,255,0.18)',
                      border: '1px solid rgba(255,255,255,0.25)',
                    }}
                  >
                    <f.icon size={16} className="text-white" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{f.title}</div>
                    <div className="text-teal-200/70 text-xs mt-0.5">{f.desc}</div>
                  </div>
                  <CheckCircle2 size={15} className="text-teal-300/60 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Stats */}
          <div
            className="animate-fade-in-up stagger-5 grid grid-cols-3 gap-4 pt-6 border-t"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            {[
              { num: '50K+', label: 'Assets Managed' },
              { num: '200+', label: 'QA Teams' },
              { num: '99.9%', label: 'Uptime SLA' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-extrabold text-white">{s.num}</div>
                <div className="text-teal-200/70 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          RIGHT PANEL — Login Form (40%)
      ══════════════════════════════════════════ */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center bg-white dark:bg-slate-950 relative overflow-y-auto">
        {/* Subtle background noise for the form side */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, #08a49c 0%, transparent 50%),
                              radial-gradient(circle at 70% 80%, #06b6d4 0%, transparent 50%)`,
          }}
        />

        <div className="relative z-10 w-full max-w-md mx-auto px-8 py-12">
          {/* Mobile logo */}
          <div className="flex justify-center mb-10 lg:hidden animate-fade-in-up">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #08a49c, #06b6d4)', boxShadow: '0 8px 24px rgba(8,164,156,0.4)' }}
              >
                <Layers size={28} className="text-white" />
              </div>
              <div className="text-center">
                <div className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">Q-KTAMP</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">QA Asset Platform</div>
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="animate-fade-in-up stagger-1 mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
              Sign in to your account to continue managing your QA assets.
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl mb-6 animate-scale-in-bounce">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700 dark:text-red-300 leading-snug">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up stagger-2">
            {/* Email field */}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  style={{ transition: 'color 0.2s ease' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="input pl-10 h-11 rounded-xl"
                />
                {email && (
                  <CheckCircle2
                    size={15}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#08a49c] animate-scale-in"
                  />
                )}
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <a
                  href="#"
                  className="text-xs font-medium text-[#08a49c] hover:text-[#06b6d4] transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="input pl-10 pr-10 h-11 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-[#08a49c] focus:ring-[#08a49c] focus:ring-offset-0"
              />
              <label
                htmlFor="remember"
                className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none"
              >
                Keep me signed in
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center h-12 rounded-xl text-base font-bold tracking-wide"
              style={{ letterSpacing: '0.02em' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7 animate-fade-in-up stagger-3">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              Quick Access
            </span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Demo credentials */}
          <div className="animate-fade-in-up stagger-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 text-center">
              Demo accounts — click to auto-fill
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMO_USERS.map((u, i) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => quickLogin(u)}
                  className={`demo-pill text-left ${u.bg} ${u.border} border`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className={`flex items-center gap-1.5 ${u.text}`}>
                    <span className="text-base leading-none">{u.icon}</span>
                    <span className="text-xs font-bold tracking-tight">{u.role}</span>
                    {filledRole === u.role && (
                      <CheckCircle2 size={12} className="ml-auto text-[#08a49c] animate-scale-in" />
                    )}
                  </div>
                  <div className={`text-xs opacity-60 truncate font-mono mt-0.5 ${u.text}`}>
                    {u.email}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-slate-400 dark:text-slate-600 mt-3">
              Password for all demo accounts: <code className="font-mono text-[#08a49c]">password123</code>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-10">
            © 2025 Q-KTAMP · Enterprise QA Platform
          </p>
        </div>
      </div>
    </div>
  );
}
