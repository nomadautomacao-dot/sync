import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'dart:typed_data';

import '../models/levantamento_fundeb_models.dart';
import '../models/slide_models.dart';
import '../models/sync_models.dart';
import '../../features/modules/application/fundeb_levantamento_pdf_builder.dart';
import 'sync_repository.dart';

class SyncPalette {
  static const bgPrimary = Color(0xFF04070C);
  static const bgSecondary = Color(0xFF0A111A);
  static const bgElevated = Color(0xFF111823);
  static const bgSurface = Color(0xFF17202D);
  static const borderSubtle = Color(0xFF232E3F);
  static const borderMedium = Color(0xFF334155);
  static const textPrimary = Color(0xFFF7F8FB);
  static const textSecondary = Color(0xFFA8B2C7);
  static const textTertiary = Color(0xFF74809A);
  static const accent = Color(0xFF11284A);
  static const accentHover = Color(0xFF2F6BFF);
  static const statusActive = Color(0xFF1EC77A);
  static const statusWarning = Color(0xFFF59E0B);
  static const statusError = Color(0xFFEF4444);
  static const statusInfo = Color(0xFF4EA1FF);
  static const statusPurple = Color(0xFF7C8BFF);
}

class MockSyncRepository implements SyncRepository {
  @override
  bool get remoteEnabled => false;

  @override
  String get apiBaseUrl => '';

  @override
  bool get usesEnvironmentApi => false;

  @override
  Future<void> setApiBaseUrl(String value) async {}

  @override
  Future<SyncUser?> restoreSession() async => null;

  @override
  Future<SyncUser> signIn(String email, String password) async {
    return SyncUser(name: 'Adriel Tavares', email: email, initials: 'AT');
  }

  @override
  Future<void> signOut() async {}

  @override
  Future<DashboardOverview> getDashboard({int? year}) async {
    return loadDashboard();
  }

  @override
  Future<List<CompanySummary>> getSidebarCompanies() async {
    return loadSidebarCompanies();
  }

  @override
  Future<List<CollaboratorSummary>> getCollaborators({
    String search = '',
    String status = 'all',
    int? year,
  }) async {
    return loadCollaborators();
  }

  @override
  Future<List<AuditEntry>> getAudit({int limit = 20}) async {
    return loadAudit().take(limit).toList();
  }

  @override
  Future<List<ModuleDefinition>> getModules() async {
    return loadModules();
  }

  @override
  Future<WorkspaceSettings> getWorkspaceSettings() async {
    return loadSettings();
  }

  @override
  Future<WorkspaceSettings> updateWorkspaceSettings(
    WorkspaceSettings settings,
  ) async {
    return settings;
  }

