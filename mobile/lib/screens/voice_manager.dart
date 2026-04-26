import 'package:flutter/material.dart';
import 'package:aura_mobile/services/tts_service.dart';

class VoiceManagerScreen extends StatefulWidget {
  @override
  _VoiceManagerScreenState createState() => _VoiceManagerScreenState();
}

class _VoiceManagerScreenState extends State<VoiceManagerScreen> {
  final TtsService _ttsService = TtsService();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Color(0xFF0F172A),
      appBar: AppBar(
        title: Text("Aura Neural Voice Manager"),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            _buildEngineCard(
              "Coqui VITS", 
              "High-quality VITS architecture optimized by Sherpa-ONNX.",
              TtsEngineType.coqui,
              _ttsService.coquiStatus
            ),
            SizedBox(height: 16),
            _buildEngineCard(
              "MOSS-TTS Nano", 
              "Deep authoritative voices targeted for low-latency.",
              TtsEngineType.moss,
              _ttsService.mossStatus
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEngineCard(String title, String desc, TtsEngineType type, EngineStatus status) {
    return Card(
      color: Color(0xFF1E293B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.blueAccent)),
                _buildStatusChip(status),
              ],
            ),
            SizedBox(height: 12),
            Text(desc, style: TextStyle(color: Colors.slateGray, fontSize: 14)),
            SizedBox(height: 20),
            Row(
              children: [
                if (status == EngineStatus.empty || status == EngineStatus.error)
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: Icon(Icons.download),
                      label: Text("Download & Setup"),
                      onPressed: () => _handleDownload(type),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                    ),
                  ),
                if (status == EngineStatus.ready) ...[
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: Icon(Icons.volume_up),
                      label: Text("Speak Test"),
                      onPressed: () => _ttsService.speak("Aura Assistant is ready.", type),
                    ),
                  ),
                  SizedBox(width: 8),
                  IconButton(
                    icon: Icon(Icons.delete, color: Colors.redAccent),
                    onPressed: () {}, // Delete logic
                  )
                ],
                if (status == EngineStatus.downloading)
                  Expanded(child: LinearProgressIndicator()),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(EngineStatus status) {
    Color color;
    String label;
    switch(status) {
      case EngineStatus.empty: color = Colors.grey; label = "Empty"; break;
      case EngineStatus.downloading: color = Colors.orange; label = "Downloading"; break;
      case EngineStatus.ready: color = Colors.emerald; label = "Ready"; break;
      case EngineStatus.error: color = Colors.red; label = "Error"; break;
    }
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  void _handleDownload(TtsEngineType type) async {
    final url = type == TtsEngineType.coqui 
      ? "https://huggingface.co/csukuangfj/sherpa-onnx-vits-en-vctk/resolve/main/model.onnx"
      : "https://your-server.com/moss-nano.onnx";
    
    await _ttsService.downloadModel(type, url);
    setState(() {});
  }
}
