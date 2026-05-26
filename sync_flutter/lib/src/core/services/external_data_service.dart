import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/levantamento_fundeb_models.dart';

class ExternalDataService {
  static const Duration _timeout = Duration(seconds: 30);

  /// SICONFI: Receitas do FUNDEB
  Future<ReceitasFundeb?> fetchReceitasFundeb(String ibge, int exercicio) async {
    final currentYearData = await _fetchSiconfiYear(ibge, exercicio);
    if (currentYearData != null) return currentYearData;

    final priorYearData = await _fetchSiconfiYear(ibge, exercicio - 1);
    if (priorYearData != null) return priorYearData;
    
    final priorPriorYearData = await _fetchSiconfiYear(ibge, exercicio - 2);
    if (priorPriorYearData != null) return priorPriorYearData;

    return null;
  }

  Future<ReceitasFundeb?> _fetchSiconfiYear(String ibge, int year) async {
    final uri = Uri.https(
      'apidatalake.tesouro.gov.br',
      '/ords/siconfi/tt/dca',
      {'an_exercicio': '$year', 'id_ente': ibge},
    );

    try {
      final response = await http.get(uri).timeout(_timeout);
      if (response.statusCode >= 400) return null;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;

      final items = decoded['items'];
      if (items is! List) return null;

      final total = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-C',
        codConta: 'RO1.7.5.1.00.0.0',
        coluna: 'Receitas Brutas Realizadas',
      );
      if (total == null) return null;

      final unionVAAF = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-HI',
        codConta: 'P4.5.2.2.3.00.00',
      );
      final state = _siconfiValue(
        items,
        anexo: 'DCA-Anexo I-HI',
        codConta: 'P4.5.2.2.4.00.00',
      );

      final municipal = state ?? (unionVAAF == null ? total : total - unionVAAF);

      double vaat = _siconfiValue(items, anexo: 'DCA-Anexo I-C', codConta: 'RO1.7.1.5.02.0.0') ?? 0.0;
      double vaar = _siconfiValue(items, anexo: 'DCA-Anexo I-C', codConta: 'RO1.7.1.5.03.0.0') ?? 0.0;

