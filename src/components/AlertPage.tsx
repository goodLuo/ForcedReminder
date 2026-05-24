import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getReminder,
  markCompleted,
  updateReminder,
  computeNextTriggerTime,
  describeRepeat,
  describeDismissCondition,
  type Reminder,
  type DismissCondition,
} from '../db';
import { scheduleAlarm } from '../alarm';
import { playAlarmSound, stopAlarmSound, type RingtoneType } from '../sound';
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Repeat,
  Calendar,
  Camera,
  Calculator,
  Brain,
  X,
  ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';

interface AlertPageProps {
  reminderId: number;
  onDismiss: () => void;
}

// Math problem generator
function generateMathProblem(hard: boolean): { question: string; answer: number } {
  if (hard) {
    // Hard: 3-digit numbers, mixed operations
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a: number, b: number, answer: number;

    if (op === '×') {
      a = Math.floor(Math.random() * 90) + 10; // 10-99
      b = Math.floor(Math.random() * 90) + 10; // 10-99
      answer = a * b;
    } else if (op === '+') {
      a = Math.floor(Math.random() * 900) + 100; // 100-999
      b = Math.floor(Math.random() * 900) + 100;
      answer = a + b;
    } else {
      a = Math.floor(Math.random() * 900) + 100;
      b = Math.floor(Math.random() * a); // ensure positive result
      answer = a - b;
    }

    return { question: `${a} ${op} ${b} = ?`, answer };
  } else {
    // Easy: 2-digit numbers, simple operations
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a: number, b: number, answer: number;

    if (op === '×') {
      a = Math.floor(Math.random() * 9) + 2; // 2-10
      b = Math.floor(Math.random() * 9) + 2;
      answer = a * b;
    } else if (op === '+') {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      answer = a + b;
    } else {
      a = Math.floor(Math.random() * 50) + 30;
      b = Math.floor(Math.random() * 30) + 1;
      answer = a - b;
    }

    return { question: `${a} ${op} ${b} = ?`, answer };
  }
}

