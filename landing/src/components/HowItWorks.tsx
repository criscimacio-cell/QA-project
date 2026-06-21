import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Upload, GitPullRequest, CheckCircle2 } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    icon: Upload,
    title: 'Upload & Organize',
    desc: 'Drag and drop QA assets into versioned repositories. Tag with project, Jira ticket, module, and category.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    glow: 'shadow-amber-500/20',
  },
  {
    step: '02',
    icon: GitPullRequest,
    title: 'Submit for Review',
    desc: 'Trigger multi-step approval chains. Leads and admins review, comment, and approve — all in one place.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    glow: 'shadow-blue-500/20',
  },
  {
    step: '03',
    icon: CheckCircle2,
    title: 'Publish & Audit',
    desc: 'Approved files go live for the team. Every action is logged with timestamps and user attribution.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    glow: 'shadow-emerald-500/20',
  },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.8], ['0%', '100%']);

  return (
    <section id="how-it-works" ref={ref} className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-50" />

      <div className="relative max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs font-medium text-blue-400 mb-4">
            Simple workflow
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gradient-white tracking-tight mb-4">
            From draft to published
            <br />in three steps
          </h2>
        </motion.div>

        {/* Steps with animated connector line */}
        <div className="relative">
          {/* Vertical line (desktop) */}
          <div className="absolute left-[28px] top-0 bottom-0 w-px bg-white/6 hidden sm:block" />
          <motion.div
            className="absolute left-[28px] top-0 w-px bg-gradient-to-b from-amber-400 via-blue-400 to-emerald-400 hidden sm:block origin-top"
            style={{ height: lineHeight }}
          />

          <div className="flex flex-col gap-12">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-6 sm:gap-8 items-start"
              >
                {/* Icon node */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  className={`relative z-10 w-14 h-14 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0 shadow-xl ${s.glow}`}
                >
                  <s.icon size={22} className={s.color} />
                </motion.div>

                {/* Content */}
                <div className="pt-1 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-slate-600">{s.step}</span>
                    <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-md">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
