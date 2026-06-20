import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { SplineScene, type SplineApp } from '../components/ui/splite';


/* ─── Post-login morph overlay ─────────────────────────────────────── */
function MorphOverlay({ grown, ringPulse, fadingOut, loadingText = 'Loading your workspace…' }: { grown: boolean; ringPulse: boolean; fadingOut: boolean; loadingText?: string }) {
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
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 80, height: 80, borderRadius: 22, transform: 'translate(-50%,-50%)', border: '2px solid rgba(245,158,11,0.5)', animation: 'ringExpand 0.55s ease-out forwards', pointerEvents: 'none' }} />
        )}
        {ringPulse && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 80, height: 80, borderRadius: 22, transform: 'translate(-50%,-50%)', border: '1.5px solid rgba(245,158,11,0.25)', animation: 'ringExpand 0.55s ease-out 0.18s forwards', pointerEvents: 'none' }} />
        )}
        <div style={{ width: grown ? 80 : 40, height: grown ? 80 : 40, borderRadius: grown ? 22 : 10, background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', boxShadow: '0 8px 32px rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1),height 0.5s cubic-bezier(0.34,1.3,0.64,1),border-radius 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
          <svg width={grown ? 34 : 18} height={grown ? 34 : 18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'width 0.5s cubic-bezier(0.34,1.3,0.64,1),height 0.5s cubic-bezier(0.34,1.3,0.64,1)' }}>
            <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
        <div style={{ overflow: 'hidden', opacity: grown ? 1 : 0, maxHeight: grown ? 40 : 0, transition: 'opacity 0.35s ease 0.3s,max-height 0.35s ease 0.3s' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 20, color: '#0f172a', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>
        <div style={{ opacity: grown ? 1 : 0, transform: grown ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease 0.55s,transform 0.3s ease 0.55s', marginTop: -10 }}>
          <span style={{ fontSize: 11, color: '#5a8a86', letterSpacing: '0.04em' }}>{loadingText}</span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orgSlug, setOrgSlug]   = useState(searchParams.get('slug') ?? '');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [phase, setPhase]             = useState<'idle'|'slideOut'|'morph'>('idle');
  const [morphGrown, setMorphGrown]   = useState(false);
  const [ringPulse, setRingPulse]     = useState(false);
  const [morphFading, setMorphFading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isAdminLogin, setIsAdminLogin] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !loginSuccess) navigate('/', { replace: true });
  }, [user, authLoading, loginSuccess]);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const splineRef = useRef<SplineApp | null>(null);

  const triggerScratchHead = () => {
    if (!splineRef.current) return;
    try {
      splineRef.current.emitEvent('mouseDown', 'Robot');
    } catch {}
  };

  /* Post-login transition chain */
  useEffect(() => {
    if (!loginSuccess) return;
    setPhase('slideOut');
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => setPhase('morph'),       460));
    ts.push(setTimeout(() => setMorphGrown(true),     520));
    ts.push(setTimeout(() => setRingPulse(true),     1060));
    ts.push(setTimeout(() => setMorphFading(true),   1800));
    ts.push(setTimeout(() => navigate(isAdminLogin ? '/backoffice' : '/'), 2100));
    return () => ts.forEach(clearTimeout);
  }, [loginSuccess, isAdminLogin, navigate]);

  /* Animated email placeholder */
  useEffect(() => {
    const text = 'your@email.com';
    let i = 0; let fwd = true;
    const el = emailInputRef.current;
    if (!el) return;
    const tick = () => {
      if (el.value) return;
      el.placeholder = text.slice(0, i) + '|';
      if (fwd) { i++; if (i > text.length) fwd = false; }
      else     { i--; if (i < 0) { i = 0; fwd = true; } }
    };
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length > 0) triggerScratchHead();
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      await login(email, password, rememberMe, orgSlug.trim() || undefined);
      setLoginSuccess(true);
    } catch (orgErr: any) {
      // Org login failed — try backoffice admin login
      try {
        await api.post('/api/backoffice/auth/login', { email, password });
        setIsAdminLogin(true);
        setLoginSuccess(true);
      } catch {
        setError(orgErr?.response?.data?.error || 'Invalid credentials. Please try again.');
        triggerScratchHead();
      }
    } finally {
      setLoading(false);
    }
  };



  const AMBER = '#F59E0B';

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div
      className="login-root"
      style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        background: '#f0f0f0',
        fontFamily: "'DM Sans', sans-serif",
        ...(phase === 'slideOut'
          ? { opacity: 0, transition: 'opacity 0.45s ease' }
          : { animation: 'fadeIn 0.35s ease both' }),
      }}
    >
      {/* Post-login morph overlay */}
      {phase === 'morph' && <MorphOverlay grown={morphGrown} ringPulse={ringPulse} fadingOut={morphFading} loadingText={isAdminLogin ? 'Loading admin console…' : 'Loading your workspace…'} />}

      {/* ── Spline scene — full-bleed background, shifted left ── */}
      <div tabIndex={-1} style={{ position:'fixed', top:0, bottom:0, left:'-20%', right:0, zIndex:0 }}>
        <SplineScene
          scene="https://prod.spline.design/QQ1zXNE5ma-qe0g0/scene.splinecode"
          className="w-full h-full"
          onLoad={(app) => { splineRef.current = app; }}
        />
      </div>

      {/* ── Content layer — pointer-events passthrough so Spline stays interactive ── */}
      <div style={{ position:'relative', zIndex:1, minHeight:'100vh', pointerEvents:'none' }}>

      {/* ── Left: brand & demo pills ── */}
      <div className="login-left-panel" style={{ position:'absolute', left:'5%', top:'8%', maxWidth:340 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:AMBER, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 14px ${AMBER}66` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span className="brand-title" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18, color:'#1a1a1a', letterSpacing:'0.04em' }}>Qlarity</span>
        </div>
        <h1 className="brand-title" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:32, fontWeight:800, color:'#1a1a1a', lineHeight:1.2, marginBottom:8 }}>
          Asset Platform
        </h1>
        <p className="brand-tagline" style={{ fontSize:15, color:'rgba(0,0,0,0.5)' }}>Clarity in every decision.</p>
      </div>

      <div className="login-demo-panel" style={{ position:'absolute', left:'5%', bottom:'6%', maxWidth:340, pointerEvents:'auto' }}>
        <p style={{ fontSize:13, color:'rgba(0,0,0,0.4)', letterSpacing:'0.01em' }}>Powered by <strong style={{ fontSize:14, color:'rgba(0,0,0,0.6)' }}>Stash Ph Pinas Inc.</strong></p>
      </div>

      {/* ── Login card — right side, floating over scene ── */}
      <div className="login-card-wrapper" style={{ position:'absolute', right:0, top:0, bottom:0, width:'44%', minWidth:360, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 48px', pointerEvents:'none' }}>
        <div data-no-ripple style={{ position:'relative', width:'100%', maxWidth:440, pointerEvents:'auto' }}>

          {/* Rotating amber rings */}
          <div style={{ position:'absolute', inset:-3, borderRadius:20, border:'1px solid transparent', borderTop:`1.5px solid rgba(245,158,11,0.7)`, borderRight:`1px solid rgba(245,158,11,0.25)`, animation:'spin 4s linear infinite', pointerEvents:'none' }} />
          <div style={{ position:'absolute', inset:-3, borderRadius:20, border:'1px solid transparent', borderBottom:`1.5px solid rgba(245,158,11,0.55)`, borderLeft:`1px solid rgba(245,158,11,0.25)`, animation:'spin 6s linear infinite reverse', pointerEvents:'none' }} />

          {/* Ambient amber glow behind card */}
          <div style={{ position:'absolute', inset:-24, borderRadius:28, background:'radial-gradient(ellipse at center, rgba(245,158,11,0.13) 0%, rgba(180,83,9,0.07) 50%, transparent 75%)', filter:'blur(16px)', pointerEvents:'none', zIndex:0 }} />

          {/* Card — glass morphism */}
          <div className="login-card" style={{ position:'relative', zIndex:1, background:'rgba(255,255,255,0.82)', backdropFilter:'blur(32px) saturate(180%)', WebkitBackdropFilter:'blur(32px) saturate(180%)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:16, padding:'40px 40px 36px', boxShadow:'0 40px 100px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>

            {/* Header */}
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <h2 className="login-title" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:22, color:'#1a1a1a', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>User Login</h2>
              <p className="login-subtitle" style={{ fontSize:13, color:'rgba(0,0,0,0.45)', letterSpacing:'0.01em' }}>Welcome to Qlarity</p>
              <div style={{ width:36, height:2, borderRadius:2, background:'linear-gradient(90deg,#F59E0B,#FCD34D)', margin:'10px auto 0' }} />
            </div>

            <form ref={formRef} onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Organization slug (optional) */}
              <div>
                <div style={{ position:'relative' }}>
                  <Building2 size={15} color={AMBER} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', zIndex:1 }} />
                  <input type="text" value={orgSlug}
                    onChange={e => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="your-org-id (e.g. acme-corp)"
                    aria-label="Organization ID"
                    autoComplete="organization"
                    className="login-input"
                    style={{ width:'100%', paddingLeft:40, paddingRight:16, height:50, borderRadius:10, border:'1px solid rgba(0,0,0,0.12)', background:'rgba(255,255,255,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', fontSize:14, color:'#1a1a1a', outline:'none', transition:'border-color 0.2s,box-shadow 0.2s,background 0.2s', boxSizing:'border-box' }}
                    onFocus={e => { e.target.style.borderColor=AMBER; e.target.style.background='rgba(255,255,255,0.65)'; e.target.style.boxShadow=`0 0 0 3px rgba(245,158,11,0.2)`; }}
                    onBlur={e => { e.target.style.borderColor='rgba(0,0,0,0.12)'; e.target.style.background='rgba(255,255,255,0.45)'; e.target.style.boxShadow='none'; }}
                  />
                </div>
                <p style={{ fontSize:11, color:'rgba(0,0,0,0.38)', marginTop:4, paddingLeft:2 }}>
                  Your workspace ID — provided when your organization was created. Optional if you're the only org.
                </p>
              </div>

              {/* Email */}
              <div style={{ position:'relative' }}>
                <Mail size={15} color={AMBER} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', zIndex:1 }} />
                <input ref={emailInputRef} type="email" value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({...p, email:''})); }}
                  placeholder="Email address"
                  aria-label="Email address"
                  autoComplete="email"
                  className="login-input"
                  style={{ width:'100%', paddingLeft:40, paddingRight:16, height:50, borderRadius:10, border:`1px solid ${errors.email?'rgba(239,68,68,0.5)':'rgba(0,0,0,0.12)'}`, background:errors.email?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', fontSize:14, color:'#1a1a1a', outline:'none', transition:'border-color 0.2s,box-shadow 0.2s,background 0.2s', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor=AMBER; e.target.style.background='rgba(255,255,255,0.65)'; e.target.style.boxShadow=`0 0 0 3px rgba(245,158,11,0.2)`; }}
                  onBlur={e => { e.target.style.borderColor=errors.email?'rgba(239,68,68,0.5)':'rgba(0,0,0,0.12)'; e.target.style.background=errors.email?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.45)'; e.target.style.boxShadow='none'; }}
                />
                {errors.email && <p role="alert" style={{ fontSize:12, color:'#dc2626', marginTop:4, paddingLeft:4 }}>{errors.email}</p>}
              </div>

              {/* Password */}
              <div style={{ position:'relative' }}>
                <Lock size={15} color={AMBER} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', zIndex:1 }} />
                <input type={showPw?'text':'password'} value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({...p, password:''})); }}
                  placeholder="Password"
                  aria-label="Password"
                  autoComplete="current-password"
                  className="login-input"
                  style={{ width:'100%', paddingLeft:40, paddingRight:44, height:50, borderRadius:10, border:`1px solid ${errors.password?'rgba(239,68,68,0.5)':'rgba(0,0,0,0.12)'}`, background:errors.password?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', fontSize:14, color:'#1a1a1a', outline:'none', transition:'border-color 0.2s,box-shadow 0.2s,background 0.2s', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor=AMBER; e.target.style.background='rgba(255,255,255,0.65)'; e.target.style.boxShadow=`0 0 0 3px rgba(245,158,11,0.2)`; }}
                  onBlur={e => { e.target.style.borderColor=errors.password?'rgba(239,68,68,0.5)':'rgba(0,0,0,0.12)'; e.target.style.background=errors.password?'rgba(239,68,68,0.06)':'rgba(255,255,255,0.45)'; e.target.style.boxShadow='none'; }}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s=>!s)} aria-label={showPw?'Hide password':'Show password'}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(0,0,0,0.35)', display:'flex', padding:4, transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='rgba(0,0,0,0.7)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(0,0,0,0.35)'}
                >
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
                {errors.password && <p role="alert" style={{ fontSize:12, color:'#dc2626', marginTop:4, paddingLeft:4 }}>{errors.password}</p>}
              </div>

              {/* Remember + forgot */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'2px 2px 0' }}>
                <label className="login-label" style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13, color:'rgba(0,0,0,0.5)' }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor:AMBER, width:14, height:14 }} />
                  Remember me
                </label>
                <Link to="/forgot-password" style={{ fontSize:13, color:'rgba(0,0,0,0.5)', textDecoration:'none', transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color=AMBER}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(0,0,0,0.5)'}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Error banner */}
              {error && (
                <div role="alert" style={{ display:'flex', alignItems:'center', gap:8, borderRadius:10, padding:'10px 14px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#dc2626', fontSize:13, backdropFilter:'blur(8px)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{ width:'100%', height:50, borderRadius:10, border:'none', background:`linear-gradient(135deg, ${AMBER}, #D97706)`, color:'#09090B', fontWeight:800, fontSize:14, letterSpacing:'0.12em', textTransform:'uppercase', cursor:loading?'not-allowed':'pointer', opacity:loading?0.8:1, boxShadow:`0 4px 24px rgba(245,158,11,0.4)`, transition:'transform 0.15s,box-shadow 0.15s,opacity 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 32px rgba(245,158,11,0.55)`; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow=`0 4px 24px rgba(245,158,11,0.4)`; }}
              >
                {loading
                  ? <><span style={{ width:15, height:15, border:'2.5px solid #09090B', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite', display:'inline-block' }}/> Signing in…</>
                  : 'Login'
                }
              </button>

              <p className="login-footer-text" style={{ textAlign:'center', fontSize:13, color:'rgba(0,0,0,0.4)', marginTop:2 }}>
                New organization?{' '}
                <Link to="/register" className="login-footer-link" style={{ color:'rgba(0,0,0,0.6)', fontWeight:500, textDecoration:'none', transition:'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color=AMBER}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='rgba(0,0,0,0.6)'}
                >
                  Create an account
                </Link>
              </p>
            </form>
          </div>
        </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes ringExpand {
          from { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          to   { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
        @media (prefers-color-scheme: dark) {
          .login-root { background: #0f172a !important; }
          .login-card { background: rgba(15,23,42,0.85) !important; border-color: rgba(255,255,255,0.08) !important; }
          .login-title { color: #f1f5f9 !important; }
          .login-subtitle { color: rgba(255,255,255,0.45) !important; }
          .login-input { color: #f1f5f9 !important; background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.12) !important; }
          .login-input:focus { background: rgba(255,255,255,0.10) !important; }
          .login-label { color: rgba(255,255,255,0.5) !important; }
          .login-footer-text { color: rgba(255,255,255,0.35) !important; }
          .login-footer-link { color: rgba(255,255,255,0.6) !important; }
          .demo-section p { color: rgba(255,255,255,0.4) !important; }
          .brand-title { color: #f1f5f9 !important; }
          .brand-tagline { color: rgba(255,255,255,0.5) !important; }
        }
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
          .login-demo-panel { display: none !important; }
          .login-card-wrapper { position: relative !important; width: 100% !important; min-width: unset !important; padding: 24px 20px !important; top: unset !important; right: unset !important; bottom: unset !important; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        }
      `}</style>
    </div>
  );
}