  @override
  DashboardOverview loadDashboard() {
    return const DashboardOverview(
      year: 2026,
      projectedGrossRevenue: 4280000,
      projectedProfit: 1730000,
      projectedMargin: 0.404,
      implementationCoverage: 0.67,
      kpis: [
        KpiMetric(
          label: 'Cidades trabalhadas',
          value: '43',
          helper: 'municipios acompanhados em 2026',
          icon: LucideIcons.mapPinned,
          color: SyncPalette.statusInfo,
          sparkData: const [12, 18, 22, 28, 30, 35, 38, 41, 43],
        ),
        KpiMetric(
          label: 'Cidades fidelizadas',
          value: '18',
          helper: 'base recorrente validada',
          icon: LucideIcons.target,
          color: SyncPalette.statusActive,
          sparkData: const [3, 5, 7, 9, 11, 13, 15, 17, 18],
        ),
        KpiMetric(
          label: 'Lucro base YTD',
          value: 'R\$ 1,1 mi',
          helper: 'resultado operacional acumulado',
          icon: LucideIcons.handCoins,
          color: const Color(0xFFD4A853), // SaaSTokens.gold
          sparkData: const [80, 120, 180, 310, 450, 620, 780, 950, 1100],
        ),
        KpiMetric(
          label: 'Comissao prevista',
          value: 'R\$ 412 mil',
          helper: 'base recorrente do ano',
          icon: LucideIcons.badgeDollarSign,
          color: const Color(0xFFB8943F), // SaaSTokens.goldDim
          sparkData: const [30, 55, 90, 140, 200, 260, 320, 370, 412],
        ),
        KpiMetric(
          label: 'Proximo ciclo',
          value: 'R\$ 5,2 mi',
          helper: 'pipeline ponderado do ano seguinte',
          icon: LucideIcons.banknoteArrowUp,
          color: SyncPalette.accentHover,
          sparkData: const [1.2, 1.8, 2.5, 3.0, 3.6, 4.1, 4.5, 4.9, 5.2],
        ),
      ],
      monthlyTrend: [
        MonthlyPoint(
          label: '01',
          revenue: 180000,
          profit: 66000,
          commission: 15000,
        ),
        MonthlyPoint(
          label: '02',
          revenue: 220000,
          profit: 88000,
          commission: 18000,
        ),
        MonthlyPoint(
          label: '03',
          revenue: 250000,
          profit: 99000,
          commission: 22000,
        ),
        MonthlyPoint(
          label: '04',
          revenue: 280000,
          profit: 112000,
          commission: 26000,
        ),
        MonthlyPoint(
          label: '05',
          revenue: 310000,
          profit: 129000,
          commission: 29000,
        ),
        MonthlyPoint(
          label: '06',
          revenue: 345000,
          profit: 144000,
          commission: 32000,
        ),
        MonthlyPoint(
          label: '07',
          revenue: 370000,
          profit: 152000,
          commission: 34000,
        ),
        MonthlyPoint(
          label: '08',
          revenue: 400000,
          profit: 162000,
          commission: 36000,
        ),
        MonthlyPoint(
          label: '09',
          revenue: 390000,
          profit: 158000,
          commission: 35000,
        ),
        MonthlyPoint(
          label: '10',
          revenue: 430000,
          profit: 171000,
          commission: 38000,
        ),
        MonthlyPoint(
          label: '11',
          revenue: 510000,
          profit: 205000,
          commission: 42000,
        ),
        MonthlyPoint(
          label: '12',
          revenue: 595000,
          profit: 244000,
          commission: 47000,
        ),
      ],
      alerts: [
        AlertMessage(
          text:
              '6 cidades com probabilidade alta ainda sem validacao institucional.',
          color: SyncPalette.statusWarning,
        ),
        AlertMessage(
          text:
              '2 operacoes com margem abaixo do piso esperado para fidelizacao.',
          color: SyncPalette.statusError,
        ),
      ],
      portfolioMix: [
        PortfolioSlice(
          label: 'Fidelizadas',
          value: 18,
          color: SyncPalette.statusActive,
        ),
        PortfolioSlice(
          label: 'Em implantacao',
          value: 11,
          color: SyncPalette.statusWarning,
        ),
        PortfolioSlice(
          label: 'Em operacao',
          value: 8,
          color: SyncPalette.statusInfo,
        ),
        PortfolioSlice(
          label: 'Demais cidades',
          value: 6,
          color: SyncPalette.accentHover,
        ),
      ],
      topMunicipalities: [
        MunicipalityProjection(
          name: 'Serra do Ramalho',
          state: 'BA',
          stage: 'Implantacao',
          projectedRevenue: 520000,
          projectedProfit: 196000,
          probability: 0.91,
          collaboratorName: 'Rafael Costa',
        ),
        MunicipalityProjection(
          name: 'Pocoes',
          state: 'BA',
          stage: 'Negociacao',
          projectedRevenue: 460000,
          projectedProfit: 173000,
          probability: 0.82,
          collaboratorName: 'Mayra Sousa',
        ),
        MunicipalityProjection(
          name: 'Sao Felix do Coribe',
          state: 'BA',
          stage: 'Fidelizado',
          projectedRevenue: 410000,
          projectedProfit: 158000,
          probability: 0.95,
          collaboratorName: 'Fabio Mendes',
        ),
        MunicipalityProjection(
          name: 'Cristalina',
          state: 'GO',
          stage: 'Proposta apresentada',
          projectedRevenue: 355000,
          projectedProfit: 131000,
          probability: 0.68,
          collaboratorName: 'Renata Prado',
        ),
      ],
    );
  }

  List<CompanySummary> loadCompanies() {
    return const [
      CompanySummary(
        id: '1',
        tradingName: 'Rocha Prime',
        segment: 'Consultoria publica',
        cnpj: '12.345.678/0001-90',
        status: 'Ativo',
        city: 'Belem',
        state: 'PA',
        enabledModules: [
          'consultoria',
          'fundeb',
          'levantamento-fundeb',
          'propostas',
        ],
        color: SyncPalette.statusInfo,
      ),
      CompanySummary(
        id: '2',
        tradingName: 'Sync Educacional',
        segment: 'Educacao e captacao',
        cnpj: '98.765.432/0001-21',
        status: 'Ativo',
        city: 'Goiania',
        state: 'GO',
        enabledModules: ['fundeb', 'case-de-sucesso', 'contrato-fundeb'],
        color: SyncPalette.statusActive,
      ),
      CompanySummary(
        id: '3',
        tradingName: 'Instituto Horizonte',
        segment: 'Formacao e apoio tecnico',
        cnpj: '21.567.890/0001-55',
        status: 'Inativo',
        city: 'Salvador',
        state: 'BA',
        enabledModules: ['formacao'],
        color: SyncPalette.statusPurple,
      ),
    ];
  }

  @override
  Future<List<CompanySummary>> getCompanies({
    String search = '',
    String status = 'Todos',
  }) async {
    return loadCompanies().where((company) {
      final matchesSearch =
          search.trim().isEmpty ||
          company.tradingName.toLowerCase().contains(search.toLowerCase()) ||
          company.segment.toLowerCase().contains(search.toLowerCase()) ||
          company.cnpj.contains(search);
      final matchesStatus = status == 'Todos' || company.status == status;
      return matchesSearch && matchesStatus;
    }).toList();
  }

