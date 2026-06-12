import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarWidth = collapsed ? 64 : 256;

  // Simulate a top progress bar on route change
  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    setLoading(true);
    setProgressWidth(0);

    // Animate progress
    let w = 0;
    const tick = () => {
      w = w < 70 ? w + Math.random() * 18 : w < 90 ? w + Math.random() * 4 : w;
      setProgressWidth(Math.min(w, 92));
    };
    const interval = setInterval(tick, 80);

    progressTimer.current = setTimeout(() => {
      clearInterval(interval);
      setProgressWidth(100);
      setTimeout(() => {
        setLoading(false);
        setProgressWidth(0);
      }, 300);
    }, 500);

    return () => {
      clearInterval(interval);
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30 dark:bg-slate-950 dark:bg-none">
      {/* ── Floating background orbs (dark mode only) ── */}
      <div className="pointer-events-none hidden dark:block" aria-hidden="true">
        {/* Orb 1 – teal top-left */}
        <div
          className="fixed rounded-full"
          style={{
            width: '600px', height: '600px',
            top: '-200px', left: '-150px',
            background: 'radial-gradient(circle, rgba(6,95,70,0.18) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'float-orb 18s ease-in-out infinite',
            zIndex: 0,
          }}
        />
        {/* Orb 2 – cyan bottom-right */}
        <div
          className="fixed rounded-full"
          style={{
            width: '700px', height: '700px',
            bottom: '-250px', right: '-200px',
            background: 'radial-gradient(circle, rgba(167,243,208,0.14) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float-orb-2 22s ease-in-out infinite',
            zIndex: 0,
          }}
        />
        {/* Orb 3 – emerald center */}
        <div
          className="fixed rounded-full"
          style={{
            width: '500px', height: '500px',
            top: '40%', left: '40%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)',
            filter: 'blur(70px)',
            animation: 'float-orb-3 28s ease-in-out infinite',
            zIndex: 0,
          }}
        />
        {/* Orb 4 – indigo mid-right */}
        <div
          className="fixed rounded-full"
          style={{
            width: '400px', height: '400px',
            top: '30%', right: '-100px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animation: 'float-orb 24s ease-in-out infinite reverse',
            zIndex: 0,
          }}
        />
      </div>

      {/* ── Top Progress Bar ── */}
      {loading && (
        <div
          className="fixed top-0 left-0 z-[9999] h-[2.5px] transition-all duration-150 ease-out"
          style={{
            width: `${progressWidth}%`,
            background: 'linear-gradient(90deg, #065F46, #059669, #A7F3D0)',
            boxShadow: '0 0 10px rgba(6,95,70,0.7), 0 0 4px rgba(167,243,208,0.5)',
            opacity: progressWidth === 0 ? 0 : 1,
          }}
        >
          {/* Glowing tip */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full"
            style={{
              background: 'rgba(6,95,70,0.6)',
              filter: 'blur(4px)',
              transform: 'translateY(-50%) scale(1)',
            }}
          />
        </div>
      )}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <TopBar sidebarWidth={sidebarWidth} />

      <main
        className="pt-16 min-h-screen transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarWidth }}
      >
        <div className="p-6">
          {/* Page transition wrapper - key on pathname for re-mount animation */}
          <div key={location.pathname} className="page-transition-wrapper">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
