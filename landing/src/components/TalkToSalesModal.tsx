import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, CheckCircle2, Send, Mail, Building2, User } from 'lucide-react';
import { useState } from 'react';

const TEAM = [
  { name: 'Alex Rivera', role: 'Head of Sales', initials: 'AR', color: '#f59e0b' },
  { name: 'Sarah Kim', role: 'Enterprise AE', initials: 'SK', color: '#10b981' },
  { name: 'James Park', role: 'Solutions Engineer', initials: 'JP', color: '#8b5cf6' },
];

const FAQS = [
  { q: 'How long is the call?', a: '30 minutes, no fluff.' },
  { q: 'Is there a free trial?', a: 'Yes — 14 days, no card needed.' },
  { q: 'Can you migrate our existing docs?', a: 'We handle the migration for enterprise teams.' },
];

export default function TalkToSalesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [tab, setTab] = useState<'form' | 'calendar'>('form');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl shadow-black/20 flex flex-col lg:flex-row">

              {/* Left panel */}
              <div className="lg:w-[42%] bg-slate-900 rounded-3xl lg:rounded-r-none p-8 flex flex-col gap-8">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-4">
                    Sales Team
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
                    Let's talk about<br />
                    <span className="text-amber-400">your team's needs.</span>
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    We'll walk you through Qlarity, answer every question, and find the right plan for your workflow.
                  </p>
                </div>

                {/* Team */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Who you'll meet</p>
                  {TEAM.map((m) => (
                    <div key={m.name} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: m.color }}>
                        {m.initials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{m.name}</div>
                        <div className="text-xs text-slate-400">{m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAQ */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">What to expect</p>
                  {FAQS.map((f) => (
                    <div key={f.q} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-white">{f.q}</div>
                        <div className="text-xs text-slate-400">{f.a}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div className="flex-1 p-8 flex flex-col gap-6 relative">
                {/* Close */}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X size={15} className="text-slate-500" />
                </button>

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                  {(['form', 'calendar'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t === 'form' ? 'Send a message' : 'Book a call'}
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {tab === 'form' ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      {sent ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center justify-center gap-4 py-16 text-center"
                        >
                          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 size={28} className="text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-xl font-bold text-slate-900 mb-1">Message sent!</div>
                            <div className="text-sm text-slate-500">We'll get back to you within one business day.</div>
                          </div>
                          <button
                            onClick={() => { setSent(false); setForm({ name: '', email: '', company: '', message: '' }); }}
                            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                          >
                            Send another message
                          </button>
                        </motion.div>
                      ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <User size={11} /> Full name
                              </label>
                              <input
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Jane Smith"
                                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <Mail size={11} /> Work email
                              </label>
                              <input
                                required
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="jane@company.com"
                                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                              <Building2 size={11} /> Company
                            </label>
                            <input
                              required
                              value={form.company}
                              onChange={(e) => setForm({ ...form, company: e.target.value })}
                              placeholder="Acme Inc."
                              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">How can we help?</label>
                            <textarea
                              rows={4}
                              value={form.message}
                              onChange={(e) => setForm({ ...form, message: e.target.value })}
                              placeholder="Tell us about your team size, current workflow, or anything else..."
                              className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition-all resize-none"
                            />
                          </div>
                          <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-amber-200/60"
                          >
                            <Send size={14} /> Send message
                          </motion.button>
                          <p className="text-xs text-slate-400 text-center">We respond within 1 business day.</p>
                        </form>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="calendar"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-4"
                    >
                      {/* Calendar placeholder */}
                      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-slate-700 font-semibold">
                          <Calendar size={16} className="text-amber-500" />
                          <span>Pick a time that works for you</span>
                        </div>
                        {/* Fake calendar grid */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                            <div key={d} className="text-[10px] font-semibold text-slate-400 py-1">{d}</div>
                          ))}
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                            const disabled = d < 5 || d === 13 || d === 20 || d === 27 || (d > 7 && d < 10);
                            return (
                              <button
                                key={d}
                                disabled={disabled}
                                className={`text-xs py-2 rounded-lg transition-all font-medium ${
                                  disabled
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-700 hover:bg-amber-100 hover:text-amber-700 cursor-pointer'
                                }`}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                          {['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'].map(t => (
                            <button
                              key={t}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">All times in your local timezone · 30-min call</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
