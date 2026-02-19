# Here Is My Seat — Build Commands Reference

## Development

| # | Command | Use |
|---|---------|-----|
| 1 | `npx expo start` | Start dev server (test on Expo Go) |
| 2 | `npx expo start --clear` | Start dev server with cleared cache |
| 3 | `npx expo start --tunnel` | Start dev server in tunnel mode (different networks) |

## Android APK Build (Local)

> **Build from short path:** `C:\Users\Yogesh\dev\seat-app`

| # | Command | Use |
|---|---------|-----|
| 4 | `npx expo prebuild --platform android --clean` | Generate native `android/` folder |
| 5 | `$env:ANDROID_HOME = "C:\Users\Yogesh\AppData\Local\Android\Sdk"` | Set Android SDK path (PowerShell) |
| 6 | `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"` | Set Java path (PowerShell) |
| 7 | `cd android; .\gradlew.bat assembleRelease` | Build release APK for testing |
| 8 | `.\gradlew.bat assembleDebug` | Build debug APK (with dev tools) |
| 9 | `.\gradlew.bat clean` | Clean previous build artifacts |
| 10 | `.\gradlew.bat bundleRelease` | Build AAB for Play Store upload |

**APK output:** `android\app\build\outputs\apk\release\app-release.apk`

## EAS Cloud Build (Alternative)

| # | Command | Use |
|---|---------|-----|
| 11 | `npm install -g eas-cli` | Install Expo cloud build tool (one-time) |
| 12 | `eas build --platform android --profile preview` | Build APK in cloud |
| 13 | `eas build --platform android --profile production` | Build signed AAB for Play Store |

## Utilities

| # | Command | Use |
|---|---------|-----|
| 14 | `npm install` | Install all dependencies |
| 15 | `npx expo install <package>` | Install Expo-compatible package |
| 16 | `npx expo doctor` | Check for dependency issues |

## Quick Build Steps

```powershell
# 1. Copy project to short path (if not done)
# 2. Install dependencies
cd C:\Users\Yogesh\dev\seat-app
npm install

# 3. Generate native project
npx expo prebuild --platform android --clean

# 4. Set environment & build
$env:ANDROID_HOME = "C:\Users\Yogesh\AppData\Local\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleRelease

# 5. APK is at: android\app\build\outputs\apk\release\app-release.apk
```
