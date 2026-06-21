import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { blurUp, stagger } from '../lib/animations';

const FAQS = [
  {
    q: 'How is Qlarity different from Google Drive or Dropbox?',
    a: 'Google Drive and Dropbox are great for storing files, but they have no built-in approval workflows, version policies, or audit trails. Qlarity is built specifically for document-driven teams — every file has a clear owner, a review chain, and a full history. You get structure, not just storage.',
  },
  {
    q: 'Can I control who sees what?',
    a: 'Yes. Qlarity has granular role-based access down to the individual file level. You can set view, edit, share, and approve permissions per person or per team — and audit exactly who accessed what and when.',
  },
  {
    q: 'How does version control work?',
    a: 'Every time a file is edited or replaced, Qlarity saves the previous version automatically. You can browse the full change history and restore any past version in one click — nothing is ever permanently lost. Business and Enterprise plans include unlimited version history.',
  },
  {
    q: 'What file types does Qlarity support?',
    a: 'Qlarity works with any file type — PDFs, Word documents, Excel spreadsheets, PowerPoint presentations, images, and more. If you can upload it, Qlarity can track, version, and route it through your workflow.',
  },
  {
    q: 'How long does it take to set up?',
    a: 'Most teams are up and running in under an hour. Import your existing files, invite your team, set up your folder structure, and start routing documents for review. No lengthy onboarding or professional services required.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes — Qlarity is free forever for small teams. The free plan includes up to 5 users, 10 GB storage, unlimited documents, basic approval workflows, and 30-day version history. Paid plans unlock unlimited users, unlimited version history, advanced permissions, SSO, and priority support.',
  },
  {
    q: 'Is my data secure?',
    a: 'Security is a core part of Qlarity, not an afterthought. All files are encrypted at rest and in transit. We maintain a full immutable audit log, support role-based access, and are building toward SOC 2 Type II certification.',
  },
];

function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
  scrollYProgress,
}: {
  faq: typeof FAQS[number];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  scrollYProgress: ReturnType<typeof useSpring>;
}) {
  // Alternating directions: even from left, odd from right
  const fromLeft = index % 2 === 0;
  const s0 = index * 0.09;
  const s1 = s0 + 0.25;

  const rawX   = useTransform(scrollYProgress, [s0, s1], [fromLeft ? -80 : 80, 0]);
  const rawOp  = useTransform(scrollYProgress, [s0, s0 + 0.12], [0, 1]);
  const x      = useSpring(rawX,  { stiffness: 80, damping: 20, mass: 1 });
  const opacity = rawOp;

  return (
    <motion.div
      style={{ x, opacity }}
      className="group"
    >
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-lg"
        aria-expanded={isOpen}
      >
        {/* Number badge */}
        <span className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-amber-500 text-white'
            : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
        }`}>
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className={`flex-1 font-semibold text-sm sm:text-base transition-colors duration-200 ${isOpen ? 'text-amber-600' : 'text-slate-800 group-hover:text-slate-900'}`}>
          {faq.q}
        </span>

        <span className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'border-amber-300 bg-amber-50 text-amber-500 rotate-0'
            : 'border-slate-200 text-slate-400 group-hover:border-slate-300'
        }`}>
          {isOpen ? <Minus size={13} /> : <Plus size={13} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 pl-11 pr-8">
              {/* Amber accent bar */}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                exit={{ scaleY: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-0 top-0 w-0.5 h-full bg-amber-400 rounded-full origin-top"
                style={{ position: 'relative', display: 'inline-block', width: 2, marginRight: 12 }}
              />
              <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className={`h-px transition-colors duration-200 ${isOpen ? 'bg-amber-100' : 'bg-slate-100'}`} />
    </motion.div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.9', 'center 0.4'],
  });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 18, mass: 1 });

  const toggle = (i: number) => setOpenIndex(prev => prev === i ? null : i);

  // Decorative number that counts up as you scroll into the section
  const rawCount = useTransform(scrollYProgress, [0, 1], [0, FAQS.length]);
  const displayCount = useTransform(rawCount, v => Math.min(Math.floor(v), FAQS.length));

  return (
    <section
      ref={sectionRef}
      id="faq"
      aria-labelledby="faq-heading"
      className="py-32 relative overflow-hidden bg-[#FAFAFA]"
    >
      {/* Grid bg */}
      <div aria-hidden="true" className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Ambient glow */}
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }} />

      <div className="relative max-w-3xl mx-auto px-6">
        {/* Header */}
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-center mb-16"
        >
          <motion.div variants={blurUp}
            className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs font-medium text-amber-700 mb-4">
            Got questions?
          </motion.div>
          <motion.h2
            id="faq-heading"
            variants={blurUp}
            className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4"
          >
            Frequently asked questions
          </motion.h2>
          <motion.p variants={blurUp} className="text-slate-500 text-lg max-w-lg mx-auto">
            Everything you need to know about Qlarity. Can't find an answer?{' '}
            <a href="mailto:hello@qlarity.io" className="text-amber-600 hover:text-amber-500 underline underline-offset-2 transition-colors">
              Ask us directly.
            </a>
          </motion.p>

          {/* Animated counter decoration */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-6 inline-flex items-center gap-2 text-xs text-slate-400"
          >
            <motion.span className="font-mono font-bold text-amber-500 text-sm">
              {displayCount}
            </motion.span>
            <span>/ {FAQS.length} questions</span>
          </motion.div>
        </motion.div>

        {/* Accordion list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 divide-y-0 relative overflow-hidden">
          {/* Subtle amber top border accent */}
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          {FAQS.map((faq, i) => (
            <FAQItem
              key={faq.q}
              faq={faq}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
              scrollYProgress={smoothProgress}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