  @override
  Future<CompanyBundle> getCompanyBundle(String companyId) async {
    final company = loadCompanies().firstWhere((item) => item.id == companyId);
    return CompanyBundle(
      company: CompanyDetails(
        id: company.id,
        name: company.tradingName,
        tradingName: company.tradingName,
        cnpj: company.cnpj,
        status: company.status,
        segment: company.segment,
        city: company.city,
        state: company.state,
        email: 'contato@empresa.local',
        phone: '(91) 99999-0000',
        contactName: 'Responsavel comercial',
        contactPosition: 'Diretoria',
        enabledModules: company.enabledModules,
      ),
      employees: const [
        EmployeeRecord(
          id: '1',
          name: 'Analista de implantacao',
          email: 'implantacao@empresa.local',
          position: 'Implantacao',
          role: 'member',
          status: 'Ativo',
        ),
      ],
    );
  }

  @override
  Future<CompanyDetails> updateCompanyModules(
    String companyId,
    List<String> enabledModules,
  ) async {
    final bundle = await getCompanyBundle(companyId);
    return CompanyDetails(
      id: bundle.company.id,
      name: bundle.company.name,
      tradingName: bundle.company.tradingName,
      cnpj: bundle.company.cnpj,
      status: bundle.company.status,
      segment: bundle.company.segment,
      city: bundle.company.city,
      state: bundle.company.state,
      email: bundle.company.email,
      phone: bundle.company.phone,
      contactName: bundle.company.contactName,
      contactPosition: bundle.company.contactPosition,
      enabledModules: enabledModules,
    );
  }

  @override
  Future<CityAccount> createCity(Map<String, dynamic> data) async {
    throw UnsupportedError('Mock não suporta criação.');
  }

  @override
  Future<CollaboratorSummary> createCollaborator(Map<String, dynamic> data) async {
    throw UnsupportedError('Mock nao suporta criacao.');
  }

  @override
  Future<List<CityAccount>> getCities({
    String search = '',
    String stage = '',
  }) async {
    return const <CityAccount>[];
  }

  @override
  Future<List<MunicipioSearchItem>> searchMunicipios(
    String query, {
    String? uf,
  }) async {
    final normalizedQuery = query.trim().toLowerCase();
    final normalizedUf = (uf ?? '').trim().toUpperCase();
    final pool = const [
      MunicipioSearchItem(
        codigoIbge: '2928903',
        nome: 'Pocoes',
        uf: 'BA',
        regiao: 'Nordeste',
      ),
      MunicipioSearchItem(
        codigoIbge: '2930156',
        nome: 'Serra do Ramalho',
        uf: 'BA',
        regiao: 'Nordeste',
      ),
      MunicipioSearchItem(
        codigoIbge: '5218507',
        nome: 'Cristalina',
        uf: 'GO',
        regiao: 'Centro-Oeste',
      ),
    ];

    return pool.where((item) {
      final matchesQuery =
          normalizedQuery.isEmpty ||
          item.nome.toLowerCase().contains(normalizedQuery) ||
          item.codigoIbge.contains(normalizedQuery);
      final matchesUf = normalizedUf.isEmpty || item.uf == normalizedUf;
      return matchesQuery && matchesUf;
    }).toList();
  }

  @override
  Future<LevantamentoFundebBundle> getLevantamentoFundeb(
    MunicipioLookupRequest request,
  ) async {
    return _buildMockLevantamentoBundle(request);
  }

  @override
  Future<RelatorioDirigidoBundle> refreshRelatorioDirigido(
    MunicipioLookupRequest request,
  ) async {
    final bundle = _buildMockLevantamentoBundle(request);
    final report = bundle.relatorioDirigidoBase!;
    return RelatorioDirigidoBundle(report: report, base: report);
  }

  @override
  Future<Uint8List> generateLevantamentoFundebPdf(
    MunicipioLookupRequest request, {
    String tipo = 'levantamento',
  }) async {
    final bundle = await getLevantamentoFundeb(request);
    if (tipo == 'lite') {
      return FundebLevantamentoPdfBuilder.buildLiteFromBundle(
        bundle,
        directedReport: bundle.relatorioDirigidoBase,
      );
    }
    return FundebLevantamentoPdfBuilder.buildFromBundle(
      bundle,
      directedReport: bundle.relatorioDirigidoBase,
    );
  }

  @override
  Future<Map<String, dynamic>> obterDadosContratoFundeb(Map<String, dynamic> body) async {
    final double valorMensalVal = body['valorMensal'] != null ? double.parse(body['valorMensal'].toString()) : 15000.0;
    final int qtdMesesVal = body['quantidadeMeses'] != null ? int.parse(body['quantidadeMeses'].toString()) : 12;
    return <String, dynamic>{
      'success': true,
      'contrato': <String, dynamic>{
        'municipioNome': body['municipioNome'] ?? 'Município de Teste',
        'municipioCNPJ': '00.000.000/0001-00',
        'municipioEndereco': 'Praça da Matriz, 1',
        'municipioCEP': '00000-000',
        'municipioUF': body['uf'] ?? 'BA',
        'empresaRazaoSocial': 'Rocha Prime Consultoria LTDA',
        'empresaCNPJ': '12.345.678/0001-90',
        'empresaEndereco': 'Av. República, 1000',
        'empresaCidade': 'Belém',
        'empresaUF': 'PA',
        'empresaCEP': '66000-000',
        'representanteNome': 'Fulano de Tal',
        'representanteCPF': '111.111.111-11',
        'representanteRG': '1234567-SSP/DF',
        'representanteOrgaoExp': 'SSP/DF',
        'representanteNacionalidade': 'brasileiro',
        'representanteEstadoCivil': 'casado',
        'representanteQualificacao': 'sócio-administrador',
        'processoNumero': '001/2026',
        'inexigibilidadeNumero': '002/2026',
        'contratoNumero': '003/2026',
        'exercicio': body['exercicio'] ?? 2026,
        'baseLegal': 'Art. 74, III, da Lei nº 14.133/2021',
        'valorMensal': valorMensalVal,
        'quantidadeMeses': qtdMesesVal,
        'valorGlobal': valorMensalVal * qtdMesesVal,
        'percentualInsumos': 40,
        'percentualPessoal': 60,
      }
    };
  }

