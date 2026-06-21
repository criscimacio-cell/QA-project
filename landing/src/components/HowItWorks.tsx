import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Upload, GitPullRequest, CheckCircle2 } from 'lucide-react';
import { fadeLeft, fadeRight } from '../lib/animations';

const STEPS = [
  { step: '01', icon: Upload, title: 'Upload & Organize', desc: 'Drag and drop QA assets into versioned repositories. Tag with project, Jira ticket, module, and category.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', shadow: 'shadow-amber-100' },
  { step: '02', icon: GitPullRequest, title: 'Submit for Review', desc: 'Trigger multi-step approval chains. Leads and admins review, comment, and approve — all in one place.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', shadow: 'shadow-blue-100' },
  { step: '03', icon: CheckCircle2, title: 'Publish & Audit', desc: 'Approved files go live for the team. Every action is logged with timestamps and user attribution.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', shadow: 'shadow-emerald-100' },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  // Animated fill line
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.75], ['0%', '100%']);
  // Section parallax
  const sectionY = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <section id="how-it-works" ref={ref} className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/50 to-[#FAFAFA]" />

      <motion.div style={{ y: sectionY }} className="relative max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-medium text-blue-600 mb-4"
          >
            Simple workflow
          </motion.div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            From draft to published
            <br />in three steps
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Track line */}
          <div className="absolute left-[28px] top-0 bottom-0 w-px bg-slate-200 hidden sm:block" />
          {/* Animated fill */}
          <motion.div
            className="absolute left-[28px] top-0 w-px hidden sm:block origin-top"
            style={{ height: lineHeight, background: 'linear-gradient(to bottom, #F59E0B, #3B82F6, #10B981)' }}
          />

          <div className="flex flex-col gap-16">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                variants={i % 2 === 0 ? fadeLeft : fadeRight}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.5 }}
                className="flex gap-6 sm:gap-8 items-start"
              >
                {/* Icon node with entrance pop */}
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  whileHover={{ scale: 1.12, rotate: 5 }}
                  className={`relative z-10 w-14 h-14 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0 shadow-lg ${s.shadow}`}
                >
                  <s.icon size={22} className={s.color} />
                </motion.div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: 0.25 + i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-1 flex-1"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-slate-400">{s.step}</span>
                    <h3 className="text-lg font-semibold text-slate-800">{s.title}</h3>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-md">{s.desc}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
