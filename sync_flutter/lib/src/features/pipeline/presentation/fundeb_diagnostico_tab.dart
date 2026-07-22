import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/sync_models.dart';
import '../../../core/theme/app_theme.dart';

/// Aba de Diagnóstico FUNDEB exibida no painel de detalhe do pipeline.
/// Espelha todos os blocos do relatório técnico Rocha Prime.
class FundebDiagnosticoTab extends StatelessWidget {
  const FundebDiagnosticoTab({
    super.key,
    required this.city,
    required this.diagnostico,
  });

  final CityAccount city;
  final FundebDiagnostico diagnostico;

  static final _currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
  static final _number = NumberFormat.decimalPattern('pt_BR');

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildExercicioHeader(),
        const SizedBox(height: 20),
        _buildReceitaHero(),
        const SizedBox(height: 16),
        _buildSection('1. Identificação do Ente', LucideIcons.landmark, _buildIdentificacao()),
        _buildSection('2. Receita e Projeção', LucideIcons.trendingUp, _buildReceitaProjecao()),
        _buildSection('3. VAAF / VAAT / VAAR', LucideIcons.chartArea, _buildVaatVaar()),
        _buildSection('4. Eficiência Arrecadatória', LucideIcons.gauge, _buildEficiencia()),
        _buildSection('5. Matrículas da Rede', LucideIcons.graduationCap, _buildMatriculas()),
        _buildSection('6. Indicadores IDEB', LucideIcons.award, _buildIdeb()),
        _buildSection('7. Sistemas MEC/FNDE', LucideIcons.monitorDot, _buildSistemas()),
        _buildSection('8. SICONFI — Despesas', LucideIcons.receipt, _buildSiconfi()),
        if (diagnostico.alertasTecnicos.isNotEmpty)
          _buildSection('Alertas Técnicos', LucideIcons.triangleAlert, _buildAlertas()),
        if (diagnostico.proximosPassos.isNotEmpty)
          _buildSection('Próximos Passos', LucideIcons.listChecks, _buildProximosPassos()),
      ],
    );
  }

  Widget _buildExercicioHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: SaaSTokens.primaryLight,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.fileText, size: 12, color: SaaSTokens.primary),
          const SizedBox(width: 6),
          Text(
            'Diagnóstico FUNDEB — Exercício ${diagnostico.exercicio}',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: SaaSTokens.primary),
          ),
          const SizedBox(width: 6),
          Text('FNDE / INEP / IBGE', style: const TextStyle(fontSize: 10, color: SaaSTokens.primaryDim)),
        ],
      ),
    );
  }

  Widget _buildReceitaHero() {
    final ganho = diagnostico.ganhoPotencial;
    final pct = diagnostico.ganhoPotencialPct;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [SaaSTokens.primary, const Color(0xFF2F4F84)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('RECEITA FUNDEB ATUAL', style: TextStyle(fontSize: 10, color: Colors.white70, letterSpacing: 0.8, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            _currency.format(diagnostico.receitaFundeb2026),
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _heroKpi('ESTIMATIVA 2027', _currency.format(diagnostico.estimativa2027), Colors.white)),
              Expanded(child: _heroKpi('GANHO POTENCIAL', '${pct.toStringAsFixed(1)}%\n${_currency.format(ganho)}', const Color(0xFF6EE7B7))),
              Expanded(child: _heroKpi('CAMADA RECUP.', _currency.format(diagnostico.camadaRecuperavel), const Color(0xFFFCD34D))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroKpi(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 9, color: Colors.white60, fontWeight: FontWeight.w600, letterSpacing: 0.6)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color, height: 1.3)),
      ],
    );
  }

  Widget _buildSection(String title, IconData icon, Widget content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: SaaSTokens.primary),
              const SizedBox(width: 6),
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: SaaSTokens.textTitle)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: SaaSTokens.borderLight),
            ),
            child: content,
          ),
        ],
      ),
    );
  }

  Widget _buildIdentificacao() {
    return Column(
      children: [
        _row('Gestor Municipal', diagnostico.gestor ?? '—'),
        _row('Partido', diagnostico.partido ?? '—'),
        _row('População Estimada', _number.format(diagnostico.populacao)),
        _row('Área Territorial', '${diagnostico.areaKm2.toStringAsFixed(1)} km²'),
        _row('PIB per Capita', _currency.format(diagnostico.pibPerCapita)),
        _row('Escolarização 6–14 anos', '${(diagnostico.escolarizacao614 * 100).toStringAsFixed(1)}%'),
        _row('UF / Fundo Estadual', '${city.uf} / Nordeste'),
        _row('Código IBGE', city.codigoIbge),
      ],
    );
  }

  Widget _buildReceitaProjecao() {
    return Column(
      children: [
        _row('Receita Total FUNDEB ${diagnostico.exercicio}', _currency.format(diagnostico.receitaFundeb2026)),
        _row('Estimativa Próximo Ciclo (${diagnostico.exercicio + 1})', _currency.format(diagnostico.estimativa2027), highlight: true),
        _row('Ganho Potencial Estimado', '${_currency.format(diagnostico.ganhoPotencial)} (+${diagnostico.ganhoPotencialPct.toStringAsFixed(1)}%)', highlight: true),
        _row('Camada Recuperável (bases atuais)', _currency.format(diagnostico.camadaRecuperavel)),
        _divider(),
        _note('Os valores projetados têm caráter estimativo e dependem de validação documental nas bases oficiais do FUNDEB e dos sistemas MEC/FNDE.'),
      ],
    );
  }

  Widget _buildVaatVaar() {
    return Table(
      columnWidths: const {0: FlexColumnWidth(2), 1: FlexColumnWidth(2), 2: FlexColumnWidth(2)},
      children: [
        _tableHeader(['Componente', 'Atual', 'Projetado']),
        _tableRow(['VAAF', _currency.format(diagnostico.vaafAtual), _currency.format(diagnostico.vaafProjetado)], highlight: false),
        _tableRow(['VAAT', _currency.format(diagnostico.vaatAtual), _currency.format(diagnostico.vaatProjetado)], highlight: true),
        _tableRow(['VAAR', _currency.format(diagnostico.vaarAtual), _currency.format(diagnostico.vaarProjetado)], highlight: false),
      ],
    );
  }

  Widget _buildEficiencia() {
    return Column(
      children: [
        _row('Índice de Eficiência Arrecadatória', diagnostico.indiceEficienciaArrecadatoria.toStringAsFixed(2)),
        _row('FUNDEB per Capita', _currency.format(diagnostico.fundebPerCapita)),
        _row('Fator de Ajuste Regional', diagnostico.fatorAjusteRegional.toStringAsFixed(2)),
        _row('Habilitação VAAT', diagnostico.habilitacaoVaat ? '✅ Habilitado' : '⚠️ Não habilitado',
            highlight: !diagnostico.habilitacaoVaat),
        _row('Recurso Real por Aluno', _currency.format(diagnostico.recursoRealPorAluno)),
      ],
    );
  }

  Widget _buildMatriculas() {
    return Column(
      children: [
        _row('Total Municipal', _number.format(diagnostico.matriculasTotaisMunicipal), highlight: true),
        _row('Creche', _number.format(diagnostico.matriculasCreche)),
        _row('Pré-Escola', _number.format(diagnostico.matriculasPreEscola)),
        _row('Fund. Anos Iniciais', _number.format(diagnostico.matriculasAnosIniciais)),
        _row('Fund. Anos Finais', _number.format(diagnostico.matriculasAnosFinais)),
        _row('EJA', _number.format(diagnostico.matriculasEja)),
        _row('Educação Especial', _number.format(diagnostico.matriculasEspecial)),
        _divider(),
        _row('Matrículas em Tempo Integral', _number.format(diagnostico.matriculasIntegral)),
        _row('Cobertura Integral (%)', '${diagnostico.coberturaIntegralPct.toStringAsFixed(1)}%'),
      ],
    );
  }

  Widget _buildIdeb() {
    final ini = diagnostico.idebAnosIniciais;
    final fin = diagnostico.idebAnosFinais;
    final mIni = diagnostico.metaIdebAnosIniciais;
    final mFin = diagnostico.metaIdebAnosFinais;
    return Column(
      children: [
        _row('IDEB — Anos Iniciais', ini != null ? ini.toStringAsFixed(1) : '—'),
        if (mIni != null) _row('Meta IDEB Anos Iniciais', mIni.toStringAsFixed(1)),
        _row('IDEB — Anos Finais', fin != null ? fin.toStringAsFixed(1) : '—'),
        if (mFin != null) _row('Meta IDEB Anos Finais', mFin.toStringAsFixed(1)),
        if (ini == null && fin == null)
          _note('Dados IDEB ainda não cadastrados para este município.'),
      ],
    );
  }

  Widget _buildSistemas() {
    return Column(
      children: [
        _row('SIMEC — Obras vinculadas', '${diagnostico.simecObras} obra(s)'),
        _row('PDDE Info — Escolas', '${diagnostico.pddeEscolas} escola(s)'),
        _row('SIGARPWEB', diagnostico.sigarpwebStatus ?? 'Consulta disponível'),
        _row('FNDE Habilita', 'Requer credencial do ente'),
        _row('SIGPC', 'Consulta pública de prestação de contas disponível'),
      ],
    );
  }

  Widget _buildSiconfi() {
    return Column(
      children: [
        _row('Despesa com Educação', _currency.format(diagnostico.despesaEducacao)),
        _row('Vinculação MDE (%)', '${diagnostico.vinculacaoMde.toStringAsFixed(1)}%'),
        _note('Fonte: SICONFI / Tesouro Nacional — DCA e RREO do exercício de referência.'),
      ],
    );
  }

  Widget _buildAlertas() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: diagnostico.alertasTecnicos.map((alerta) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(LucideIcons.triangleAlert, size: 12, color: Color(0xFFF59E0B)),
              const SizedBox(width: 6),
              Expanded(child: Text(alerta, style: const TextStyle(fontSize: 11, color: SaaSTokens.textBody))),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildProximosPassos() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: diagnostico.proximosPassos.asMap().entries.map((entry) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 18, height: 18,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: SaaSTokens.primary, borderRadius: BorderRadius.circular(9)),
                child: Text('${entry.key + 1}', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(entry.value, style: const TextStyle(fontSize: 11, color: SaaSTokens.textBody))),
            ],
          ),
        );
      }).toList(),
    );
  }

  // ── helpers ──────────────────────────────────────────────────

  Widget _row(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            flex: 3,
            child: Text(label, style: const TextStyle(fontSize: 11, color: SaaSTokens.textMuted)),
          ),
          Expanded(
            flex: 2,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 11,
                fontWeight: highlight ? FontWeight.bold : FontWeight.w500,
                color: highlight ? SaaSTokens.primary : SaaSTokens.textTitle,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _divider() => const Padding(
    padding: EdgeInsets.symmetric(vertical: 6),
    child: Divider(height: 1, color: SaaSTokens.borderLight),
  );

  Widget _note(String text) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text(text, style: const TextStyle(fontSize: 10, color: SaaSTokens.textDim, fontStyle: FontStyle.italic, height: 1.4)),
  );

  TableRow _tableHeader(List<String> cells) {
    return TableRow(
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: SaaSTokens.borderLight))),
      children: cells.map((c) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(c, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: SaaSTokens.textDim)),
      )).toList(),
    );
  }

  TableRow _tableRow(List<String> cells, {required bool highlight}) {
    return TableRow(
      children: cells.asMap().entries.map((entry) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Text(
          entry.value,
          style: TextStyle(
            fontSize: 11,
            fontWeight: highlight || entry.key > 0 ? FontWeight.w600 : FontWeight.normal,
            color: highlight && entry.key > 0 ? SaaSTokens.primary : SaaSTokens.textTitle,
          ),
        ),
      )).toList(),
    );
  }
}

