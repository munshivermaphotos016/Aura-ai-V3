import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sherpa_onnx/sherpa_onnx.dart' as sherpa;

enum TtsEngineType { coqui, moss }
enum EngineStatus { empty, downloading, ready, error }

class TtsService {
  EngineStatus coquiStatus = EngineStatus.empty;
  EngineStatus mossStatus = EngineStatus.empty;
  
  String? _coquiModelPath;
  String? _mossModelPath;
  
  final Dio _dio = Dio();
  sherpa.OfflineTts? _sherpaTts;

  // Initialize Coqui (Sherpa-ONNX)
  Future<void> initCoqui() async {
    if (_coquiModelPath == null) return;
    
    final config = sherpa.OfflineTtsDataConfig(
      model: sherpa.OfflineTtsModelConfig(
        vits: sherpa.OfflineTtsVitsModelConfig(
          model: _coquiModelPath!,
          lexicon: "${_coquiModelPath!.replaceAll('model.onnx', 'lexicon.txt')}",
          tokens: "${_coquiModelPath!.replaceAll('model.onnx', 'tokens.txt')}",
        ),
      ),
    );
    
    _sherpaTts = sherpa.OfflineTts(config);
    coquiStatus = EngineStatus.ready;
  }

  // Generic Downloader Logic
  Future<void> downloadModel(TtsEngineType type, String url) async {
    try {
      final docDir = await getApplicationDocumentsDirectory();
      final folder = Directory('${docDir.path}/${type.name}');
      if (!await folder.exists()) await folder.create();
      
      final filePath = "${folder.path}/model.onnx";
      
      if (type == TtsEngineType.coqui) coquiStatus = EngineStatus.downloading;
      else mossStatus = EngineStatus.downloading;

      await _dio.download(url, filePath);
      
      if (type == TtsEngineType.coqui) {
        _coquiModelPath = filePath;
        await initCoqui();
      } else {
        _mossModelPath = filePath;
        // Logic for ONNX Runtime initialization
        mossStatus = EngineStatus.ready;
      }
    } catch (e) {
      if (type == TtsEngineType.coqui) coquiStatus = EngineStatus.error;
      else mossStatus = EngineStatus.error;
      rethrow;
    }
  }

  Future<void> speak(String text, TtsEngineType type) async {
    if (type == TtsEngineType.coqui && _sherpaTts != null) {
      final audio = _sherpaTts!.generate(text);
      // Play audio bytes using standard audioplayers or custom buffer
    }
    // MOSS-TTS logic via onnxruntime...
  }
}