  @override
  Future<Uint8List> gerarKitContratosFundeb(Map<String, dynamic> data) async {
    return Uint8List(0);
  }

  @override
  Future<Uint8List> gerarPropostaDocx(Map<String, dynamic> data) async {
    return Uint8List(0);
  }

  @override
  Future<Uint8List> gerarKitContratosFundebComAnexos(
    Map<String, dynamic> data,
    Map<String, List<({String nome, Uint8List bytes})>> anexos,
  ) async {
    return gerarKitContratosFundeb(data);
  }

  @override
  List<CompanySummary> loadSidebarCompanies() => loadCompanies();

  @override
  List<CollaboratorSummary> loadCollaborators() {
    return const [
      CollaboratorSummary(
        id: '1',
        fullName: 'Rafael Costa',
        role: 'Captacao territorial',
        type: 'Parceiro externo',
        state: 'BA',
        status: 'Ativo',
        cities: 9,
        fidelized: 4,
        profitYtd: 412000,
        commissionYtd: 82000,
      ),
      CollaboratorSummary(
        id: '2',
        fullName: 'Mayra Sousa',
        role: 'Articulacao municipal',
        type: 'Articulador municipal',
        state: 'GO',
        status: 'Ativo',
        cities: 7,
        fidelized: 3,
        profitYtd: 285000,
        commissionYtd: 61000,
      ),
      CollaboratorSummary(
        id: '3',
        fullName: 'Fabio Mendes',
        role: 'Implantacao FUNDEB',
        type: 'Suporte a implantacao',
        state: 'PA',
        status: 'Prospeccao',
        cities: 4,
        fidelized: 1,
        profitYtd: 143000,
        commissionYtd: 23000,
      ),
    ];
  }

  @override
  List<AuditEntry> loadAudit() {
    return const [
      AuditEntry(
        action: 'Contrato FUNDEB gerado para Serra do Ramalho/BA.',
        createdAt: '16/04/2026 09:14',
      ),
      AuditEntry(
        action: 'Relatorio dirigido do modulo Levantamento FUNDEB exportado.',
        createdAt: '16/04/2026 08:42',
      ),
      AuditEntry(
        action: 'Nova empresa cadastrada no workspace: Sync Educacional.',
        createdAt: '15/04/2026 17:28',
      ),
      AuditEntry(
        action: 'Colaborador Rafael Costa recebeu atualizacao de comissao.',
        createdAt: '15/04/2026 14:05',
      ),
    ];
  }

