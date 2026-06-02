import { useState, useEffect } from 'react';
import { Files, Users, Upload, Clock, BookOpen, HardDrive, Activity, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import FileIcon from '../components/UI/FileIcon';

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPLOAD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DOWNLOAD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  APPROVE: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  VIEW: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  SEARCH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const STATUS_COLORS: Record<string, string> = {
  published: '#08a49c', approved: '#0d9488', submitted: '#3b82f6',
  under_review: '#f59e0b', draft: '#9ca3af', archived: '#6b7280',
};

function formatBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {}); }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Here's what's happening with your QA assets today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Files} label="Total Files" value={stats.totalFiles} sub="Active assets" color="bg-primary-500" />
        <StatCard icon={Users} label="Active Users" value={stats.activeUsers} sub="Team members" color="bg-blue-500" />
        <StatCard icon={Upload} label="Uploaded Today" value={stats.uploadedToday} sub="New files" color="bg-green-500" />
        <StatCard icon={Clock} label="Pending Review" value={stats.pendingApprovals} sub="Awaiting approval" color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="KB Articles" value={stats.totalKB} sub="Published guides" color="bg-purple-500" />
        <StatCard icon={HardDrive} label="Total Storage" value={formatBytes(stats.totalSize)} sub="Used capacity" color="bg-rose-500" />
        <StatCard icon={Activity} label="Audit Events" value="15+" sub="Last 24 hours" color="bg-indigo-500" />
        <StatCard icon={TrendingUp} label="This Week" value="+12%" sub="Upload growth" color="bg-orange-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Trend */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.uploadTrend}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(-5) || d} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#08a49c" strokeWidth={2} dot={{ fill: '#08a49c', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">File Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={stats.statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ status, percent }) => `${(percent * 100).toFixed(0)}%`}>
                {stats.statusBreakdown.map((entry: any) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#9ca3af'} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {stats.statusBreakdown.map((s: any) => (
              <div key={s.status} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: STATUS_COLORS[s.status] || '#9ca3af' }} />
                <span className="text-gray-600 dark:text-gray-400 capitalize">{s.status.replace('_', ' ')}</span>
                <span className="ml-auto font-medium text-gray-900 dark:text-gray-100">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Repository Usage */}
      {stats.repositoryStats?.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Repository Usage</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.repositoryStats} margin={{ left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="file_count" fill="#08a49c" radius={[4, 4, 0, 0]} name="Files" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats.recentActivity?.slice(0, 8).map((item: any) => (
              <div key={item.id} className="flex items-start gap-3">
                <img src={item.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`} alt="" className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.user_name || 'System'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[item.action] || 'bg-gray-100 text-gray-600'}`}>{item.action}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{item.details}</p>
                  <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Downloaded */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Files</h3>
          {stats.topFiles?.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">No download activity yet</div>
          ) : (
            <div className="space-y-3">
              {stats.topFiles?.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.project} · {f.category}</div>
                  </div>
                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{f.downloads}×</span>
                </div>
              ))}
              {stats.topFiles?.length === 0 && stats.recentActivity?.slice(0, 5).filter((a: any) => a.action === 'UPLOAD').map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <FileIcon name={f.details} size={20} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.details?.replace('Uploaded: ', '')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3">
            {[
              { label: 'Pending Approvals', value: stats.pendingApprovals, color: 'text-amber-600' },
              { label: 'Published Files', value: stats.statusBreakdown?.find((s: any) => s.status === 'published')?.count || 0, color: 'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
