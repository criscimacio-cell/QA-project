import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import {
  Files, Users, Upload, Clock, BookOpen, HardDrive,
  Activity, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, CheckCircle2, AlertCircle,
  UploadCloud, CheckCircle, Trash2, Eye, Download, Archive
} from 'lucide-react';

function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

const ACTIVITY_ICON: Record<string, { icon: any; color: string; bg: string }> = {
  UPLOAD:   { icon: UploadCloud, color: '#2563eb', bg: 'rgba(59,130,246,0.1)' },
  APPROVE:  { icon: CheckCircle,  color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  DELETE:   { icon: Trash2,       color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
  VIEW:     { icon: Eye,          color: '#475569', bg: 'rgba(100,116,139,0.08)' },
  DOWNLOAD: { icon: Download,     color: '#d97706', bg: 'rgba(245,158,11,0.1)' },
  ARCHIVE:  { icon: Archive,      color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

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
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); setDone(true); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { displayed, done };
}

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 900, active = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active || typeof target !== 'number' || isNaN(target)) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return value;
}

/* ── Mini sparkline using inline SVG ── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ') + ` L${w},${h} L0,${h} Z`;
  const linePath = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <path d={linePath} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Fintech-style KPI Card ── */
function KpiCard({
  icon: Icon, label, value, sub, accent, gradient, sparkData,
  trend, trendLabel, delay = 0,
}: {
  icon: any; label: string; value: number | string; sub?: string;
  accent: string; gradient: string; sparkData?: number[]; trend?: number; trendLabel?: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isNumeric = typeof value === 'number';
  const count = useCountUp(isNumeric ? (value as number) : 0, 950, visible && isNumeric);
  const displayValue = isNumeric ? count.toLocaleString() : value;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className="relative overflow-hidden cursor-default rounded-2xl"
      style={{
        background: gradient,
        opacity: 0,
        animation: `fadeSlideUp 0.42s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
        boxShadow: hovered
          ? `0 20px 60px ${accent}55, 0 8px 24px ${accent}33`
          : `0 4px 20px ${accent}33, 0 2px 8px rgba(0,0,0,0.12)`,
        transform: hovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'box-shadow 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shine sweep on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
          transform: hovered ? 'translateX(100%)' : 'translateX(-100%)',
          transition: hovered ? 'transform 0.55s ease' : 'none',
        }}
      />

      {/* Glowing blob top-right */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 w-28 h-28 rounded-full"
        style={{ background: 'rgba(255,255,255,0.12)', filter: 'blur(18px)' }}
      />

      <div className="relative p-5">
        {/* Top row: label + large icon */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 leading-tight mb-0.5">
              {label}
            </p>
            {trend !== undefined && (
              <span
                aria-label={`${trendUp ? 'Up' : 'Down'} ${Math.abs(trend)}%`}
                className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mt-1"
                style={{
                  background: trendUp ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)',
                  color: 'white',
                }}
              >
                {trendUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {/* Large icon bubble */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              transform: hovered ? 'scale(1.12) rotate(-6deg)' : 'scale(1) rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            <Icon size={22} color="white" />
          </div>
        </div>

        {/* Big number */}
        <p
          className="text-4xl font-black text-white leading-none tracking-tight mb-1"
          style={{ fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        >
          {displayValue}
        </p>

        {/* Sub + sparkline */}
        <div className="flex items-end justify-between gap-2 mt-2">
          <div>
            {sub && <p className="text-xs text-white/65 leading-tight">{sub}</p>}
            {trendLabel && trend !== undefined && (
              <p className="text-xs text-white/50 mt-0.5">{trendLabel}</p>
            )}
          </div>
          {sparkData && sparkData.length > 1 && (
            <div className="flex-shrink-0 opacity-60 group-hover:opacity-90 transition-opacity">
              <Sparkline data={sparkData} color="rgba(255,255,255,0.9)" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN:    { bg: 'rgba(16,185,129,0.08)', text: '#059669' },
  UPLOAD:   { bg: 'rgba(59,130,246,0.08)', text: '#2563eb' },
  DOWNLOAD: { bg: 'rgba(139,92,246,0.08)', text: '#7c3aed' },
  APPROVE:  { bg: 'rgba(245,158,11,0.08)', text: '#d97706' },
  DELETE:   { bg: 'rgba(239,68,68,0.08)',  text: '#dc2626' },
  VIEW:     { bg: 'rgba(100,116,139,0.06)', text: '#475569' },
  SEARCH:   { bg: 'rgba(20,184,166,0.08)', text: '#0d9488' },
};

const STATUS_COLORS: Record<string, string> = {
  published:    '#10b981',
  approved:     '#059669',
  submitted:    '#3b82f6',
  under_review: '#f59e0b',
  draft:        '#94a3b8',
  archived:     '#6b7280',
};

const RANK_GRADIENTS = [
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #94a3b8, #64748b)',
  'linear-gradient(135deg, #b45309, #92400e)',
];

function formatBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs font-medium shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
      <div className="text-slate-400 mb-1 text-[11px]">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="shimmer-bg rounded-2xl" style={{ height: 120 }} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="shimmer-bg rounded-lg" style={{ height: 10 }} />
            <div className="shimmer-bg rounded-lg" style={{ height: 36 }} />
            <div className="shimmer-bg rounded-lg" style={{ height: 8, width: '60%' }} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="shimmer-bg rounded-lg" style={{ height: 200 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const clock = useClock();
  const hour = clock.getHours();
  const greetingWord = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';
  const { displayed: typedGreeting, done: typingDone } = useTyping(`${greetingWord}, ${firstName}`, 42);
  const timeStr = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => setStatsError(true));
    if (user?.role === 'admin') {
      api.get('/dashboard/activity').then(r => setActivityFeed(r.data)).catch(() => toast.error('Failed to load activity feed'));
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const id = setInterval(() => {
      api.get('/dashboard/activity').then(r => setActivityFeed(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [user?.role]);

  if (statsError) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlertCircle size={40} className="text-red-400" />
      <p className="text-slate-600 dark:text-slate-300 font-medium">Failed to load dashboard data</p>
      <button className="btn-secondary text-sm" onClick={() => {
        setStatsError(false);
        api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => setStatsError(true));
        if (user?.role === 'admin') {
          api.get('/dashboard/activity').then(r => setActivityFeed(r.data)).catch(() => toast.error('Failed to load activity feed'));
        }
      }}>Retry</button>
    </div>
  );
  if (!stats) return <DashboardSkeleton />;

  /* Derive spark data from upload trend */
  const trendNums: number[] = (stats.uploadTrend || []).map((d: any) => d.count as number);
  const todayUploads = trendNums.at(-1) ?? 0;
  const yesterdayUploads = trendNums.at(-2) ?? 0;
  const uploadTrend = yesterdayUploads > 0
    ? Math.round(((todayUploads - yesterdayUploads) / yesterdayUploads) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Hero header ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          animation: 'fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Subtle top gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, transparent 60%)',
        }} />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-6">
          {/* Greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">{dateStr}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight" style={{ minHeight: 32 }}>
              {typedGreeting}
              {!typingDone && <span style={{ animation: 'cursorBlink 0.8s step-end infinite', color: '#f59e0b', marginLeft: 1 }}>|</span>}
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Here's what's happening with your assets today.
            </p>
          </div>

          {/* Right widgets */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Live clock */}
            <div className="flex flex-col items-center px-4 py-2.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <span className="text-xl font-bold text-amber-500 tabular-nums font-mono">{timeStr}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Live</span>
            </div>

            {/* Quick stat pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{stats.totalFiles}</span>
                <span className="text-[10px] text-slate-400">files</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertCircle size={13} className="text-red-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{stats.pendingApprovals}</span>
                <span className="text-[10px] text-slate-400">pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={Files} label="Total Files" value={stats.totalFiles}
          sub="Active assets" accent="#f59e0b"
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 60%, #b45309 100%)"
          sparkData={trendNums} delay={0}
        />
        <KpiCard
          icon={Users} label="Active Users" value={stats.activeUsers}
          sub="Team members" accent="#6366f1"
          gradient="linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #4338ca 100%)"
          delay={60}
        />
        <KpiCard
          icon={Upload} label="Uploaded Today" value={stats.uploadedToday}
          sub="New uploads" accent="#10b981"
          gradient="linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)"
          trend={uploadTrend} trendLabel="vs yesterday"
          sparkData={trendNums} delay={120}
        />
        <KpiCard
          icon={Clock} label="Pending Review" value={stats.pendingApprovals}
          sub="Awaiting approval" accent="#ef4444"
          gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 60%, #b91c1c 100%)"
          delay={180}
        />
        <KpiCard
          icon={BookOpen} label="KB Articles" value={stats.totalKB}
          sub="Published guides" accent="#8b5cf6"
          gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 60%, #6d28d9 100%)"
          delay={240}
        />
        <KpiCard
          icon={HardDrive} label="Storage Used" value={formatBytes(stats.totalSize)}
          sub="Total capacity" accent="#0ea5e9"
          gradient="linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #0369a1 100%)"
          delay={300}
        />
        <KpiCard
          icon={Activity} label="Audit Events" value={stats.auditEventsToday}
          sub="Last 24 hours" accent="#f97316"
          gradient="linear-gradient(135deg, #f97316 0%, #ea580c 60%, #c2410c 100%)"
          delay={360}
        />
        <KpiCard
          icon={TrendingUp} label="Upload Growth" value={stats.uploadGrowth ?? 0}
          sub="This week vs last" accent="#14b8a6"
          gradient="linear-gradient(135deg, #14b8a6 0%, #0d9488 60%, #0f766e 100%)"
          sparkData={trendNums} delay={420}
          trend={stats.uploadGrowth ?? 0} trendLabel="vs last week"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Upload Trend — area chart */}
        <div className="card p-5 lg:col-span-2" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.28s' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Upload Trend</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Files uploaded — last 7 days</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              Weekly
            </span>
          </div>
          <div role="img" aria-label="Upload trend area chart showing files uploaded over last 7 days">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.uploadTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d?.slice(-5) || d} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} fill="url(#areaGrad)"
                  dot={{ fill: '#f59e0b', r: 3.5, strokeWidth: 2, stroke: 'var(--card)' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* File Status donut */}
        <div className="card p-5" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.34s' }}>
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">File Status</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Distribution breakdown</p>
          </div>
          <div role="img" aria-label="File status distribution pie chart">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={stats.statusBreakdown} dataKey="count" nameKey="status"
                  cx="50%" cy="50%" outerRadius={68} innerRadius={38} paddingAngle={2} strokeWidth={0}>
                  {stats.statusBreakdown.map((entry: any) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {stats.statusBreakdown.map((s: any) => {
              const total = stats.statusBreakdown.reduce((a: number, b: any) => a + b.count, 0) || 1;
              const pct = Math.round((s.count / total) * 100);
              return (
                <div key={s.status} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.status] || '#94a3b8' }} />
                  <span className="text-slate-500 dark:text-slate-400 capitalize flex-1">{(s.status || '').replace('_', ' ')}</span>
                  <span className="text-slate-400 dark:text-slate-500">{pct}%</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 w-4 text-right">{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Repository Usage ── */}
      {stats.repositoryStats?.length > 0 && (
        <div className="card p-5" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.38s' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Repository Usage</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Files per repository</p>
            </div>
          </div>
          <div role="img" aria-label="Repository usage bar chart showing files per repository">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.repositoryStats} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="file_count" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Files" maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Activity Feed ── */}
      {activityFeed.length > 0 && (
        <div className="card p-5" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.5s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Recent Activity</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Latest platform events</p>
            </div>
          </div>
          <div className="space-y-3">
            {activityFeed.slice(0, 15).map((item: any, idx: number) => {
              const config = ACTIVITY_ICON[item.action] || { icon: Activity, color: '#475569', bg: 'rgba(100,116,139,0.08)' };
              const IconComp = config.icon;
              const initial = (item.user_name || '?')[0].toUpperCase();
              return (
                <div key={item.id} className="flex items-start gap-3"
                  style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${idx * 0.04}s` }}>
                  {/* User avatar */}
                  {item.user_avatar ? (
                    <img src={item.user_avatar} alt="" className="w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-slate-900 object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-slate-900"
                      style={{ background: config.bg, color: config.color }}>
                      {initial}
                    </div>
                  )}
                  {/* Action icon */}
                  <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: config.bg }}>
                    <IconComp size={12} style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.user_name || 'System'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: config.bg, color: config.color }}>{item.action}</span>
                      {item.entity_type && <span className="text-xs text-slate-400">{item.entity_type}</span>}
                    </div>
                    {item.details && <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{item.details}</p>}
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{timeAgo(item.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Bottom Row: Top Files ── */}
      <div className="grid grid-cols-1 gap-4">

        {/* Top Files */}
        <div className="card p-5" style={{ animation: 'fadeSlideUp 0.5s ease both', animationDelay: '0.46s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Top Files</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Most downloaded assets</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }}>
              All time
            </span>
          </div>

          {stats.topFiles?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Files size={30} className="text-slate-300 dark:text-slate-600" />
              <span className="text-sm text-slate-400 dark:text-slate-500">No download activity yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topFiles?.map((f: any, i: number) => {
                const maxDl = stats.topFiles[0]?.downloads || 1;
                const pct = Math.round((f.downloads / maxDl) * 100);
                return (
                  <div key={i} className="flex items-center gap-3"
                    style={{ animation: `rowStagger 0.28s ease both`, animationDelay: `${i * 60}ms` }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: RANK_GRADIENTS[i] || 'rgba(100,116,139,0.15)', color: i < 3 ? '#fff' : '#64748b', fontSize: 10, fontWeight: 700 }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                        {f.project} · {f.category}
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                          style={{ width: `${pct}%`, transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 100}ms` }} />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-amber-500">{f.downloads}</span>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">DLs</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary pills */}
          <div className="mt-5 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Pending Approvals', value: stats.pendingApprovals, accent: '#f59e0b' },
              {
                label: 'Published Files',
                value: stats.statusBreakdown?.find((s: any) => s.status === 'published')?.count || 0,
                accent: '#10b981',
              },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center"
                style={{ background: `${s.accent}08`, border: `1px solid ${s.accent}18` }}>
                <div className="text-2xl font-extrabold" style={{ color: s.accent }}>{s.value}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
