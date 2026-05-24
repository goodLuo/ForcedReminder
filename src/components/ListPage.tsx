import { useEffect, useState } from 'react';
import {
  getAllReminders,
  deleteReminder,
  updateReminder,
  describeRepeat,
  describeDismissCondition,
  type Reminder,
} from '../db';
import { cancelAlarm, scheduleAlarm } from '../alarm';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Plus,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Trash2,
  Calendar,
  AlertTriangle,
  Repeat,
  Power,
  Pencil,
} from 'lucide-react';

interface ListPageProps {
  onAdd: () => void;
  onEdit: (reminder: Reminder) => void;
  onDelete?: (id: number) => void;
  refreshKey: number;
}

export default function ListPage({ onAdd, onEdit, refreshKey }: ListPageProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadReminders = async () => {
    setLoading(true);
    const all = await getAllReminders();
    setReminders(all);
    setLoading(false);
  };

  useEffect(() => {
    loadReminders();
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    cancelAlarm(id);
    await deleteReminder(id);
    loadReminders();
    setDeletingId(null);
  };

  const handleToggle = async (e: React.MouseEvent, r: Reminder) => {
    e.stopPropagation();
    if (!r.id) return;
    const newEnabled = !(r.enabled ?? true);
    const updated: Reminder = { ...r, enabled: newEnabled };
    if (newEnabled && !r.completed) {
      scheduleAlarm(r.id, r.targetTime);
    } else {
      cancelAlarm(r.id);
    }
    await updateReminder(updated);
    loadReminders();
  };

  const handleItemClick = (r: Reminder) => {
    onEdit(r);
  };

  const filtered = reminders.filter((r) => {
    if (filter === 'pending') return !r.completed;
    if (filter === 'completed') return r.completed;
    return true;
  });

  const pendingCount = reminders.filter((r) => !r.completed).length;
  const completedCount = reminders.filter((r) => r.completed).length;
  const overdueCount = reminders.filter(
    (r) => !r.completed && (r.enabled ?? true) && isPast(new Date(r.targetTime))
  ).length;

  const getDateLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    if (isToday(date)) return '今天';
    if (isTomorrow(date)) return '明天';
    return format(date, 'MM月dd日', { locale: zhCN });
  };

  const getTimeLabel = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const getStatusInfo = (r: Reminder) => {
    if (r.completed) {
      return {
        bg: 'bg-emerald-50 border-emerald-200',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        label: '已完成',
      };
    }
    if (!(r.enabled ?? true)) {
      return {
        bg: 'bg-slate-50 border-slate-200',
        icon: <BellOff className="w-5 h-5 text-slate-400" />,
        label: '已停用',
      };
    }
    if (isPast(new Date(r.targetTime))) {
      return {
        bg: 'bg-red-50 border-red-200',
        icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
        label: '已逾期',
      };
    }
    return {
      bg: 'bg-blue-50 border-blue-200',
      icon: <Clock className="w-5 h-5 text-blue-500" />,
      label: '等待中',
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Status Bar Simulation */}
      <div className="bg-slate-900/80 backdrop-blur-lg px-4 py-2 flex items-center justify-between text-slate-400 text-xs">
        <span>{format(new Date(), 'HH:mm')}</span>
        <div className="flex items-center gap-1">
          <span>Android 16</span>
          <div className="w-4 h-2.5 border border-slate-400 rounded-sm relative">
            <div
              className="absolute inset-0.5 bg-emerald-400 rounded-[1px]"
              style={{ width: '70%' }}
            />
          </div>
        </div>
      </div>

      {/* App Bar */}
      <div className="bg-slate-900/60 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">强制提醒</h1>
              <p className="text-slate-400 text-xs">多任务强制提醒管理器</p>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-5 pb-4 flex gap-3">
          <div className="flex-1 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-2xl font-bold text-white">{pendingCount}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> 待处理
            </div>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-2xl font-bold text-emerald-400">
              {completedCount}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 已完成
            </div>
          </div>
          <div className="flex-1 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="text-2xl font-bold text-red-400">{overdueCount}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> 已逾期
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-5 pb-3 flex gap-2">
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
              }`}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待处理' : '已完成'}
            </button>
          ))}
        </div>
      </div>

      {/* List Content */}
      <div className="px-4 py-4 pb-28 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 mt-3 text-sm">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-slate-800/60 flex items-center justify-center mb-4">
              <BellOff className="w-10 h-10 text-slate-600" />
            </div>
            <p className="text-slate-400 text-base font-medium">暂无提醒事项</p>
            <p className="text-slate-500 text-sm mt-1">
              点击下方 + 号添加新提醒
            </p>
          </div>
        ) : (
          filtered.map((r) => {
            const status = getStatusInfo(r);
            const repeatLabel = describeRepeat(r);
            const isRepeating = !!r.repeat && r.repeat !== 'once';
            const hasDismissCondition = !!r.dismissCondition && r.dismissCondition !== 'none';
            const isEnabled = r.enabled ?? true;

            return (
              <div
                key={r.id}
                onClick={() => handleItemClick(r)}
                className={`rounded-2xl border p-4 transition-all cursor-pointer active:scale-[0.98] hover:shadow-md ${status.bg} ${
                  r.completed || !isEnabled ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{status.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-slate-800 ${
                        r.completed ? 'line-through text-slate-500' : ''
                      }`}
                    >
                      {r.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {getDateLabel(r.targetTime)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {getTimeLabel(r.targetTime)}
                      </span>
                    </div>
                    {/* Repeat Badge */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {isRepeating && (
                        <div
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isEnabled && !r.completed
                              ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-sm shadow-blue-500/30'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Repeat className="w-2.5 h-2.5" />
                          {repeatLabel}
                        </div>
                      )}
                      {/* Status badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.completed
                            ? 'bg-emerald-100 text-emerald-600'
                            : !isEnabled
                            ? 'bg-slate-200 text-slate-500'
                            : isPast(new Date(r.targetTime))
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}
                      >
                        {status.label}
                      </span>
                      {/* Dismiss condition badge */}
                      {hasDismissCondition && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-600">
                          {describeDismissCondition(r.dismissCondition)}
                        </span>
                      )}
                      {/* Edit hint */}
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-100">
                        <Pencil className="w-2.5 h-2.5" />
                        点击编辑
                      </span>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-col gap-1 shrink-0">
                    {!r.completed && (
                      <button
                        onClick={(e) => handleToggle(e, r)}
                        className={`p-2 rounded-xl transition-colors group ${
                          isEnabled
                            ? 'hover:bg-amber-100'
                            : 'hover:bg-emerald-100'
                        }`}
                        title={isEnabled ? '停用' : '启用'}
                      >
                        <Power
                          className={`w-4 h-4 transition-colors ${
                            isEnabled
                              ? 'text-emerald-500 group-hover:text-amber-600'
                              : 'text-slate-400 group-hover:text-emerald-500'
                          }`}
                        />
                      </button>
                    )}
                    <button
                      onClick={(e) => r.id != null && handleDelete(e, r.id)}
                      disabled={deletingId === r.id}
                      className="p-2 rounded-xl hover:bg-red-100 transition-colors group disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB — centered bottom */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 h-14 px-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-xl shadow-blue-500/40 text-white font-bold text-base hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
          <span>新建提醒</span>
        </button>
      </div>

      {/* Bottom Nav Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 px-6 py-2 flex items-center justify-center">
        <div className="w-32 h-1 bg-slate-600 rounded-full" />
      </div>
    </div>
  );
}
