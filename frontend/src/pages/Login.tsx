import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2, Sun, Moon, Layers, ArrowRight, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com',     role: 'Admin',    color: '#ef4444' },
  { email: 'lead@qa.com',      role: 'Lead',     color: '#8b5cf6' },
  { email: 'engineer1@qa.com', role: 'Engineer', color: '#3b82f6' },
  { email: 'viewer@qa.com',    role: 'Viewer',   color: '#64748b' },
];

const FEATURES = [
  { icon: ShieldCheck, text: 'Role-based access control' },
  { icon: Zap,         text: 'Real-time approval workflows' },
  { icon: BarChart3,   text: 'Audit logs & analytics' },
];

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [filledRole, setFilledRole] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
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
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(150deg, #09c4ba 0%, #08a49c 45%, #06918b 100%)' }}
    >
      {/* Background orbs */}
      <div className="pointer-events-none" aria-hidden="true">
        <div className="fixed rounded-full" style={{
          width: 700, height: 700, top: -200, left: -200,
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb 18s ease-in-out infinite',
        }} />
        <div className="fixed rounded-full" style={{
          width: 600, height: 600, bottom: -200, right: -100,
          background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'float-orb-2 22s ease-in-out infinite',
        }} />
        <div className="fixed rounded-full" style={{
          width: 400, height: 400, top: '40%', left: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'float-orb-3 28s ease-in-out infinite',
        }} />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-5 right-5 z-50 w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:scale-105"
        style={{
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Main card — full screen */}
      <div
        className="relative w-full h-screen overflow-hidden z-10"
        style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div className="flex h-full">

          {/* ── LEFT PANEL ── */}
          <div
            className="hidden md:flex md:w-[42%] flex-col relative overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.08)', borderRight: '1px solid rgba(255,255,255,0.15)' }}
          >
            {/* Decorative rings */}
            <div className="absolute" style={{
              width: 480, height: 480, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.12)',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
            }} />
            <div className="absolute" style={{
              width: 320, height: 320, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.18)',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
            }} />
            <div className="absolute" style={{
              width: 160, height: 160, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.25)',
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
            }} />

            {/* Floating shape top-right */}
            <div className="absolute top-8 right-8 w-16 h-16 rounded-2xl rotate-12 opacity-20"
              style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }} />
            <div className="absolute top-16 right-20 w-8 h-8 rounded-xl rotate-45 opacity-15"
              style={{ background: 'rgba(255,255,255,0.5)' }} />

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3 p-8">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.35)' }}>
                <Layers size={17} className="text-white" />
              </div>
              <span className="text-white font-extrabold text-lg tracking-wide">Q-KTAMP</span>
            </div>

            {/* Center content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-10">
              <h1 className="text-white font-black text-3xl leading-tight mb-3">
                QA Asset<br />Management
              </h1>
              <p className="text-white/70 text-sm leading-relaxed mb-8">
                Centralise your test assets, manage approvals, and track quality across every release.
              </p>

              <div className="space-y-3">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.18)' }}>
                      <Icon size={14} className="text-white" />
                    </div>
                    <span className="text-white/80 text-sm font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom */}
            <div className="relative z-10 p-8">
              <p className="text-white/40 text-[11px] font-semibold tracking-[0.2em] uppercase">
                QA Knowledge &amp; Test Asset Platform
              </p>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div
            className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 overflow-y-auto"
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #08a49c, #06b6d4)' }}>
                <Layers size={15} className="text-white" />
              </div>
              <span className="font-extrabold text-lg" style={{ color: '#08a49c' }}>Q-KTAMP</span>
            </div>

            <div className="max-w-[380px] w-full mx-auto">
              {/* Heading */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-1">
                  Welcome back
                </h2>
                <p className="text-sm text-blue-200/60">
                  Sign in to your account to continue
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl mb-6 text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                  }}>
                  <AlertCircle size={15} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-blue-200/70 uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full pl-10 pr-4 h-11 rounded-xl text-sm outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ffffff',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(255,255,255,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.18)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-blue-200/70 uppercase tracking-wider">
                      Password
                    </label>
                    <Link to="/forgot-password" className="text-xs font-medium transition-colors hover:underline" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 h-11 rounded-xl text-sm outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ffffff',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(255,255,255,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.18)'; }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.1)'; }}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all mt-2"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1.5px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.28)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.2)'; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Demo accounts */}
              <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs text-center font-semibold uppercase tracking-widest text-blue-200/50 mb-3">
                  Demo accounts
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {DEMO_USERS.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => quickLogin(u)}
                      className="relative flex flex-col items-center py-2.5 px-1 rounded-xl transition-all hover:-translate-y-0.5"
                      style={{
                        background: filledRole === u.role
                          ? 'rgba(255,255,255,0.22)'
                          : 'rgba(255,255,255,0.08)',
                        border: `1.5px solid ${filledRole === u.role ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                      }}
                    >
                      {filledRole === u.role && (
                        <CheckCircle2 size={10} className="absolute top-1.5 right-1.5" style={{ color: u.color }} />
                      )}
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-1" style={{ background: u.color + '20' }}>
                        <span className="text-[9px] font-black" style={{ color: u.color }}>{u.role[0]}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-100/80">{u.role}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-center text-blue-200/50 mt-2.5">
                  All use password&nbsp;
                  <span className="font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>password123</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
