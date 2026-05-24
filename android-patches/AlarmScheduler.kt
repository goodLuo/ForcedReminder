package com.forcedreminder.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * 开机/重启广播接收器
 * 设备启动后自动重新调度所有提醒
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            Log.d("BootReceiver", "Received: $action, rescheduling alarms...")
            AlarmScheduler.rescheduleAllFromPrefs(context)
        }
    }
}

/**
 * 闹钟触发广播接收器
 * 收到广播后启动全屏 AlertActivity
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getIntExtra("reminderId", -1)
        if (reminderId == -1) return
        
        Log.d("AlarmReceiver", "Alarm triggered for reminder #$reminderId")
        
        // 启动全屏 AlertActivity
        val alertIntent = Intent(context, AlertActivity::class.java).apply {
            putExtra("reminderId", reminderId)
            putExtra("content", intent.getStringExtra("content") ?: "")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                     Intent.FLAG_ACTIVITY_CLEAR_TOP or
                     Intent.FLAG_ACTIVITY_NO_USER_ACTION or
                     Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        }
        context.startActivity(alertIntent)
    }
}

/**
 * 闹钟调度器
 * 使用 AlarmManager.setExactAndAllowWhileIdle() 穿透 Doze 模式
 */
object AlarmScheduler {
    private const val TAG = "AlarmScheduler"
    private const val PREFS_NAME = "forced_reminder_alarms"
    private const val KEY_ALARMS = "alarms_json"

    data class AlarmInfo(
        val reminderId: Int,
        val targetTime: Long,
        val content: String,
        val repeat: String = "once",
        val daysOfWeek: String = "[]",
        val monthDay: Int = 1
    )

