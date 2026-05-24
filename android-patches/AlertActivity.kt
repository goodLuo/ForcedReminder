package com.forcedreminder.app

import android.app.KeyguardManager
import android.content.Context
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * 全屏强制提醒 Activity
 * 锁屏状态下也能弹出，必须点击完成按钮才能关闭
 */
class AlertActivity : AppCompatActivity() {
    
    private var reminderId: Int = -1
    private var content: String = ""
    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaPlayer: MediaPlayer? = null
    private var startTime: Long = 0
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        reminderId = intent.getIntExtra("reminderId", -1)
        content = intent.getStringExtra("content") ?: "提醒 #$reminderId"
        startTime = System.currentTimeMillis()
        
        // 设置全屏、锁屏显示
        setupWindowFlags()
        
        // 获取 WakeLock 点亮屏幕
        acquireWakeLock()
        
        // 播放提示音
        playAlarmSound()
        
        // 构建 UI
        setContentView(buildUI())
    }
    
    /** 设置 Window 标志，确保锁屏也能弹出 */
    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            )
        }
    }
    
    /** 获取 WakeLock 确保屏幕亮起 */
    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "ForcedReminder:AlertWakeLock"
        )
        wakeLock?.acquire(10 * 60 * 1000L) // 10分钟超时
    }
    
    /** 播放内置提示音 */
    private fun playAlarmSound() {
        try {
            // 使用系统默认通知音
            val uri = android.media.RingtoneManager.getDefaultUri(
                android.media.RingtoneManager.TYPE_NOTIFICATION
            )
            mediaPlayer = MediaPlayer().apply {
                setDataSource(this@AlertActivity, uri)
                prepare()
                isLooping = true
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    /** 停止提示音 */
    private fun stopAlarmSound() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    /** 构建 UI */
    private fun buildUI(): ScrollView {
        val root = ScrollView(this).apply {
            setBackgroundColor(ContextCompat.getColor(this@AlertActivity, android.R.color.black))
            isFillViewport = true
        }
        
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
            gravity = android.view.Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
        }
        
        // 背景渐变效果用红色
        layout.setBackgroundColor(0xFF991B1B.toInt())
        
        // 标题
        val title = TextView(this).apply {
            text = "⏰ 提醒时间到！"
            textSize = 36f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 16)
            }
        }
        
        // 内容
        val contentText = TextView(this).apply {
            text = content
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 32, 0, 16)
            }
        }
        
        // 时间信息
        val timeFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
        val timeText = TextView(this).apply {
            text = "触发时间：${timeFmt.format(System.currentTimeMillis())}"
            textSize = 14f
            setTextColor(0xFFD1D5DB.toInt())
            gravity = android.view.Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 48)
            }
        }
        
        // 完成按钮
        val dismissButton = Button(this).apply {
            text = "✅ 我已完成，关闭提醒"
            textSize = 20f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setBackgroundColor(0xFF10B981.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(48, 32, 48, 32)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 32, 0, 16)
            }
            setOnClickListener {
                completeAndDismiss()
            }
        }
        
        // 底部提示
        val hint = TextView(this).apply {
            text = "必须点击上方按钮才能关闭此提醒"
            textSize = 12f
            setTextColor(0xFF9CA3AF.toInt())
            gravity = android.view.Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 16, 0, 0)
            }
        }
        
        layout.addView(title)
        layout.addView(contentText)
        layout.addView(timeText)
        layout.addView(dismissButton)
        layout.addView(hint)
        
        root.addView(layout)
        return root
    }
    
    /** 完成并关闭 */
    private fun completeAndDismiss() {
        // 停止声音
        stopAlarmSound()
        releaseWakeLock()
        
        // 更新完成状态
        markReminderCompleted()
        
        // 关闭 Activity
        finish()
    }
    
    /** 标记提醒为已完成 */
    private fun markReminderCompleted() {
        try {
            val prefs = getSharedPreferences("forced_reminder_completed", Context.MODE_PRIVATE)
            val completed = prefs.getStringSet("completed", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
            completed.add(reminderId.toString())
            prefs.edit().putStringSet("completed", completed).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    /** 释放 WakeLock */
    private fun releaseWakeLock() {
        try {
            wakeLock?.release()
            wakeLock = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    /** 屏蔽返回键 */
    override fun onBackPressed() {
        Toast.makeText(this, "请先完成任务再关闭", Toast.LENGTH_SHORT).show()
    }
    
    /** 屏蔽 Home 键和返回键 */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_HOME || keyCode == KeyEvent.KEYCODE_BACK) {
            Toast.makeText(this, "无法退出，请完成任务", Toast.LENGTH_SHORT).show()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
    
    /** 用户尝试切换应用时 */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        Toast.makeText(this, "无法退出，请完成任务", Toast.LENGTH_SHORT).show()
        // 重新 bring to front
        moveTaskToBack(false)
        startActivity(Intent(this, AlertActivity::class.java).apply {
            putExtra("reminderId", reminderId)
            putExtra("content", content)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        })
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopAlarmSound()
        releaseWakeLock()
    }
}
