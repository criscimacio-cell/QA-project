import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { email: 'admin@qa.com',     role: 'Admin',    color: '#ef4444' },
  { email: 'lead@qa.com',      role: 'Lead',     color: '#FBBF24' },
  { email: 'engineer1@qa.com', role: 'Engineer', color: '#3b82f6' },
  { email: 'viewer@qa.com',    role: 'Viewer',   color: '#64748b' },
];

/* ─── Post-login morph overlay ─────────────────────────────────────── */
function MorphOverlay({ grown, ringPulse, fadingOut }: { grown: boolean; ringPulse: boolean; fadingOut: boolean }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#FAFAFA',
      opacity: fadingOut ? 0 : 1,
      transition: fadingOut ? 'opacity 0.45s ease' : 'none',
      pointerEvents: fadingOut ? 'none' : 'all',
    }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {/* Ring 1 */}
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
        {/* Ring 2 */}
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
        {/* Logo icon */}
        <div style={{
          width: grown ? 80 : 40, height: grown ? 80 : 40,
          borderRadius: grown ? 22 : 10,
          background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: [
            'width 0.5s cubic-bezier(0.34,1.3,0.64,1)',
            'height 0.5s cubic-bezier(0.34,1.3,0.64,1)',
            'border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)',
          ].join(','),
        }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1), height 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        {/* Wordmark */}
        <div style={{
          overflow: 'hidden',
          opacity: grown ? 1 : 0,
          maxHeight: grown ? 40 : 0,
          transition: 'opacity 0.35s ease 0.3s, max-height 0.35s ease 0.3s',
        }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>
        {/* Subtitle */}
        <div style={{
          opacity: grown ? 1 : 0,
          transform: grown ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.3s ease 0.55s, transform 0.3s ease 0.55s',
          marginTop: -10,
        }}>
          <span style={{ fontSize: 11, color: '#5a8a86', letterSpacing: '0.04em' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function Login() {
  const { login, user, refreshUser } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  // Redirect already-logged-in users immediately
  useEffect(() => { if (user) navigate('/', { replace: true }); }, []);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');

  const [phase, setPhase] = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown] = useState(false);
  const [ringPulse, setRingPulse] = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  // Post-login animation sequence — runs once when loginSuccess flips to true
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

  // Typewriter on email placeholder
  useEffect(() => {
    const text = 'admin@qa.com';
    let i = 0;
    let fwd = true;
    const el = emailInputRef.current;
    if (!el) return;
    const tick = () => {
      if (el.value) return; // stop if user typed
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) { fwd = false; } }
      else { i--; if (i < 0) { i = 0; fwd = true; } }
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, []);

  // Floating particles in left panel
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    const particles: HTMLDivElement[] = [];
    for (let n = 0; n < 18; n++) {
      const d = document.createElement('div');
      const dx = (Math.random() - 0.5) * 60;
      const dy = (Math.random() - 0.5) * 60;
      d.style.cssText = `
        position:absolute;
        width:4px;height:4px;border-radius:50%;
        background:rgba(245,158,11,0.55);
        left:${Math.random()*100}%;top:${Math.random()*100}%;
        --dx:${dx}px;--dy:${dy}px;
        animation:floatParticle ${3 + Math.random()*4}s ease-in-out ${Math.random()*3}s infinite;
        pointer-events:none;
      `;
      container.appendChild(d);
      particles.push(d);
    }
    return () => particles.forEach(d => d.remove());
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: "'DM Sans',sans-serif", overflow: 'hidden', position: 'relative' }}>

      {/* ── Post-login morph overlay ── */}
      {(phase === 'morph') && (
        <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} />
      )}

      {/* ════════════════════════════════════
          LEFT PANEL — Dark obsidian with rocket
      ════════════════════════════════════ */}
      <div style={{
        width: '55%', background: '#09090B', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', padding: '40px 48px',
        ...(phase === 'slideOut' ? { opacity: 0, transform: 'translateX(-55px) scale(0.96)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: 'none' } : {}),
      }}>

        {/* Floating decorative circles */}
        <div style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', top: '8%', left: '10%', background: 'white', opacity: 0.08, animation: 'floatBubble 6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', top: '20%', right: '18%', background: 'white', opacity: 0.10, animation: 'floatBubble 8s ease-in-out 1s infinite' }} />
        <div style={{ position: 'absolute', width: 28, height: 28, borderRadius: '50%', top: '35%', left: '6%', background: 'white', opacity: 0.12, animation: 'floatBubble 5s ease-in-out 2s infinite' }} />
        <div style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', bottom: '28%', left: '14%', background: 'white', opacity: 0.07, animation: 'floatBubble 7s ease-in-out 0.5s infinite' }} />
        <div style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', top: '60%', right: '10%', background: 'white', opacity: 0.13, animation: 'floatBubble 4.5s ease-in-out 1.5s infinite' }} />
        <div style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', bottom: '15%', right: '22%', background: 'white', opacity: 0.09, animation: 'floatBubble 9s ease-in-out 3s infinite' }} />
        <div style={{ position: 'absolute', width: 16, height: 16, borderRadius: '50%', top: '75%', left: '35%', background: 'white', opacity: 0.11, animation: 'floatBubble 5.5s ease-in-out 2.5s infinite' }} />
        <div style={{ position: 'absolute', width: 52, height: 52, borderRadius: '50%', top: '45%', right: '5%', background: 'white', opacity: 0.06, animation: 'floatBubble 10s ease-in-out 4s infinite' }} />

        {/* Particles ref */}
        <div ref={particlesRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} />

        {/* Logo top-left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 2, position: 'relative' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: 'white', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>

        {/* Heading + subtitle */}
        <div style={{ marginTop: 48, zIndex: 2, position: 'relative' }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: 10 }}>
            QA Asset Platform
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>
            Clarity in every QA decision.
          </p>
        </div>

        {/* Rocket + smoke SVG illustration */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
          <svg viewBox="0 0 380 280" fill="none" xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', maxWidth: 380, filter: 'drop-shadow(0 8px 32px rgba(245,158,11,0.18))' }}>

            {/* Smoke trail / cloud puffs — growing rightward */}
            {/* Leftmost smallest puff */}
            <circle cx="155" cy="168" r="18" fill="white" opacity="0.12"/>
            <circle cx="178" cy="172" r="24" fill="white" opacity="0.14"/>
            <circle cx="206" cy="174" r="30" fill="white" opacity="0.16"/>
            <circle cx="240" cy="176" r="36" fill="white" opacity="0.18"/>
            <circle cx="278" cy="178" r="42" fill="white" opacity="0.20"/>
            <circle cx="320" cy="180" r="48" fill="white" opacity="0.22"/>
            <circle cx="365" cy="182" r="54" fill="white" opacity="0.24"/>

            {/* Secondary layer of smoke for volume */}
            <circle cx="190" cy="185" r="20" fill="rgba(200,200,200,0.10)"/>
            <circle cx="225" cy="190" r="28" fill="rgba(200,200,200,0.10)"/>
            <circle cx="265" cy="192" r="34" fill="rgba(200,200,200,0.10)"/>
            <circle cx="310" cy="194" r="40" fill="rgba(200,200,200,0.10)"/>
            <circle cx="360" cy="196" r="46" fill="rgba(200,200,200,0.10)"/>

            {/* Rocket group — rotated -42deg, pointing up-left */}
            <g transform="translate(130, 140) rotate(-42)" style={{ animation: 'rocketFloat 4s ease-in-out infinite' }}>
              {/* Rocket body */}
              <rect x="-18" y="-50" width="36" height="70" rx="18" fill="#F59E0B"/>
              <rect x="-14" y="-48" width="28" height="60" rx="15" fill="#FBBF24" opacity="0.6"/>

              {/* Rocket nose cone */}
              <ellipse cx="0" cy="-50" rx="18" ry="12" fill="#D97706"/>
              <path d="M-18,-50 Q0,-88 18,-50" fill="#F59E0B"/>
              <path d="M-14,-50 Q0,-82 14,-50" fill="#FBBF24" opacity="0.7"/>

              {/* Window */}
              <circle cx="0" cy="-20" r="9" fill="white" opacity="0.9"/>
              <circle cx="0" cy="-20" r="6" fill="#bfdbfe"/>
              <circle cx="-2" cy="-22" r="2" fill="white" opacity="0.8"/>

              {/* Left wing */}
              <path d="M-18,10 L-34,32 L-18,24 Z" fill="#D97706"/>
              <path d="M-18,10 L-30,28 L-18,22 Z" fill="#F59E0B" opacity="0.7"/>

              {/* Right wing */}
              <path d="M18,10 L34,32 L18,24 Z" fill="#D97706"/>
              <path d="M18,10 L30,28 L18,22 Z" fill="#F59E0B" opacity="0.7"/>

              {/* Bottom fin detail */}
              <rect x="-4" y="18" width="8" height="6" rx="2" fill="#92400e" opacity="0.5"/>

              {/* Exhaust flames */}
              <ellipse cx="-6" cy="26" rx="5" ry="9" fill="#FCD34D" opacity="0.9"/>
              <ellipse cx="6" cy="26" rx="5" ry="9" fill="#FCD34D" opacity="0.9"/>
              <ellipse cx="0" cy="28" rx="6" ry="12" fill="#F59E0B" opacity="0.8"/>
              <ellipse cx="-4" cy="30" rx="3" ry="7" fill="white" opacity="0.5"/>
              <ellipse cx="4" cy="30" rx="3" ry="7" fill="white" opacity="0.5"/>
            </g>

            {/* Stars scattered around rocket */}
            <circle cx="60" cy="60" r="2" fill="white" opacity="0.6"/>
            <circle cx="320" cy="40" r="1.5" fill="white" opacity="0.5"/>
            <circle cx="40" cy="180" r="1.5" fill="white" opacity="0.4"/>
            <circle cx="100" cy="40" r="1" fill="white" opacity="0.7"/>
            <circle cx="280" cy="80" r="2" fill="#F59E0B" opacity="0.5"/>
            <circle cx="75" cy="220" r="1.5" fill="white" opacity="0.5"/>
          </svg>
        </div>

        {/* Demo accounts pills at bottom */}
        <div style={{ zIndex: 2, position: 'relative' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
            Demo accounts
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.email}
                type="button"
                onClick={() => quickLogin(u)}
                style={{
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                  background: filledRole === u.role ? u.color : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${filledRole === u.role ? u.color : 'rgba(255,255,255,0.15)'}`,
                  color: filledRole === u.role ? '#09090B' : 'rgba(255,255,255,0.75)',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { if (filledRole !== u.role) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => { if (filledRole !== u.role) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              >
                {filledRole === u.role && <CheckCircle2 size={11} />}
                {u.role}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            Password: <span style={{ fontFamily: 'monospace', color: '#F59E0B', fontWeight: 700 }}>password123</span>
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════
          CLOUD DIVIDER — organic boundary
      ════════════════════════════════════ */}
      <div style={{ position: 'absolute', left: 'calc(55% - 60px)', top: 0, bottom: 0, width: 120, zIndex: 10, pointerEvents: 'none' }}>
        <svg viewBox="0 0 120 900" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          <path d="
            M120,0 L120,900 L60,900
            Q10,882 28,846
            Q-8,828 22,792
            Q-8,774 28,738
            Q-8,720 22,684
            Q-8,666 28,630
            Q-8,612 22,576
            Q-8,558 28,522
            Q-8,504 22,468
            Q-8,450 28,414
            Q-8,396 22,360
            Q-8,342 28,306
            Q-8,288 22,252
            Q-8,234 28,198
            Q-8,180 22,144
            Q-8,126 28,90
            Q-8,72 22,36
            Q36,4 60,0 Z
          " fill="white"/>
        </svg>
      </div>

      {/* ════════════════════════════════════
          RIGHT PANEL — White login form
      ════════════════════════════════════ */}
      <div style={{
        flex: 1, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px 40px 80px',
        ...(phase === 'slideOut' ? { opacity: 0, transform: 'translateX(40px) scale(0.97)', transition: 'opacity 0.5s ease, transform 0.5s ease', pointerEvents: 'none' } : {}),
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Form header */}
          <div style={{ textAlign: 'center', marginBottom: 32, animation: 'fadeInField 0.5s ease both' }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 22, color: '#09090B', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              User <span style={{ color: '#F59E0B' }}>Login</span>
            </h2>
            <p style={{ fontSize: 14, color: '#78716c' }}>Welcome back to Qlarity</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div style={{ animation: 'fadeInField 0.6s ease 0.1s both' }}>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                  placeholder="Email address"
                  style={{
                    width: '100%', paddingLeft: 46, paddingRight: 18, height: 50,
                    borderRadius: 999,
                    border: `1px solid ${errors.email ? '#f87171' : 'rgba(245,158,11,0.25)'}`,
                    background: errors.email ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.08)',
                    fontSize: 14, color: '#09090B', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = errors.email ? '#f87171' : '#F59E0B'; e.target.style.boxShadow = `0 0 0 3px ${errors.email ? 'rgba(248,113,113,0.15)' : 'rgba(245,158,11,0.15)'}`; }}
                  onBlur={e => { e.target.style.borderColor = errors.email ? '#f87171' : 'rgba(245,158,11,0.25)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              {errors.email && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4, paddingLeft: 18 }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ animation: 'fadeInField 0.6s ease 0.18s both' }}>
              <div style={{ position: 'relative' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Password"
                  style={{
                    width: '100%', paddingLeft: 46, paddingRight: 50, height: 50,
                    borderRadius: 999,
                    border: `1px solid ${errors.password ? '#f87171' : 'rgba(245,158,11,0.25)'}`,
                    background: errors.password ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.08)',
                    fontSize: 14, color: '#09090B', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = errors.password ? '#f87171' : '#F59E0B'; e.target.style.boxShadow = `0 0 0 3px ${errors.password ? 'rgba(248,113,113,0.15)' : 'rgba(245,158,11,0.15)'}`; }}
                  onBlur={e => { e.target.style.borderColor = errors.password ? '#f87171' : 'rgba(245,158,11,0.25)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#78716c', display: 'flex', padding: 4 }}>
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4, paddingLeft: 18 }}>{errors.password}</p>}
            </div>

            {/* Remember me + Forgot password row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4, paddingRight: 4, animation: 'fadeInField 0.6s ease 0.22s both' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#78716c' }}>
                <input type="checkbox" style={{ accentColor: '#F59E0B', width: 14, height: 14 }} />
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#F59E0B', fontWeight: 500, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            {/* Error message */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '10px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13, animation: 'fadeInField 0.3s ease both' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* LOGIN button */}
            <div style={{ animation: 'fadeInField 0.6s ease 0.26s both' }}>
              <button
                type="submit"
                disabled={loading || Object.values(errors).some(Boolean)}
                style={{
                  width: '100%', height: 50, borderRadius: 999, border: 'none',
                  background: '#F59E0B',
                  color: '#09090B', fontWeight: 700, fontSize: 15,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: (loading || Object.values(errors).some(Boolean)) ? 'not-allowed' : 'pointer',
                  opacity: (loading || Object.values(errors).some(Boolean)) ? 0.7 : 1,
                  boxShadow: '0 4px 18px rgba(245,158,11,0.38)',
                  transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#D97706'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(245,158,11,0.5)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F59E0B'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(245,158,11,0.38)'; }}
              >
                {loading ? (
                  <><span style={{ width: 16, height: 16, border: '2px solid #09090B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Signing in…</>
                ) : 'Login'}
              </button>
            </div>

            {/* Forgot password link below button */}
            <p style={{ textAlign: 'center', fontSize: 13, color: '#78716c', animation: 'fadeInField 0.6s ease 0.30s both' }}>
              <Link to="/forgot-password" style={{ color: '#F59E0B', fontWeight: 500, textDecoration: 'none' }}>
                Forgot your password?
              </Link>
            </p>

          </form>

          {/* Bottom brand mark */}
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'fadeInField 0.6s ease 0.38s both' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: '#c4b5a0', letterSpacing: '0.08em', fontWeight: 600 }}>QLARITY</span>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes rocketFloat {
          0%, 100% { transform: rotate(-42deg) translateY(0px); }
          50% { transform: rotate(-42deg) translateY(-10px); }
        }
        @keyframes fadeInField {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translate(0, 0); opacity: 0.5; }
          50% { transform: translate(var(--dx), var(--dy)); opacity: 1; }
        }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes ringExpand {
            from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
            to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
          }
        }
      `}</style>
    </div>
  );
}
