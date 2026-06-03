import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com', role: 'Admin', password: 'password123' },
  { email: 'lead@qa.com', role: 'Lead', password: 'password123' },
  { email: 'engineer1@qa.com', role: 'Engineer', password: 'password123' },
  { email: 'viewer@qa.com', role: 'Viewer', password: 'password123' },
];

/* ── Isometric phone SVG illustration ── */
function IsometricIllustration() {
  return (
    <svg viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[200px]">
      {/* Phone body */}
      <rect x="55" y="30" width="90" height="120" rx="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      {/* Screen */}
      <rect x="62" y="42" width="76" height="90" rx="4" fill="rgba(255,255,255,0.12)" />
      {/* Home bar */}
      <rect x="82" y="140" width="36" height="4" rx="2" fill="rgba(255,255,255,0.3)" />

      {/* Chart bars inside screen */}
      <rect x="68" y="100" width="10" height="26" rx="2" fill="rgba(255,255,255,0.5)" />
      <rect x="82" y="88" width="10" height="38" rx="2" fill="rgba(255,255,255,0.7)" />
      <rect x="96" y="94" width="10" height="32" rx="2" fill="rgba(255,255,255,0.5)" />
      <rect x="110" y="80" width="10" height="46" rx="2" fill="rgba(255,255,255,0.9)" />

      {/* Line chart */}
      <polyline points="68,90 82,75 96,80 110,60 124,68" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots on line */}
      {[[68,90],[82,75],[96,80],[110,60],[124,68]].map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="white" opacity="0.9" />
      ))}

      {/* Circular gauge top-left of screen */}
      <circle cx="80" cy="58" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle cx="80" cy="58" r="10" stroke="rgba(255,255,255,0.85)" strokeWidth="3"
        strokeDasharray="40 23" strokeDashoffset="10" strokeLinecap="round" />
      <text x="80" y="62" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" opacity="0.9">72%</text>

      {/* Rising plane/arrow outside phone top-right */}
      <g transform="translate(138, 20) rotate(30)">
        <rect width="28" height="14" rx="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <polyline points="5,9 11,5 17,9 23,5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Small floating card bottom-left */}
      <rect x="20" y="115" width="36" height="26" rx="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <rect x="25" y="121" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.6)" />
      <rect x="25" y="128" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
      <rect x="25" y="134" width="8" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

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
      setError(err.response?.data?.error || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (u: typeof DEMO_USERS[0]) => {
    setEmail(u.email);
    setPassword(u.password);
    setFilledRole(u.role);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #b2eae7 0%, #d4f4f2 40%, #c8eef6 100%)' }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="fixed top-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur text-slate-600 hover:text-[#08a49c] shadow transition-all hover:scale-105"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Background decorative circles */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #08a49c, transparent 70%)' }} />
      <div className="absolute -bottom-40 -right-20 w-[28rem] h-[28rem] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #06b6d4, transparent 70%)' }} />

      {/* ── Main Card ── */}
      <div
        className="relative w-full flex rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxWidth: 820, minHeight: 500, animation: 'fadeInUp 0.5s ease both' }}
      >
        {/* ══ LEFT PANEL — Teal ══ */}
        <div
          className="relative flex-shrink-0 flex flex-col justify-between overflow-hidden"
          style={{
            width: '42%',
            background: 'linear-gradient(160deg, #07b5ac 0%, #08a49c 40%, #06908a 100%)',
          }}
        >
          {/* Large circle overlay — mimics the geometric shape in reference */}
          <div
            className="absolute"
            style={{
              width: 420,
              height: 420,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              right: -160,
              top: '50%',
              transform: 'translateY(-50%)',
              border: '1.5px solid rgba(255,255,255,0.18)',
            }}
          />
          <div
            className="absolute"
            style={{
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              right: -80,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />

          {/* "Welcome" rotated text on left edge */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 font-black text-white/30 tracking-[0.4em] uppercase"
            style={{
              writingMode: 'vertical-rl',
              transform: 'translateY(-50%) rotate(180deg)',
              fontSize: 28,
              left: 12,
            }}
          >
            Welcome
          </div>

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-8 py-10">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8 self-start ml-6">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <span className="text-white font-extrabold text-base tracking-wide">Q-KTAMP</span>
            </div>

            {/* Illustration */}
            <div style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))' }}>
              <IsometricIllustration />
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10 px-8 pb-8">
            <p className="text-white/60 text-[10px] font-semibold tracking-[0.2em] uppercase text-center">
              QA Knowledge &amp; Test Asset Platform
            </p>
          </div>
        </div>

        {/* ══ RIGHT PANEL — White form ══ */}
        <div className="flex-1 flex flex-col justify-center bg-white dark:bg-slate-900 px-10 py-10">
          <h2
            className="font-extrabold text-center mb-8 tracking-wider text-[#08a49c]"
            style={{ fontSize: 26, letterSpacing: '0.15em' }}
          >
            LOGIN
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email / Username */}
            <div>
              <label className="block text-xs font-semibold text-[#08a49c] mb-1.5 tracking-wide">Username</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full border-b-2 border-slate-200 dark:border-slate-700 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 pb-2 pr-8 placeholder-slate-300 dark:placeholder-slate-600 focus:border-[#08a49c] transition-colors"
                />
                <User size={15} className="absolute right-1 bottom-2.5 text-[#08a49c]" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#08a49c] mb-1.5 tracking-wide">password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border-b-2 border-slate-200 dark:border-slate-700 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 pb-2 pr-8 placeholder-slate-300 dark:placeholder-slate-600 focus:border-[#08a49c] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-1 bottom-2.5 text-[#08a49c] hover:opacity-70 transition-opacity"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={15} /> : <Lock size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full font-bold text-sm tracking-wider text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-100 shadow-lg disabled:opacity-60"
                style={{ background: 'linear-gradient(90deg, #08a49c, #06b6d4)', boxShadow: '0 6px 20px rgba(8,164,156,0.4)' }}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Login'}
              </button>
            </div>
          </form>

          {/* Forgot / Help */}
          <div className="flex justify-end gap-4 mt-4">
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-[#08a49c] transition-colors">
              Forgot
            </Link>
            <a href="#" className="text-xs text-slate-400 hover:text-[#08a49c] transition-colors">Help</a>
          </div>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-400 text-center mb-3 uppercase tracking-widest">Quick access — demo accounts</p>
            <div className="grid grid-cols-4 gap-1.5">
              {DEMO_USERS.map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => quickLogin(u)}
                  className="relative flex flex-col items-center py-2 px-1 rounded-xl border transition-all hover:border-[#08a49c]/50 hover:bg-[#08a49c]/5 text-center"
                  style={{
                    borderColor: filledRole === u.role ? '#08a49c' : 'rgba(226,232,240,1)',
                    background: filledRole === u.role ? 'rgba(8,164,156,0.06)' : undefined,
                  }}
                >
                  {filledRole === u.role && (
                    <CheckCircle2 size={11} className="absolute top-1.5 right-1.5 text-[#08a49c]" />
                  )}
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{u.role}</span>
                  <span className="text-[9px] text-slate-400 font-mono truncate w-full px-0.5">{u.email.split('@')[0]}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              Password: <span className="font-mono text-[#08a49c]">password123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
