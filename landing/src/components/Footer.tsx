import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { stagger, fadeUp } from '../lib/animations';

const LINKS = {
  Product: ['Features', 'Pricing', 'Changelog', 'Roadmap'],
  Resources: ['Documentation', 'API Reference', 'Status', 'Security'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
};

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          variants={stagger(0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-16"
        >
          {/* Brand */}
          <motion.div variants={fadeUp} className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Layers size={16} className="text-amber-500" />
              </div>
              <span className="font-bold text-slate-900">Qlarity</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[180px]">
              QA asset management for teams that care about quality.
            </p>
          </motion.div>

          {Object.entries(LINKS).map(([section, items]) => (
            <motion.div key={section} variants={fadeUp}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{section}</h4>
              <ul className="flex flex-col gap-2">
                {items.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.35 }}
                  >
                    <a href="#" className="text-sm text-slate-500 hover:text-slate-900 transition-colors duration-200">
                      {item}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-100"
        >
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Qlarity. All rights reserved.</p>
          <div className="flex items-center gap-4">
            {['Privacy', 'Terms', 'Cookies'].map((l) => (
              <a key={l} href="#" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">{l}</a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
