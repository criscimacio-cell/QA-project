import './index.css';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import DocumentJourney from './components/DocumentJourney';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import SocialProof from './components/SocialProof';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import CTA from './components/CTA';
import Footer from './components/Footer';
import { ScrollProgressBar, ScrollToTop } from './components/ScrollUI';
import TalkToSalesModal from './components/TalkToSalesModal';

export default function App() {
  const [salesOpen, setSalesOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <ScrollProgressBar />
      <ScrollToTop />
      <TalkToSalesModal open={salesOpen} onClose={() => setSalesOpen(false)} />
      <Navbar onTalkToSales={() => setSalesOpen(true)} />
      <main>
        <Hero />
        <DocumentJourney />
        <Features />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
