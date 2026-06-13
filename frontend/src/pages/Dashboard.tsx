import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import {
  Files, Users, Upload, Clock, BookOpen, HardDrive,
  Activity, TrendingUp, ArrowUpRight, Sparkles
} from 'lucide-react';

/* ── Live clock ── */
function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* ── Typing text hook ── */
function useTyping(text: string, speed = 38) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

/* ── 3D tilt + specular highlight hook ── */
function useTilt(intensity = 12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const shine = el.querySelector<HTMLDivElement>('.tilt-shine');
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateZ(8px) scale(1.02)`;
      if (shine) {
        shine.style.opacity = '1';
        shine.style.background = `radial-gradient(circle at ${(x+0.5)*100}% ${(y+0.5)*100}%, rgba(255,255,255,0.10) 0%, transparent 65%)`;
      }
    };
    const onLeave = () => {
      el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)';
      if (shine) shine.style.opacity = '0';
    };
    el.style.transition = 'transform 0.15s ease-out';
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [intensity]);
  return ref;
}

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 900, active = false) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active || typeof target !== 'number' || isNaN(target)) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(target * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, active]);
  return value;
}

/* ── Circular progress ring ── */
function RingProgress({ pct, color, size = 52, stroke = 3.5 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.min(pct, 1))), 120);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, right: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

/* ── Stat card: ring + 3D tilt + countUp ── */
function StatCard({
  icon: Icon, label, value, sub, gradient, ringColor, ringPct = 0.6, delay = 0,
}: {
  icon: any; label: string; value: number | string;
  sub?: string; gradient: string; ringColor?: string; ringPct?: number; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const tiltRef = useTilt(10);
  const isNumeric = typeof value === 'number';
  const count = useCountUp(isNumeric ? (value as number) : 0, 1000, visible && isNumeric);
  const displayValue = isNumeric ? count : value;
  const rc = ringColor || '#F59E0B';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      ref={tiltRef}
      className="stat-card-dark card-3d p-5"
      style={{
        opacity: 0,
        animation: `fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
        position: 'relative', overflow: 'hidden',
        willChange: 'transform',
      }}
    >
      {/* Top shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }} />
      {/* Specular highlight layer */}
      <div className="tilt-shine absolute inset-0 rounded-2xl pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.15s ease', zIndex: 1 }} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="stat-number-neon mt-2"
            style={{ animation: visible ? 'countUp 0.4s ease forwards' : 'none' }}>
            {displayValue}
          </p>
          {sub && (
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <ArrowUpRight size={11} className="text-[#F59E0B]" />{sub}
            </p>
          )}
        </div>

        {/* Icon with animated ring */}
        <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0, marginLeft: 12 }}>
          <RingProgress pct={visible ? ringPct : 0} color={rc} size={52} stroke={3} />
          <div
            className="absolute inset-1.5 rounded-xl flex items-center justify-center"
            style={{ background: gradient, boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 12px ${rc}33` }}
          >
            <Icon size={19} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN:    { bg: 'rgba(16,185,129,0.1)', text: '#FBBF24' },
  UPLOAD:   { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  DOWNLOAD: { bg: 'rgba(139,92,246,0.1)', text: '#F59E0B' },
  APPROVE:  { bg: 'rgba(245,158,11,0.1)', text: '#D97706' },
  DELETE:   { bg: 'rgba(239,68,68,0.1)', text: '#dc2626' },
  VIEW:     { bg: 'rgba(100,116,139,0.1)', text: '#475569' },
  SEARCH:   { bg: 'rgba(245,158,11,0.1)', text: '#d97706' },
};

const STATUS_COLORS: Record<string, string> = {
  published: '#F59E0B',
  approved: '#D97706',
  submitted: '#3b82f6',
  under_review: '#f59e0b',
  draft: '#9ca3af',
  archived: '#6b7280',
};

const RANK_STYLES = [
  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', text: '#fff' },
  { bg: 'linear-gradient(135deg, #b45309, #92400e)', text: '#fff' },
];

function formatBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

/* Custom tooltip for charts */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2.5 rounded-xl text-xs font-medium"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* Skeleton dashboard */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="shimmer-bg rounded-lg" style={{ height: 12, marginBottom: 8 }} />
            <div className="shimmer-bg rounded-lg" style={{ height: 32, marginBottom: 8 }} />
            <div className="shimmer-bg rounded-lg" style={{ height: 8 }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="shimmer-bg rounded-lg" style={{ height: 200, marginBottom: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const clock = useClock();
  const hour = clock.getHours();
  const greetingWord = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';
  const typedGreeting = useTyping(`${greetingWord}, ${firstName} 👋`, 40);
  const timeStr = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Aurora Hero Banner ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: '#0d0d14',
          border: '1px solid rgba(245,158,11,0.15)',
          animation: 'fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
          minHeight: 130,
        }}
      >
        {/* Aurora bands */}
        {[
          { top: '-20%', h: 160, colors: 'rgba(245,158,11,0.18) 20%, rgba(139,92,246,0.12) 60%, transparent 90%', dur: '12s', del: '0s' },
          { top: '30%',  h: 120, colors: 'rgba(20,184,166,0.10) 10%, rgba(245,158,11,0.14) 55%, transparent 85%', dur: '17s', del: '-5s' },
          { top: '65%',  h: 100, colors: 'rgba(139,92,246,0.08) 15%, rgba(20,184,166,0.08) 60%, transparent 90%', dur: '22s', del: '-9s' },
        ].map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: 0, right: 0, top: b.top, height: b.h,
            background: `linear-gradient(90deg, transparent 0%, ${b.colors}, transparent 100%)`,
            filter: 'blur(28px)',
            animation: `auroraDrift ${b.dur} ease-in-out ${b.del} infinite`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Dot grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Glow orb top-right */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none',
        }} />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4 p-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: 11, color: 'rgba(245,158,11,0.7)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {dateStr}
              </span>
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.02em',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              minHeight: 34,
            }}>
              {typedGreeting}
              <span style={{ animation: 'cursorBlink 0.8s step-end infinite', color: '#F59E0B' }}>|</span>
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
              Here's what's happening with your QA assets today.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Live clock */}
            <div style={{
              padding: '10px 18px', borderRadius: 14, textAlign: 'center',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                {timeStr}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Live
              </div>
            </div>

            {/* Quick stats */}
            {[
              { label: 'Total Files', val: stats.totalFiles, color: '#F59E0B' },
              { label: 'Pending', val: stats.pendingApprovals, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '10px 18px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats grid (all 8 in one 4-col grid) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Files}      label="Total Files"     value={stats.totalFiles}              sub="Active assets"     gradient="linear-gradient(135deg,#F59E0B,#FBBF24)"  ringColor="#F59E0B"  ringPct={0.78} delay={0}   />
        <StatCard icon={Users}      label="Active Users"    value={stats.activeUsers}             sub="Team members"      gradient="linear-gradient(135deg,#3b82f6,#6366f1)"  ringColor="#6366f1"  ringPct={0.55} delay={80}  />
        <StatCard icon={Upload}     label="Uploaded Today"  value={stats.uploadedToday}           sub="New files"         gradient="linear-gradient(135deg,#10b981,#34d399)"  ringColor="#10b981"  ringPct={0.40} delay={160} />
        <StatCard icon={Clock}      label="Pending Review"  value={stats.pendingApprovals}        sub="Awaiting approval" gradient="linear-gradient(135deg,#f59e0b,#d97706)"  ringColor="#ef4444"  ringPct={Math.min((stats.pendingApprovals||0)/10,1)} delay={240} />
        <StatCard icon={BookOpen}   label="KB Articles"     value={stats.totalKB}                 sub="Published guides"  gradient="linear-gradient(135deg,#FBBF24,#F59E0B)"  ringColor="#FBBF24"  ringPct={0.65} delay={320} />
        <StatCard icon={HardDrive}  label="Total Storage"   value={formatBytes(stats.totalSize)}  sub="Used capacity"     gradient="linear-gradient(135deg,#ef4444,#dc2626)"  ringColor="#ef4444"  ringPct={0.50} delay={400} />
        <StatCard icon={Activity}   label="Audit Events"    value={stats.auditEventsToday}        sub="Last 24 hours"     gradient="linear-gradient(135deg,#6366f1,#4f46e5)"  ringColor="#6366f1"  ringPct={0.72} delay={480} />
        <StatCard icon={TrendingUp} label="This Week"       value={stats.uploadGrowth}            sub="Upload growth"     gradient="linear-gradient(135deg,#f97316,#ea580c)"  ringColor="#f97316"  ringPct={0.85} delay={560} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Upload Trend */}
        <div className="stat-card-dark p-5 lg:col-span-2 animate-fade-in-up stagger-4" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-sm">
                Upload Trend
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 7 days</p>
            </div>
            <div
              className="px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                background: 'rgba(245,158,11,0.1)',
                color: '#F59E0B',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              ↑ Active
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.uploadTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={d => d?.slice(-5) || d}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ fill: '#F59E0B', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="stat-card-dark p-5 animate-fade-in-up stagger-5" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.38s' }}>
          <div className="mb-5">
            <h3 className="font-bold text-white text-sm">File Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">Distribution</p>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={stats.statusBreakdown}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={68}
                innerRadius={35}
                paddingAngle={3}
                strokeWidth={0}
              >
                {stats.statusBreakdown.map((entry: any) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] || '#9ca3af'}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {stats.statusBreakdown.map((s: any) => (
              <div key={s.status} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLORS[s.status] || '#9ca3af' }}
                />
                <span className="text-slate-400 capitalize flex-1">
                  {(s.status || '').replace('_', ' ')}
                </span>
                <span className="font-bold text-slate-100">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Repository Usage ── */}
      {stats.repositoryStats?.length > 0 && (
        <div className="stat-card-dark p-4 animate-fade-in-up stagger-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-sm">Repository Usage</h3>
              <p className="text-xs text-slate-500 mt-0.5">Files per repository</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.repositoryStats} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#FBBF24" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                dataKey="file_count"
                fill="url(#barGrad)"
                radius={[6, 6, 0, 0]}
                name="Files"
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bottom Row: Activity + Top Files ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Activity */}
        <div className="stat-card-dark p-5 animate-fade-in-up stagger-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-sm">Recent Activity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Latest team actions</p>
            </div>
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: '#10b981',
                boxShadow: '0 0 0 3px rgba(16,185,129,0.2)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }}
            />
          </div>
          <div className="space-y-3">
            {stats.recentActivity?.slice(0, 8).map((item: any, idx: number) => {
              const ac = ACTION_COLORS[item.action] || { bg: 'rgba(100,116,139,0.1)', text: '#475569' };
              return (
                <div
                  key={item.id}
                  className="activity-item flex items-start gap-3"
                  style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${idx * 0.06}s` }}
                >
                  <img
                    src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`}
                    alt=""
                    className="w-7 h-7 rounded-full bg-slate-100 flex-shrink-0 ring-2 ring-white dark:ring-slate-900"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-100">
                        {item.user_name || 'System'}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: ac.bg, color: ac.text }}
                      >
                        {item.action}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.details}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Files (Most Downloaded) */}
        <div className="stat-card-dark p-5 animate-fade-in-up stagger-7">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-sm">Top Files</h3>
              <p className="text-xs text-slate-500 mt-0.5">Most downloaded assets</p>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}
            >
              All time
            </span>
          </div>

          {stats.topFiles?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
              <Files size={32} className="opacity-20" />
              <span className="text-sm">No download activity yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topFiles?.map((f: any, i: number) => {
                const rankStyle = RANK_STYLES[i] || { bg: 'rgba(100,116,139,0.1)', text: '#64748b' };
                const maxDownloads = stats.topFiles[0]?.downloads || 1;
                const pct = Math.round((f.downloads / maxDownloads) * 100);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 animate-fade-in-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div
                      className="rank-badge text-xs"
                      style={{ background: rankStyle.bg, color: rankStyle.text }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate">
                        {f.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {f.project} · {f.category}
                      </div>
                      <div className="progress-bar mt-1.5">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${pct}%`, transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 120}ms` }}
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span
                        className="text-xs font-bold"
                        style={{ color: '#F59E0B' }}
                      >
                        {f.downloads}
                      </span>
                      <div className="text-xs text-slate-400 dark:text-slate-600">DLs</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick stat pills */}
          <div
            className="mt-5 pt-4 grid grid-cols-2 gap-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {[
              { label: 'Pending Approvals', value: stats.pendingApprovals, color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
              {
                label: 'Published Files',
                value: stats.statusBreakdown?.find((s: any) => s.status === 'published')?.count || 0,
                color: '#FBBF24',
                bg: 'rgba(16,185,129,0.08)',
              },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center transition-all hover:scale-105"
                style={{ background: s.bg, border: `1px solid ${s.bg}` }}
              >
                <div className="text-xl font-extrabold" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
