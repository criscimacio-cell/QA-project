import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { FolderOpen, GitPullRequest, Users, History, Lock, ShieldCheck, Search, Layers } from 'lucide-react';
import { blurUp, stagger, scaleIn } from '../lib/animations';

const FEATURES = [
  { icon: FolderOpen, title: 'Centralized Storage', desc: 'One secure home for every document across your organization — PDFs, Word files, spreadsheets, and more. Organized by folder, tag, and department.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', glow: 'rgba(245,158,11,0.08)', size: 'large', tags: ['Any File Type', 'Folder Structure', 'Department Views'] },
  { icon: GitPullRequest, title: 'Approval Workflows', desc: 'Route documents through customizable multi-step review chains. Set required approvers, deadlines, and automatic escalations.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', glow: 'rgba(59,130,246,0.08)', size: 'large', tags: ['Multi-step Reviews', 'Auto Escalation', 'Email Alerts'] },
  { icon: History, title: 'Version Control', desc: 'Every edit is tracked. Restore any previous version instantly with a full change history and side-by-side comparison.', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', glow: 'rgba(139,92,246,0.06)', size: 'small' },
  { icon: Users, title: 'Team Collaboration', desc: 'Comment, annotate, and tag teammates directly on documents. Resolve threads and keep discussions in context.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', glow: 'rgba(16,185,129,0.06)', size: 'small' },
  { icon: Lock, title: 'Granular Permissions', desc: 'Control exactly who can view, edit, share, or approve each document. Down to individual file level.', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', glow: 'rgba(239,68,68,0.06)', size: 'small' },
  { icon: ShieldCheck, title: 'Audit Trail', desc: 'Immutable log of every open, edit, share, and approval action — timestamped and exportable for compliance.', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', glow: 'rgba(6,182,212,0.06)', size: 'small' },
  { icon: Search, title: 'Full-Text Search', desc: 'Search inside document contents, not just filenames. Find what you need in seconds across thousands of files.', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', glow: 'rgba(234,179,8,0.06)', size: 'small' },
  { icon: Layers, title: 'Templates', desc: 'Build reusable document templates for contracts, reports, and forms. Standardize structure across your team.', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', glow: 'rgba(249,115,22,0.06)', size: 'small' },
];

const large = FEATURES.filter((f) => f.size === 'large');
const small = FEATURES.filter((f) => f.size === 'small');

function BentoCard({ f, big = false }: { f: typeof FEATURES[number]; big?: boolean }) {
  return (
    <motion.div
      variants={big ? scaleIn : blurUp}
      whileHover={{ y: -6, boxShadow: '0 16px 40px rgba(0,0,0,0.1)', transition: { duration: 0.25 } }}
      className="bento-card rounded-2xl p-7 flex flex-col gap-5 cursor-default group relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(350px circle at 30% 40%, ${f.glow}, transparent 70%)` }} />
      <div className={`relative z-10 ${big ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl ${f.bg} border ${f.border} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
        <f.icon size={big ? 22 : 18} className={f.color} />
      </div>
      <div className="relative z-10">
        <h3 className={`font-semibold text-slate-800 mb-2 ${big ? 'text-base' : 'text-sm'}`}>{f.title}</h3>
        <p className={`text-slate-500 leading-relaxed ${big ? 'text-sm' : 'text-xs'}`}>{f.desc}</p>
      </div>
      {big && f.tags && (
        <div className="relative z-10 mt-auto pt-2 flex flex-wrap gap-2">
          {f.tags.map((tag) => (
            <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${f.bg} border ${f.border} ${f.color} font-medium`}>{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Features() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const headerY = useTransform(scrollYProgress, [0, 0.4], [40, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.25], [0, 1]);

  return (
    <section id="features" ref={ref} className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/60 to-[#FAFAFA]" />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div style={{ y: headerY, opacity: headerOpacity }} className="text-center mb-16">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Everything you need
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Built for document-driven teams
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="text-slate-500 text-lg max-w-xl mx-auto">
            Every feature works together seamlessly — from upload to approval to publish, with full traceability.
          </motion.p>
        </motion.div>

        <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {large.map((f) => <BentoCard key={f.title} f={f} big />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {small.slice(0, 2).map((f) => <BentoCard key={f.title} f={f} />)}
          </div>
          {small.slice(2).map((f) => <BentoCard key={f.title} f={f} />)}
        </motion.div>
      </div>
    </section>
  );
}