    /** 设置单个闹钟 */
    fun set(context: Context, info: AlarmInfo) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("reminderId", info.reminderId)
            putExtra("content", info.content)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            info.reminderId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Android 6.0+ 使用 setExactAndAllowWhileIdle 穿透 Doze 模式
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                info.targetTime,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                info.targetTime,
                pendingIntent
            )
        }

        Log.d(TAG, "Set alarm #${info.reminderId} at ${info.targetTime}")
        saveAlarmInfo(context, info)
    }

    /** 取消单个闹钟 */
    fun cancel(context: Context, reminderId: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
        
        Log.d(TAG, "Canceled alarm #$reminderId")
        removeAlarmInfo(context, reminderId)
    }

    /** 取消所有闹钟 */
    fun cancelAll(context: Context) {
        getSavedAlarms(context).forEach { info ->
            cancel(context, info.reminderId)
        }
    }

    /** 保存闹钟信息到 SharedPreferences */
    private fun saveAlarmInfo(context: Context, info: AlarmInfo) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarms = getSavedAlarms(context).toMutableList()
        alarms.removeAll { it.reminderId == info.reminderId }
        alarms.add(info)
        
        val jsonArray = JSONArray()
        alarms.forEach { a ->
            val obj = JSONObject()
            obj.put("id", a.reminderId)
            obj.put("time", a.targetTime)
            obj.put("content", a.content)
            obj.put("repeat", a.repeat)
            obj.put("days", a.daysOfWeek)
            obj.put("monthDay", a.monthDay)
            jsonArray.put(obj)
        }
        
        prefs.edit().putString(KEY_ALARMS, jsonArray.toString()).apply()
    }

    /** 移除闹钟信息 */
    private fun removeAlarmInfo(context: Context, reminderId: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val alarms = getSavedAlarms(context).toMutableList()
        alarms.removeAll { it.reminderId == reminderId }
        
        val jsonArray = JSONArray()
        alarms.forEach { a ->
            val obj = JSONObject()
            obj.put("id", a.reminderId)
            obj.put("time", a.targetTime)
            obj.put("content", a.content)
            obj.put("repeat", a.repeat)
            obj.put("days", a.daysOfWeek)
            obj.put("monthDay", a.monthDay)
            jsonArray.put(obj)
        }
        
        prefs.edit().putString(KEY_ALARMS, jsonArray.toString()).apply()
    }

    /** 获取已保存的闹钟列表 */
    fun getSavedAlarms(context: Context): List<AlarmInfo> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val jsonStr = prefs.getString(KEY_ALARMS, "[]") ?: "[]"
        val jsonArray = JSONArray(jsonStr)
        val alarms = mutableListOf<AlarmInfo>()
        
        for (i in 0 until jsonArray.length()) {
            val obj = jsonArray.getJSONObject(i)
            alarms.add(AlarmInfo(
                reminderId = obj.getInt("id"),
                targetTime = obj.getLong("time"),
                content = obj.getString("content"),
                repeat = obj.optString("repeat", "once"),
                daysOfWeek = obj.optString("days", "[]"),
                monthDay = obj.optInt("monthDay", 1)
            ))
        }
        
        return alarms
    }

    /** 计算下次触发时间 */
    fun computeNextTime(info: AlarmInfo): Long? {
        val cal = java.util.Calendar.getInstance().apply {
            timeInMillis = info.targetTime
        }
        val hour = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val minute = cal.get(java.util.Calendar.MINUTE)
        
        fun setTime(c: java.util.Calendar): Long {
            c.set(java.util.Calendar.HOUR_OF_DAY, hour)
            c.set(java.util.Calendar.MINUTE, minute)
            c.set(java.util.Calendar.SECOND, 0)
            c.set(java.util.Calendar.MILLISECOND, 0)
            return c.timeInMillis
        }
        
        return when (info.repeat) {
            "once" -> null
            "daily" -> {
                val next = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                next.add(java.util.Calendar.DAY_OF_YEAR, 1)
                setTime(next)
            }
            "weekdays" -> {
                val next = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                do {
                    next.add(java.util.Calendar.DAY_OF_YEAR, 1)
                } while (next.get(java.util.Calendar.DAY_OF_WEEK) in 
                         listOf(java.util.Calendar.SATURDAY, java.util.Calendar.SUNDAY))
                setTime(next)
            }
            "weekends" -> {
                val next = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                do {
                    next.add(java.util.Calendar.DAY_OF_YEAR, 1)
                } while (next.get(java.util.Calendar.DAY_OF_WEEK) !in
                         listOf(java.util.Calendar.SATURDAY, java.util.Calendar.SUNDAY))
                setTime(next)
            }
            "weekly", "custom" -> {
                try {
                    val daysArray = JSONArray(info.daysOfWeek)
                    val days = mutableListOf<Int>()
                    for (i in 0 until daysArray.length()) {
                        days.add(daysArray.getInt(i))
                    }
                    if (days.isEmpty()) return null
                    days.sort()
                    
                    val current = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                    val currentDay = current.get(java.util.Calendar.DAY_OF_WEEK)
                    // Convert Java Calendar (Sun=1, Mon=2...) to our format (Sun=0, Mon=1...)
                    val jsDay = if (currentDay == java.util.Calendar.SUNDAY) 0 else currentDay - 1
                    
                    val nextDay = days.firstOrNull { it > jsDay } ?: days.first()
                    val diff = if (nextDay > jsDay) nextDay - jsDay else 7 - jsDay + nextDay
                    
                    val next = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                    next.add(java.util.Calendar.DAY_OF_YEAR, diff)
                    setTime(next)
                } catch (e: Exception) {
                    null
                }
            }
            "monthly" -> {
                val next = java.util.Calendar.getInstance().apply { timeInMillis = info.targetTime }
                next.add(java.util.Calendar.MONTH, 1)
                val maxDay = next.getActualMaximum(java.util.Calendar.DAY_OF_MONTH)
                next.set(java.util.Calendar.DAY_OF_MONTH, kotlin.math.min(info.monthDay, maxDay))
                setTime(next)
            }
            else -> null
        }
    }

    /** 从保存的数据重新调度所有闹钟（开机/APP更新后调用） */
    fun rescheduleAllFromPrefs(context: Context) {
        Log.d(TAG, "Rescheduling all alarms...")
        val now = System.currentTimeMillis()
        val alarms = getSavedAlarms(context)
        
        alarms.forEach { info ->
            if (info.targetTime > now) {
                // 未来时间，直接调度
                set(context, info)
            } else {
                // 已过期
                when (info.repeat) {
                    "once" -> {
                        // 单次已过期，移除
                        removeAlarmInfo(context, info.reminderId)
                    }
                    else -> {
                        // 重复的，快进到下次
                        var nextTime = computeNextTime(info)
                        var safety = 0
                        var working = info
                        while (nextTime != null && nextTime <= now && safety < 365) {
                            working = info.copy(targetTime = nextTime)
                            nextTime = computeNextTime(working)
                            safety++
                        }
                        if (nextTime != null) {
                            val newInfo = info.copy(targetTime = nextTime)
                            set(context, newInfo)
                        }
                    }
                }
            }
        }
        
        Log.d(TAG, "Rescheduled ${alarms.size} alarms")
    }
}
