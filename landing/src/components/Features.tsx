import { motion } from 'framer-motion';
import { FolderOpen, BookOpen, Database, GitPullRequest, ShieldCheck, Lock, Search, Archive } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: FolderOpen,
    title: 'File Manager',
    desc: 'Versioned QA asset storage with drag-and-drop upload, bulk actions, and full history tracking.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    glow: 'rgba(245,158,11,0.08)',
    size: 'large',
    tags: ['Versioned', 'Drag & Drop', 'Bulk Actions'],
  },
  {
    icon: GitPullRequest,
    title: 'Approval Workflows',
    desc: 'Multi-step review chains with configurable required approvals, status gates, and email notifications.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    glow: 'rgba(59,130,246,0.08)',
    size: 'large',
    tags: ['Multi-step', 'Status Gates', 'Notifications'],
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    desc: 'Rich-text documentation your QA team can contribute to and search instantly.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    glow: 'rgba(139,92,246,0.06)',
    size: 'small',
  },
  {
    icon: Database,
    title: 'Test Data Library',
    desc: 'Organize reusable datasets with tagging and version control.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    glow: 'rgba(16,185,129,0.06)',
    size: 'small',
  },
  {
    icon: Lock,
    title: 'Custom RBAC',
    desc: 'Unlimited custom roles with per-module permissions.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    glow: 'rgba(239,68,68,0.06)',
    size: 'small',
  },
  {
    icon: ShieldCheck,
    title: 'Audit Log',
    desc: 'Immutable trail of every action with CSV export.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    glow: 'rgba(6,182,212,0.06)',
    size: 'small',
  },
  {
    icon: Search,
    title: 'Full-Text Search',
    desc: 'Find any file, article, or dataset instantly across your org.',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    glow: 'rgba(234,179,8,0.06)',
    size: 'small',
  },
  {
    icon: Archive,
    title: 'Archive & Restore',
    desc: 'Safely retire outdated assets. Restore anytime with full history.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    glow: 'rgba(249,115,22,0.06)',
    size: 'small',
  },
];

const large = FEATURES.filter((f) => f.size === 'large');
const small = FEATURES.filter((f) => f.size === 'small');

const cardVariant = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

function BentoCard({ f, index, big = false }: { f: typeof FEATURES[number]; index: number; big?: boolean }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariant}
      whileHover={{ y: -5, transition: { duration: 0.25 } }}
      className="bento-card rounded-2xl p-7 flex flex-col gap-5 cursor-default group relative overflow-hidden"
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(350px circle at 30% 40%, ${f.glow}, transparent 70%)` }}
      />

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
            <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${f.bg} border ${f.border} ${f.color} font-medium`}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function Features() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section id="features" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/60 to-[#FAFAFA]" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Everything you need
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Built for QA teams
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Every module works together. No duct tape, no integrations — one platform from draft to publish.
          </p>
        </motion.div>

        {/* Bento grid */}
        <motion.div
          initial="hidden"
          animate={isInView ? 'show' : 'hidden'}
          transition={{ staggerChildren: 0.07 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Row 1: 2 large cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {large.map((f, i) => (
              <BentoCard key={f.title} f={f} index={i} big />
            ))}
          </div>

          {/* Right tall card group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            {small.slice(0, 2).map((f, i) => (
              <BentoCard key={f.title} f={f} index={i + 2} />
            ))}
          </div>

          {/* Row 2: 4 small cards */}
          {small.slice(2).map((f, i) => (
            <BentoCard key={f.title} f={f} index={i + 4} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
