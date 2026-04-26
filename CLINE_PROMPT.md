# Master Instructions for Cline: Building Aura Native Android APK

## System Context
You are an expert Android Developer using Capacitor to turn a React/Vite web application into a high-performance native assistant. I am using Cline to execute these steps within Android Studio.

## Phase 1: Initialization
1. Ensure the web app is built: `npm run build`.
2. Initialize Capacitor if not done: `npx cap init AuraAssistant com.aura.assistant.ai --web-dir dist`.
3. Add the Android platform: `npx cap add android`.

## Phase 2: Native Code Injection
The assistant logic requires native overrides. Follow these steps precisely using the templates in `/native-android/`:

1. **MainActivity.java**:
   - Locate: `android/app/src/main/java/com/aura/assistant/ai/MainActivity.java`.
   - Replace its content with the code found in `/native-android/MainActivity.java.txt`.
   - **Critical**: This includes the `onKeyDown` override that allows the Power and Volume buttons to trigger the `window.triggerNativeAssistant('native')` Javascript bridge.

2. **AndroidManifest.xml**:
   - Locate: `android/app/src/main/app/src/main/AndroidManifest.xml`.
   - Merge the permissions and `<intent-filter>` from `/native-android/AndroidManifest.xml.txt`.
   - Ensure the `android.intent.action.ASSIST` filter is added to the Main Activity so Aura can be set as the default system assistant.

## Phase 3: Hardware Triggers Logic
The React side (already implemented) listens for:
- `window.triggerNativeAssistant('native')` -> This is what you must ensure the Java code calls via the Capacitor Bridge.
- `DeviceMotionEvent` -> Handles the Double Shake.

## Phase 4: Permissions Verification
Ensure the following are explicitly requested in the builds:
- `android.permission.RECORD_AUDIO`
- `android.permission.SYSTEM_ALERT_WINDOW` (Overlay permission for assistant UI)
- `android.permission.BIND_VOICE_INTERACTION`

## Phase 5: Finalization
1. Run `npx cap sync android` to sync all web assets and configurations.
2. Open the Gradle tab and perform a "Sync Project with Gradle Files".
3. Build the APK via **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Verification Checklist for Cline:
- Does `MainActivity` call `getBridge().eval(...)` on hardware key down?
- Does `AndroidManifest` have the `ASSIST` intent?
- Are the background/overlay permissions included?

Proceed with these steps now.
