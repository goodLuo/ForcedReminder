#!/bin/bash
# 强制提醒 APP — Android 项目初始化脚本
# 用法: chmod +x scripts/init-android.sh && ./scripts/init-android.sh

set -e

echo "📱 强制提醒 APP — Android 初始化"
echo "=================================="

# 1. 构建前端
echo ""
echo "🔨 Step 1: 构建前端代码..."
npm run build

# 2. 初始化 Capacitor（如果尚未初始化）
if [ ! -f "capacitor.config.json" ] && [ ! -f "capacitor.config.ts" ]; then
    echo "📝 Step 2: 初始化 Capacitor..."
    npx cap init "强制提醒" com.forcedreminder.app --web-dir dist
else
    echo "✅ Step 2: Capacitor 已初始化，跳过"
fi

# 3. 添加 Android 平台（如果尚未添加）
if [ ! -d "android" ]; then
    echo "🤖 Step 3: 添加 Android 平台（首次可能需下载 ~200MB）..."
    npx cap add android
else
    echo "✅ Step 3: Android 平台已存在，跳过"
fi

# 4. 同步
echo ""
echo "🔄 Step 4: 同步前端代码到 Android 项目..."
npx cap sync android

# 5. 打开 Android Studio（可选）
echo ""
echo "========================================"
echo "✅ 初始化完成！"
echo ""
echo "接下来请执行以下操作："
echo ""
echo "  1️⃣  用 Android Studio 打开 android/ 目录："
echo "      npx cap open android"
echo ""
echo "  2️⃣  添加原生代码（AndroidManifest.xml, AlarmReceiver.kt 等）"
echo "      详细步骤请参考 BUILD_GUIDE.md"
echo ""
echo "  3️⃣  在 Android Studio 中点击 Build → Build APK"
echo ""
echo "  📖 完整指南: cat BUILD_GUIDE.md"
echo "========================================"
