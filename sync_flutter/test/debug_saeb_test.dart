import 'dart:convert';
import 'dart:io';
import 'package:sync_flutter/src/core/models/levantamento_fundeb_models.dart';

void main() {
  final file = File('test/fixtures/salvador_payload.json');
  final payload = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  final data = payload['data'] as Map<String, dynamic>;
  final rf = data['relatorio_fundeb'] as Map<String, dynamic>? ?? {};
  final rdb = data['relatorio_dirigido_base'] as Map<String, dynamic>? ?? {};
  
  // Parse indicadoresAprendizagem
  final indMap = rdb['indicadoresAprendizagem'] as Map<String, dynamic>?;
  if (indMap == null) {
    print('ERROR: indicadoresAprendizagem is null in relatorio_dirigido_base');
    return;
  }
  
  final ind = IndicadoresAprendizagem.fromJson(indMap);
  print('disponivel: ${ind.disponivel}');
  print('anoReferencia: ${ind.anoReferencia}');
  print('anosIniciais: ${ind.anosIniciais}');
  print('  idebObservado: ${ind.anosIniciais?.idebObservado}');
  print('  notaPortugues: ${ind.anosIniciais?.notaPortugues}');
  print('  notaMatematica: ${ind.anosIniciais?.notaMatematica}');
  print('  notaMedia: ${ind.anosIniciais?.notaMedia}');
  print('  taxaAprovacao: ${ind.anosIniciais?.taxaAprovacao}');
  print('  indicadorRendimento: ${ind.anosIniciais?.indicadorRendimento}');
  print('anosFinais:');
  print('  idebObservado: ${ind.anosFinais?.idebObservado}');
  print('  notaPortugues: ${ind.anosFinais?.notaPortugues}');
  print('  notaMatematica: ${ind.anosFinais?.notaMatematica}');
  print('distorcaoIdadeSerie:');
  print('  fundamentalTotal: ${ind.distorcaoIdadeSerie?.fundamentalTotal}');
  print('  anosIniciais: ${ind.distorcaoIdadeSerie?.anosIniciais}');
  print('  anosFinais: ${ind.distorcaoIdadeSerie?.anosFinais}');
  
  // Parse perfilIBGE
  final perfilMap = rdb['perfilIBGE'] as Map<String, dynamic>?;
  print('\n=== perfilIBGE ===');
  if (perfilMap != null) {
    print('disponivel: ${perfilMap['disponivel']}');
    print('areaTerritorial: ${perfilMap['areaTerritorial']}');
    print('mortalidadeInfantil: ${perfilMap['mortalidadeInfantil']}');
    print('escolarizacao614: ${perfilMap['escolarizacao614']}');
    print('populacaoEstimada: ${perfilMap['populacaoEstimada']}');
  } else {
    print('ERROR: perfilIBGE is null');
  }
}
