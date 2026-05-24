import { useState, useMemo, useEffect } from 'react';
import {
  addReminder,
  updateReminder,
  type RepeatMode,
  type Reminder,
  type DismissCondition,
  type RingtoneType,
} from '../db';
import { scheduleAlarm, cancelAlarm } from '../alarm';
import { previewRingtone } from '../sound';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  Type,
  CalendarDays,
  Clock,
  Bell,
  Sparkles,
  Repeat,
  Repeat1,
  Calendar,
  Sun,
  Moon,
  Briefcase,
  Pencil,
  ShieldCheck,
  Camera,
  Calculator,
  Brain,
  CheckCircle,
} from 'lucide-react';

interface AddPageProps {
  onBack: () => void;
  onSaved: () => void;
  editingReminder?: Reminder | null;
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AddPage({
  onBack,
  onSaved,
  editingReminder,
}: AddPageProps) {
  const isEditing = !!editingReminder;

  const [content, setContent] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(
    format(new Date(Date.now() + 60 * 60 * 1000), 'HH:mm')
  );
  const [repeat, setRepeat] = useState<RepeatMode>('once');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState(new Date().getDate());
  const [dismissCondition, setDismissCondition] =
    useState<DismissCondition>('none');
  const [ringtone, setRingtone] = useState<RingtoneType>('marimba');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showRepeatPanel, setShowRepeatPanel] = useState(false);
  const [showDismissPanel, setShowDismissPanel] = useState(false);
  const [showRingtonePanel, setShowRingtonePanel] = useState(false);
  const [playingPreview, setPlayingPreview] = useState<RingtoneType | null>(null);

  // Pre-fill when editing
  useEffect(() => {
    if (editingReminder) {
      setContent(editingReminder.content);
      const d = new Date(editingReminder.targetTime);
      setDate(format(d, 'yyyy-MM-dd'));
      setTime(format(d, 'HH:mm'));
      setRepeat(editingReminder.repeat || 'once');
      setDaysOfWeek(editingReminder.daysOfWeek || []);
      setMonthDay(editingReminder.monthDay || d.getDate());
      setDismissCondition(editingReminder.dismissCondition || 'none');
      setRingtone(editingReminder.ringtone || 'marimba');
      if (editingReminder.repeat && editingReminder.repeat !== 'once') {
        setShowRepeatPanel(true);
      }
      if (
        editingReminder.dismissCondition &&
        editingReminder.dismissCondition !== 'none'
      ) {
        setShowDismissPanel(true);
      }
    }
  }, [editingReminder]);

  const quickOptions = [
    { label: '喝水', icon: '💧' },
    { label: '休息一下', icon: '☕' },
    { label: '开会', icon: '📋' },
    { label: '吃药', icon: '💊' },
    { label: '运动', icon: '🏃' },
    { label: '打电话', icon: '📱' },
    { label: '提交报告', icon: '📝' },
    { label: '取快递', icon: '📦' },
  ];

  const repeatPresets: {
    mode: RepeatMode;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
    days?: number[];
  }[] = [
    {
      mode: 'once',
      label: '仅一次',
      icon: <Repeat1 className="w-4 h-4" />,
      color: 'from-slate-500 to-slate-600',
      desc: '只在指定时间触发',
    },
    {
      mode: 'daily',
      label: '每天',
      icon: <Repeat className="w-4 h-4" />,
      color: 'from-blue-500 to-blue-600',
      desc: '每天同一时间触发',
    },
    {
      mode: 'weekdays',
      label: '工作日',
      icon: <Briefcase className="w-4 h-4" />,
      color: 'from-indigo-500 to-purple-600',
      desc: '周一至周五',
      days: [1, 2, 3, 4, 5],
    },
    {
      mode: 'weekends',
      label: '周末',
      icon: <Sun className="w-4 h-4" />,
      color: 'from-amber-500 to-orange-600',
      desc: '周六、周日',
      days: [0, 6],
    },
    {
      mode: 'weekly',
      label: '每周自定义',
      icon: <Calendar className="w-4 h-4" />,
      color: 'from-emerald-500 to-teal-600',
      desc: '选择每周的某几天',
    },
    {
      mode: 'monthly',
      label: '每月',
      icon: <Moon className="w-4 h-4" />,
      color: 'from-pink-500 to-rose-600',
      desc: '每月固定日期',
    },
  ];

