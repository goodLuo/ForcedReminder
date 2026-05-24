import { useState, useEffect, useCallback } from 'react';
import ListPage from './components/ListPage';
import AddPage from './components/AddPage';
import AlertPage from './components/AlertPage';
import {
  setAlarmListener,
  requestNotificationPermission,
  scheduleAlarm,
  isNative,
} from './alarm';
import {
  getAllReminders,
  updateReminder,
  computeNextTriggerTime,
  type Reminder,
} from './db';

type Page = 'list' | 'add' | 'edit';

export default function App() {
  const [page, setPage] = useState<Page>('list');
  const [alertReminderId, setAlertReminderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [alertQueue, setAlertQueue] = useState<number[]>([]);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAlarmTrigger = useCallback((id: number) => {
    setAlertQueue((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  // Process alert queue
  useEffect(() => {
    if (alertReminderId === null && alertQueue.length > 0) {
      const nextId = alertQueue[0];
      setAlertReminderId(nextId);
      setAlertQueue((prev) => prev.slice(1));
    }
  }, [alertReminderId, alertQueue]);

  // 初始化：设置监听器 + 重新调度所有提醒 + 检测原生环境
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const native = isNative();
      if (mounted) {
        setIsNativePlatform(native);
      }

      setAlarmListener(handleAlarmTrigger);
      await requestNotificationPermission();

      const reminders = await getAllReminders();
      const now = Date.now();

      for (const r of reminders) {
        if (!r.id) continue;
        if (r.completed) continue;
        if (!(r.enabled ?? true)) continue;

        // 重复提醒：如果目标时间已过去，快进到下一个有效时间
        if (r.repeat && r.repeat !== 'once' && r.targetTime < now) {
          let nextTime = computeNextTriggerTime(r);
          let safety = 0;
          let working = r;
          while (nextTime && nextTime < now && safety < 365) {
            working = { ...working, targetTime: nextTime };
            nextTime = computeNextTriggerTime(working);
            safety++;
          }
          if (nextTime) {
            const updated = { ...r, targetTime: nextTime };
            await updateReminder(updated);
            await scheduleAlarm(r.id, nextTime);
            continue;
          }
        }

        // 单次提醒：如果已过期，跳过
        if (r.repeat === 'once' && r.targetTime < now) {
          continue;
        }

        await scheduleAlarm(r.id, r.targetTime);
      }

      if (mounted) {
        setInitialized(true);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [handleAlarmTrigger]);

  // 原生环境：APP 从后台恢复时重新同步提醒
  useEffect(() => {
    if (!isNativePlatform || !initialized) return;

    // Capacitor 的 appStateChange 监听
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', async (state: { isActive: boolean }) => {
        if (state.isActive) {
          // APP 恢复前台：重新同步所有提醒
          const reminders = await getAllReminders();
          for (const r of reminders) {
            if (!r.id || r.completed || !(r.enabled ?? true)) continue;
            await scheduleAlarm(r.id, r.targetTime);
          }
        }
      });
    });
  }, [isNativePlatform, initialized]);

  // APP 退出前清理（仅 Web 环境）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isNativePlatform) {
        e.preventDefault();
        e.returnValue = '关闭后将无法收到提醒，确认离开？';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isNativePlatform]);

  const handleAlertDismiss = useCallback(() => {
    setAlertReminderId(null);
    triggerRefresh();
  }, [triggerRefresh]);

  const handleEdit = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setPage('edit');
  }, []);

  const handleBackToList = useCallback(() => {
    setEditingReminder(null);
    setPage('list');
  }, []);

  const handleSaved = useCallback(() => {
    setEditingReminder(null);
    setPage('list');
    triggerRefresh();
  }, [triggerRefresh]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">
          {isNativePlatform ? '正在启动...' : '正在加载提醒...'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-900 relative shadow-2xl">
      {/* 原生环境状态条 */}
      {isNativePlatform && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-500/90 backdrop-blur-sm px-3 py-1 flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-[10px] font-medium">
            原生模式 · AlarmManager 已启用
          </span>
        </div>
      )}

      <div className={isNativePlatform ? 'pt-5' : ''}>
        {page === 'list' && (
          <ListPage
            onAdd={() => setPage('add')}
            onEdit={handleEdit}
            refreshKey={refreshKey}
          />
        )}

        {page === 'add' && (
          <AddPage
            onBack={handleBackToList}
            onSaved={handleSaved}
          />
        )}

        {page === 'edit' && (
          <AddPage
            key={editingReminder?.id}
            onBack={handleBackToList}
            onSaved={handleSaved}
            editingReminder={editingReminder}
          />
        )}
      </div>

      {/* 全屏 Alert Overlay */}
      {alertReminderId !== null && (
        <AlertPage reminderId={alertReminderId} onDismiss={handleAlertDismiss} />
      )}
    </div>
  );
}
