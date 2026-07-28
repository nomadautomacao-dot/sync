import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'firebase_options.dart';
import 'src/app/app.dart';

Future<void> main() async {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) {
    // Na web o Flutter so monta a arvore de semantica depois que o visitante
    // acha e ativa um botao escondido. Para software de poder publico
    // (eMAG, Lei 13.146) isso nao e opcional: liga de saida.
    binding.ensureSemantics();
  }
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await initializeDateFormatting('pt_BR');
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const SyncFlutterApp());
}