  @override
  List<ModuleDefinition> loadModules() {
    return const [
      ModuleDefinition(
        key: 'consultoria',
        label: 'Consultoria',
        description: 'Projetos, entregas, contratos e pareceres.',
        color: SyncPalette.statusInfo,
        icon: LucideIcons.briefcaseBusiness,
        mappedFlows: [
          'Projetos ativos',
          'Tracker de entregas',
          'Resumo contratual',
        ],
      ),
      ModuleDefinition(
        key: 'fundeb',
        label: 'Consultoria FUNDEB',
        description:
            'Municipios, indicadores, projecao de faturamento e comissao.',
        color: SyncPalette.statusActive,
        icon: LucideIcons.landmark,
        mappedFlows: [
          'Carteira municipal',
          'Indicadores financeiros',
          'Projecao anual',
        ],
      ),
      ModuleDefinition(
        key: 'levantamento-fundeb',
        label: 'Levantamento FUNDEB',
        description:
            'Diagnostico municipal, relatorio dirigido e exportacao operacional.',
        color: SyncPalette.accentHover,
        icon: LucideIcons.squarePen,
        mappedFlows: ['Diagnostico', 'Preview tecnico', 'PDF dirigido com IA'],
      ),
      ModuleDefinition(
        key: 'levantamento-lite-fundeb',
        label: 'Levantamento Lite FUNDEB',
        description: 'Resumo infografico de ate duas paginas para reunioes.',
        color: SyncPalette.statusPurple,
        icon: Icons.insert_chart_outlined_rounded,
        mappedFlows: ['Dados da cidade', 'Rede escolar', 'PDF infografico'],
      ),
      ModuleDefinition(
        key: 'contrato-fundeb',
        label: 'Contratos Fundeb',
        description:
            'Geração modular completa de processo administrativo e contrato (15 anexos) sob a Lei 14.133/21.',
        color: SyncPalette.statusWarning,
        icon: Icons.assignment_outlined,
        mappedFlows: [
          'Wizard paramétrico 5 etapas',
          'Geração lote 15 documentos',
          'Download lote compactado (.ZIP)',
        ],
      ),
      ModuleDefinition(
        key: 'case-de-sucesso',
        label: 'Case de Sucesso',
        description: 'Analise da evolucao do FUNDEB com cards e graficos.',
        color: SyncPalette.statusWarning,
        icon: LucideIcons.chartSpline,
        mappedFlows: [
          'Seletor de municipio',
          'Cards de impacto',
          'Graficos de evolucao',
        ],
      ),
      ModuleDefinition(
        key: 'propostas',
        label: 'Propostas Comerciais',
        description: 'Criacao e padronizacao de propostas de servicos.',
        color: SyncPalette.statusActive,
        icon: LucideIcons.banknote,
        mappedFlows: [
          'Wizard comercial',
          'Minuta contratual',
          'Exportacao PDF/DOCX',
        ],
      ),
      ModuleDefinition(
        key: 'tecnologia',
        label: 'Tecnologia',
        description: 'Inventario, suporte e projetos internos.',
        color: SyncPalette.textSecondary,
        icon: LucideIcons.blocks,
        mappedFlows: ['Inventario interno', 'Roadmap tecnico'],
      ),
      ModuleDefinition(
        key: 'slides',
        label: 'Slides',
        description: 'Apresentacoes corporativas com dados reais do municipio.',
        color: const Color(0xFF7C3AED),
        icon: LucideIcons.presentation,
        mappedFlows: [
          'Templates institucionais',
          'Proposta FUNDEB',
          'Resumo executivo',
        ],
      ),
    ];
  }

  @override
  WorkspaceSettings loadSettings() {
    return const WorkspaceSettings(
      id: 'mock-workspace',
      groupName: 'Grupo Sync',
      slug: 'sync-workspace',
    );
  }