export default function AlertPage({ reminderId, onDismiss }: AlertPageProps) {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shakeCount, setShakeCount] = useState(0);

  // Challenge states
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [mathProblem, setMathProblem] = useState<{
    question: string;
    answer: number;
  } | null>(null);
  const [mathInput, setMathInput] = useState('');
  const [mathError, setMathError] = useState(false);
  const [mathSolved, setMathSolved] = useState(0);
  const [mathRequired, setMathRequired] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadReminder = async () => {
      const r = await getReminder(reminderId);
      setReminder(r || null);

      // Initialize challenge based on condition
      if (r) {
        const condition = r.dismissCondition || 'none';
        if (condition === 'none') {
          setChallengeCompleted(true);
        } else if (condition === 'math') {
          setMathProblem(generateMathProblem(false));
          setMathRequired(1);
        } else if (condition === 'math_hard') {
          setMathProblem(generateMathProblem(true));
          setMathRequired(3);
        }
        // photo: no init needed, wait for upload
      }

      setLoading(false);
    };
    loadReminder();
  }, [reminderId]);

  // Play alarm sound once reminder is loaded (so we know which ringtone)
  useEffect(() => {
    if (!reminder) return;
    const tone = (reminder.ringtone || 'marimba') as RingtoneType;
    playAlarmSound(tone);
    return () => stopAlarmSound();
  }, [reminder]);

  // Auto-focus math input when a new problem appears or error is cleared
  useEffect(() => {
    if (mathProblem) {
      // Use requestAnimationFrame to ensure DOM is ready
      const timer = requestAnimationFrame(() => {
        mathInputRef.current?.focus();
        // Also select all text so user can overwrite easily
        mathInputRef.current?.select();
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [mathProblem]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Block back button / escape key (BUT NOT when user is typing in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't block Backspace/Delete when the user is focused on an input/textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === 'Escape' || (e.key === 'Backspace' && !isTyping)) {
        e.preventDefault();
        e.stopPropagation();
        setShakeCount((c) => c + 1);
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      setShakeCount((c) => c + 1);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('keydown', handleKeyDown, true);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShakeCount((c) => c + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
      setChallengeCompleted(true);
    }
  };

  // Handle math answer submission
  const handleMathSubmit = () => {
    if (!mathProblem) return;

    const userAnswer = parseInt(mathInput.trim(), 10);
    if (isNaN(userAnswer)) {
      setMathError(true);
      return;
    }

    if (userAnswer === mathProblem.answer) {
      setMathError(false);
      const newSolved = mathSolved + 1;
      setMathSolved(newSolved);

      if (newSolved >= mathRequired) {
        setChallengeCompleted(true);
      } else {
        // Generate next problem
        const isHard = reminder?.dismissCondition === 'math_hard';
        setMathProblem(generateMathProblem(isHard));
        setMathInput('');
      }
    } else {
      setMathError(true);
      // Shake animation
      setShakeCount((c) => c + 1);
    }
  };

  // Regenerate math problem (with penalty: adds one more required)
  const handleRegenerateMath = () => {
    const isHard = reminder?.dismissCondition === 'math_hard';
    setMathProblem(generateMathProblem(isHard));
    setMathInput('');
    setMathError(false);
    // Penalty: one more to solve
    setMathRequired((prev) => prev + 1);
  };

  const handleComplete = useCallback(async () => {
    if (completing || !reminder || !challengeCompleted) return;
    setCompleting(true);
    try {
      if (reminder.repeat === 'once' || !reminder.repeat) {
        await markCompleted(reminderId);
      } else {
        const nextTime = computeNextTriggerTime(reminder);
        if (nextTime) {
          const updated: Reminder = {
            ...reminder,
            targetTime: nextTime,
            lastTriggered: Date.now(),
          };
          await updateReminder(updated);
          scheduleAlarm(reminderId, nextTime);
        } else {
          await markCompleted(reminderId);
        }
      }
      stopAlarmSound();
      onDismiss();
    } catch (e) {
      console.error('Complete failed:', e);
      setCompleting(false);
    }
  }, [reminderId, completing, onDismiss, reminder, challengeCompleted]);

  const formatElapsed = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dismissCondition: DismissCondition =
    reminder?.dismissCondition || 'none';
  const isRepeating = !!reminder?.repeat && reminder.repeat !== 'once';
  const nextTime =
    reminder && isRepeating ? computeNextTriggerTime(reminder) : null;

  const renderChallenge = () => {
    if (dismissCondition === 'none' || challengeCompleted) {
      return null;
    }

    if (dismissCondition === 'photo') {
      return (
        <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-bold">📷 拍照验证</span>
          </div>
          <p className="text-white/70 text-xs mb-4">
            请上传一张照片才能关闭此提醒
          </p>

          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden mb-3">
              <img
                src={photoPreview}
                alt="Uploaded"
                className="w-full h-32 object-cover"
              />
              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 rounded-xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-colors"
            >
              <ImageIcon className="w-10 h-10 text-white/50" />
              <span className="text-white/70 text-sm">点击上传图片</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>
      );
    }

    if (dismissCondition === 'math' || dismissCondition === 'math_hard') {
      const isHard = dismissCondition === 'math_hard';
      return (
        <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isHard ? (
                <Brain className="w-5 h-5 text-red-400" />
              ) : (
                <Calculator className="w-5 h-5 text-emerald-400" />
              )}
              <span className="text-white font-bold">
                {isHard ? '🧠 困难数学题' : '🧮 数学题'}
              </span>
            </div>
            <div className="text-xs text-white/60">
              {mathSolved}/{mathRequired} 题
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isHard
                  ? 'bg-gradient-to-r from-red-500 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
              }`}
              style={{ width: `${(mathSolved / mathRequired) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="bg-white/10 rounded-xl p-4 mb-4 text-center">
            <p className="text-white text-2xl font-mono font-bold">
              {mathProblem?.question}
            </p>
          </div>

          {/* Input */}
          <div className="flex gap-2 mb-3">
            <input
              ref={mathInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9-]*"
              value={mathInput}
              onChange={(e) => {
                // Only allow digits and minus sign
                const val = e.target.value.replace(/[^0-9-]/g, '');
                setMathInput(val);
                setMathError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMathSubmit();
              }}
              placeholder="输入答案"
              className={`flex-1 bg-white/10 border-2 rounded-xl px-4 py-3 text-white text-center text-lg font-mono focus:outline-none transition-colors ${
                mathError
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-white/20 focus:border-white/40'
              }`}
            />
            <button
              onClick={handleMathSubmit}
              className={`px-6 rounded-xl font-bold transition-all active:scale-95 ${
                isHard
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
              }`}
            >
              确认
            </button>
          </div>

          {mathError && (
            <div className="flex items-center gap-2 text-red-400 text-xs mb-3 animate-[shake_0.3s_ease-in-out]">
              <X className="w-4 h-4" />
              <span>答案错误，请重试</span>
            </div>
          )}

          <button
            onClick={handleRegenerateMath}
            className="w-full py-2 rounded-xl border border-dashed border-white/20 text-white/60 text-xs flex items-center justify-center gap-1 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            换一题（+1题惩罚）
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900 via-red-800 to-orange-900">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[600px] h-[600px] rounded-full bg-red-500/10 animate-ping"
            style={{ animationDuration: '3s' }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[400px] h-[400px] rounded-full bg-red-500/10 animate-ping"
            style={{ animationDuration: '2s', animationDelay: '0.5s' }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-[200px] h-[200px] rounded-full bg-red-500/15 animate-ping"
            style={{ animationDuration: '1.5s', animationDelay: '1s' }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-md w-full overflow-y-auto max-h-[100vh] py-8">
        {shakeCount > 0 && (
          <div className="absolute top-0 left-0 right-0 flex justify-center animate-bounce">
            <div className="bg-red-500/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full flex items-center gap-1.5 shadow-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              {challengeCompleted
                ? '无法退出，请点击完成按钮'
                : '请先完成验证任务'}
            </div>
          </div>
        )}

        {/* Bell Icon */}
        <div className="relative mb-4 mt-4">
          <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border-2 border-white/20 shadow-2xl">
            <Bell className="w-10 h-10 text-white animate-[wiggle_0.5s_ease-in-out_infinite]" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            <span className="text-white text-[10px] font-bold">!</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-white mb-1 text-center tracking-tight">
          ⏰ 提醒时间到！
        </h1>
        <p className="text-red-200/80 text-xs mb-4 text-center">
          {isRepeating
            ? '🔁 重复提醒'
            : dismissCondition !== 'none'
            ? describeDismissCondition(dismissCondition)
            : '请立即处理'}
        </p>

        {/* Reminder Content Card */}
        <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 mb-4 shadow-2xl">
          <p className="text-white text-lg font-bold text-center leading-relaxed">
            {reminder?.content || '提醒内容'}
          </p>
        </div>

        {/* Badges */}
        {reminder && (
          <div className="mb-4 flex items-center gap-2 flex-wrap justify-center">
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20">
              <Repeat className="w-3.5 h-3.5 text-white/80" />
              <span className="text-white/90 text-xs font-medium">
                {describeRepeat(reminder)}
              </span>
            </div>
            {nextTime && (
              <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-emerald-400/30">
                <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-emerald-100 text-xs font-medium">
                  下次：{format(new Date(nextTime), 'MM/dd HH:mm')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Elapsed Timer */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          <span className="text-red-200/70 text-sm font-mono">
            已响铃 {formatElapsed(elapsed)}
          </span>
        </div>

        {/* Challenge UI */}
        {renderChallenge()}

        {/* Complete Button */}
        <button
          onClick={handleComplete}
          disabled={completing || !challengeCompleted}
          className={`w-full py-4 rounded-2xl text-white font-black text-base shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group ${
            challengeCompleted
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-emerald-500/40 hover:shadow-emerald-500/60'
              : 'bg-slate-600/50 cursor-not-allowed'
          }`}
        >
          {challengeCompleted && (
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          {completing ? (
            <>
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              处理中...
            </>
          ) : !challengeCompleted ? (
            <>
              <AlertCircle className="w-5 h-5" />
              请先完成上方验证
            </>
          ) : isRepeating ? (
            <>
              <CheckCircle className="w-6 h-6" />
              ✅ 已完成，等待下次触发
            </>
          ) : (
            <>
              <CheckCircle className="w-6 h-6" />
              ✅ 我已完成，关闭提醒
            </>
          )}
        </button>

        <p className="text-red-300/50 text-xs mt-3 text-center">
          {challengeCompleted
            ? '点击上方按钮关闭提醒'
            : '完成验证后才能关闭提醒'}
        </p>
      </div>

      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
