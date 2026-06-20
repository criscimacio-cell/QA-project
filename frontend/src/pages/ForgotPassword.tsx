import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ForgotPassword() {
  const { dark, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) { setError('Email is required'); return; }
    if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <button onClick={toggle} className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl glass text-slate-600 dark:text-slate-300 hover:text-[#F59E0B] transition-all hover:scale-105">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', boxShadow: '0 8px 24px rgba(245,158,11,0.35)' }}>
            <Layers size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Qlarity</h1>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-[#F59E0B]" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Check your email</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
              </p>
              {import.meta.env.DEV && (
                <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  💡 In development mode, the reset link is printed in the <strong>backend terminal</strong> console.
                </p>
              )}
              <Link to="/login" className="btn-primary w-full justify-center mt-2">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Reset your password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(''); }} className={`input pl-9 ${error ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="you@company.com" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-[#F59E0B] transition-colors">
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
