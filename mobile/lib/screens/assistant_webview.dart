import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:shake/shake.dart';
import 'package:flutter/services.dart';

class AssistantWebViewScreen extends StatefulWidget {
  @override
  _AssistantWebViewScreenState createState() => _AssistantWebViewScreenState();
}

class _AssistantWebViewScreenState extends State<AssistantWebViewScreen> {
  late final WebViewController _controller;
  ShakeDetector? _shakeDetector;

  @override
  void initState() {
    super.initState();
    
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            // Update loading bar.
          },
          onPageStarted: (String url) {},
          onPageFinished: (String url) {},
          onWebResourceError: (WebResourceError error) {},
        ),
      )
      ..addJavaScriptChannel(
        'Android',
        onMessageReceived: (JavaScriptMessage message) {
          // Handle messages from React app if needed
          if (message.message == 'openSettings') {
            // Open native settings
          }
        },
      )
      ..loadRequest(Uri.parse('https://your-deployed-app-url.com')); // This will be replaced by the user with their app URL

    // Initialize Shake Detection
    _shakeDetector = ShakeDetector.autoStart(
      onPhoneShake: () {
        _triggerAssistant('shake');
      },
      shakeThresholdGravity: 2.7,
    );

    // Listen for Volume Buttons as a proxy for "Power Button" as power button is restricted
    // Note: This requires a specific plugin like hardware_buttons, but we'll show the logic.
  }

  void _triggerAssistant(String type) {
    _controller.runJavaScript('window.triggerNativeAssistant("$type")');
    // Also ensure the app is visible/foreground if possible
    HapticFeedback.vibrate();
  }

  @override
  void dispose() {
    _shakeDetector?.stopListening();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: WebViewWidget(controller: _controller),
      ),
    );
  }
}
