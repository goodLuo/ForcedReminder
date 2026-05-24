# 📱 Android 原生代码补丁

在运行 `npx cap add android` **之后**，将本目录的文件复制到对应位置：

## 复制操作

```bash
# 从项目根目录执行

# 1. 替换 AndroidManifest.xml
cp android-patches/AndroidManifest.xml android/app/src/main/AndroidManifest.xml

# 2. 添加 Kotlin 源码文件
cp android-patches/AlarmScheduler.kt android/app/src/main/java/com/forcedreminder/app/AlarmScheduler.kt
cp android-patches/AlertActivity.kt android/app/src/main/java/com/forcedreminder/app/AlertActivity.kt

# 3. 添加 strings.xml 到资源目录
mkdir -p android/app/src/main/res/values
cp android-patches/strings.xml android/app/src/main/res/values/strings.xml
```

## 修改 MainActivity.kt

在 `android/app/src/main/java/com/forcedreminder/app/MainActivity.kt` 中添加：

```kotlin
package com.forcedreminder.app

import com.getcapacitor.BridgeActivity
import android.os.Bundle
import android.content.SharedPreferences

class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 开机/恢复后重新调度闹钟
        AlarmScheduler.rescheduleAllFromPrefs(this)
    }
}
```

## 构建 APK

```bash
cd android
./gradlew assembleDebug
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`
