import { motion } from 'framer-motion';
import { FolderOpen, BookOpen, Database, GitPullRequest, ShieldCheck, Lock, Search, Archive } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: FolderOpen,
    title: 'File Manager',
    desc: 'Versioned QA asset storage with drag-and-drop upload, bulk actions, and full history tracking.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    icon: GitPullRequest,
    title: 'Approval Workflows',
    desc: 'Multi-step review chains with configurable required approvals, status gates, and notifications.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base',
    desc: 'Rich-text documentation hub your whole QA team can contribute to and search instantly.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    icon: Database,
    title: 'Test Data Library',
    desc: 'Organize and share reusable test datasets with tagging, categories, and version control.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Lock,
    title: 'Custom RBAC',
    desc: 'Create unlimited custom roles with per-module permissions. Admin keeps full control.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  {
    icon: ShieldCheck,
    title: 'Audit Log',
    desc: 'Immutable trail of every action — uploads, approvals, deletions — with export to CSV.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    icon: Search,
    title: 'Full-Text Search',
    desc: 'Find any file, article, or dataset instantly across your entire org with smart filters.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  {
    icon: Archive,
    title: 'Archive & Restore',
    desc: 'Safely retire outdated assets without deletion. Restore at any time with full version history.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export default function Features() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section id="features" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs font-medium text-amber-400 mb-4">
            Everything you need
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gradient-white tracking-tight mb-4">
            Built for QA teams
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Every module works together. No duct tape, no integrations — one platform from draft to publish.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate={isInView ? 'show' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={cardVariant}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="card-glass rounded-2xl p-6 flex flex-col gap-4 cursor-default group transition-all duration-300"
            >
              <div className={`w-10 h-10 rounded-xl ${f.bg} border ${f.border} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                <f.icon size={18} className={f.color} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
