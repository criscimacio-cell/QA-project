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
        {ringPulse && ['0s','0.18s'].map((d, i) => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%', width: 80, height: 80, borderRadius: 22,
            transform: 'translate(-50%,-50%)',
            border: i === 0 ? '2px solid rgba(245,158,11,0.5)' : '1.5px solid rgba(245,158,11,0.25)',
            animation: `ringExpand 0.55s ease-out ${d} forwards`,
            pointerEvents: 'none',
          }} />
        ))}
        <div style={{
          width: grown ? 80 : 40, height: grown ? 80 : 40, borderRadius: grown ? 22 : 10,
          background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1), height 0.5s cubic-bezier(0.34,1.3,0.64,1), border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)',
        }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'width 0.5s, height 0.5s' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div style={{ overflow: 'hidden', opacity: grown ? 1 : 0, maxHeight: grown ? 40 : 0, transition: 'opacity 0.35s ease 0.3s, max-height 0.35s ease 0.3s' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a' }}>Qlarity</span>
        </div>
        <div style={{ opacity: grown ? 1 : 0, transform: grown ? 'none' : 'translateY(6px)', transition: 'opacity 0.3s ease 0.55s, transform 0.3s ease 0.55s', marginTop: -10 }}>
          <span style={{ fontSize: 11, color: '#78716c' }}>Loading your workspace…</span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login, user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/', { replace: true }); }, []);

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [filledRole, setFilledRole] = useState('');
  const [remember, setRemember]   = useState(false);
  const [phase, setPhase]         = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown]   = useState(false);
  const [ringPulse, setRingPulse]     = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

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
    const text = 'admin@qa.com'; let i = 0; let fwd = true;
    const el = emailRef.current; if (!el) return;
    const id = setInterval(() => {
      if (el.value) return;
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) fwd = false; }
      else { i--; if (i < 0) { i = 0; fwd = true; } }
    }, 120);
    return () => clearInterval(id);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'At least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!validate()) return;
    setLoading(true); setError('');
    try { await login(email, password); setLoginSuccess(true); }
    catch (err: any) { setError(err.response?.data?.error || 'Invalid credentials.'); }
    finally { setLoading(false); }
  };

  const A = '#F59E0B'; // amber

  /* ── 15 trail particles — curved path from lower-left toward rocket ── */
  /* Rocket exhaust origin ≈ (432,448). Trail fans lower-left.
     Listed near→far so first drawn = behind later ones visually. */
  const particles = [
    { cx: 432, cy: 452, r: 13.5, o: 0.28 },
    { cx: 416, cy: 469, r: 12.0, o: 0.25, dx: -2  },
    { cx: 399, cy: 487, r: 10.8, o: 0.22 },
    { cx: 381, cy: 507, r: 9.6,  o: 0.20, dx: 3   },
    { cx: 362, cy: 527, r: 8.5,  o: 0.18 },
    { cx: 342, cy: 548, r: 7.5,  o: 0.16, dx: -3  },
    { cx: 321, cy: 570, r: 6.6,  o: 0.14 },
    { cx: 299, cy: 593, r: 5.8,  o: 0.12, dx: 2   },
    { cx: 276, cy: 617, r: 5.1,  o: 0.10 },
    { cx: 252, cy: 642, r: 4.4,  o: 0.09, dx: -2  },
    { cx: 227, cy: 668, r: 3.8,  o: 0.07 },
    { cx: 201, cy: 695, r: 3.2,  o: 0.06, dx: 2   },
    { cx: 174, cy: 723, r: 2.7,  o: 0.05 },
    { cx: 146, cy: 752, r: 2.2,  o: 0.04 },
    { cx: 117, cy: 782, r: 1.7,  o: 0.03 },
  ];

  return (
    <div style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(150deg, #FFF9EE 0%, #FDFCFA 45%, #F0F5FF 100%)',
      fontFamily: "'DM Sans', sans-serif",
      opacity: phase === 'slideOut' ? 0 : 1,
      transition: phase === 'slideOut' ? 'opacity 0.45s ease' : 'none',
    }}>

      {phase === 'morph' && <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading}/>}

      {/* ════════════════════════════════════════════════════════════
          THREE-LAYER CLOUD SYSTEM — paper-cut layered effect
          All in one SVG for efficiency. Stacked back→front.
      ════════════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      >
        <defs>
          {/* Blur filter for background layer */}
          <filter id="bgBlur" x="-10%" y="-10%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="22"/>
          </filter>
          {/* Drop shadow — gives depth between paper-cut layers */}
          <filter id="paperShadow" x="-5%" y="-5%" width="118%" height="118%">
            <feDropShadow dx="8" dy="2" stdDeviation="16" floodColor="rgba(0,0,0,0.10)"/>
          </filter>
          <filter id="paperShadow2" x="-5%" y="-5%" width="118%" height="118%">
            <feDropShadow dx="12" dy="4" stdDeviation="20" floodColor="rgba(0,0,0,0.08)"/>
          </filter>
          {/* Amber glow gradient: rocket → form */}
          <linearGradient id="rocketGlow" x1="0" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.00"/>
            <stop offset="28%"  stopColor="#F59E0B" stopOpacity="0.12"/>
            <stop offset="62%"  stopColor="#FCD34D" stopOpacity="0.07"/>
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.00"/>
          </linearGradient>
        </defs>

        {/* ── LAYER 1: Background — wide, blurred, soft warm tint ── */}
        {/* Extends to ~x=980 (68%), gives depth backdrop */}
        <path
          filter="url(#bgBlur)"
          d="M0,0 L970,0 Q1060,150 960,310 Q860,470 990,640 Q1070,790 950,900 L0,900 Z"
          fill="#FEF9F0" opacity="0.7"
        />

        {/* ── LAYER 2: Mid cloud — main visible divider ──
            Solid white fill. Angular-ish bumps = paper-cut feel.
            Baseline x≈840, bumps to x≈920. */}
        <path
          filter="url(#paperShadow2)"
          d="
            M 0,0
            L 838,0
            L 848,0 L 852,55
            Q 904,115 852,195
            L 840,220 L 824,232
            Q 768,262 798,338
            L 808,368 L 856,384
            Q 920,418 862,504
            L 845,532 L 814,546
            Q 750,576 784,660
            L 796,700 L 855,720
            Q 924,760 865,850
            L 848,878 L 834,900
            L 0,900 Z
          "
          fill="white"
        />

        {/* ── LAYER 3: Foreground — slightly different shape, cuts right ──
            Paper-cut overlap over mid layer. Slightly smaller bumps. */}
        <path
          filter="url(#paperShadow)"
          d="
            M 0,0
            L 862,0
            L 878,0 L 882,45
            Q 940,100 882,178
            L 866,200 L 846,215
            Q 784,246 820,320
            L 832,355 L 880,372
            Q 956,410 890,490
            L 870,514 L 840,524
            L 840,900 L 0,900 Z
          "
          fill="#FFFCF8"
        />

        {/* Smoke trail particles */}
        {particles.map((p, i) => (
          <circle
            key={i}
            cx={p.cx + ((p as any).dx || 0)}
            cy={p.cy}
            r={p.r}
            fill={`rgba(210,180,130,${p.o})`}
            style={{ animation: `particlePulse ${2 + (i % 3) * 0.6}s ease-in-out ${(i * 0.12).toFixed(2)}s infinite` }}
          />
        ))}

        {/* Amber glow — rocket → form connection */}
        <ellipse cx="820" cy="415" rx="440" ry="115" fill="url(#rocketGlow)" opacity="0.9"/>
      </svg>

      {/* ════════════════════════════════════════════════════════════
          BACKGROUND decorative dots — right side, subtle depth
      ════════════════════════════════════════════════════════════ */}
      {[
        { l:'auto', r:'8%',  t:'12%', s:7,  c:'rgba(245,158,11,0.35)', d:'5s'   },
        { l:'auto', r:'18%', t:'28%', s:5,  c:'rgba(59,130,246,0.3)',  d:'7s'   },
        { l:'auto', r:'5%',  t:'55%', s:6,  c:'rgba(245,158,11,0.28)', d:'6s'   },
        { l:'auto', r:'22%', t:'70%', s:4,  c:'rgba(16,185,129,0.28)', d:'8s'   },
        { l:'auto', r:'11%', t:'82%', s:5,  c:'rgba(245,158,11,0.22)', d:'5.5s' },
      ].map((d, i) => (
        <div key={i} style={{
          position: 'absolute', width: d.s, height: d.s, borderRadius: '50%',
          top: d.t, right: d.r, left: d.l,
          background: d.c, pointerEvents: 'none', zIndex: 2,
          animation: `dotDrift ${d.d} ease-in-out ${i * 0.7}s infinite`,
        }}/>
      ))}

      {/* ════════════════════════════════════════════════════════════
          ROCKET — x≈33%, y≈44%, pointing upper-right at −35°
          Floating animation on the container
      ════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: '33%', top: '44%',
        transform: 'translate(-50%, -50%)',
        zIndex: 4, pointerEvents: 'none',
        animation: 'rocketFloat 4s ease-in-out infinite',
        filter: 'drop-shadow(0 12px 28px rgba(245,158,11,0.22))',
      }}>
        <svg viewBox="0 0 120 196" width="156" height="255"
          style={{ transform: 'rotate(-35deg)' }}>

          {/* Body */}
          <rect x="40" y="52" width="40" height="92" rx="20" fill="white"
            stroke="rgba(245,158,11,0.22)" strokeWidth="1.2"/>
          <rect x="45" y="55" width="30" height="82" rx="16"
            fill="rgba(255,251,235,0.75)"/>

          {/* Nose cone */}
          <path d="M40,52 Q60,6 80,52" fill="white"
            stroke="rgba(245,158,11,0.18)" strokeWidth="1"/>
          <path d="M45,52 Q60,12 75,52" fill="rgba(255,248,220,0.65)"/>

          {/* Shine on nose */}
          <path d="M48,36 Q53,18 58,30" stroke="rgba(255,255,255,0.9)"
            strokeWidth="2.5" strokeLinecap="round" fill="none"/>

          {/* Porthole */}
          <circle cx="60" cy="88" r="13" fill="#FBBF24" opacity="0.95"/>
          <circle cx="60" cy="88" r="9"  fill="#F59E0B"/>
          <circle cx="56" cy="84" r="3.5" fill="rgba(255,255,255,0.85)"/>

          {/* Left fin */}
          <path d="M40,120 L17,154 L40,142 Z" fill="#e879f9"/>
          <path d="M40,120 L21,150 L40,138 Z" fill="rgba(255,255,255,0.22)"/>

          {/* Right fin */}
          <path d="M80,120 L103,154 L80,142 Z" fill="#e879f9"/>
          <path d="M80,120 L99,150 L80,138 Z" fill="rgba(255,255,255,0.22)"/>

          {/* Nozzle */}
          <rect x="52" y="142" width="16" height="9" rx="3.5"
            fill="rgba(180,140,70,0.55)"/>

          {/* Exhaust flames */}
          <ellipse cx="52" cy="157" rx="7"  ry="12" fill="#FCD34D" opacity="0.93"/>
          <ellipse cx="68" cy="157" rx="7"  ry="12" fill="#FCD34D" opacity="0.93"/>
          <ellipse cx="60" cy="161" rx="9"  ry="16" fill={A}       opacity="0.82"/>
          <ellipse cx="55" cy="166" rx="4"  ry="8"  fill="white"   opacity="0.48"/>
          <ellipse cx="65" cy="166" rx="4"  ry="8"  fill="white"   opacity="0.48"/>
        </svg>
      </div>

      {/* ════════════════════════════════════════════════════════════
          LEFT CONTENT — brand text (upper) + demo pills (lower)
          Kept within the cloud illustration area
      ════════════════════════════════════════════════════════════ */}
      <div style={{ position: 'absolute', left: '5%', top: '7%', zIndex: 5, maxWidth: 300 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,158,11,0.32)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: '#1c1917' }}>Qlarity</span>
        </div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 28, fontWeight: 800, color: '#1c1917', lineHeight: 1.3, marginBottom: 8 }}>
          QA Asset<br/>Platform
        </h1>
        <p style={{ fontSize: 14, color: '#78716c', lineHeight: 1.6 }}>
          Clarity in every QA decision.
        </p>
      </div>

      {/* Demo pills */}
      <div style={{ position: 'absolute', left: '5%', bottom: '6%', zIndex: 5, maxWidth: 300 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a8a29e', marginBottom: 8 }}>
          Demo accounts
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEMO_USERS.map(u => (
            <button key={u.email} type="button" onClick={() => { setEmail(u.email); setPassword('password123'); setFilledRole(u.role); }}
              style={{
                padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                background: filledRole === u.role ? u.color : 'rgba(0,0,0,0.06)',
                border: `1px solid ${filledRole === u.role ? u.color : 'rgba(0,0,0,0.1)'}`,
                color: filledRole === u.role ? 'white' : '#57534e',
                fontSize: 12, fontWeight: 600, transition: 'all 0.18s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              {filledRole === u.role && <CheckCircle2 size={10}/>}
              {u.role}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#a8a29e', marginTop: 6 }}>
          pw: <span style={{ fontFamily: 'monospace', color: A, fontWeight: 700 }}>password123</span>
        </p>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT SIDE — Login card (40% width)
          Clean floating card, minimal form
      ════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 48px', zIndex: 3,
      }}>
        <div style={{
          width: '100%', maxWidth: 360,
          background: 'white',
          borderRadius: 20,
          padding: '38px 32px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03), 0 12px 40px rgba(0,0,0,0.09), 0 40px 80px rgba(0,0,0,0.04)',
        }}>

          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#1c1917', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              User Login
            </h2>
            <p style={{ fontSize: 13, color: '#a8a29e' }}>Welcome back to Qlarity</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

            {/* Email */}
            <div>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="2"
                  style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input ref={emailRef} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }}
                  placeholder="Email address"
                  style={{
                    width: '100%', paddingLeft: 42, paddingRight: 14, height: 46,
                    borderRadius: 999, border: `1.5px solid ${errors.email ? '#fca5a5' : 'rgba(245,158,11,0.22)'}`,
                    background: errors.email ? '#fff5f5' : 'rgba(255,251,235,0.65)',
                    fontSize: 14, color: '#1c1917', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = A; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.12)'; e.target.style.background = '#FFFBF0'; }}
                  onBlur={e => { e.target.style.borderColor = errors.email ? '#fca5a5' : 'rgba(245,158,11,0.22)'; e.target.style.boxShadow = 'none'; e.target.style.background = errors.email ? '#fff5f5' : 'rgba(255,251,235,0.65)'; }}
                />
              </div>
              {errors.email && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 3, paddingLeft: 14 }}>{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="2"
                  style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Password"
                  style={{
                    width: '100%', paddingLeft: 42, paddingRight: 44, height: 46,
                    borderRadius: 999, border: `1.5px solid ${errors.password ? '#fca5a5' : 'rgba(245,158,11,0.22)'}`,
                    background: errors.password ? '#fff5f5' : 'rgba(255,251,235,0.65)',
                    fontSize: 14, color: '#1c1917', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = A; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.12)'; e.target.style.background = '#FFFBF0'; }}
                  onBlur={e => { e.target.style.borderColor = errors.password ? '#fca5a5' : 'rgba(245,158,11,0.22)'; e.target.style.boxShadow = 'none'; e.target.style.background = errors.password ? '#fff5f5' : 'rgba(255,251,235,0.65)'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', display: 'flex', padding: 4 }}>
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 3, paddingLeft: 14 }}>{errors.password}</p>}
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#78716c' }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  style={{ accentColor: A, width: 14, height: 14, cursor: 'pointer' }}/>
                Remember me
              </label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#a8a29e', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = A)}
                onMouseLeave={e => (e.currentTarget.style.color = '#a8a29e')}>
                Forgot password?
              </Link>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* LOGIN button */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', height: 48, borderRadius: 999, border: 'none',
                background: loading ? '#FCD34D' : `linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)`,
                color: '#1c1917', fontWeight: 700, fontSize: 14,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 20px rgba(245,158,11,0.42)`,
                transition: 'all 0.2s', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(245,158,11,0.52)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(245,158,11,0.42)'; }}
            >
              {loading
                ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#1c1917', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Signing in…</>
                : 'Login'
              }
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#78716c', margin: '2px 0 0' }}>
              New here?{' '}
              <Link to="/forgot-password" style={{ color: A, fontWeight: 600, textDecoration: 'none' }}>
                Create Account
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rocketFloat {
          0%, 100% { transform: translate(-50%,-50%) translateY(0px); }
          50%       { transform: translate(-50%,-50%) translateY(-18px); }
        }
        @keyframes dotDrift {
          0%,100% { transform: translateY(0) translateX(0); }
          33%     { transform: translateY(-7px) translateX(4px); }
          66%     { transform: translateY(3px) translateX(-4px); }
        }
        @keyframes particlePulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.6; }
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
