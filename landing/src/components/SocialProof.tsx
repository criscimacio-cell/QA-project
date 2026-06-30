import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ShieldCheck, Users, GitPullRequest, Clock } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: Users,
    title: 'Multi-tenant ready',
    desc: 'Each team or department gets its own isolated workspace with independent roles and permissions.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    icon: GitPullRequest,
    title: 'Structured approvals',
    desc: 'Documents go through defined review chains before they reach the team — no more ad-hoc Slack approvals.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: ShieldCheck,
    title: 'Full audit trail',
    desc: 'Every upload, edit, approval, and deletion is logged with timestamps and user attribution.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Clock,
    title: 'Version history',
    desc: 'Never lose a previous version. Roll back to any point in a document\'s history with one click.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
];

export default function SocialProof() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gradient-white tracking-tight mb-4">
            Why teams use Qlarity
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Purpose-built for organizations that need control, clarity, and traceability over their documents.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
              className="card-glass rounded-2xl p-6 flex flex-col gap-4 cursor-default"
            >
              <div className={`w-10 h-10 rounded-xl ${h.bg} border ${h.border} flex items-center justify-center`}>
                <h.icon size={18} className={h.color} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{h.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{h.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
