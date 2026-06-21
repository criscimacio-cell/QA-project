import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Upload, GitPullRequest, Globe } from 'lucide-react';
import { fadeLeft } from '../lib/animations';

const STEPS = [
  { step: '01', icon: Upload, title: 'Upload & Organize', desc: 'Drag and drop any document into Qlarity. Organize by folder, department, or tag. Set metadata like owner, expiry date, and category automatically.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', shadow: 'shadow-amber-100' },
  { step: '02', icon: GitPullRequest, title: 'Route for Approval', desc: 'Assign reviewers and kick off a workflow. Approvers get notified, can comment inline, and sign off — all without leaving Qlarity.', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', shadow: 'shadow-blue-100' },
  { step: '03', icon: Globe, title: 'Publish & Control Access', desc: 'Approved documents go live instantly. Control who can view, download, or share. Every action is logged for compliance.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', shadow: 'shadow-emerald-100' },
];

export default function HowItWorks() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.75], ['0%', '100%']);
  const sectionY = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" ref={ref} className="py-32 relative overflow-hidden scroll-mt-20">
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-40" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/50 to-[#FAFAFA]" />

      <motion.div style={{ y: sectionY }} className="relative max-w-4xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 text-xs font-medium text-blue-600 mb-4">
            Simple workflow
          </motion.div>
          <h2 id="how-it-works-heading" className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            From upload to published
            <br />in three steps
          </h2>
        </motion.div>

        <div className="relative">
          <div aria-hidden="true" className="absolute left-[28px] top-0 bottom-0 w-px bg-slate-200 hidden sm:block" />
          <motion.div aria-hidden="true" className="absolute left-[28px] top-0 w-px hidden sm:block origin-top"
            style={{ height: lineHeight, background: 'linear-gradient(to bottom, #F59E0B, #3B82F6, #10B981)' }} />

          <div className="flex flex-col gap-16">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeLeft}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.5 }}
                className="flex gap-4 sm:gap-8 items-start"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  aria-hidden="true"
                  className={`relative z-10 w-10 h-10 sm:w-14 sm:h-14 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0 shadow-lg ${s.shadow}`}
                >
                  <s.icon size={18} className={`sm:hidden ${s.color}`} />
                  <s.icon size={22} className={`hidden sm:block ${s.color}`} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ delay: 0.25 + i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-1 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-mono text-slate-500">{s.step}</span>
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
