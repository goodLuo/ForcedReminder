# 🚀 GitHub Actions 云端构建 APK 指南

## 前提条件

- 一个 GitHub 账号
- 本项目已推送到你的 GitHub 仓库
- 无需本地 Android 环境，所有构建在云端完成

---

## 快速开始（3 步搞定）

### 第 1 步：推送代码到 GitHub

```bash
# 如果还没有 Git 仓库
git init
git add .
git commit -m "初始提交"

# 关联远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 第 2 步：等待自动构建

推送代码后，GitHub Actions 会**自动触发构建**。你也可以：

1. 进入仓库页面
2. 点击顶部 **Actions** 标签
3. 你会看到 `📱 Build Android APK` 正在运行
4. 等待约 **5-10 分钟**（首次会下载 Android SDK，约 2-3 分钟）

### 第 3 步：下载 APK

构建完成后：

1. 点击 **Actions** 标签
2. 点击最新的一次构建记录
3. 滚动到页面最底部
4. 找到 **Artifacts** 区域，点击 `forced-reminder-apks`
5. 下载 ZIP 文件，解压后即可得到 APK

---

## 手动触发构建

如果你修改了代码想立即构建，无需等待推送：

1. 进入仓库 → **Actions** → **📱 Build Android APK**
2. 点击右上角的 **Run workflow** 按钮
3. 选择分支（通常是 `main`）
4. 点击绿色 **Run workflow** 按钮
5. 等待构建完成

---

## 构建产物说明

| 文件名 | 说明 | 大小约 | 用途 |
|--------|------|--------|------|
| `app-debug.apk` | Debug 签名版本 | ~15MB | 直接安装到手机测试 |
| `app-release-unsigned.apk` | 未签名 Release 版本 | ~10MB | 需要签名后才能发布到应用商店 |

### 安装 Debug APK 到手机

**方法 A：通过 USB 数据线**
```bash
adb install app-debug.apk
```

**方法 B：通过二维码/链接**
1. 将 APK 上传到临时文件服务（如 [transfer.sh](https://transfer.sh)）
2. 手机扫描二维码下载安装
3. 需要在手机设置中允许"安装未知来源应用"

**方法 C：直接拷贝**
1. 将 APK 拷贝到手机存储
2. 在手机上用文件管理器找到 APK
3. 点击安装

---

## 签名 Release APK（可选）

如果你要发布到应用商店，需要对 APK 签名：

### 在 GitHub Actions 中添加签名

1. **生成签名密钥**（本地执行一次）：
```bash
keytool -genkeypair -v -keystore release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias forced-reminder
```

2. **将密钥 Base64 编码**：
```bash
base64 release-key.jks > release-key.jks.b64
```

3. **在 GitHub 仓库添加 Secrets**：
   - 进入仓库 → **Settings** → **Secrets and variables** → **Actions**
   - 点击 **New repository secret**
   - 添加以下 Secrets：

| Secret 名称 | 值 |
|------------|-----|
| `RELEASE_KEYSTORE_BASE64` | 步骤 2 生成的 Base64 内容 |
| `RELEASE_KEYSTORE_PASSWORD` | 你的密钥密码 |
| `RELEASE_KEY_ALIAS` | `forced-reminder` |
| `RELEASE_KEY_PASSWORD` | 你的密钥密码 |

4. **在 workflow 中启用签名**：

编辑 `.github/workflows/build-apk.yml`，将 `workflow_dispatch` 部分改为：

```yaml
on:
  push:
    branches: [main, master]
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      sign_release:
        description: 'Sign release APK'
        required: false
        default: 'false'
        type: boolean
```

然后在构建步骤后添加签名步骤（参考 BUILD_GUIDE.md 中的签名配置）。

---

## 发布版本（打 Tag 自动发 Release）

```bash
# 给当前代码打一个版本标签
git tag v1.0.0
git push origin v1.0.0
```

推送 Tag 后，GitHub Actions 会：
1. 构建 APK
2. 自动创建 GitHub Release
3. 将 APK 附加到 Release 页面

---

## 常见问题

### Q: 构建失败怎么办？
A: 点击 Actions 中的失败记录，查看 **Build log** 中的红色错误信息。常见原因：
- `android-patches/` 目录文件缺失 → 检查文件是否存在
- 内存不足 → Actions 有 7GB 内存，应该够用

### Q: 首次构建很慢？
A: 首次会下载 Android SDK (~1GB)，之后会使用缓存，构建会快很多（约 3-5 分钟）。

### Q: 如何清除缓存重新构建？
A: 进入 Actions 页面，点击右上角的 **⋮** → **Caches** → 删除缓存。

### Q: 构建成功了但 APK 安装失败？
A: Debug APK 通常可以直接安装。如果提示"应用未安装"：
- 检查手机是否开启了"安装未知来源应用"权限
- 检查是否有旧版本冲突（先卸载旧版）
- 检查 Android 版本兼容性（最低支持 Android 6.0+）

### Q: 每次修改代码都要重新构建吗？
A: 是的。每次修改代码后推送或手动触发 Actions，会重新构建 APK。

---

## 工作流配置说明

`.github/workflows/build-apk.yml` 做了这些事情：

```
检出代码
    ↓
安装 Java 17 + Node.js 20
    ↓
npm install + npm run build
    ↓
npx cap init + npx cap add android
    ↓
复制原生补丁 (AndroidManifest, Kotlin 文件)
    ↓
npx cap sync
    ↓
./gradlew assembleDebug + assembleRelease
    ↓
收集 APK → 上传为 Artifacts
    ↓
(如果是 Tag) 自动创建 GitHub Release
```

---

## 后续优化建议

- [ ] 配置 APK 签名，自动构建签名版 Release
- [ ] 添加版本号自动生成（基于 Git commit 或 package.json）
- [ ] 集成 Firebase App Distribution，构建完成后自动分发
- [ ] 添加单元测试，构建失败时不发版
- [ ] 配置 Slack/企业微信 通知，构建完成后推送消息
