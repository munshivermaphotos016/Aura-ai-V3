# Converting Aura Assistant to a Native Android APK

This guide provides step-by-step instructions on how to take this codebase from GitHub and turn it into a high-performance native Android application (APK) using **Capacitor** and **Android Studio**.

## Prerequisites
1. **GitHub Account**: Your project should be pushed to a repository.
2. **Node.js**: Installed on your local machine.
3. **Android Studio**: Installed on your local machine (for building the APK).
4. **Git**: Installed on your local machine.

---

## Part 1: Initial Setup (Local Machine)

1. **Clone the Project**
   Open your terminal/command prompt and run:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd aura-assistant
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Initialize Capacitor**
   Aura is already prepared with Capacitor dependencies. Initialize the project:
   ```bash
   npx cap init AuraAssistant com.yourapp.aura --web-dir dist
   ```
   *Note: Use a unique App ID like `com.yourname.aura`.*

4. **Build the Web App**
   ```bash
   npm run build
   ```

5. **Add Android Platform**
   ```bash
   npx cap add android
   ```

---

## Part 2: Working in Android Studio

1. **Open the Project**
   Launch Android Studio and select **"Open an existing project"**. Navigate to your project folder and select the `android` directory.

2. **Wait for Gradle Sync**
   Android Studio will download necessary files and build the project structure. This may take a few minutes.

3. **Configure Permissions** (Critical for Voice & Assistant)
   Open `android/app/src/main/AndroidManifest.xml` and ensure these are inside the `<manifest>` tag:
   ```xml
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.VIBRATE" />
   <uses-permission android:name="android.permission.CALL_PHONE" />
   <!-- For Assistant Features -->
   <uses-permission android:name="android.permission.BIND_VOICE_INTERACTION" />
   ```

---

## Part 3: Implementing Hardware Triggers (Power Button/Shake)

While the web app handles the "Double Shake" logic, native button clicks (like the Side Button) require a small piece of Native Code.

1. **Open MainActivity.java**
   Path: `android/app/src/main/java/com/yourapp/aura/MainActivity.java`

2. **Add Key Event Listener**
   This allows Aura to respond when you click hardware buttons while the app is active.

   ```java
   @Override
   public boolean onKeyDown(int keyCode, KeyEvent event) {
       if (keyCode == KeyEvent.KEYCODE_POWER || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
           // Call the JS function we built in React
           getBridge().eval("window.triggerNativeAssistant('native')");
           return true; 
       }
       return super.onKeyDown(keyCode, event);
   }
   ```

---

## Part 4: Generating the APK

1. In Android Studio, go to the top menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
2. Once finished, a notification popup will appear. Click **"locate"** to find your `app-debug.apk`.
3. To publish to the Play Store, use **Build > Generate Signed Bundle / APK** and follow the prompts to create a release key.

---

## Important Tips for "Google Assistant" Style behavior
* **Default Assistant App**: On your Android phone, go to **Settings > Apps > Default Apps > Digital assistant app** and select your app. 
* **Overlay Permission**: If you want Aura to appear over other apps, you need to request the `ACTION_MANAGE_OVERLAY_PERMISSION` in your native code.
