import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type RepeatMode =
  | 'once'       // 仅一次
  | 'daily'      // 每天
  | 'weekdays'   // 工作日（周一至周五）
  | 'weekends'   // 周末（周六、周日）
  | 'weekly'     // 每周固定某天
  | 'monthly'    // 每月固定日期
  | 'custom';    // 自定义（等同于 weekly，自定义 daysOfWeek）

export type DismissCondition =
  | 'none'       // 直接关闭
  | 'photo'      // 上传图片
  | 'math'       // 数学题
  | 'math_hard'; // 困难数学题

export interface MathConfig {
  difficulty: 'easy' | 'medium' | 'hard';
  count: number; // 需要答对几题
}

export type RingtoneType = 'marimba' | 'piano' | 'digital' | 'birds' | 'gentle';

export interface Reminder {
  id?: number;
  content: string;
  targetTime: number; // timestamp in ms
  completed: boolean;
  createdAt: number;
  repeat: RepeatMode;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (used for weekly/custom)
  monthDay?: number; // 1-31 (used for monthly)
  lastTriggered?: number; // last triggered timestamp, for deduplication
  enabled?: boolean; // allow toggling off without deleting
  dismissCondition?: DismissCondition; // how to dismiss the alert
  mathConfig?: MathConfig; // config for math challenge
  ringtone?: RingtoneType; // alarm sound style
}

interface ReminderDB extends DBSchema {
  reminders: {
    key: number;
    value: Reminder;
    indexes: {
      'by-time': number;
      'by-completed': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ReminderDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ReminderDB>('reminder-db', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('reminders', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-time', 'targetTime');
          store.createIndex('by-completed', 'completed');
        }
        // v2 & v3 schema is backwards-compatible (adds optional fields)
      },
    });
  }
  return dbPromise;
}

export async function addReminder(reminder: Omit<Reminder, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('reminders', reminder as Reminder);
}

export async function getAllReminders(): Promise<Reminder[]> {
  const db = await getDB();
  const all = await db.getAll('reminders');
  return all.sort((a, b) => a.targetTime - b.targetTime);
}

export async function getReminder(id: number): Promise<Reminder | undefined> {
  const db = await getDB();
  return db.get('reminders', id);
}

export async function updateReminder(reminder: Reminder): Promise<void> {
  const db = await getDB();
  await db.put('reminders', reminder);
}

export async function deleteReminder(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('reminders', id);
}

export async function markCompleted(id: number): Promise<void> {
  const db = await getDB();
  const reminder = await db.get('reminders', id);
  if (reminder) {
    reminder.completed = true;
    await db.put('reminders', reminder);
  }
}

/**
 * Compute the next trigger time for a reminder after the given base time.
 * Returns null if there is no next occurrence (e.g. repeat='once').
 */
export function computeNextTriggerTime(reminder: Reminder): number | null {
  const base = new Date(reminder.targetTime);
  const hour = base.getHours();
  const minute = base.getMinutes();

  const setTime = (d: Date) => {
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  switch (reminder.repeat) {
    case 'once':
      return null;

    case 'daily': {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      return setTime(next);
    }

    case 'weekdays': {
      const next = new Date(base);
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      return setTime(next);
    }

    case 'weekends': {
      const next = new Date(base);
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() !== 0 && next.getDay() !== 6);
      return setTime(next);
    }

    case 'weekly':
    case 'custom': {
      const days = reminder.daysOfWeek || [];
      if (days.length === 0) return null;
      const sorted = [...days].sort((a, b) => a - b);
      const currentDay = base.getDay();
      let candidate: number | undefined = sorted.find((d) => d > currentDay);
      if (candidate === undefined) candidate = sorted[0];
      const diff =
        candidate > currentDay
          ? candidate - currentDay
          : 7 - currentDay + candidate;
      const next = new Date(base);
      next.setDate(next.getDate() + diff);
      return setTime(next);
    }

    case 'monthly': {
      const day = reminder.monthDay ?? base.getDate();
      let next = new Date(base);
      next.setDate(day);
      if (next.getTime() <= base.getTime() || next.getMonth() !== base.getMonth()) {
        next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(day, lastDay));
      }
      return setTime(next);
    }
  }

  return null;
}

/** Human-readable description of a repeat config */
export function describeRepeat(reminder: Reminder): string {
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  switch (reminder.repeat) {
    case 'once':
      return '仅一次';
    case 'daily':
      return '每天';
    case 'weekdays':
      return '工作日';
    case 'weekends':
      return '周末';
    case 'weekly':
    case 'custom': {
      const days = reminder.daysOfWeek || [];
      if (days.length === 0) return '仅一次';
      if (days.length === 7) return '每天';
      const weekdays = [1, 2, 3, 4, 5];
      const weekends = [0, 6];
      const sorted = [...days].sort((a, b) => a - b);
      if (
        sorted.length === weekdays.length &&
        sorted.every((d, i) => d === weekdays[i])
      ) {
        return '工作日';
      }
      if (
        sorted.length === weekends.length &&
        sorted.every((d, i) => d === weekends[i])
      ) {
        return '周末';
      }
      return sorted.map((d) => dayNames[d]).join(' ');
    }
    case 'monthly':
      return `每月${reminder.monthDay ?? '同一日'}号`;
    default:
      return '仅一次';
  }
}

/** Human-readable description of dismiss condition */
export function describeDismissCondition(condition?: DismissCondition): string {
  switch (condition) {
    case 'photo':
      return '📷 拍照/上传图片';
    case 'math':
      return '🧮 简单数学题';
    case 'math_hard':
      return '🧠 困难数学题';
    case 'none':
    default:
      return '✅ 直接关闭';
  }
}
