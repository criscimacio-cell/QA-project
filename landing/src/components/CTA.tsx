import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(245,158,11,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-6"
        >
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
            <span className="text-gradient-white">Ready to organize</span>
            <br />
            <span className="text-gradient">your QA assets?</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-lg">
            Join hundreds of QA teams already using Qlarity. Free to start, scales with you.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <motion.a
              href="/register"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors glow-amber"
            >
              Get Started Free
              <ArrowRight size={16} />
            </motion.a>
            <motion.a
              href="mailto:hello@qlarity.io"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/12 text-white font-medium px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              Talk to Sales
            </motion.a>
          </div>
          <p className="text-xs text-slate-600">No credit card · Free forever for small teams · Cancel anytime</p>
        </motion.div>
      </div>
    </section>
  );
}
