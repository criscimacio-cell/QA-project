import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Layers, Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const token = params.get('token') || '';

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setValid(false); return; }
    api.get(`/auth/reset-password/validate?token=${token}`)
      .then(r => setValid(r.data.valid))
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      timerRef.current = setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const getStrength = (val: string): number => {
    if (val.length === 0) return 0;
    if (val.length < 6) return 0;
    if (val.length < 8) return 1;
    if (val.length >= 10 && /[A-Z]/.test(val) && /[0-9]/.test(val) && /[!@#$%^&*]/.test(val)) return 4;
    if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) return 3;
    return 2;
  };
  const strength = getStrength(password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-[#F59E0B]', 'bg-green-500'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <button onClick={toggle} className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-600 dark:text-slate-300 hover:text-[#F59E0B] transition-all hover:scale-105">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}>
            <Layers size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Qlarity</h1>
        </div>

        <div className="card p-8">
          {valid === null && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-slate-500 mt-3">Validating reset link…</p>
            </div>
          )}

          {valid === false && (
            <div className="text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Link Invalid or Expired</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">This reset link has expired or already been used. Please request a new one.</p>
              <Link to="/forgot-password" className="btn-primary w-full justify-center">Request New Link</Link>
            </div>
          )}

          {valid === true && done && (
            <div className="text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-[#F59E0B]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Password Reset!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your password has been updated. Redirecting to login…</p>
              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-[#F59E0B] rounded-full" style={{ animation: 'progressBar 3s linear forwards' }} />
              </div>
            </div>
          )}

          {valid === true && !done && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set new password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required className="input pl-9 pr-10" placeholder="Minimum 8 characters" />
                    <button type="button" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor[strength] : 'bg-slate-200 dark:bg-slate-700'}`} />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500' : 'text-[#F59E0B]'}`}>{strengthLabel[strength]}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required className="input pl-9" placeholder="Re-enter your password" />
                    {confirm.length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {confirm === password ? <CheckCircle2 size={15} className="text-[#F59E0B]" /> : <XCircle size={15} className="text-red-400" />}
                      </div>
                    )}
                  </div>
                </div>
                <button type="submit" disabled={loading || password !== confirm || password.length < 8} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
