import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { fadeUp, blurUp, stagger } from '../lib/animations';

const PLANS = [
  {
    name: 'Starter', price: '$0', period: 'forever', desc: 'For small teams getting their documents organized.',
    cta: 'Get Started Free', ctaHref: '/register', highlight: false,
    features: ['Up to 5 users', '10 GB storage', 'Unlimited documents', 'Version history (30 days)', 'Basic approval workflow', 'Full-text search'],
  },
  {
    name: 'Business', price: '$29', period: 'per month', desc: 'For growing teams that need control and compliance.',
    cta: 'Start Free Trial', ctaHref: '/register?plan=business', highlight: true, badge: 'Most Popular',
    features: ['Unlimited users', '500 GB storage', 'Unlimited version history', 'Multi-step approval workflows', 'Granular permissions & RBAC', 'Audit trail & CSV export', 'Document templates', 'Email & Slack notifications', 'Priority support', 'API access'],
  },
  {
    name: 'Enterprise', price: 'Custom', period: 'contact us', desc: 'For large organizations with compliance and security needs.',
    cta: 'Contact Sales', ctaHref: 'mailto:sales@qlarity.io', highlight: false,
    features: ['Everything in Business', 'Unlimited storage', 'SSO / SAML', 'Dedicated infrastructure', 'SLA guarantee', 'Custom retention policies', 'Onboarding & training', 'Security review'],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  show: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { duration: 0.65, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] as const } }),
};

export default function Pricing() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [-20, 20]);

  return (
    <section id="pricing" ref={ref} className="py-32 relative overflow-hidden">
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/60 to-[#FAFAFA]" />
      </motion.div>

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} className="text-center mb-16">
          <motion.div variants={blurUp} className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 text-xs font-medium text-violet-700 mb-4">
            <Zap size={12} className="fill-violet-500 text-violet-500" />
            Simple pricing
          </motion.div>
          <motion.h2 variants={blurUp} className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Plans for every team
          </motion.h2>
          <motion.p variants={fadeUp} className="text-slate-500 text-lg max-w-xl mx-auto">
            Start free, scale when you need to. No hidden fees, no per-document charges.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              whileHover={{ y: plan.highlight ? -10 : -5, transition: { duration: 0.25 } }}
              className={`relative rounded-2xl p-8 flex flex-col gap-6 ${plan.highlight ? 'bg-white border-2 border-amber-400 shadow-xl shadow-amber-100' : 'bg-white border border-slate-200 shadow-sm'}`}
            >
              {plan.badge && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.8 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md shadow-amber-200">
                  {plan.badge}
                </motion.div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-4xl font-bold ${plan.highlight ? 'text-gradient' : 'text-slate-900'}`}>{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-slate-400 text-sm mb-1">/ {plan.period}</span>}
                </div>
                {plan.price === 'Custom' && <span className="text-slate-400 text-sm">{plan.period}</span>}
                <p className="text-slate-500 text-sm mt-2">{plan.desc}</p>
              </div>

              <motion.a href={plan.ctaHref} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all duration-200 ${plan.highlight ? 'shimmer-btn bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-200' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'}`}>
                {plan.cta}
              </motion.a>

              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f, fi) => (
                  <motion.li key={f} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + fi * 0.04, duration: 0.4 }}
                    className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 size={15} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-amber-500' : 'text-slate-400'}`} />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
