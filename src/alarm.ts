/**
 * Alarm scheduler
 * 
 * - 在浏览器环境：使用 setTimeout 定时（仅限页面打开时）
 * - 在 Capacitor 原生环境：使用 Android AlarmManager / LocalNotifications（支持后台/关机后）
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const activeTimers = new Map<number, ReturnType<typeof setTimeout>>();
let onAlarmTrigger: ((id: number) => void) | null = null;

/** 是否在原生安卓环境中运行 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function setAlarmListener(listener: (id: number) => void) {
  onAlarmTrigger = listener;

  // 原生平台：监听本地通知点击
  if (isNative()) {
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      const id = parseInt(notification.extra?.reminderId as string, 10);
      if (id && onAlarmTrigger) {
        onAlarmTrigger(id);
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const id = parseInt(action.notification.extra?.reminderId as string, 10);
      if (id && onAlarmTrigger) {
        onAlarmTrigger(id);
      }
    });
  }
}

/**
 * 调度闹钟
 * @param id - 提醒 ID
 * @param targetTime - 目标时间戳（毫秒）
 */
export async function scheduleAlarm(id: number, targetTime: number) {
  cancelAlarm(id);

  if (isNative()) {
    await scheduleNative(id, targetTime);
  } else {
    scheduleWeb(id, targetTime);
  }
}

/** 原生平台：使用 Capacitor LocalNotifications */
async function scheduleNative(id: number, targetTime: number) {
  try {
    // 请求通知权限
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      console.warn('通知权限被拒绝');
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: '⏰ 提醒时间到！',
          body: `点击查看提醒详情`,
          id: id,
          schedule: { at: new Date(targetTime) },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          iconColor: '#EF4444',
          extra: {
            reminderId: String(id),
          },
          actionTypeId: 'REMINDER_OPEN',
        },
      ],
    });
  } catch (e) {
    console.error('原生通知调度失败:', e);
    // 降级为 Web 方案
    scheduleWeb(id, targetTime);
  }
}

/** Web 环境：使用 setTimeout */
function scheduleWeb(id: number, targetTime: number) {
  const now = Date.now();
  const delay = targetTime - now;

  if (delay <= 0) {
    setTimeout(() => {
      if (onAlarmTrigger) onAlarmTrigger(id);
    }, 100);
    return;
  }

  const timer = setTimeout(() => {
    activeTimers.delete(id);
    if (onAlarmTrigger) onAlarmTrigger(id);
  }, delay);

  activeTimers.set(id, timer);
}

/** 取消单个闹钟 */
export async function cancelAlarm(id: number) {
  if (isNative()) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id }],
      });
    } catch {
      // ignore
    }
  } else {
    const timer = activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(id);
    }
  }
}

/** 取消所有闹钟 */
export async function cancelAllAlarms() {
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications,
        });
      }
    } catch {
      // ignore
    }
  } else {
    activeTimers.forEach((timer) => clearTimeout(timer));
    activeTimers.clear();
  }
}

export function isScheduled(id: number): boolean {
  return activeTimers.has(id);
}

/** 请求通知权限（仅原生） */
export async function requestNotificationPermission() {
  if (isNative()) {
    try {
      await LocalNotifications.requestPermissions();
    } catch {
      // ignore
    }
  } else {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}
