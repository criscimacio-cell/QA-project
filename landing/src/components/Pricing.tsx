import { motion } from 'framer-motion';
import { CheckCircle2, Zap } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for small QA teams getting started.',
    cta: 'Get Started',
    ctaHref: '/register',
    highlight: false,
    features: [
      'Up to 5 users',
      '2 repositories',
      '1 GB storage',
      'File manager & versioning',
      'Basic approval workflow',
      'Knowledge base (read-only)',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'per month',
    desc: 'For growing QA teams that need more power.',
    cta: 'Start Pro Trial',
    ctaHref: '/register?plan=pro',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited users',
      'Unlimited repositories',
      '50 GB storage',
      'Full approval workflows',
      'Knowledge base (full access)',
      'Test data library',
      'Custom roles & RBAC',
      'Audit log & CSV export',
      'Email notifications',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    desc: 'For large orgs with security and compliance needs.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@qlarity.io',
    highlight: false,
    features: [
      'Everything in Pro',
      'Unlimited storage',
      'SSO / SAML',
      'Dedicated infrastructure',
      'SLA guarantee',
      'Custom integrations',
      'Onboarding support',
      'Security review',
    ],
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

export default function Pricing() {
  const { ref, isInView } = useScrollReveal(0.1);

  return (
    <section id="pricing" className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] via-white/60 to-[#FAFAFA]" />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-full px-4 py-1.5 text-xs font-medium text-violet-700 mb-4">
            <Zap size={12} className="fill-violet-500 text-violet-500" />
            Simple pricing
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Plans for every team
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Start free, scale when you need to. No hidden fees.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate={isInView ? 'show' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={cardVariant}
              whileHover={{ y: plan.highlight ? -8 : -4, transition: { duration: 0.3 } }}
              className={`relative rounded-2xl p-8 flex flex-col gap-6 ${
                plan.highlight
                  ? 'bg-white border-2 border-amber-400 shadow-xl shadow-amber-100'
                  : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md shadow-amber-200">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{plan.name}</h3>
                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-4xl font-bold ${plan.highlight ? 'text-gradient' : 'text-slate-900'}`}>{plan.price}</span>
                  {plan.price !== 'Custom' && (
                    <span className="text-slate-400 text-sm mb-1">/ {plan.period}</span>
                  )}
                </div>
                {plan.price === 'Custom' && (
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                )}
                <p className="text-slate-500 text-sm mt-2">{plan.desc}</p>
              </div>

              <motion.a
                href={plan.ctaHref}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all duration-200 ${
                  plan.highlight
                    ? 'shimmer-btn bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-200'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                }`}
              >
                {plan.cta}
              </motion.a>

              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle2 size={15} className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-amber-500' : 'text-slate-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
