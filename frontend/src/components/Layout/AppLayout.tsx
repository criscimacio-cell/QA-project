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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Top Progress Bar ── */}
      {loading && (
        <div
          className="fixed top-0 left-0 z-[9999] h-[2.5px] transition-all duration-150 ease-out"
          style={{
            width: `${progressWidth}%`,
            background: 'linear-gradient(90deg, #08a49c, #06b6d4, #5eead4)',
            boxShadow: '0 0 10px rgba(8,164,156,0.7), 0 0 4px rgba(6,182,212,0.5)',
            opacity: progressWidth === 0 ? 0 : 1,
          }}
        >
          {/* Glowing tip */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full"
            style={{
              background: 'rgba(8,164,156,0.6)',
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
