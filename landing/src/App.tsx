import './index.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import SocialProof from './components/SocialProof';
import Pricing from './components/Pricing';
import CTA from './components/CTA';
import Footer from './components/Footer';
import { ScrollProgressBar, ScrollToTop } from './components/ScrollUI';

export default function App() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900">
      <ScrollProgressBar />
      <ScrollToTop />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