      return ReceitasFundeb(
        totalReceitas: total,
        receitaContribuicaoMunicipal: municipal,
        complementacaoVAAF: unionVAAF ?? 0.0,
        complementacaoVAAT: vaat,
        complementacaoVAAR: vaar,
      );
    } catch (_) {
      return null;
    }
  }

  double? _siconfiValue(
    List<dynamic> items, {
    required String anexo,
    required String codConta,
    String? coluna,
  }) {
    for (final item in items.whereType<Map<String, dynamic>>()) {
      if (item['anexo'] != anexo || item['cod_conta'] != codConta) continue;
      if (coluna != null && item['coluna'] != coluna) continue;
      final value = item['valor'];
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value.replaceAll(',', '.'));
    }
    return null;
  }

  /// IBGE: Identificação completa do município
  Future<Map<String, dynamic>?> fetchIdentificacaoIbge(String ibge) async {
    final uri = Uri.https(
      'servicodados.ibge.gov.br',
      '/api/v1/localidades/municipios/$ibge',
    );

    try {
      final response = await http.get(uri).timeout(_timeout);
      if (response.statusCode >= 400) return null;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;

      return decoded;
    } catch (_) {
      return null;
    }
  }

  /// INEP/QEdu: Censo Escolar
  Future<CensoEscolar?> fetchCensoEscolar(String ibge, int exercicio) async {
    final currentYearData = await _fetchQeduCenso(ibge, exercicio);
    if (currentYearData != null) return currentYearData;

    final priorYearData = await _fetchQeduCenso(ibge, exercicio - 1);
    if (priorYearData != null) return priorYearData;

    final priorPriorYearData = await _fetchQeduCenso(ibge, exercicio - 2);
    if (priorPriorYearData != null) return priorPriorYearData;

    return null;
  }

  Future<CensoEscolar?> _fetchQeduCenso(String ibge, int year) async {
    final uri = Uri.https('qedu.org.br', '/api/v1/censo/territorios/matriculas', {
      'ibge_id': ibge,
      'ano': '$year',
      'dependencia_id': '5',
      'localizacao_id': '0',
      'oferta_id': '0',
    });

    try {
      final response = await http.get(uri).timeout(_timeout);
      if (response.statusCode >= 400) return null;

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;

      final censo = decoded['censo'];
      if (censo is! Map<String, dynamic>) return null;

      final matriculasCreche = _readNullablePayloadInt(censo['matriculas_creche']) ?? 0;
      final matriculasPre = _readNullablePayloadInt(censo['matriculas_pre_escolar']) ?? 0;
      final matriculasIniciais = _readNullablePayloadInt(censo['matriculas_anos_iniciais']) ?? 0;
      final matriculasFinais = _readNullablePayloadInt(censo['matriculas_anos_finais']) ?? 0;
      final matriculasMedio = _readNullablePayloadInt(censo['matriculas_ensino_medio']) ?? 0;
      final matriculasEja = _readNullablePayloadInt(censo['matriculas_eja']) ?? 0;
      final matriculasEspecial = _readNullablePayloadInt(censo['matriculas_educacao_especial']) ?? 0;

      final totalMatriculas = matriculasCreche + matriculasPre + matriculasIniciais + matriculasFinais + matriculasMedio + matriculasEja;
      final totalEscolas = _readNullablePayloadInt(censo['qtd_escolas']) ?? 0;

      if (totalMatriculas == 0 && totalEscolas == 0) return null;

      return CensoEscolar(
        totalEscolas: totalEscolas,
        totalMatriculas: totalMatriculas,
        totalDocentes: 0,
        fonte: 'INEP / Censo Escolar $year (QEdu)',
        anoReferencia: year,
        recorte: 'Rede Municipal',
        matriculasEtapa: CensoMatriculasEtapa(
          educacaoInfantil: matriculasCreche + matriculasPre,
          ensinoFundamental: matriculasIniciais + matriculasFinais,
          ensinoMedio: matriculasMedio,
          eja: matriculasEja,
          educacaoEspecial: matriculasEspecial,
        ),
        matriculasDetalhadas: CensoMatriculasDetalhadas(
          creche: matriculasCreche,
          preEscola: matriculasPre,
          anosIniciais: matriculasIniciais,
          anosFinais: matriculasFinais,
        ),
        tempoIntegral: CensoTempoIntegral(
          total: _readNullablePayloadInt(censo['matriculas_integral']) ?? 0,
          educacaoInfantil: 0,
          ensinoFundamental: 0,
          ensinoMedio: 0,
        ),
        docentesCiclo: const CensoDocentesCiclo(
          fundamentalIniciaisFinais: 0,
          ensinoMedio: 0,
        ),
      );
    } catch (_) {
      return null;
    }
  }

  int? _readNullablePayloadInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.round();
    if (value is String) {
      final normalized = value.trim().replaceAll('.', '').replaceAll(',', '.');
      if (normalized.isEmpty) return null;
      return double.tryParse(normalized)?.round();
    }
    return null;
  }

  ProjecaoRochaPrime calcularProjecao(ReceitasFundeb receitas) {
    final vaafProjetado = receitas.complementacaoVAAF * 1.05;
    final vaafGanho = vaafProjetado - receitas.complementacaoVAAF;
    
    final totalProjetado = receitas.receitaContribuicaoMunicipal + vaafProjetado + receitas.complementacaoVAAT + receitas.complementacaoVAAR;
    
    final ganhoPercentual = receitas.totalReceitas > 0 ? (totalProjetado - receitas.totalReceitas) / receitas.totalReceitas : 0.0;
    final totalGanho = totalProjetado - receitas.totalReceitas;

    return ProjecaoRochaPrime(
      vaafAtual: receitas.complementacaoVAAF,
      vaafProjetado: vaafProjetado,
      vaafGanho: vaafGanho > 0 ? vaafGanho : 0,
      vaatAtual: receitas.complementacaoVAAT,
      vaatProjetado: receitas.complementacaoVAAT,
      vaatGanho: 0,
      vaarAtual: receitas.complementacaoVAAR,
      vaarProjetado: receitas.complementacaoVAAR,
      vaarGanho: 0,
      totalAtual: receitas.totalReceitas,
      totalProjetado: totalProjetado,
      totalGanho: totalGanho > 0 ? totalGanho : 0,
      ganhoPercentual: ganhoPercentual > 0 ? ganhoPercentual : 0,
      possuiComplementacao: receitas.complementacaoVAAF > 0 || receitas.complementacaoVAAT > 0 || receitas.complementacaoVAAR > 0,
      metodologia: 'Crescimento conservador de 5% sobre VAAF (SICONFI).',
    );
  }

  ProjecaoRochaPrime calcularProjecaoRecuperavel(ReceitasFundeb receitas) {
    final totalRetroativo = receitas.complementacaoVAAF * 0.02;
    return ProjecaoRochaPrime(
      vaafAtual: receitas.complementacaoVAAF,
      vaafProjetado: receitas.complementacaoVAAF,
      vaafGanho: totalRetroativo,
      vaatAtual: 0,
      vaatProjetado: 0,
      vaatGanho: 0,
      vaarAtual: 0,
      vaarProjetado: 0,
      vaarGanho: 0,
      totalAtual: receitas.totalReceitas,
      totalProjetado: receitas.totalReceitas + totalRetroativo,
      totalGanho: totalRetroativo,
      ganhoPercentual: receitas.totalReceitas > 0 ? totalRetroativo / receitas.totalReceitas : 0.0,
      possuiComplementacao: receitas.complementacaoVAAF > 0,
      metodologia: 'Estimativa de recuperação de 2% sobre VAAF dos últimos 5 anos.',
    );
  }
}
