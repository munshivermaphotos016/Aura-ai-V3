import 'package:flutter/material.dart';
import 'package:aura_mobile/screens/assistant_webview.dart';

void main() {
  runApp(AuraMobileApp());
}

class AuraMobileApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aura AI Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        primaryColor: Colors.blue,
        scaffoldBackgroundColor: Color(0xFF0F172A),
      ),
      home: AssistantWebViewScreen(),
    );
  }
}
