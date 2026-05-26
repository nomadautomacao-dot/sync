// Data models for the "Case de Sucesso" institutional report.
//
// A Case de Sucesso compares FUNDEB complementation data across multiple
// years (typically 2024 → 2025 → 2026) for a single municipality, showing
// the financial evolution that resulted from the Rocha Prime engagement.

class CaseSucessoMunicipio {
  const CaseSucessoMunicipio({
    required this.nome,
    required this.uf,
    required this.codigoIbge,
    required this.anos,
    this.tese,
    this.destaques = const <String>[],
    this.servicos = const <String>[],
  });

  final String nome;
  final String uf;
  final String codigoIbge;
  final List<CaseSucessoAno> anos;

  /// High-level thesis for the case study.
  final String? tese;

  /// Bullet points for narrative highlights.
  final List<String> destaques;

  /// Services rendered by Rocha Prime.
  final List<String> servicos;

  String get label => '$nome/$uf';

  CaseSucessoAno? anoByYear(int year) {
    for (final a in anos) {
      if (a.ano == year) return a;
    }
    return null;
  }

  /// Sorted list of years present in the data.
  List<int> get sortedYears {
    final years = anos.map((a) => a.ano).toList()..sort();
    return years;
  }
}

class CaseSucessoAno {
  const CaseSucessoAno({
    required this.ano,
    required this.vaaf,
    required this.vaat,
    required this.vaar,
    required this.totalComplementacao,
    required this.totalReceitas,
  });

  final int ano;
  final double vaaf;
  final double vaat;
  final double vaar;
  final double totalComplementacao;
  final double totalReceitas;
}

/// Computed delta between two years for a single metric.
class CaseSucessoDelta {
  const CaseSucessoDelta({
    required this.label,
    required this.valorAnterior,
    required this.valorAtual,
  });

  final String label;
  final double valorAnterior;
  final double valorAtual;

  double get variacao => valorAtual - valorAnterior;
  double get percentual =>
      valorAnterior == 0 ? 0 : ((valorAtual - valorAnterior) / valorAnterior) * 100;

  String get percentualFormatted {
    final pct = percentual;
    final sign = pct >= 0 ? '+' : '';
    return '$sign${pct.toStringAsFixed(2)}%';
  }

  bool get isPositive => variacao >= 0;
}

/// Bundle with one or more municipalities for a case study report.
class CaseSucessoBundle {
  const CaseSucessoBundle({
    required this.municipios,
    required this.anoBase,
    required this.anoAtual,
    this.titulo,
    this.subtitulo,
  });

  final List<CaseSucessoMunicipio> municipios;
  final int anoBase;
  final int anoAtual;
  final String? titulo;
  final String? subtitulo;

  /// Aggregate complementation across all municipalities for a year.
  double totalComplementacao(int year) {
    double total = 0;
    for (final m in municipios) {
      final a = m.anoByYear(year);
      if (a != null) total += a.totalComplementacao;
    }
    return total;
  }

  /// Aggregate total receitas across all municipalities for a year.
  double totalReceitas(int year) {
    double total = 0;
    for (final m in municipios) {
      final a = m.anoByYear(year);
      if (a != null) total += a.totalReceitas;
    }
    return total;
  }

  /// Compute deltas between anoBase and anoAtual for each metric.
  List<CaseSucessoDelta> deltasForMunicipio(CaseSucessoMunicipio municipio) {
    final base = municipio.anoByYear(anoBase);
    final atual = municipio.anoByYear(anoAtual);
    if (base == null || atual == null) return const <CaseSucessoDelta>[];
    return <CaseSucessoDelta>[
      CaseSucessoDelta(
        label: 'Total da Complementação',
        valorAnterior: base.totalComplementacao,
        valorAtual: atual.totalComplementacao,
      ),
      CaseSucessoDelta(
        label: 'VAAF',
        valorAnterior: base.vaaf,
        valorAtual: atual.vaaf,
      ),
      CaseSucessoDelta(
        label: 'VAAT',
        valorAnterior: base.vaat,
        valorAtual: atual.vaat,
      ),
      CaseSucessoDelta(
        label: 'VAAR',
        valorAnterior: base.vaar,
        valorAtual: atual.vaar,
      ),
    ];
  }
}
