import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Building2, Mail, Lock, User } from 'lucide-react';
import api from '../api/client';

const AMBER = '#F59E0B';

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

export default function Register() {
  const navigate = useNavigate();

  const [orgName, setOrgName]       = useState('');
  const [orgSlug, setOrgSlug]       = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [adminName, setAdminName]   = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [success, setSuccess]       = useState(false);

  const handleOrgName = (v: string) => {
    setOrgName(v);
    if (!slugEdited) setOrgSlug(slugify(v));
  };

  const handleSlug = (v: string) => {
    setOrgSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
    setSlugEdited(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!orgName.trim()) e.orgName = 'Organization name is required';
    if (!orgSlug || orgSlug.length < 2) e.orgSlug = 'Organization ID must be at least 2 characters';
    else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/.test(orgSlug)) e.orgSlug = 'Only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.';
    if (!adminName.trim()) e.adminName = 'Your name is required';
    if (!adminEmail.trim()) e.adminEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) e.adminEmail = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/register', { orgName: orgName.trim(), orgSlug, adminName: adminName.trim(), adminEmail: adminEmail.trim().toLowerCase(), adminPassword: password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', paddingLeft: 40, paddingRight: 16, height: 46, borderRadius: 10,
    border: `1px solid ${errors[field] ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'}`,
    background: errors[field] ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.7)',
    fontSize: 14, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  });

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: 'white', borderRadius: 16, padding: '40px 36px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: '#1a1a1a', marginBottom: 10 }}>Organization Created!</h2>
          <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', lineHeight: 1.6, marginBottom: 24 }}>
            Your organization <strong style={{ color: '#1a1a1a' }}>{orgName}</strong> has been set up. You can now log in with your admin account.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', marginBottom: 6 }}>Your Organization ID:</p>
          <code style={{ display: 'block', background: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: 8, padding: '8px 14px', fontSize: 15, fontWeight: 700, color: AMBER, marginBottom: 24 }}>{orgSlug}</code>
          <button onClick={() => navigate(`/login?slug=${orgSlug}`)} style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${AMBER}, #D97706)`, color: '#09090B', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 17, color: '#1a1a1a', letterSpacing: '0.04em' }}>Qlarity</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '36px 36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 20, color: '#1a1a1a', marginBottom: 6 }}>Create Your Organization</h2>
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>Set up your team workspace in seconds</p>
            <div style={{ width: 32, height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${AMBER}, #FCD34D)`, margin: '10px auto 0' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Organization Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Organization</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={15} color={AMBER} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="text" value={orgName} onChange={e => handleOrgName(e.target.value)} placeholder="Acme Corp" style={inputStyle('orgName')}
                  onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                  onBlur={e => { e.target.style.borderColor = errors.orgName ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
                {errors.orgName && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.orgName}</p>}
              </div>
            </div>

            {/* Organization Slug */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Organization ID <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(used for login)</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(0,0,0,0.3)', userSelect: 'none' }}>#</span>
                <input type="text" value={orgSlug} onChange={e => handleSlug(e.target.value)} placeholder="acme-corp" style={{ ...inputStyle('orgSlug'), paddingLeft: 28 }}
                  onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                  onBlur={e => { e.target.style.borderColor = errors.orgSlug ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
                {errors.orgSlug && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.orgSlug}</p>}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', margin: '4px 0' }} />

            {/* Admin Name */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Admin Account</label>
              <div style={{ position: 'relative' }}>
                <User size={15} color={AMBER} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="Your full name" style={inputStyle('adminName')}
                  onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                  onBlur={e => { e.target.style.borderColor = errors.adminName ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
                {errors.adminName && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.adminName}</p>}
              </div>
            </div>

            {/* Admin Email */}
            <div style={{ position: 'relative' }}>
              <Mail size={15} color={AMBER} style={{ position: 'absolute', left: 13, top: 13, pointerEvents: 'none' }} />
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@yourcompany.com" style={inputStyle('adminEmail')}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = errors.adminEmail ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.adminEmail && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.adminEmail}</p>}
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <Lock size={15} color={AMBER} style={{ position: 'absolute', left: 13, top: 13, pointerEvents: 'none' }} />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (min 8 chars)" style={{ ...inputStyle('password'), paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = errors.password ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: 4 }}>
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
              {errors.password && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div style={{ position: 'relative' }}>
              <Lock size={15} color={AMBER} style={{ position: 'absolute', left: 13, top: 13, pointerEvents: 'none' }} />
              <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" style={{ ...inputStyle('confirm'), paddingRight: 16 }}
                onFocus={e => { e.target.style.borderColor = AMBER; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.15)`; }}
                onBlur={e => { e.target.style.borderColor = errors.confirm ? 'rgba(239,68,68,0.5)' : 'rgba(0,0,0,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
              {errors.confirm && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{errors.confirm}</p>}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', fontSize: 13 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${AMBER}, #D97706)`, color: '#09090B', fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
              {loading ? <><span style={{ width: 14, height: 14, border: '2.5px solid #09090B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }}/> Creating…</> : 'Create Organization'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'rgba(0,0,0,0.6)', fontWeight: 500, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = AMBER}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(0,0,0,0.6)'}
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
