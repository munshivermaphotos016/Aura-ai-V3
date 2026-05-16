# Converting Aura AI to a Native Android APK

This guide explains how to convert the Aura web application into a fully-functional native Android App (APK using Android Studio). The Aura React codebase contains a native JS-to-Java bridge that expects to run inside an Android `WebView`. 

By wrapping it natively, you gain access to raw OS capabilities like hardware button triggers (like squeezing or pressing power buttons to trigger the Assistant overlay), low-level deep intents, background DSP for the wake word, and calling or SMS interactions without user-interrupted intent choosers.

## Step 1: Exporting & Building the React App

The native Android app needs the static built assets.
1. Run `npm run build` in the Aura project root.
2. The compiled static HTML/JS/CSS will be located in the `dist/` directory.

> **Hosting option (Recommended)**: You can also simply host this Vite app on Vercel or Cloud Run and point the WebView directly to the `https://` URL instead of bundling the files! This makes updates instantaneous across all Android devices.

## Step 2: Creating the Android Studio Project

1. Open Android Studio and click **New Project**.
2. Select **Empty Views Activity** (do not use Jetpack Compose if you just want to wrap a WebView simply, though both work).
3. Name it "Aura Assistant", select Java or Kotlin (examples here use Java mostly, easily converted to Kotlin), and set Minimum SDK to at least 24 (Android 7.0).

## Step 3: Configure Android Permissions

To allow Aura to behave like a true AI Assistant matching its web capabilities (calling, SMS, Internet, microphone access), open your `android/app/src/main/AndroidManifest.xml`.

Add these inside the `<manifest>` block (before `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Essential for "Over-the-Screen" popups and overlay Assistant modes -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<!-- Required for interacting with WhatsApp, YouTube, and other apps natively -->
<queries>
    <package android:name="com.whatsapp" />
    <package android:name="com.google.android.youtube" />
    <package android:name="com.instagram.android" />
    <package android:name="com.netflix.mediaclient" />
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="http" />
    </intent>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="https" />
    </intent>
</queries>
```

## Step 4: The WebView Interface (JavaScript Bridge)

The Aura React codebase specifically listens for an interface called `Android` on the `window` object. If this exists, Aura immediately changes its behavior to Native mode (managing native calls, native intents, app opening, etc.).

Create a new Java class named `AuraWebInterface.java`:

```java
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class AuraWebInterface {
    Context mContext;

    AuraWebInterface(Context c) {
        mContext = c;
    }

    // Checking if native permissions are granted
    @JavascriptInterface
    public boolean hasPermission(String name) {
        // e.g. name = "android.permission.RECORD_AUDIO"
        return ContextCompat.checkSelfPermission(mContext, name) == PackageManager.PERMISSION_GRANTED;
    }

    // Request permissions dynamically from the React frontend
    @JavascriptInterface
    public boolean requestPermission(String name) {
        if (!hasPermission(name)) {
            ActivityCompat.requestPermissions((Activity) mContext, new String[]{name}, 1);
            return false; // Will trigger async in standard Android implementations
        }
        return true;
    }

    // Open Deep App Intents
    @JavascriptInterface
    public void openIntent(String url) {
        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            mContext.startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(mContext, "Application not found", Toast.LENGTH_SHORT).show();
        }
    }
    
    // Hardware/DSP Wake Word Hooks
    @JavascriptInterface
    public void startWakeWordDSP(String wakeWord) {
        // Here you would hook up Porcupine, PocketSphinx, or your native low-power wake word lib.
        // On detected, run: webView.evaluateJavascript("window.onNativeWakeWordDetected('start');", null);
        Toast.makeText(mContext, "Native DSP listening for: " + wakeWord, Toast.LENGTH_SHORT).show();
    }
    
    @JavascriptInterface
    public void stopWakeWordDSP() {
        // Stop the native DSP thread to save battery
    }
    
    // Legacy Execution Action Handler
    @JavascriptInterface
    public void executeAction(String type, String number, String content) {
        if (type.equals("call")) {
            Intent intent = new Intent(Intent.ACTION_CALL);
            intent.setData(Uri.parse("tel:" + number));
            mContext.startActivity(intent);
        } else if (type.equals("message")) {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("sms:" + number));
            intent.putExtra("sms_body", content);
            mContext.startActivity(intent);
        }
    }
}
```

## Step 5: Setting Up The MainActivity

In your `MainActivity.java` or `MainActivity.kt`:

1. Replace the default view layout with a `WebView`.
2. Configure it properly to enable DOM storage, Javascript, and media playback.

```java
import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true); 
        // Important: Allows microphone to work inside WebView without prompting twice
        webSettings.setMediaPlaybackRequiresUserGesture(false); 

        // Set the native Bridge!
        webView.addJavascriptInterface(new AuraWebInterface(this), "Android");

        // Handle WebView Microphone/Camera permissions
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Auto-grant the webview permissions since the Android layer already asked
                request.grant(request.getResources());
            }
        });
        
        webView.setWebViewClient(new WebViewClient());

        // Either load the hosted URL from Vercel/CloudRun:
        webView.loadUrl("https://your-aura-app-url.com");
        
        // OR load locally if you copied the `dist` folder into `android/app/src/main/assets/`
        // webView.loadUrl("file:///android_asset/dist/index.html");
    }
}
```

## Step 6: Hooking Up Hardware / Global Overlays (System Alert)

To make Aura function like true System Assistants (like Google Assistant or Siri) where it slides up transparently over other applications:

1. Request `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` so your app can draw over other apps (`SYSTEM_ALERT_WINDOW`).
2. Add a foreground service that runs a transparent `WebView` added to the `WindowManager`.
3. To trigger the web UI's "listening" overlay programmatically when a user double-taps the power button or squeezes the device (Active Edge), your native code can invoke:

```java
webView.evaluateJavascript("if (window.triggerNativeAssistant) window.triggerNativeAssistant('voice')", null);
```
This Javascript call tells the React code to immediately activate the `OverlayAssistantUI` and begin voice recognition.

## Step 7: Build and Run

1. Connect your Android device or start an emulator.
2. In Android Studio, click **Run (Shift+F10)**.
3. Once running on your phone, you should see the Web interface. Try asking Aura to "Open YouTube" or "Call someone" - the React application will recognize the `window.Android` bridge, bypass the standard browser behavior, and tunnel the native OS Intent directly to Android Studio!

### Notes on Deep Automation

The Web layer passes specific intent formats (like `intent://#Intent;action=android.settings.SETTINGS;end;`) straight to the `openIntent()` Java function via `AuraWebInterface`. The provided Android Java implementation will natively parse this App Intent mechanism safely and securely execute it locally on the Android device context.
