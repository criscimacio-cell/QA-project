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

/* ─── Floating animated background ─────────────────────────────────── */
function FloatingBackground() {
  return (
    <>
      {/* Large ambient glow orbs */}
      <div className="orb orb-amber-xl" style={{ width: 520, height: 520, top: '-12%', left: '-8%' }} />
      <div className="orb orb-white-xl" style={{ width: 400, height: 400, top: '30%', left: '28%', animationDelay: '-3s', animationDuration: '18s' }} />
      <div className="orb orb-amber-xl" style={{ width: 300, height: 300, bottom: '-8%', right: '38%', animationDelay: '-8s', animationDuration: '22s' }} />

      {/* Medium floating orbs */}
      <div className="orb orb-amber-md" style={{ width: 120, height: 120, top: '18%', left: '42%', animationDelay: '-1s' }} />
      <div className="orb orb-white-md" style={{ width: 90,  height: 90,  top: '62%', left: '8%',  animationDelay: '-4s', animationDuration: '9s' }} />
      <div className="orb orb-amber-md" style={{ width: 70,  height: 70,  top: '78%', left: '52%', animationDelay: '-6s', animationDuration: '11s' }} />
      <div className="orb orb-white-md" style={{ width: 55,  height: 55,  top: '10%', left: '62%', animationDelay: '-2s', animationDuration: '8s' }} />
      <div className="orb orb-amber-md" style={{ width: 80,  height: 80,  top: '45%', left: '20%', animationDelay: '-9s', animationDuration: '14s' }} />

      {/* Twinkling star particles */}
      {[
        { top: '6%',  left: '15%',  size: 3, delay: '0s' },
        { top: '13%', left: '38%',  size: 2, delay: '-1s' },
        { top: '22%', left: '7%',   size: 4, delay: '-2s' },
        { top: '33%', left: '55%',  size: 2, delay: '-0.5s' },
        { top: '41%', left: '3%',   size: 3, delay: '-3s' },
        { top: '55%', left: '34%',  size: 2, delay: '-1.5s' },
        { top: '67%', left: '16%',  size: 4, delay: '-4s' },
        { top: '73%', left: '44%',  size: 2, delay: '-2.5s' },
        { top: '82%', left: '5%',   size: 3, delay: '-0.8s' },
        { top: '88%', left: '26%',  size: 2, delay: '-3.5s' },
        { top: '15%', left: '50%',  size: 3, delay: '-5s' },
        { top: '50%', left: '60%',  size: 2, delay: '-1.2s' },
        { top: '30%', left: '25%',  size: 2, delay: '-6s' },
        { top: '92%', left: '38%',  size: 3, delay: '-2.2s' },
        { top: '5%',  left: '30%',  size: 2, delay: '-4.5s' },
      ].map((s, i) => (
        <div key={i} className="star" style={{
          top: s.top, left: s.left,
          width: s.size, height: s.size,
          animationDelay: s.delay,
        }} />
      ))}

      {/* Expanding amber rings */}
      <div className="ring ring-1" style={{ width: 160, height: 160, top: '20%', left: '15%' }} />
      <div className="ring ring-2" style={{ width: 100, height: 100, top: '60%', left: '40%', animationDelay: '-2.5s' }} />
      <div className="ring ring-3" style={{ width: 200, height: 200, top: '70%', left: '5%',  animationDelay: '-5s' }} />

      {/* Floating geometric diamonds */}
      <svg className="geo-float" style={{ position:'absolute', top:'25%', left:'30%', animationDelay:'-1s', opacity:0.12, pointerEvents:'none' }} width="28" height="28" viewBox="0 0 28 28">
        <polygon points="14,0 28,14 14,28 0,14" fill="none" stroke="#F59E0B" strokeWidth="1.5"/>
      </svg>
      <svg className="geo-float" style={{ position:'absolute', top:'55%', left:'12%', animationDelay:'-4s', opacity:0.1, pointerEvents:'none' }} width="20" height="20" viewBox="0 0 20 20">
        <polygon points="10,0 20,10 10,20 0,10" fill="none" stroke="white" strokeWidth="1"/>
      </svg>
      <svg className="geo-float" style={{ position:'absolute', top:'38%', left:'48%', animationDelay:'-7s', opacity:0.13, pointerEvents:'none' }} width="36" height="36" viewBox="0 0 36 36">
        <polygon points="18,0 36,18 18,36 0,18" fill="none" stroke="#F59E0B" strokeWidth="1.5"/>
      </svg>
      <svg className="geo-float" style={{ position:'absolute', top:'82%', left:'22%', animationDelay:'-2s', opacity:0.09, pointerEvents:'none' }} width="24" height="24" viewBox="0 0 24 24">
        <polygon points="12,0 24,12 12,24 0,12" fill="none" stroke="white" strokeWidth="1"/>
      </svg>

      {/* Floating hexagons */}
      <svg className="geo-spin" style={{ position:'absolute', top:'12%', left:'55%', opacity:0.08, pointerEvents:'none' }} width="48" height="48" viewBox="0 0 48 48">
        <polygon points="24,2 44,14 44,34 24,46 4,34 4,14" fill="none" stroke="#F59E0B" strokeWidth="1.2"/>
      </svg>
      <svg className="geo-spin-rev" style={{ position:'absolute', top:'70%', left:'36%', opacity:0.07, pointerEvents:'none', animationDelay:'-3s' }} width="64" height="64" viewBox="0 0 64 64">
        <polygon points="32,2 60,18 60,46 32,62 4,46 4,18" fill="none" stroke="white" strokeWidth="1"/>
      </svg>

      {/* Horizontal drifting lines */}
      <div className="drift-line" style={{ top:'35%', width:180, animationDelay:'-1s' }} />
      <div className="drift-line" style={{ top:'58%', width:120, animationDelay:'-5s', animationDuration:'20s' }} />
      <div className="drift-line" style={{ top:'80%', width:90,  animationDelay:'-9s', animationDuration:'16s' }} />
    </>
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

  const AMBER = '#F59E0B';

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: '#09090B',
      fontFamily: "'DM Sans', sans-serif",
      opacity: phase === 'slideOut' ? 0 : 1,
      transition: phase === 'slideOut' ? 'opacity 0.45s ease' : 'none',
    }}>

      {/* Post-login morph overlay */}
      {phase === 'morph' && (
        <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />
      )}

      {/* Animated background layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <FloatingBackground />
      </div>

      {/* ── Left: brand heading & demo pills ── */}
      <div style={{ position: 'absolute', left: '5%', top: '8%', zIndex: 3, maxWidth: 340 }}>
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

      {/* ── Login form card — glass morphism, right side ── */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: '42%', zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 48px',
      }}>
        <div style={{
          width: '100%', maxWidth: 360,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          padding: '40px 36px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.08)',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800,
              fontSize: 20, color: 'white',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4,
            }}>
              USER LOGIN
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Welcome to Qlarity</p>
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
                  border: `1px solid ${errors.email ? '#f87171' : 'rgba(245,158,11,0.25)'}`,
                  background: errors.email ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
                  fontSize: 14, color: 'white', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px ${AMBER}22`; }}
                onBlur={e => { e.target.style.borderColor = errors.email ? '#f87171' : 'rgba(245,158,11,0.25)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.email && <p style={{ fontSize: 12, color: '#f87171', marginTop: 3, paddingLeft: 16 }}>{errors.email}</p>}
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
                  border: `1px solid ${errors.password ? '#f87171' : 'rgba(245,158,11,0.25)'}`,
                  background: errors.password ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.07)',
                  fontSize: 14, color: 'white', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px ${AMBER}22`; }}
                onBlur={e => { e.target.style.borderColor = errors.password ? '#f87171' : 'rgba(245,158,11,0.25)'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', display: 'flex', padding: 4 }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
              {errors.password && <p style={{ fontSize: 12, color: '#f87171', marginTop: 3, paddingLeft: 16 }}>{errors.password}</p>}
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                <input type="checkbox" style={{ accentColor: AMBER, width: 14, height: 14 }} />
                Remember
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                Forgot password ?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* LOGIN button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 46, borderRadius: 8, border: 'none',
                background: AMBER,
                color: '#09090B', fontWeight: 700, fontSize: 14,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: `0 4px 20px ${AMBER}55`,
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
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              <Link to="/forgot-password" style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, textDecoration: 'none' }}>
                Create Account
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @keyframes ringExpand {
          from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }

        /* Large ambient orbs */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: orbDrift 14s ease-in-out infinite;
        }
        .orb-amber-xl { background: radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%); }
        .orb-white-xl { background: radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 70%); filter: blur(60px); }
        .orb-amber-md { background: radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%); filter: blur(40px); animation-name: orbFloat; animation-duration: 10s; }
        .orb-white-md { background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%); filter: blur(30px); animation-name: orbFloat; animation-duration: 10s; }

        @keyframes orbDrift {
          0%,100% { transform: translate(0px, 0px) scale(1); }
          33%     { transform: translate(18px,-22px) scale(1.04); }
          66%     { transform: translate(-12px, 14px) scale(0.97); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0px); }
          50%     { transform: translateY(-18px); }
        }

        /* Stars */
        .star {
          position: absolute;
          border-radius: 50%;
          background: white;
          animation: twinkle 4s ease-in-out infinite;
        }
        @keyframes twinkle {
          0%,100% { opacity: 0.15; transform: scale(1); }
          50%     { opacity: 0.9;  transform: scale(1.4); }
        }

        /* Expanding rings */
        .ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(245,158,11,0.3);
          animation: expandRing 6s ease-out infinite;
        }
        .ring-2 { animation-duration: 8s; border-color: rgba(255,255,255,0.15); }
        .ring-3 { animation-duration: 10s; }
        @keyframes expandRing {
          0%   { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        /* Floating geometry */
        .geo-float {
          position: absolute;
          animation: geoFloat 12s ease-in-out infinite;
        }
        @keyframes geoFloat {
          0%,100% { transform: translateY(0px) rotate(0deg); }
          50%     { transform: translateY(-20px) rotate(8deg); }
        }

        /* Spinning hexagons */
        .geo-spin {
          position: absolute;
          animation: geoSpin 30s linear infinite;
        }
        .geo-spin-rev {
          position: absolute;
          animation: geoSpin 40s linear infinite reverse;
        }
        @keyframes geoSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Drifting horizontal lines */
        .drift-line {
          position: absolute;
          left: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(245,158,11,0.25), transparent);
          animation: driftLine 12s linear infinite;
        }
        @keyframes driftLine {
          from { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          to   { transform: translateX(120vw); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
