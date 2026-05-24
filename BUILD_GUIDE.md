# 📱 强制提醒 APP — APK 打包指南

## 方案说明

本项目使用 **Capacitor** 将 React 应用打包为原生安卓 APP，利用 Android 原生 `AlarmManager` 实现**关机/关后台后仍能精准提醒**。

### 核心优势

| 特性 | 纯网页 | 网页 + Capacitor 本地通知 | **完整原生（本方案）** |
|---|---|---|---|
| 页面关闭后提醒 | ❌ 不行 | ✅ 通知栏通知 | ✅ 通知 + 强制弹窗 |
| 重启后提醒 | ❌ 不行 | ✅ 系统调度 | ✅ BOOT_COMPLETED |
| 全屏强制弹窗 | ❌ 不行 | ❌ 不行 | ✅ 原生 Activity |
| 响铃提醒 | ❌ 页面关了就停 | ❌ | ✅ 原生 AudioManager |

---

## 第一步：初始化 Android 项目

```bash
# 1. 安装 Capacitor CLI（如未安装）
npx cap init "强制提醒" com.forcedreminder.app --web-dir dist

# 2. 添加 Android 平台
npx cap add android

# 3. 构建前端代码
npm run build

# 4. 同步到 Android 项目
npx cap sync android
```

> ⚠️ 首次执行 `npx cap add android` 会自动下载 ~200MB 的 Android 依赖，需要几分钟。

---

## 第二步：用 Android Studio 打开项目

```bash
# 用 Android Studio 打开 android/ 目录
npx cap open android
```

或者手动打开：`文件 → 打开 → 选择项目下的 android/ 目录`

---

## 第三步：添加原生代码（关键）

### 3.1 修改 AndroidManifest.xml

打开 `android/app/src/main/AndroidManifest.xml`，在 `<application>` 标签内添加：

```xml
<!-- 允许接收开机广播 -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<!-- 精确闹钟权限（Android 12+） -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<!-- 通知权限 -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<!-- 唤醒屏幕 -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<!-- 前台服务 -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<!-- 关闭电池优化（确保闹钟精准） -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<!-- 全屏显示（锁屏也能弹出） -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<application ...>
    
    <!-- 开机自启动接收器 -->
    <receiver
        android:name=".BootReceiver"
        android:enabled="true"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.BOOT_COMPLETED" />
            <action android:name="android.intent.action.QUICKBOOT_POWERON" />
        </intent-filter>
    </receiver>
    
    <!-- 闹钟广播接收器 -->
    <receiver
        android:name=".AlarmReceiver"
        android:enabled="true"
        android:exported="false" />
    
    <!-- 全屏提醒 Activity -->
    <activity
        android:name=".AlertActivity"
        android:exported="false"
        android:showWhenLocked="true"
        android:turnScreenOn="true"
        android:excludeFromRecents="true"
        android:taskAffinity=""
        android:theme="@style/Theme.AppCompat.NoActionBar" />
        
</application>
```

### 3.2 创建 BootReceiver.kt

新建 `android/app/src/main/java/com/forcedreminder/app/BootReceiver.kt`：

```kotlin
package com.forcedreminder.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            // 开机后重新调度所有提醒
            // 这里通过 WebView 调用 JS 重新加载数据
            RescheduleService.rescheduleAll(context)
        }
    }
}
```

### 3.3 创建 AlarmReceiver.kt

新建 `android/app/src/main/java/com/forcedreminder/app/AlarmReceiver.kt`：

```kotlin
package com.forcedreminder.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getIntExtra("reminderId", -1)
        if (reminderId != -1) {
            val alertIntent = Intent(context, AlertActivity::class.java).apply {
                putExtra("reminderId", reminderId)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or 
                         Intent.FLAG_ACTIVITY_CLEAR_TOP or
                         Intent.FLAG_ACTIVITY_NO_USER_ACTION)
            }
            context.startActivity(alertIntent)
        }
    }
}
```

### 3.4 创建 AlertActivity.kt（强制全屏弹窗）

新建 `android/app/src/main/java/com/forcedreminder/app/AlertActivity.kt`：

