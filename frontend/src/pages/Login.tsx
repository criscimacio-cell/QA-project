import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com', role: 'Admin' },
  { email: 'lead@qa.com', role: 'Lead' },
  { email: 'engineer1@qa.com', role: 'Engineer' },
  { email: 'viewer@qa.com', role: 'Viewer' },
];

function IsometricIllustration() {
  return (
    <svg viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[340px] drop-shadow-xl">
      {/* Phone body */}
      <rect x="60" y="28" width="100" height="136" rx="12" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      {/* Screen area */}
      <rect x="68" y="42" width="84" height="106" rx="5" fill="rgba(255,255,255,0.10)" />
      {/* Home bar */}
      <rect x="90" y="154" width="40" height="4" rx="2" fill="rgba(255,255,255,0.35)" />

      {/* Bar chart */}
      <rect x="74" y="110" width="12" height="30" rx="2.5" fill="rgba(255,255,255,0.45)" />
      <rect x="90" y="97"  width="12" height="43" rx="2.5" fill="rgba(255,255,255,0.65)" />
      <rect x="106" y="104" width="12" height="36" rx="2.5" fill="rgba(255,255,255,0.45)" />
      <rect x="122" y="88"  width="12" height="52" rx="2.5" fill="rgba(255,255,255,0.85)" />

      {/* Line chart over bars */}
      <polyline points="80,102 96,85 112,92 128,70" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      <circle cx="80"  cy="102" r="3" fill="white" opacity="0.9"/>
      <circle cx="96"  cy="85"  r="3" fill="white" opacity="0.9"/>
      <circle cx="112" cy="92"  r="3" fill="white" opacity="0.9"/>
      <circle cx="128" cy="70"  r="4" fill="white"/>

      {/* Donut gauge top-left of screen */}
      <circle cx="86" cy="60" r="12" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none"/>
      <circle cx="86" cy="60" r="12" stroke="rgba(255,255,255,0.85)" strokeWidth="4" fill="none"
        strokeDasharray="50 25" strokeDashoffset="10" strokeLinecap="round"/>
      <text x="86" y="64" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="800">72%</text>

      {/* Small stats card top-right inside screen */}
      <rect x="106" y="48" width="40" height="28" rx="4" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
      <rect x="111" y="54" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.7)"/>
      <rect x="111" y="60" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.45)"/>
      <rect x="111" y="66" width="10" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>

      {/* Floating arrow/plane top-right outside phone */}
      <g transform="translate(152,22) rotate(25)">
        <rect width="30" height="16" rx="5" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
        <polyline points="5,10 11,6 17,10 24,6" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </g>

      {/* Small floating card bottom-left outside phone */}
      <rect x="18" y="122" width="40" height="30" rx="6" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
      <rect x="24" y="129" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.6)"/>
      <rect x="24" y="136" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.4)"/>
      <rect x="24" y="143" width="10" height="2" rx="1"   fill="rgba(255,255,255,0.25)"/>
    </svg>
  );
}

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
    <div className="min-h-screen flex overflow-hidden relative">

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur text-slate-500 hover:text-[#08a49c] shadow-sm transition-all hover:scale-105"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* ══════════════════════════════════
          LEFT PANEL — full-height teal
      ══════════════════════════════════ */}
      <div
        className="relative w-[45%] flex-shrink-0 flex flex-col"
        style={{ background: 'linear-gradient(150deg, #09c4ba 0%, #08a49c 45%, #06918b 100%)', overflow: 'visible', zIndex: 10 }}
      >
        {/* ── Curved right edge — SVG bulge into white panel ── */}
        <svg
          className="absolute top-0 right-0 h-full pointer-events-none"
          style={{ width: 72, right: -70, zIndex: 20 }}
          viewBox="0 0 72 1000"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="edgeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#09c4ba" />
              <stop offset="45%"  stopColor="#08a49c" />
              <stop offset="100%" stopColor="#06918b" />
            </linearGradient>
          </defs>
          {/* convex bulge: starts flush left, curves right to ~70px at midpoint, returns flush */}
          <path d="M0,0 C72,250 72,750 0,1000 L0,0 Z" fill="url(#edgeGrad)" />
        </svg>

        {/* ── Decorative concentric rings (stay inside teal) ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: '100%',
            paddingBottom: '100%',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.18)',
            right: '-48%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 5,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: '70%',
            paddingBottom: '70%',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.10)',
            right: '-32%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 5,
          }}
        />

        {/* "WELCOME" rotated vertically on left edge */}
        <div
          className="absolute select-none font-black tracking-[0.45em] uppercase"
          style={{
            color: 'rgba(255,255,255,0.25)',
            fontSize: 42,
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            left: 20,
            top: '50%',
            marginTop: '-120px',
          }}
        >
          WELCOME
        </div>

        {/* Logo top-left */}
        <div className="relative z-20 flex items-center gap-2.5 px-12 pt-10">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-lg tracking-wide">Q-KTAMP</span>
        </div>

        {/* Centered illustration */}
        <div className="relative z-20 flex-1 flex items-center justify-center px-12">
          <IsometricIllustration />
        </div>

        {/* Bottom tagline */}
        <div className="relative z-20 pb-10 px-12 text-center">
          <p className="text-white/55 text-[11px] font-semibold tracking-[0.22em] uppercase">
            QA Knowledge &amp; Test Asset Platform
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════
          RIGHT PANEL — full-height white
      ══════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col justify-center relative overflow-y-auto"
        style={{ background: dark ? '#0f172a' : '#ffffff', zIndex: 1 }}
      >
        {/* Subtle teal tint blob top-right */}
        <div
          className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle at top right, #b2f0ec, transparent 70%)' }}
        />

        <div className="relative z-10 w-full max-w-[520px] mx-auto px-14 py-0">

          {/* Heading */}
          <h2
            className="font-extrabold text-center mb-12 tracking-[0.25em]"
            style={{ fontSize: 36, color: '#08a49c' }}
          >
            LOGIN
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl border mb-8 text-sm bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Username */}
            <div>
              <label
                className="block text-sm font-semibold mb-3 tracking-wide"
                style={{ color: '#08a49c' }}
              >
                Username
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-transparent outline-none text-base pb-3 pr-10 text-slate-700 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 transition-colors"
                  style={{ borderBottom: '2px solid #e2e8f0' }}
                  onFocus={e => (e.target.style.borderBottomColor = '#08a49c')}
                  onBlur={e => (e.target.style.borderBottomColor = '#e2e8f0')}
                />
                <User size={18} className="absolute right-1 bottom-3" style={{ color: '#08a49c' }} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-sm font-semibold mb-3 tracking-wide"
                style={{ color: '#08a49c' }}
              >
                password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent outline-none text-base pb-3 pr-10 text-slate-700 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 transition-colors"
                  style={{ borderBottom: '2px solid #e2e8f0' }}
                  onFocus={e => (e.target.style.borderBottomColor = '#08a49c')}
                  onBlur={e => (e.target.style.borderBottomColor = '#e2e8f0')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-1 bottom-3 transition-opacity hover:opacity-60"
                  style={{ color: '#08a49c' }}
                >
                  {showPw ? <EyeOff size={18} /> : <Lock size={18} />}
                </button>
              </div>
            </div>

            {/* Login button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-full font-bold text-base tracking-widest text-white transition-all hover:opacity-90 hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(90deg, #08a49c 0%, #09c4ba 100%)',
                  boxShadow: '0 10px 30px rgba(8,164,156,0.4)',
                  letterSpacing: '0.15em',
                }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Login'}
              </button>
            </div>
          </form>

          {/* Forgot / Help */}
          <div className="flex justify-end gap-6 mt-5">
            <Link
              to="/forgot-password"
              className="text-sm text-slate-400 hover:text-[#08a49c] transition-colors"
            >
              Forgot
            </Link>
            <a href="#" className="text-sm text-slate-400 hover:text-[#08a49c] transition-colors">
              Help
            </a>
          </div>

          {/* Demo accounts */}
          <div className="mt-10 pt-7 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 text-center mb-4 uppercase tracking-[0.2em]">
              Quick access — demo accounts
            </p>
            <div className="grid grid-cols-4 gap-3">
              {DEMO_USERS.map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => quickLogin(u)}
                  className="relative flex flex-col items-center py-3 px-2 rounded-xl border transition-all hover:scale-105"
                  style={{
                    borderColor: filledRole === u.role ? '#08a49c' : '#e2e8f0',
                    background: filledRole === u.role ? 'rgba(8,164,156,0.06)' : 'transparent',
                  }}
                >
                  {filledRole === u.role && (
                    <CheckCircle2 size={12} className="absolute top-2 right-2" style={{ color: '#08a49c' }} />
                  )}
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{u.role}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 truncate w-full text-center">
                    {u.email.split('@')[0]}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-center text-slate-400 mt-3">
              Password: <span className="font-mono" style={{ color: '#08a49c' }}>password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
