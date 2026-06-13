import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
            style={{ transition: 'width 0.5s, height 0.5s' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div style={{ overflow: 'hidden', opacity: grown ? 1 : 0, maxHeight: grown ? 40 : 0, transition: 'opacity 0.35s ease 0.3s, max-height 0.35s ease 0.3s' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a' }}>Qlarity</span>
        </div>
        <div style={{ opacity: grown ? 1 : 0, transform: grown ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease 0.55s, transform 0.3s ease 0.55s', marginTop: -10 }}>
          <span style={{ fontSize: 11, color: '#78716c' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function Login() {
  const { login, user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/', { replace: true }); }, []);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');
  const [remember, setRemember] = useState(false);

  const [phase, setPhase]               = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown]     = useState(false);
  const [ringPulse, setRingPulse]       = useState(false);
  const [morphFading, setMorphFading]   = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loginSuccess) return;
    setPhase('slideOut');
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => setPhase('morph'),       460));
    ts.push(setTimeout(() => setMorphGrown(true),     520));
    ts.push(setTimeout(() => setRingPulse(true),     1060));
    ts.push(setTimeout(() => setMorphFading(true),   1800));
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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Must be at least 8 characters';
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
    setEmail(u.email); setPassword('password123'); setFilledRole(u.role);
  };

  const AMBER = '#F59E0B';

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      /* Soft warm-to-cool gradient — friendly SaaS feel */
      background: 'linear-gradient(150deg, #FFF8ED 0%, #FAFAFA 55%, #EFF6FF 100%)',
      fontFamily: "'DM Sans', sans-serif",
      opacity: phase === 'slideOut' ? 0 : 1,
      transition: phase === 'slideOut' ? 'opacity 0.45s ease' : 'none',
    }}>

      {/* ── Post-login morph overlay ── */}
      {phase === 'morph' && (
        <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />
      )}

      {/* ════════════════════════════════════════════════════════
          BACKGROUND decorative dots/circles — soft, barely visible
          These float outside the cloud blob for depth
      ════════════════════════════════════════════════════════ */}
      {/* Large soft circles — upper-right area */}
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', top: '-4%', right: '12%',  background: 'rgba(245,158,11,0.07)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 110, height: 110, borderRadius: '50%', top: '8%',  right: '6%',   background: 'rgba(59,130,246,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width:  80, height:  80, borderRadius: '50%', bottom: '10%', right: '18%', background: 'rgba(245,158,11,0.06)', pointerEvents: 'none' }} />
      {/* Tiny dots scattered */}
      <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', top: '18%', right: '28%', background: 'rgba(245,158,11,0.4)', pointerEvents: 'none', animation: 'dotDrift 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 5, height: 5, borderRadius: '50%', top: '60%', right: '22%', background: 'rgba(59,130,246,0.35)', pointerEvents: 'none', animation: 'dotDrift 8s ease-in-out 1s infinite' }} />
      <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', bottom: '25%', right: '10%', background: 'rgba(245,158,11,0.3)', pointerEvents: 'none', animation: 'dotDrift 7s ease-in-out 2s infinite' }} />
      <div style={{ position: 'absolute', width: 7, height: 7, borderRadius: '50%', top: '40%', right: '35%', background: 'rgba(16,185,129,0.3)', pointerEvents: 'none', animation: 'dotDrift 9s ease-in-out 0.5s infinite' }} />

      {/* ════════════════════════════════════════════════════════
          LEFT CLOUD BLOB — white organic shape covering left ~58%
          Its RIGHT EDGE is the wavy divider (bumps protrude right)
      ════════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      >
        {/* Drop shadow filter for the cloud blob */}
        <defs>
          <filter id="cloudShadow" x="-5%" y="-5%" width="115%" height="115%">
            <feDropShadow dx="6" dy="0" stdDeviation="18" floodColor="rgba(0,0,0,0.10)" />
          </filter>
        </defs>

        {/*
          Cloud blob path — covers left side.
          Right edge (the divider) has 3 smooth organic bumps
          that protrude rightward into the form side.
          Baseline of right edge ≈ x=770. Bumps peak at x≈900.
        */}
        <path
          filter="url(#cloudShadow)"
          d="
            M 0,0
            L 760,0
            Q 920,110  780,240
            Q 640,370  800,500
            Q 950,630  770,760
            Q 700,860  750,900
            L 0,900
            Z
          "
          fill="white"
        />

        {/*
          Smoke trail — from rocket exhaust going DOWN-LEFT.
          Rocket is at ~(504, 405). Exhaust direction: lower-left.
          Circles start small at rocket and grow as they drift away.
          Color: very soft warm gray (visible on white bg)
        */}
        <circle cx="490" cy="430" r="10" fill="rgba(180,160,130,0.22)"/>
        <circle cx="460" cy="458" r="15" fill="rgba(180,160,130,0.19)"/>
        <circle cx="426" cy="488" r="21" fill="rgba(180,160,130,0.16)"/>
        <circle cx="388" cy="520" r="28" fill="rgba(180,160,130,0.13)"/>
        <circle cx="345" cy="554" r="36" fill="rgba(180,160,130,0.11)"/>
        <circle cx="298" cy="590" r="45" fill="rgba(180,160,130,0.09)"/>
        <circle cx="246" cy="628" r="55" fill="rgba(180,160,130,0.07)"/>
        <circle cx="188" cy="668" r="66" fill="rgba(180,160,130,0.05)"/>
      </svg>

      {/* ════════════════════════════════════════════════════════
          ROCKET — inside the cloud blob
          Center at ~35% left, ~45% height.
          Rotated -35° (pointing upper-right).
          Animation: gently floating up and down.
      ════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute',
        left: '35%', top: '45%',
        transform: 'translate(-50%, -50%)',
        zIndex: 4, pointerEvents: 'none',
        animation: 'rocketFloat 4s ease-in-out infinite',
      }}>
        {/*
          Rocket SVG — white body, amber accent details, pink/magenta fins.
          Angle: rotate(-35deg) so nose points upper-right.
        */}
        <svg viewBox="0 0 120 200" width="140" height="233"
          style={{ transform: 'rotate(-35deg)', filter: 'drop-shadow(0 8px 24px rgba(245,158,11,0.25))' }}>

          {/* Body */}
          <rect x="42" y="55"  width="36" height="88" rx="18" fill="white" stroke="rgba(245,158,11,0.25)" strokeWidth="1"/>
          <rect x="47" y="58"  width="26" height="78" rx="14" fill="rgba(255,251,235,0.8)"/>

          {/* Nose cone */}
          <path d="M42,55 Q60,8 78,55" fill="white" stroke="rgba(245,158,11,0.2)" strokeWidth="1"/>
          <path d="M47,55 Q60,14 73,55" fill="rgba(255,248,220,0.7)"/>

          {/* Porthole */}
          <circle cx="60" cy="90"  r="12" fill="#FBBF24" opacity="0.9"/>
          <circle cx="60" cy="90"  r="8.5" fill="#F59E0B"/>
          <circle cx="56" cy="87"  r="3"   fill="rgba(255,255,255,0.8)"/>

          {/* Left fin */}
          <path d="M42,118 L20,148 L42,138 Z" fill="#e879f9"/>
          <path d="M42,118 L24,144 L42,134 Z" fill="rgba(255,255,255,0.25)"/>

          {/* Right fin */}
          <path d="M78,118 L100,148 L78,138 Z" fill="#e879f9"/>
          <path d="M78,118 L96,144 L78,134 Z" fill="rgba(255,255,255,0.25)"/>

          {/* Bottom nozzle */}
          <rect x="53" y="140" width="14" height="8" rx="3" fill="rgba(180,140,80,0.5)"/>

          {/* Exhaust flames */}
          <ellipse cx="53" cy="154" rx="6"  ry="10" fill="#FCD34D" opacity="0.92"/>
          <ellipse cx="67" cy="154" rx="6"  ry="10" fill="#FCD34D" opacity="0.92"/>
          <ellipse cx="60" cy="158" rx="8"  ry="14" fill={AMBER}   opacity="0.82"/>
          <ellipse cx="55" cy="162" rx="3.5" ry="7" fill="white"   opacity="0.5"/>
          <ellipse cx="65" cy="162" rx="3.5" ry="7" fill="white"   opacity="0.5"/>
        </svg>
      </div>

      {/* ════════════════════════════════════════════════════════
          LEFT CONTENT — brand text + demo pills
          Positioned inside the cloud blob area
      ════════════════════════════════════════════════════════ */}

      {/* Brand text — upper-left inside cloud */}
      <div style={{ position: 'absolute', left: '5%', top: '8%', zIndex: 4, maxWidth: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: '#09090B', letterSpacing: '0.01em' }}>Qlarity</span>
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 30, fontWeight: 800, color: '#09090B', lineHeight: 1.25, marginBottom: 8 }}>
          QA Asset<br/>Platform
        </h1>
        <p style={{ fontSize: 14, color: '#78716c', lineHeight: 1.6 }}>
          Clarity in every<br/>QA decision.
        </p>
      </div>

      {/* Demo pills — lower-left inside cloud */}
      <div style={{ position: 'absolute', left: '5%', bottom: '7%', zIndex: 4, maxWidth: 320 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#a8a29e', marginBottom: 8 }}>
          Demo accounts
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEMO_USERS.map(u => (
            <button
              key={u.email}
              type="button"
              onClick={() => quickLogin(u)}
              style={{
                padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                background: filledRole === u.role ? u.color : 'rgba(0,0,0,0.06)',
                border: `1px solid ${filledRole === u.role ? u.color : 'rgba(0,0,0,0.1)'}`,
                color: filledRole === u.role ? 'white' : '#57534e',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.18s',
              }}
            >
              {filledRole === u.role && <CheckCircle2 size={10} />}
              {u.role}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#a8a29e', marginTop: 6 }}>
          Password: <span style={{ fontFamily: 'monospace', color: AMBER, fontWeight: 700 }}>password123</span>
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════
          RIGHT SIDE — Login form panel
          Clean white card sitting on the warm gradient background
      ════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '44%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px',
        zIndex: 3,
      }}>
        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'white',
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.03)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontWeight: 800, fontSize: 20, color: '#09090B',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              User Login
            </h2>
            <p style={{ fontSize: 13, color: '#a8a29e' }}>Welcome back to Qlarity</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email field */}
            <div>
              <div style={{ position: 'relative' }}>
                {/* User icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2"
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
                    width: '100%', paddingLeft: 44, paddingRight: 16, height: 48,
                    borderRadius: 999,
                    border: `1.5px solid ${errors.email ? '#fca5a5' : 'rgba(245,158,11,0.2)'}`,
                    background: errors.email ? '#fff5f5' : 'rgba(255,251,235,0.7)',
                    fontSize: 14, color: '#09090B', outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.12)`; e.target.style.background = '#FFFBF0'; }}
                  onBlur={e => { e.target.style.borderColor = errors.email ? '#fca5a5' : 'rgba(245,158,11,0.2)'; e.target.style.boxShadow = 'none'; e.target.style.background = errors.email ? '#fff5f5' : 'rgba(255,251,235,0.7)'; }}
                />
              </div>
              {errors.email && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4, paddingLeft: 16 }}>{errors.email}</p>}
            </div>

            {/* Password field */}
            <div>
              <div style={{ position: 'relative' }}>
                {/* Lock icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2"
                  style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Password"
                  style={{
                    width: '100%', paddingLeft: 44, paddingRight: 48, height: 48,
                    borderRadius: 999,
                    border: `1.5px solid ${errors.password ? '#fca5a5' : 'rgba(245,158,11,0.2)'}`,
                    background: errors.password ? '#fff5f5' : 'rgba(255,251,235,0.7)',
                    fontSize: 14, color: '#09090B', outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.12)`; e.target.style.background = '#FFFBF0'; }}
                  onBlur={e => { e.target.style.borderColor = errors.password ? '#fca5a5' : 'rgba(245,158,11,0.2)'; e.target.style.boxShadow = 'none'; e.target.style.background = errors.password ? '#fff5f5' : 'rgba(255,251,235,0.7)'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex', padding: 4 }}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4, paddingLeft: 16 }}>{errors.password}</p>}
            </div>

            {/* Remember + Forgot row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#78716c' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ accentColor: AMBER, width: 14, height: 14, cursor: 'pointer' }}
                />
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#a8a29e', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = AMBER)}
                onMouseLeave={e => (e.currentTarget.style.color = '#a8a29e')}
              >
                Forgot password?
              </Link>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                borderRadius: 12, padding: '10px 16px',
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#dc2626', fontSize: 13,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* LOGIN button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 48,
                borderRadius: 999, border: 'none',
                background: `linear-gradient(135deg, ${AMBER}, #FBBF24)`,
                color: '#09090B', fontWeight: 700, fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.8 : 1,
                boxShadow: `0 4px 20px rgba(245,158,11,0.4)`,
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(245,158,11,0.5)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(245,158,11,0.4)'; }}
            >
              {loading
                ? <><span style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#09090B', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Signing in…</>
                : 'Login'
              }
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
              <span style={{ fontSize: 12, color: '#c4b5a0' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
            </div>

            {/* Create account */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#78716c', margin: 0 }}>
              New here?{' '}
              <Link to="/forgot-password" style={{ color: AMBER, fontWeight: 600, textDecoration: 'none' }}>
                Create Account
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap');
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rocketFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50%       { transform: translate(-50%, -50%) translateY(-16px); }
        }
        @keyframes dotDrift {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33%       { transform: translateY(-8px) translateX(4px); }
          66%       { transform: translateY(4px) translateX(-3px); }
        }
        @keyframes ringExpand {
          from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
        input::placeholder { color: #c4b5a0; }
      `}</style>
    </div>
  );
}