/// Mock FUNDEB data para demonstração no painel de pipeline.
FundebDiagnostico mockFundebForCity(String cityId, String cityName) {
  // Dados de demonstração baseados no relatório de Acajutiba/BA
  return FundebDiagnostico(
    cityId: cityId,
    exercicio: 2026,
    gestor: 'Prefeito(a) Municipal',
    partido: 'MDB',
    populacao: 14200,
    areaKm2: 181.5,
    pibPerCapita: 13515.49,
    escolarizacao614: 0.997,
    receitaFundeb2026: 70958523.58,
    estimativa2027: 119210319.61,
    ganhoPotencial: 48251796.03,
    ganhoPotencialPct: 68.0,
    camadaRecuperavel: 13264448.08,
    vaafAtual: 10387024.82,
    vaafProjetado: 17450201.70,
    vaatAtual: 28112136.81,
    vaatProjetado: 47228389.84,
    vaarAtual: 2703988.44,
    vaarProjetado: 4542700.58,
    habilitacaoVaat: true,
    indiceEficienciaArrecadatoria: 61.27,
    fundebPerCapita: 4997.08,
    fatorAjusteRegional: 1.68,
    matriculasTotaisMunicipal: 3423,
    matriculasCreche: 386,
    matriculasPreEscola: 270,
    matriculasAnosIniciais: 839,
    matriculasAnosFinais: 715,
    matriculasEja: 1213,
    matriculasEspecial: 1309,
    matriculasIntegral: 2216,
    coberturaIntegralPct: 54.3,
    recursoRealPorAluno: 20729.92,
    idebAnosIniciais: 4.8,
    idebAnosFinais: 4.2,
    metaIdebAnosIniciais: 5.5,
    metaIdebAnosFinais: 5.0,
    simecObras: 1,
    pddeEscolas: 14,
    sigarpwebStatus: 'PREF MUN DE $cityName localizada',
    despesaEducacao: 18432000.00,
    vinculacaoMde: 25.9,
    alertasTecnicos: [
      'Os valores projetados têm caráter estimativo e dependem de validação documental.',
      'Conferir documentalmente as bases que determinam a captura de VAAF, VAAT e VAAR junto ao FNDE.',
      'Verificar atos normativos locais referentes à oferta de EJA, educação em tempo integral.',
    ],
    proximosPassos: [
      'Validar receitas atuais do FUNDEB nas bases oficiais',
      'Levantar status dos sistemas MEC/FNDE (SIMEC, Habilita, PDDE)',
      'Conferir bases do Censo Escolar e indicadores da rede municipal',
      'Gerar relatório técnico completo pelo PrimeOS para apresentação ao gestor',
    ],
  );
}
