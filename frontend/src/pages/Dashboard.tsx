import { useState, useEffect, useRef } from 'react';
import {
  Files, Users, Upload, Clock, BookOpen, HardDrive,
  Activity, TrendingUp, ArrowUpRight, Sparkles
} from 'lucide-react';

/* ── 3D tilt hook ── */
function useTilt(intensity = 12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateZ(8px) scale(1.02)`;
    };
    const onLeave = () => { el.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0) scale(1)'; };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, [intensity]);
  return ref;
}
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FileIcon from '../components/UI/FileIcon';

/* ── Animated counter hook ── */
function useCountUp(target: number, duration = 900, active = false) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!active || typeof target !== 'number' || isNaN(target)) return;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out-quart
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration, active]);

  return value;
}

/* ── Stat card with animated counter + 3D tilt ── */
function StatCard({
  icon: Icon, label, value, sub, gradient, delay = 0,
}: {
  icon: any; label: string; value: number | string;
  sub?: string; gradient: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  const tiltRef = useTilt(10);
  const isNumeric = typeof value === 'number';
  const count = useCountUp(isNumeric ? (value as number) : 0, 900, visible && isNumeric);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const displayValue = isNumeric ? count : value;

  return (
    <div
      ref={tiltRef}
      className="stat-card-dark card-3d p-5 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, opacity: 0 }}
    >
      {/* Top shimmer line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)' }}
      />
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </p>
          <p
            className="stat-number-neon mt-2"
            style={{ animation: visible ? 'countUp 0.4s ease forwards' : 'none' }}
          >
            {displayValue}
          </p>
          {sub && (
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <ArrowUpRight size={11} className="text-[#F59E0B]" />
              {sub}
            </p>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ml-4"
          style={{
            background: gradient,
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          }}
        >
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  LOGIN:    { bg: 'rgba(16,185,129,0.1)', text: '#FBBF24' },
  UPLOAD:   { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  DOWNLOAD: { bg: 'rgba(139,92,246,0.1)', text: '#7c3aed' },
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
      <div className="skeleton h-10 w-72 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-8 w-16 rounded" />
            <div className="skeleton h-2 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <DashboardSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Header / Greeting ── */}
      <div
        className="relative rounded-2xl p-5 overflow-hidden animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #0891b2 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 10s ease infinite, fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        {/* Decorative blobs */}
        <div
          className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'rgba(255,255,255,0.3)', filter: 'blur(30px)' }}
        />
        <div
          className="absolute -bottom-4 left-1/3 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'rgba(255,255,255,0.5)', filter: 'blur(20px)' }}
        />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-[#FCD34D]" />
              <span className="text-white/90 text-sm font-medium">{greeting}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-white/90/80 text-sm mt-1">
              Here's what's happening with your QA assets today.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { label: 'Total Files', val: stats.totalFiles },
              { label: 'Pending', val: stats.pendingApprovals },
            ].map(s => (
              <div
                key={s.label}
                className="px-4 py-3 rounded-xl text-center"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                <div className="text-2xl font-extrabold text-white leading-none">{s.val}</div>
                <div className="text-[#FCD34D]/80 text-xs mt-0.5 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats grid (all 8 in one 4-col grid) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Files}     label="Total Files"     value={stats.totalFiles}           sub="Active assets"     gradient="linear-gradient(135deg,#F59E0B,#FBBF24)"  delay={0}   />
        <StatCard icon={Users}     label="Active Users"    value={stats.activeUsers}          sub="Team members"      gradient="linear-gradient(135deg,#3b82f6,#6366f1)"  delay={60}  />
        <StatCard icon={Upload}    label="Uploaded Today"  value={stats.uploadedToday}        sub="New files"         gradient="linear-gradient(135deg,#10b981,#FBBF24)"  delay={120} />
        <StatCard icon={Clock}     label="Pending Review"  value={stats.pendingApprovals}     sub="Awaiting approval" gradient="linear-gradient(135deg,#f59e0b,#d97706)"  delay={180} />
        <StatCard icon={BookOpen}  label="KB Articles"     value={stats.totalKB}              sub="Published guides"  gradient="linear-gradient(135deg,#8b5cf6,#7c3aed)"  delay={240} />
        <StatCard icon={HardDrive} label="Total Storage"   value={formatBytes(stats.totalSize)} sub="Used capacity"  gradient="linear-gradient(135deg,#ef4444,#dc2626)"  delay={300} />
        <StatCard icon={Activity}  label="Audit Events"    value={stats.auditEventsToday}     sub="Last 24 hours"     gradient="linear-gradient(135deg,#6366f1,#4f46e5)"  delay={360} />
        <StatCard icon={TrendingUp}label="This Week"       value={stats.uploadGrowth}         sub="Upload growth"     gradient="linear-gradient(135deg,#f97316,#ea580c)"  delay={420} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Upload Trend */}
        <div className="stat-card-dark p-5 lg:col-span-2 animate-fade-in-up stagger-4">
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
        <div className="stat-card-dark p-5 animate-fade-in-up stagger-5">
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
                  className="activity-item flex items-start gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
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
