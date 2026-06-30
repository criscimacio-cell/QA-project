import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

const LINKS = {
  Product: ['Features', 'How It Works', 'Changelog', 'Roadmap'],
  Support: ['Documentation', 'Contact Admin', 'Report a Bug', 'Status'],
  Company: ['About', 'Blog', 'Careers', 'Contact'],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/8 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 mb-16">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Layers size={16} className="text-amber-400" />
              </div>
              <span className="font-bold text-white">Qlarity</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">
              Document management for teams that care about clarity and control.
            </p>
          </div>

          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{section}</h4>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors duration-200">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/6"
        >
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Qlarity · Internal Platform</p>
          <div className="flex items-center gap-4">
            {['Privacy', 'Terms', 'Cookies'].map((l) => (
              <a key={l} href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                {l}
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