  LevantamentoFundebBundle _buildMockLevantamentoBundle(
    MunicipioLookupRequest request,
  ) {
    final municipio = ((request.nome ?? '').trim().isEmpty
        ? 'Pocoes'
        : request.nome!.trim());
    final uf = ((request.uf ?? '').trim().isEmpty
        ? 'BA'
        : request.uf!.trim().toUpperCase());
    final codigoIbge = request.hasCodigoIbge
        ? request.codigoIbge!.replaceAll(RegExp(r'[^0-9]'), '')
        : '2928903';

    final relatorio = RelatorioFundeb(
      geradoEm: '2026-04-16T09:30:00.000Z',
      identificacao: MunicipioIdentificacao(
        municipio: '$municipio/$uf',
        municipioNome: municipio,
        uf: uf,
        codigoIBGE: codigoIbge,
        prefeito: 'Prefeito em validacao',
        partido: 'Nao informado',
        exercicio: request.exercicio,
        fonte: 'Base Sync + fallback local',
        mesorregiao: 'Centro Sul Baiano',
        microrregiao: 'Vitoria da Conquista',
        regiaoIntermediaria: 'Vitoria da Conquista',
        regiao: 'Nordeste',
      ),
      receitas: const ReceitasFundeb(
        receitaContribuicaoMunicipal: 21340000,
        complementacaoVAAF: 2840000,
        complementacaoVAAT: 1190000,
        complementacaoVAAR: 240000,
        totalReceitas: 25610000,
      ),
      projecao: const ProjecaoRochaPrime(
        vaafAtual: 2840000,
        vaafProjetado: 3410000,
        vaafGanho: 570000,
        vaatAtual: 1190000,
        vaatProjetado: 1510000,
        vaatGanho: 320000,
        vaarAtual: 240000,
        vaarProjetado: 390000,
        vaarGanho: 150000,
        totalAtual: 25610000,
        totalProjetado: 26650000,
        totalGanho: 1040000,
        ganhoPercentual: 0.0406,
        possuiComplementacao: true,
        metodologia: 'Projecao de referencia do levantamento',
        multiplicadorAplicado: 1.04,
        natureza: 'recuperavel',
      ),
      projecaoRecuperavel: const ProjecaoRochaPrime(
        vaafAtual: 2840000,
        vaafProjetado: 3410000,
        vaafGanho: 570000,
        vaatAtual: 1190000,
        vaatProjetado: 1510000,
        vaatGanho: 320000,
        vaarAtual: 240000,
        vaarProjetado: 390000,
        vaarGanho: 150000,
        totalAtual: 25610000,
        totalProjetado: 26650000,
        totalGanho: 1040000,
        ganhoPercentual: 0.0406,
        possuiComplementacao: true,
        metodologia: 'Camada recuperavel validada',
        multiplicadorAplicado: 1.04,
        natureza: 'recuperavel',
      ),
      projecaoComercial: const ProjecaoRochaPrime(
        vaafAtual: 2840000,
        vaafProjetado: 3580000,
        vaafGanho: 740000,
        vaatAtual: 1190000,
        vaatProjetado: 1640000,
        vaatGanho: 450000,
        vaarAtual: 240000,
        vaarProjetado: 420000,
        vaarGanho: 180000,
        totalAtual: 25610000,
        totalProjetado: 27070000,
        totalGanho: 1460000,
        ganhoPercentual: 0.057,
        possuiComplementacao: true,
        metodologia: 'Benchmark comercial Rocha Prime',
        multiplicadorAplicado: 1.06,
        natureza: 'benchmark',
        ressalva: 'Requer fechamento documental para captura integral.',
      ),
      upsideCondicionado: const UpsideCondicionadoFundeb(
        totalProjetado: 27070000,
        ganhoAdicional: 420000,
        ganhoPercentual: 0.0164,
        metodologia: 'Upside condicionado por benchmark regional',
        vetores: ['Tempo integral', 'Regularizacao VAAT', 'Ajustes de base'],
      ),
      perfilComercial: const PerfilComercialFundeb(
        score: 78,
        faixa: 'padrao',
        confianca: 0.81,
        habilitacaoVaat: 'Sinalizada para revisao assistida',
        populacaoEstimada: 34952,
        pendenciaVaat: 'Validar trilha documental de condicionalidades.',
        fundebPerCapita: 1910,
        matriculasMunicipaisPorHabitante: 0.21,
        educacaoInfantilMunicipalPorHabitante: 0.06,
        crecheMunicipalPorHabitante: 0.02,
      ),
      cronogramaVAAF: const [
        CronogramaVAAF(mes: 'Jan', valorProjetado: 2220000, percentual: 0.083),
        CronogramaVAAF(mes: 'Fev', valorProjetado: 2220000, percentual: 0.083),
        CronogramaVAAF(mes: 'Mar', valorProjetado: 2220000, percentual: 0.083),
        CronogramaVAAF(mes: 'Abr', valorProjetado: 2220000, percentual: 0.083),
        CronogramaVAAF(mes: 'Mai', valorProjetado: 2220000, percentual: 0.083),
        CronogramaVAAF(mes: 'Jun', valorProjetado: 2220000, percentual: 0.083),
      ],
      sistemas: const [
        SistemaHabilitacao(
          instituicao: 'FNDE',
          sistema: 'Habilita',
          situacao: 'Senha Ativa',
        ),
        SistemaHabilitacao(
          instituicao: 'MEC',
          sistema: 'PAR',
          situacao: 'Consulta publica',
        ),
      ],
      obrasPAC2: const [
        ObraPAC2(
          tipo: 'Creche tipo 1',
          aprovadas: 1,
          execucao: 1,
          canceladas: 0,
          concluidas: 0,
          total: 1,
        ),
      ],
      situacaoPAR: 'Municipio com trilha publica localizada.',
      caminhoEscola: const [
        VeiculoCaminhoEscola(
          tipo: 'Onibus escolar',
          quantidade: 4,
          valor: 1220000,
        ),
      ],
      pdde: const [
        RepassePDDE(ano: 2024, valor: 420000),
        RepassePDDE(ano: 2025, valor: 470000),
      ],
      observacoesOperacionais: const [
        'Habilitacao do ecossistema MEC/FNDE parcialmente verificavel por fontes publicas.',
        'Camada dirigida sugere fechamento juridico antes de oferta executiva final.',
      ],
      idebAnosIniciais: const [
        IDEBDado(ano: 2005, metaProjetada: 3.5, idebVerificado: 3.4),
        IDEBDado(ano: 2007, metaProjetada: 3.6, idebVerificado: 3.8),
        IDEBDado(ano: 2009, metaProjetada: 3.9, idebVerificado: 4.0),
        IDEBDado(ano: 2011, metaProjetada: 4.2, idebVerificado: 4.3),
        IDEBDado(ano: 2013, metaProjetada: 4.5, idebVerificado: 4.6),
        IDEBDado(ano: 2015, metaProjetada: 4.8, idebVerificado: 4.7),
        IDEBDado(ano: 2017, metaProjetada: 5.0, idebVerificado: 4.9),
        IDEBDado(ano: 2019, metaProjetada: 5.4, idebVerificado: 5.1),
        IDEBDado(ano: 2021, metaProjetada: 5.6, idebVerificado: 5.3),
        IDEBDado(ano: 2023, metaProjetada: 5.8, idebVerificado: 5.5),
      ],
      idebAnosFinais: const [
        IDEBDado(ano: 2005, metaProjetada: 3.2, idebVerificado: 3.1),
        IDEBDado(ano: 2007, metaProjetada: 3.3, idebVerificado: 3.4),
        IDEBDado(ano: 2009, metaProjetada: 3.5, idebVerificado: 3.6),
        IDEBDado(ano: 2011, metaProjetada: 3.8, idebVerificado: 3.7),
        IDEBDado(ano: 2013, metaProjetada: 4.0, idebVerificado: 3.9),
        IDEBDado(ano: 2015, metaProjetada: 4.3, idebVerificado: 4.1),
        IDEBDado(ano: 2017, metaProjetada: 4.5, idebVerificado: 4.3),
        IDEBDado(ano: 2019, metaProjetada: 4.8, idebVerificado: 4.4),
        IDEBDado(ano: 2021, metaProjetada: 5.0, idebVerificado: 4.7),
        IDEBDado(ano: 2023, metaProjetada: 5.2, idebVerificado: 4.9),
      ],
      censoEscolar: const CensoEscolar(
        totalEscolas: 41,
        totalMatriculas: 7340,
        totalDocentes: 428,
        fonte: 'INEP consolidado',
        anoReferencia: 2024,
        recorte: 'publica',
        matriculasEtapa: CensoMatriculasEtapa(
          educacaoInfantil: 1880,
          ensinoFundamental: 4710,
          ensinoMedio: 210,
          eja: 370,
          educacaoEspecial: 170,
        ),
        matriculasDetalhadas: CensoMatriculasDetalhadas(
          creche: 620,
          preEscola: 1260,
          anosIniciais: 2780,
          anosFinais: 1930,
        ),
        tempoIntegral: CensoTempoIntegral(
          total: 930,
          educacaoInfantil: 390,
          creche: 210,
          preEscola: 180,
          ensinoFundamental: 520,
          anosIniciais: 310,
          anosFinais: 210,
          ensinoMedio: 0,
          eja: 20,
          educacaoEspecial: 18,
        ),
        docentesCiclo: CensoDocentesCiclo(
          fundamentalIniciaisFinais: 361,
          ensinoMedio: 21,
        ),
      ),
    );

    final dirigido = RelatorioDirigidoMunicipio(
      municipio: municipio,
      uf: uf,
      codigoIbge: codigoIbge,
      geradoEm: '2026-04-16T10:00:00.000Z',
      modo: 'base_interna',
      modeloPrincipal: 'base_interna_sync',
      modeloAuxiliar: null,
      resumoExecutivo:
          'Base dirigida montada com leitura executiva, pendencias humanas claras e separacao objetiva entre fato, sinalizacao e risco de entrega.',
      searchQueries: const [
        'prefeitura pocoes fundeb',
        'pocoes bahia educacao municipal',
        'pocoes par fnde',
      ],
      itens: const [
        RelatorioDirigidoItem(
          id: 'prefeito',
          titulo: 'Gestao atual identificada',
          pergunta:
              'Quem lidera o municipio e qual o contexto politico imediato?',
          resposta:
              'A prefeitura atual esta mapeada, mas a recomendacao comercial ainda depende de fechamento fino do mandato e das prioridades da equipe local.',
          status: 'sinalizado',
          confianca: 81,
          fontes: [
            RelatorioDirigidoFonte(
              url: 'https://example.local/prefeitura',
              titulo: 'Portal institucional',
              tipo: 'institucional',
            ),
          ],
          observacoes: [
            'Confirmar composicao final da equipe de educacao antes da entrega executiva.',
          ],
        ),
        RelatorioDirigidoItem(
          id: 'fundeb',
          titulo: 'Potencial financeiro validado',
          pergunta: 'Ha evidencia suficiente para sustentar ganho recuperavel?',
          resposta:
              'Sim. A base tecnica ja mostra camada recuperavel plausivel e benchmark comercial acima do piso tecnico.',
          status: 'confirmado',
          confianca: 92,
          fontes: [
            RelatorioDirigidoFonte(
              url: 'sync://fundeb/base',
              titulo: 'Base interna Sync',
              tipo: 'base_interna',
            ),
          ],
          observacoes: [],
        ),
      ],
      pendenciasHumanas: const [
        'Validar pendencias documentais ligadas ao VAAT.',
        'Checar status operacional do PAR com a equipe municipal.',
      ],
      alertasJuridicos: const [
        'Nao transformar benchmark comercial em promessa sem respaldo documental.',
      ],
      proximosPassos: const [
        'Rodar fechamento assistido do relatorio dirigido.',
        'Priorizar coleta documental de habilitacao e trilha de programas.',
      ],
      prontidao: const RelatorioDirigidoProntidao(
        status: 'revisao_assistida',
        score: 74,
        resumo:
            'A cidade ja tem base suficiente para proposta assistida, mas ainda nao para entrega cega sem revisao humana.',
        bloqueios: ['Trilha de validacao juridica ainda nao fechada.'],
        avisos: ['Contexto politico precisa de ultima revisao comercial.'],
        criterios: [
          'Base fiscal suficiente',
          'Historico educacional consolidado',
          'Pendencia documental explicita',
        ],
      ),
      perfilMunicipio: const RelatorioDirigidoPerfilMunicipio(
        populacao: 34952,
        populacaoAnoReferencia: 'estimativa IBGE',
      ),
      contextoPolitico: const RelatorioDirigidoContextoPolitico(
        prefeitoAtual: 'Prefeito em validacao',
        partidoAtual: 'Nao informado',
        classificacaoMandato: 'indeterminado',
        detalheMandato: 'Contexto politico preliminar aguardando consolidacao.',
        estrategiaComercial:
            'Abordagem consultiva com foco em fechamento tecnico antes da proposta final.',
        resumoComparativoGestao:
            'A leitura comparativa sugere janela comercial favoravel se a equipe local confirmar abertura para saneamento operacional.',
      ),
      historico: const RelatorioDirigidoHistorico(
        anos: [
          RelatorioDirigidoSerieHistoricaAno(
            ano: 2022,
            anoBaseCenso: 2021,
            totalReceitasFundeb: 21400000,
            contribuicaoMunicipal: 18100000,
            complementacaoVAAF: 2100000,
            complementacaoVAAT: 980000,
            complementacaoVAAR: 220000,
            totalMatriculasMunicipais: 7080,
            totalEscolas: 40,
            eja: 340,
            tempoIntegral: 720,
            educacaoEspecial: 140,
          ),
          RelatorioDirigidoSerieHistoricaAno(
            ano: 2023,
            anoBaseCenso: 2022,
            totalReceitasFundeb: 23200000,
            contribuicaoMunicipal: 19400000,
            complementacaoVAAF: 2470000,
            complementacaoVAAT: 1090000,
            complementacaoVAAR: 240000,
            totalMatriculasMunicipais: 7210,
            totalEscolas: 41,
            eja: 350,
            tempoIntegral: 810,
            educacaoEspecial: 152,
          ),
          RelatorioDirigidoSerieHistoricaAno(
            ano: 2024,
            anoBaseCenso: 2023,
            totalReceitasFundeb: 25610000,
            contribuicaoMunicipal: 21340000,
            complementacaoVAAF: 2840000,
            complementacaoVAAT: 1190000,
            complementacaoVAAR: 240000,
            totalMatriculasMunicipais: 7340,
            totalEscolas: 41,
            eja: 370,
            tempoIntegral: 930,
            educacaoEspecial: 170,
          ),
        ],
        resumo:
            'Serie recente aponta crescimento consistente de receita e aumento gradual de tempo integral.',
      ),
      benchmarkRegional: const RelatorioDirigidoBenchmarkRegional(
        criterio:
            'Municipios nordestinos de porte semelhante com receita FUNDEB superior.',
        resumo:
            'Benchmark regional usado como camada comercial complementar, nunca como substituto da base recuperavel.',
        municipios: [
          RelatorioDirigidoMunicipioComparavel(
            municipio: 'Serra do Ramalho',
            uf: 'BA',
            codigoIbge: '2930156',
            criterioRegional:
                'Porte semelhante com evolucao mais agressiva de complementacao.',
            mesmaFaixaPopulacional: true,
            insight:
                'A comparacao sugere espaco para qualificar base e condicionalidades.',
            populacao: 32200,
            totalReceitasFundeb: 28900000,
            totalMatriculas: 7620,
            complementacaoUniaoTotal: 4610000,
            vantagemReceita: 3290000,
            vantagemComplementacao: 340000,
          ),
        ],
      ),
    );

    return LevantamentoFundebBundle(
      relatorio: relatorio,
      ibgePerfil: const IbgeMunicipioPerfil(
        areaTerritorial: 966.99,
        areaAnoReferencia: '2025',
        populacaoUltimoCenso: 34952,
        populacaoUltimoCensoAnoReferencia: '2022',
        densidadeDemografica: 36.15,
        densidadeAnoReferencia: '2022',
        populacaoEstimada: 35200,
        populacaoEstimadaAnoReferencia: '2025',
        escolarizacao614: 96.4,
        escolarizacaoAnoReferencia: '2022',
        idhm: 0.651,
        idhmAnoReferencia: '2010',
        mortalidadeInfantil: 18.18,
        mortalidadeAnoReferencia: '2023',
        receitasBrutasRealizadas: 69393442.1,
        receitasAnoReferencia: '2024',
        despesasBrutasEmpenhadas: 70568876.93,
        despesasAnoReferencia: '2024',
        pibPerCapita: 53846.44,
        pibAnoReferencia: '2023',
      ),
      fontes: const [
        FonteColetaStatus(
          id: 'ibge',
          label: 'IBGE',
          status: 'automatico',
          descricao:
              'Busca territorial e codigo IBGE resolvidos automaticamente.',
        ),
        FonteColetaStatus(
          id: 'fnde-siconfi',
          label: 'FNDE / SICONFI',
          status: 'estimado',
          descricao:
              'Receita FUNDEB e base fiscal consolidadas com apoio de estimativa calibrada.',
        ),
        FonteColetaStatus(
          id: 'inep-qedu',
          label: 'INEP / QEdu',
          status: 'automatico',
          descricao:
              'Censo escolar e indicadores de aprendizagem integrados pela base interna.',
        ),
        FonteColetaStatus(
          id: 'simec',
          label: 'MEC / FNDE operacional',
          status: 'manual',
          descricao: 'Parte operacional ainda depende de fechamento assistido.',
        ),
      ],
      relatorioDirigidoBase: dirigido,
    );
  }

  // ── Slides module ──

  @override
  Future<List<SlideTemplate>> getSlideTemplates() async {
    return defaultSlideTemplates;
  }

  @override
  Future<Uint8List> generateSlidesPdf(
    String templateId, {
    String? codigoIbge,
  }) async {
    // Mock returns empty bytes; real impl calls backend
    return Uint8List(0);
  }
}
