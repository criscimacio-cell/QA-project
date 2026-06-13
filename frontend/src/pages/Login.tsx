import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com',     role: 'Admin',    color: '#ef4444' },
  { email: 'lead@qa.com',      role: 'Lead',     color: '#F59E0B' },
  { email: 'engineer1@qa.com', role: 'Engineer', color: '#3b82f6' },
  { email: 'viewer@qa.com',    role: 'Viewer',   color: '#64748b' },
];

/* ─── Post-login morph overlay ─────────────────────────────────────── */
function MorphOverlay({ grown, ringPulse, fadingOut }: { grown: boolean; ringPulse: boolean; fadingOut: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA',
      opacity: fadingOut ? 0 : 1,
      transition: fadingOut ? 'opacity 0.45s ease' : 'none',
      pointerEvents: fadingOut ? 'none' : 'all',
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {ringPulse && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 80, height: 80, borderRadius: 22,
            transform: 'translate(-50%,-50%)',
            border: '2px solid rgba(245,158,11,0.5)',
            animation: 'ringExpand 0.55s ease-out forwards',
            pointerEvents: 'none',
          }} />
        )}
        {ringPulse && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 80, height: 80, borderRadius: 22,
            transform: 'translate(-50%,-50%)',
            border: '1.5px solid rgba(245,158,11,0.25)',
            animation: 'ringExpand 0.55s ease-out 0.18s forwards',
            pointerEvents: 'none',
          }} />
        )}
        <div style={{
          width: grown ? 80 : 40, height: grown ? 80 : 40,
          borderRadius: grown ? 22 : 10,
          background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: ['width 0.5s cubic-bezier(0.34,1.3,0.64,1)', 'height 0.5s cubic-bezier(0.34,1.3,0.64,1)', 'border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)'].join(','),
        }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1), height 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div style={{ overflow: 'hidden', opacity: grown ? 1 : 0, maxHeight: grown ? 40 : 0, transition: 'opacity 0.35s ease 0.3s, max-height 0.35s ease 0.3s' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>
        <div style={{ opacity: grown ? 1 : 0, transform: grown ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease 0.55s, transform 0.3s ease 0.55s', marginTop: -10 }}>
          <span style={{ fontSize: 11, color: '#5a8a86', letterSpacing: '0.04em' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function Login() {
  const { login, user, refreshUser } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/', { replace: true }); }, []);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');

  const [phase, setPhase]           = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown] = useState(false);
  const [ringPulse, setRingPulse]   = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loginSuccess) return;
    setPhase('slideOut');
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => setPhase('morph'),        460));
    ts.push(setTimeout(() => setMorphGrown(true),      520));
    ts.push(setTimeout(() => setRingPulse(true),      1060));
    ts.push(setTimeout(() => setMorphFading(true),    1800));
    ts.push(setTimeout(() => refreshUser().finally(() => navigate('/')), 2100));
    return () => ts.forEach(clearTimeout);
  }, [loginSuccess, navigate, refreshUser]);

  useEffect(() => {
    const text = 'admin@qa.com';
    let i = 0; let fwd = true;
    const el = emailInputRef.current;
    if (!el) return;
    const tick = () => {
      if (el.value) return;
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) fwd = false; }
      else { i--; if (i < 0) { i = 0; fwd = true; } }
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      await login(email, password);
      setLoginSuccess(true);
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

  /* Brand color — amber adapting our obsidian theme */
  const BG = '#09090B';
  const AMBER = '#F59E0B';

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: BG,
      fontFamily: "'DM Sans', sans-serif",
      opacity: phase === 'slideOut' ? 0 : 1,
      transition: phase === 'slideOut' ? 'opacity 0.45s ease' : 'none',
    }}>

      {/* ── Post-login morph overlay ── */}
      {phase === 'morph' && (
        <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />
      )}

      {/* ══════════════════════════════════════════════════════════
          BACKGROUND decorative circles (like reference image)
      ══════════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', top: '55%', left: '4%',  background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', top: '65%', left: '12%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width:  90, height:  90, borderRadius: '50%', top: '15%', left: '38%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width:  55, height:  55, borderRadius: '50%', top: '30%', left: '30%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width:  35, height:  35, borderRadius: '50%', top: '72%', left: '34%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      {/* Stars */}
      <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', top: '18%', left: '8%',  background: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', top: '40%', left: '5%',  background: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', top: '25%', left: '20%', background: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 5, height: 5, borderRadius: '50%', top: '10%', left: '42%', background: AMBER, opacity: 0.4, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', top: '80%', left: '22%', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />

      {/* ══════════════════════════════════════════════════════════
          WHITE CLOUD BLOB — full-screen SVG, covers right side
          (login form sits inside this area)
      ══════════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {/* Main cloud blob — left edge has 3 organic bumps, like the reference */}
        <path d="
          M 1440,0
          L 860,0
          C 680,-10 560,80  620,200
          C 540,230 480,330 540,430
          C 460,470 440,580 520,660
          C 560,730 680,760 840,740
          L 1440,740
          Z
        " fill="white" />
        {/* Extend cloud to full height at bottom */}
        <path d="
          M 1440,700 L 820,700
          C 700,720 640,780 700,860
          L 1440,860 Z
        " fill="white" opacity="0.9"/>
        {/* Smoke/cloud trail circles — diagonal from rocket area (≈30%,55%) toward cloud */}
        <circle cx="530" cy="490" r="18" fill="white" opacity="0.15"/>
        <circle cx="564" cy="476" r="24" fill="white" opacity="0.17"/>
        <circle cx="600" cy="462" r="30" fill="white" opacity="0.19"/>
        <circle cx="642" cy="450" r="38" fill="white" opacity="0.21"/>
        <circle cx="688" cy="440" r="46" fill="white" opacity="0.23"/>
        {/* Smaller smoke puffs higher up near rocket */}
        <circle cx="442" cy="528" r="12" fill="white" opacity="0.12"/>
        <circle cx="486" cy="510" r="16" fill="white" opacity="0.14"/>
      </svg>

      {/* ══════════════════════════════════════════════════════════
          ROCKET SVG — mid-left, angled ~45° upper-right
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: '18%', top: '28%',
        zIndex: 3, pointerEvents: 'none',
        animation: 'rocketFloat 4s ease-in-out infinite',
      }}>
        <svg viewBox="0 0 160 220" width="130" height="180" style={{ transform: 'rotate(45deg)' }}>
          {/* Rocket body */}
          <rect x="52" y="60" width="56" height="100" rx="28" fill="white"/>
          <rect x="60" y="63" width="40" height="88"  rx="22" fill="rgba(240,240,240,0.6)"/>

          {/* Nose cone */}
          <path d="M52,60 Q80,0 108,60" fill="white"/>
          <path d="M60,60 Q80,8  100,60" fill="rgba(245,245,245,0.7)"/>

          {/* Porthole */}
          <circle cx="80" cy="98" r="16" fill="#e879f9" opacity="0.9"/>
          <circle cx="80" cy="98" r="11" fill="#a855f7"/>
          <circle cx="75" cy="93" r="4"  fill="white" opacity="0.7"/>

          {/* Left fin */}
          <path d="M52,128 L24,162 L52,148 Z" fill="#e879f9"/>
          <path d="M52,128 L30,158 L52,144 Z" fill="white" opacity="0.3"/>

          {/* Right fin */}
          <path d="M108,128 L136,162 L108,148 Z" fill="#e879f9"/>
          <path d="M108,128 L130,158 L108,144 Z" fill="white" opacity="0.3"/>

          {/* Exhaust flames */}
          <ellipse cx="70"  cy="166" rx="8"  ry="14" fill="#FCD34D" opacity="0.9"/>
          <ellipse cx="90"  cy="166" rx="8"  ry="14" fill="#FCD34D" opacity="0.9"/>
          <ellipse cx="80"  cy="170" rx="10" ry="18" fill="#F59E0B" opacity="0.8"/>
          <ellipse cx="74"  cy="176" rx="5"  ry="10" fill="white"   opacity="0.5"/>
          <ellipse cx="86"  cy="176" rx="5"  ry="10" fill="white"   opacity="0.5"/>
        </svg>
      </div>

      {/* ══════════════════════════════════════════════════════════
          LEFT — brand heading & demo pills
      ══════════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', left: '5%', top: '8%', zIndex: 3, maxWidth: 340 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${AMBER}66` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: 'white', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>

        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 32, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 8 }}>
          QA Asset Platform
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
          Clarity in every QA decision.
        </p>
      </div>

      {/* Demo pills — bottom-left */}
      <div style={{ position: 'absolute', left: '5%', bottom: '6%', zIndex: 3, maxWidth: 340 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          Demo accounts
        </p>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {DEMO_USERS.map(u => (
            <button
              key={u.email}
              type="button"
              onClick={() => quickLogin(u)}
              style={{
                padding: '5px 13px', borderRadius: 999, cursor: 'pointer',
                background: filledRole === u.role ? u.color : 'rgba(255,255,255,0.08)',
                border: `1px solid ${filledRole === u.role ? u.color : 'rgba(255,255,255,0.15)'}`,
                color: filledRole === u.role ? '#09090B' : 'rgba(255,255,255,0.75)',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.18s',
              }}
            >
              {filledRole === u.role && <CheckCircle2 size={11} />}
              {u.role}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
          Password: <span style={{ fontFamily: 'monospace', color: AMBER, fontWeight: 700 }}>password123</span>
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════
          LOGIN FORM — floats on the white cloud area, right side
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '42%', zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 340 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800,
              fontSize: 20, color: '#09090B',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              USER LOGIN
            </h2>
            <p style={{ fontSize: 13, color: '#78716c' }}>Welcome to Qlarity</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2"
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                placeholder="Email address"
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 16, height: 46,
                  borderRadius: 999,
                  border: `1px solid ${errors.email ? '#f87171' : 'rgba(245,158,11,0.3)'}`,
                  background: errors.email ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.1)',
                  fontSize: 14, color: '#09090B', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px ${AMBER}26`; }}
                onBlur={e => { e.target.style.borderColor = errors.email ? '#f87171' : 'rgba(245,158,11,0.3)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.email && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3, paddingLeft: 16 }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2"
                style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                placeholder="Password"
                style={{
                  width: '100%', paddingLeft: 42, paddingRight: 46, height: 46,
                  borderRadius: 999,
                  border: `1px solid ${errors.password ? '#f87171' : 'rgba(245,158,11,0.3)'}`,
                  background: errors.password ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.1)',
                  fontSize: 14, color: '#09090B', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px ${AMBER}26`; }}
                onBlur={e => { e.target.style.borderColor = errors.password ? '#f87171' : 'rgba(245,158,11,0.3)'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', display: 'flex', padding: 4 }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
              {errors.password && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3, paddingLeft: 16 }}>{errors.password}</p>}
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#78716c' }}>
                <input type="checkbox" style={{ accentColor: AMBER, width: 14, height: 14 }} />
                Remember
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#78716c', textDecoration: 'none' }}>
                Forgot password ?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* LOGIN button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 46, borderRadius: 999, border: 'none',
                background: AMBER,
                color: '#09090B', fontWeight: 700, fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: `0 4px 18px ${AMBER}55`,
                transition: 'background 0.2s, transform 0.15s, box-shadow 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#D97706'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = AMBER; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              {loading
                ? <><span style={{ width: 15, height: 15, border: '2px solid #09090B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Signing in…</>
                : 'Login'
              }
            </button>

            {/* Create account link */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#78716c', marginTop: 4 }}>
              <Link to="/forgot-password" style={{ color: '#09090B', fontWeight: 500, textDecoration: 'none' }}>
                Create Account
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes rocketFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes ringExpand {
          from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