  const dismissPresets: {
    condition: DismissCondition;
    label: string;
    icon: React.ReactNode;
    color: string;
    desc: string;
  }[] = [
    {
      condition: 'none',
      label: '直接关闭',
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'from-slate-500 to-slate-600',
      desc: '点击按钮即可关闭',
    },
    {
      condition: 'photo',
      label: '拍照验证',
      icon: <Camera className="w-4 h-4" />,
      color: 'from-cyan-500 to-blue-600',
      desc: '需上传或拍摄一张照片',
    },
    {
      condition: 'math',
      label: '简单数学题',
      icon: <Calculator className="w-4 h-4" />,
      color: 'from-emerald-500 to-green-600',
      desc: '两位数加减乘法',
    },
    {
      condition: 'math_hard',
      label: '困难数学题',
      icon: <Brain className="w-4 h-4" />,
      color: 'from-red-500 to-rose-600',
      desc: '三位数混合运算，3题',
    },
  ];

  const repeatSummary = useMemo(() => {
    switch (repeat) {
      case 'once':
        return '仅一次';
      case 'daily':
        return '每天';
      case 'weekdays':
        return '工作日 (周一至周五)';
      case 'weekends':
        return '周末 (周六、周日)';
      case 'weekly':
      case 'custom': {
        if (daysOfWeek.length === 0) return '请选择天数';
        if (daysOfWeek.length === 7) return '每天';
        const sorted = [...daysOfWeek].sort((a, b) => a - b);
        return sorted.map((d) => DAY_NAMES[d]).join('、');
      }
      case 'monthly':
        return `每月 ${monthDay} 日`;
      default:
        return '仅一次';
    }
  }, [repeat, daysOfWeek, monthDay]);

  const dismissSummary = useMemo(() => {
    const preset = dismissPresets.find((p) => p.condition === dismissCondition);
    return preset?.label || '直接关闭';
  }, [dismissCondition]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectPreset = (preset: (typeof repeatPresets)[number]) => {
    setRepeat(preset.mode);
    if (preset.days) {
      setDaysOfWeek(preset.days);
    }
    if (preset.mode === 'weekly' || preset.mode === 'custom') {
      if (daysOfWeek.length === 0) {
        setDaysOfWeek([new Date(`${date}T${time}`).getDay()]);
      }
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setError('请输入提醒内容');
      return;
    }

    const targetTime = new Date(`${date}T${time}`).getTime();
    if (isNaN(targetTime)) {
      setError('请选择有效的日期和时间');
      return;
    }

    if (
      (repeat === 'weekly' || repeat === 'custom') &&
      daysOfWeek.length === 0
    ) {
      setError('请至少选择一周中的一天');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing && editingReminder?.id != null) {
        const updated: Reminder = {
          ...editingReminder,
          content: content.trim(),
          targetTime,
          repeat,
          daysOfWeek:
            repeat === 'weekly' || repeat === 'custom' ? daysOfWeek : undefined,
          monthDay: repeat === 'monthly' ? monthDay : undefined,
          dismissCondition,
          ringtone,
          completed: false,
          enabled: true,
        };
        await updateReminder(updated);
        cancelAlarm(editingReminder.id);
        scheduleAlarm(editingReminder.id, targetTime);
      } else {
        const id = await addReminder({
          content: content.trim(),
          targetTime,
          completed: false,
          createdAt: Date.now(),
          repeat,
          daysOfWeek:
            repeat === 'weekly' || repeat === 'custom' ? daysOfWeek : undefined,
          monthDay: repeat === 'monthly' ? monthDay : undefined,
          dismissCondition,
          ringtone,
          enabled: true,
        });
        scheduleAlarm(id, targetTime);
      }
      onSaved();
    } catch {
      setError('保存失败，请重试');
      setSaving(false);
    }
  };