```kotlin
package com.forcedreminder.app

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeActivity

class AlertActivity : AppCompatActivity() {
    
    private var reminderId: Int = -1
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        reminderId = intent.getIntExtra("reminderId", -1)
        
        // 锁屏状态下也能显示
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
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        
        // 点亮屏幕
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "ForcedReminder:AlertWakeLock"
        )
        wakeLock.acquire(10 * 60 * 1000L) // 10分钟
        
        // 简单的 UI（实际可以加载 WebView 显示 React 组件）
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(64, 128, 64, 64)
            setBackgroundColor(0xFFDC2626.toInt()) // 红色背景
        }
        
        val title = TextView(this).apply {
            text = "⏰ 提醒时间到！"
            textSize = 32f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 16)
            }
        }
        
        val content = TextView(this).apply {
            text = "提醒 #$reminderId\n\n请完成任务后点击下方按钮关闭"
            textSize = 18f
            setTextColor(0xFFFFFFCC.toInt())
            gravity = android.view.Gravity.CENTER
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 48)
            }
        }
        
        val dismissButton = Button(this).apply {
            text = "✅ 我已完成，关闭提醒"
            textSize = 18f
            setBackgroundColor(0xFF10B981.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setOnClickListener {
                // 标记完成 & 调度下一个
                completeReminder()
                finish()
            }
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 32)
            }
        }
        
        layout.addView(title)
        layout.addView(content)
        layout.addView(dismissButton)
        
        setContentView(layout)
    }
    
    // 屏蔽返回键、Home 键
    override fun onBackPressed() {
        // 不执行任何操作
        Toast.makeText(this, "请先完成任务再关闭", Toast.LENGTH_SHORT).show()
    }
    
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_HOME || keyCode == KeyEvent.KEYCODE_BACK) {
            Toast.makeText(this, "无法退出，请完成任务", Toast.LENGTH_SHORT).show()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
    
    override fun onUserLeaveHint() {
        // 用户尝试切换应用时
        Toast.makeText(this, "无法退出，请完成任务", Toast.LENGTH_SHORT).show()
    }
    
    private fun completeReminder() {
        // 通过 Capacitor Bridge 调用 JS 更新数据库
        // 或者通过 SharedPreferences 存储状态
        try {
            val prefs = getSharedPreferences("reminders", Context.MODE_PRIVATE)
            val completed = prefs.getStringSet("completed", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
            completed.add(reminderId.toString())
            prefs.edit().putStringSet("completed", completed).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
```

### 3.5 修改 MainActivity.kt

打开 `android/app/src/main/java/com/forcedreminder/app/MainActivity.kt`：

```kotlin
package com.forcedreminder.app

import com.getcapacitor.BridgeActivity
import android.os.Bundle
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import com.getcapacitor.Plugin
import com.getcapacitor.PluginHandle
import com.getcapacitor.annotation.CapacitorPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }
    
    override fun onResume() {
        super.onResume()
        // 检查是否有待处理的提醒
        checkPendingReminders()
    }
    
    private fun checkPendingReminders() {
        // 检查 SharedPreferences 中是否有新的提醒需要调度
        val prefs = getSharedPreferences("reminders", Context.MODE_PRIVATE)
        // 实现调度逻辑...
    }
}
```

---

## 第四步：构建 APK

### 方法 A：通过 Android Studio（推荐）

1. 点击 `Build → Build Bundle(s) / APK(s) → Build APK(s)`
2. 构建完成后点击弹窗中的 `locate` 打开 APK 所在目录
3. APK 路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 方法 B：命令行

```bash
cd android

# Mac/Linux
./gradlew assembleDebug

# Windows
gradlew.bat assembleDebug
```

APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

### 构建 Release APK（签名版）

```bash
cd android
./gradlew assembleRelease
```

需要在 `android/app/build.gradle` 中配置签名：

```groovy
android {
    signingConfigs {
        release {
            storeFile file("your-release-key.jks")
            storePassword "your-password"
            keyAlias "your-alias"
            keyPassword "your-password"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## 第五步：安装到手机

```bash
# 通过 ADB 安装
adb install android/app/build/outputs/apk/debug/app-debug.apk

# 或直接拷贝 APK 到手机手动安装
# （需要在手机设置中允许安装未知来源应用）
```

---

## 更新前端代码后同步

每次修改 React 代码后：

```bash
# 1. 重新构建前端
npm run build

# 2. 同步到 Android 项目
npx cap sync android

# 3. 在 Android Studio 中重新编译
```

或者一行命令搞定：

```bash
npm run build && npx cap sync android && npx cap open android
```

---

## 架构原理

```
┌──────────────────────────────────────────────┐
│              Android 系统层                      │
│                                              │
│  AlarmManager ──精确调度──→ AlarmReceiver      │
│       ↑                        ↓               │
│       │              AlertActivity             │
│  BootReceiver ──重启恢复──→ rescheduleAll()     │
└──────────────────┬───────────────────────────┘
                   │ WebView Bridge
┌──────────────────▼───────────────────────────┐
│              Capacitor Web 层                  │
│                                              │
│  React App ──IndexedDB──→ 提醒数据管理           │
│       ↓                                      │
│  scheduleAlarm() ──调用──→ Android AlarmManager │
│                                              │
└──────────────────────────────────────────────┘
```

### 关键流程

1. **设置提醒**：React → IndexedDB 存储 → 通过 Bridge 调用 Android AlarmManager.setExactAndAllowWhileIdle()
2. **触发提醒**：AlarmManager 发送广播 → AlarmReceiver 收到 → 启动 AlertActivity（全屏、锁屏可弹）
3. **重启恢复**：BOOT_COMPLETED 广播 → BootReceiver → 重新调度所有未完成的提醒
4. **关闭提醒**：用户点击完成 → AlertActivity 完成 → 计算下次触发时间 → 重新调度

---

## 注意事项

- ⚠️ **Android 12+** 需要用户在系统设置中允许"精确闹钟"权限
- ⚠️ **电池优化**：建议在首次启动时引导用户关闭本 APP 的电池优化
- ⚠️ **小米/华为等国产 ROM** 可能有额外的后台管理限制，需要引导用户添加白名单
- ⚠️ **Doze 模式**：使用 `setExactAndAllowWhileIdle()` 可以穿透 Doze 模式