  const targetTimestamp = new Date(`${date}T${time}`).getTime();
  const isPastTime = targetTimestamp < Date.now();
  const targetDay = new Date(targetTimestamp).getDay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Status Bar */}
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
      <div className="bg-slate-900/60 backdrop-blur-lg border-b border-slate-700/50 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center hover:bg-slate-700/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isEditing
                  ? 'bg-gradient-to-br from-amber-500 to-orange-400 shadow-lg shadow-amber-500/20'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20'
              }`}
            >
              {isEditing ? (
                <Pencil className="w-4 h-4 text-white" />
              ) : (
                <Bell className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {isEditing ? '编辑提醒' : '新建提醒'}
              </h1>
              <p className="text-slate-400 text-xs">
                {isEditing
                  ? '修改提醒内容和触发规则'
                  : '设置提醒内容和触发规则'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-5 py-6 space-y-5 pb-28">
        {/* Editing banner */}
        {isEditing && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-amber-200 text-xs font-medium">
                正在编辑已有提醒
              </p>
              <p className="text-amber-300/60 text-[10px] mt-0.5">
                修改后将自动重新调度闹钟 · ID #{editingReminder?.id}
              </p>
            </div>
          </div>
        )}

        {/* Content Input */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Type className="w-4 h-4 text-blue-400" />
            提醒内容
          </label>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError('');
              }}
              placeholder="请输入提醒事项..."
              maxLength={100}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none h-24 text-base"
            />
            <div className="absolute bottom-2 right-3 text-xs text-slate-500">
              {content.length}/100
            </div>
          </div>
        </div>

        {/* Quick Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            快捷选择
          </label>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setContent(opt.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  content === opt.label
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-700/40'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date & Time Pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              日期
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark] text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Clock className="w-4 h-4 text-purple-400" />
              时间
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark] text-sm"
            />
          </div>
        </div>

        {/* Repeat Configuration */}
        <div className="space-y-2">
          <button
            onClick={() => setShowRepeatPanel(!showRepeatPanel)}
            className="flex items-center justify-between w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 hover:bg-slate-800/80 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  repeat === 'once'
                    ? 'bg-slate-700/60'
                    : 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20'
                }`}
              >
                <Repeat
                  className={`w-4 h-4 ${
                    repeat === 'once' ? 'text-slate-400' : 'text-white'
                  }`}
                />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-200">
                  重复触发
                </div>
                <div className="text-xs text-slate-400">{repeatSummary}</div>
              </div>
            </div>
            <div
              className={`transition-transform duration-200 ${
                showRepeatPanel ? 'rotate-180' : ''
              }`}
            >
              <svg
                className="w-5 h-5 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>

          {showRepeatPanel && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-4 animate-[slideDown_0.2s_ease-out]">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2">
                  快速预设
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {repeatPresets.map((preset) => (
                    <button
                      key={preset.mode}
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative overflow-hidden rounded-xl p-3 border text-left transition-all ${
                        repeat === preset.mode
                          ? 'border-transparent shadow-lg'
                          : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                      }`}
                    >
                      {repeat === preset.mode && (
                        <div
                          className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${preset.color} opacity-20`}
                        />
                      )}
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${preset.color} flex items-center justify-center mb-2 shadow-md`}
                        >
                          <span className="text-white">{preset.icon}</span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {preset.desc}
                        </div>
                      </div>
                      {repeat === preset.mode && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-slate-900"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {(repeat === 'weekly' || repeat === 'custom') && (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-2">
                    选择触发日 (已选 {daysOfWeek.length} 天)
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_ORDER.map((day) => {
                      const active = daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                            active
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-105'
                              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
                          }`}
                        >
                          {DAY_NAMES[day].charAt(1)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-center text-[10px] text-slate-500 mt-1">
                    周一 周二 周三 周四 周五 周六 周日
                  </div>
                </div>
              )}

              {repeat === 'monthly' && (
                <div>
                  <div className="text-xs font-medium text-slate-400 mb-2">
                    每月触发日
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        onClick={() => setMonthDay(d)}
                        className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                          monthDay === d
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 scale-105'
                            : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(repeat === 'weekly' || repeat === 'custom') &&
                daysOfWeek.length === 0 && (
                  <button
                    onClick={() => setDaysOfWeek([targetDay])}
                    className="w-full py-2 rounded-xl bg-slate-800/60 border border-dashed border-slate-600 text-xs text-slate-300 hover:bg-slate-700/60 transition-colors"
                  >
                    ✨ 自动选择首次日期对应的星期 ({DAY_NAMES[targetDay]})
                  </button>
                )}
            </div>
          )}
        </div>

        {/* Dismiss Condition Configuration */}
        <div className="space-y-2">
          <button
            onClick={() => setShowDismissPanel(!showDismissPanel)}
            className="flex items-center justify-between w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 hover:bg-slate-800/80 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  dismissCondition === 'none'
                    ? 'bg-slate-700/60'
                    : 'bg-gradient-to-br from-red-500 to-orange-400 shadow-lg shadow-red-500/20'
                }`}
              >
                <ShieldCheck
                  className={`w-4 h-4 ${
                    dismissCondition === 'none' ? 'text-slate-400' : 'text-white'
                  }`}
                />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-200">
                  关闭条件
                </div>
                <div className="text-xs text-slate-400">{dismissSummary}</div>
              </div>
            </div>
            <div
              className={`transition-transform duration-200 ${
                showDismissPanel ? 'rotate-180' : ''
              }`}
            >
              <svg
                className="w-5 h-5 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>

          {showDismissPanel && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-4 animate-[slideDown_0.2s_ease-out]">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2">
                  选择关闭方式
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {dismissPresets.map((preset) => (
                    <button
                      key={preset.condition}
                      onClick={() => setDismissCondition(preset.condition)}
                      className={`relative overflow-hidden rounded-xl p-3 border text-left transition-all ${
                        dismissCondition === preset.condition
                          ? 'border-transparent shadow-lg'
                          : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                      }`}
                    >
                      {dismissCondition === preset.condition && (
                        <div
                          className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${preset.color} opacity-20`}
                        />
                      )}
                      <div className="relative">
                        <div
                          className={`w-8 h-8 rounded-lg bg-gradient-to-br ${preset.color} flex items-center justify-center mb-2 shadow-md`}
                        >
                          <span className="text-white">{preset.icon}</span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {preset.label}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {preset.desc}
                        </div>
                      </div>
                      {dismissCondition === preset.condition && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-slate-900"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips for each condition */}
              {dismissCondition === 'photo' && (
                <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3 text-cyan-200 text-xs">
                  📷 提醒弹出时需要拍照或上传一张图片才能关闭。适合用于需要证明自己确实完成任务的场景。
                </div>
              )}
              {dismissCondition === 'math' && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-emerald-200 text-xs">
                  🧮 需要答对一道简单数学题（如 23 + 45 = ?）才能关闭。适合防止迷迷糊糊点掉闹钟。
                </div>
              )}
              {dismissCondition === 'math_hard' && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-red-200 text-xs">
                  🧠 需要连续答对 3 道困难数学题（如 123 × 45 = ?）才能关闭。超级强制清醒模式！
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ringtone Picker */}
        <div className="space-y-2">
          <button
            onClick={() => setShowRingtonePanel(!showRingtonePanel)}
            className="flex items-center justify-between w-full bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 hover:bg-slate-800/80 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
                <span className="text-sm">
                  {ringtone === 'marimba' ? '🎵' : ringtone === 'piano' ? '🎹' : ringtone === 'digital' ? '🔔' : ringtone === 'birds' ? '🐦' : '🌊'}
                </span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-slate-200">提醒铃声</div>
                <div className="text-xs text-slate-400">
                  {ringtone === 'marimba' ? '清脆木琴' : ringtone === 'piano' ? '柔和钢琴' : ringtone === 'digital' ? '电子提示' : ringtone === 'birds' ? '清晨鸟鸣' : '冥想轻音'}
                </div>
              </div>
            </div>
            <div className={`transition-transform duration-200 ${showRingtonePanel ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0l-4.25-4.4a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          {showRingtonePanel && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-2 animate-[slideDown_0.2s_ease-out]">
              <div className="text-xs font-medium text-slate-400 mb-1">选择铃声（点击试听）</div>
              {([
                { type: 'marimba' as RingtoneType, emoji: '🎵', label: '清脆木琴', desc: '清亮明快，像 iPhone 经典铃声', color: 'from-violet-500 to-purple-600' },
                { type: 'piano' as RingtoneType, emoji: '🎹', label: '柔和钢琴', desc: '温暖和弦，渐进唤醒', color: 'from-blue-500 to-indigo-600' },
                { type: 'digital' as RingtoneType, emoji: '🔔', label: '电子提示', desc: '轻快双音阶，干净利落', color: 'from-cyan-500 to-teal-600' },
                { type: 'birds' as RingtoneType, emoji: '🐦', label: '清晨鸟鸣', desc: '自然鸟叫声，清新柔和', color: 'from-emerald-500 to-green-600' },
                { type: 'gentle' as RingtoneType, emoji: '🌊', label: '冥想轻音', desc: '超柔和渐进，适合午休', color: 'from-amber-500 to-orange-500' },
              ]).map((item) => (
                <button
                  key={item.type}
                  onClick={() => {
                    setRingtone(item.type);
                    setPlayingPreview(item.type);
                    previewRingtone(item.type);
                    setTimeout(() => setPlayingPreview(null), 3000);
                  }}
                  className={`relative overflow-hidden w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    ringtone === item.type
                      ? 'border-transparent shadow-lg'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/40'
                  }`}
                >
                  {ringtone === item.type && (
                    <div className={`absolute inset-0 pointer-events-none bg-gradient-to-r ${item.color} opacity-15 rounded-xl`} />
                  )}
                  <div className={`relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md shrink-0`}>
                    <span className="text-base">{item.emoji}</span>
                  </div>
                  <div className="relative z-10 flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">{item.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                  <div className="relative z-10 flex items-center gap-1.5 shrink-0">
                    {playingPreview === item.type && (
                      <div className="flex items-center gap-0.5">
                        <div className="w-0.5 h-3 bg-white/70 rounded-full animate-[soundbar1_0.6s_ease-in-out_infinite]" />
                        <div className="w-0.5 h-4 bg-white/70 rounded-full animate-[soundbar2_0.6s_ease-in-out_infinite_0.15s]" />
                        <div className="w-0.5 h-2 bg-white/70 rounded-full animate-[soundbar3_0.6s_ease-in-out_infinite_0.3s]" />
                      </div>
                    )}
                    {ringtone === item.type && (
                      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 011.42-1.42L8 12.58l7.29-7.29a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview Card */}
        <div
          className={`rounded-2xl border p-4 ${
            isPastTime && repeat === 'once'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Bell
              className={`w-4 h-4 ${
                isPastTime && repeat === 'once'
                  ? 'text-amber-400'
                  : 'text-blue-400'
              }`}
            />
            <span
              className={`text-sm font-medium ${
                isPastTime && repeat === 'once'
                  ? 'text-amber-300'
                  : 'text-blue-300'
              }`}
            >
              {isPastTime && repeat === 'once'
                ? '⚠️ 时间已过去，将立即触发'
                : repeat === 'once'
                ? '将在以下时间触发一次'
                : '🔁 重复提醒'}
            </span>
          </div>
          <p className="text-white text-base font-mono ml-6">
            {date} {time}
          </p>
          {repeat !== 'once' && (
            <p className="text-blue-200/80 text-xs ml-6 mt-1">
              重复：{repeatSummary}
            </p>
          )}
          {dismissCondition !== 'none' && (
            <p className="text-orange-200/80 text-xs ml-6 mt-1">
              关闭：{dismissSummary}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl text-white font-bold text-base shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isEditing
              ? 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-amber-500/30 hover:shadow-amber-500/50'
              : 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-blue-500/30 hover:shadow-blue-500/50'
          }`}
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {isEditing ? '更新中...' : '保存中...'}
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {isEditing ? '更新提醒' : '保存提醒'}
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes soundbar1 {
          0%, 100% { height: 6px; }
          50% { height: 14px; }
        }
        @keyframes soundbar2 {
          0%, 100% { height: 14px; }
          50% { height: 6px; }
        }
        @keyframes soundbar3 {
          0%, 100% { height: 10px; }
          50% { height: 4px; }
        }
      `}</style>
    </div>
  );
}
