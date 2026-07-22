import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../../../core/utils/file_saver.dart';

import '../../../core/models/levantamento_fundeb_models.dart';
import '../../../core/models/sync_models.dart';
import '../../../core/repositories/sync_repository.dart';
import '../../../core/repositories/mock_sync_repository.dart';
import '../../shared/presentation/shared_widgets.dart';

class ContratoCapaCapaScreen extends StatefulWidget {
  const ContratoCapaCapaScreen({
    super.key,
    required this.repository,
    required this.module,
    required this.onBack,
  });

  final SyncRepository repository;
  final ModuleDefinition module;
  final VoidCallback onBack;

  @override
  State<ContratoCapaCapaScreen> createState() => _ContratoCapaCapaScreenState();
}

class _ContratoCapaCapaScreenState extends State<ContratoCapaCapaScreen> with SingleTickerProviderStateMixin {
  // Stepper state
  int _currentStep = 0;
  int _activePreviewTab = 0;
  bool _isSaving = false;

  // Search and suggestions state
  final searchController = TextEditingController();
  List<MunicipioSearchItem> suggestions = const <MunicipioSearchItem>[];
  Timer? searchDebounce;
  bool isSearching = false;
  bool isAutofilling = false;
  String? autofillMessage;
  int searchRequestToken = 0;

  // State flags for kit generation
  bool isGeneratingKit = false;
  String generationProgressMessage = '';

  // Habilitação categories (automatic from backend - contratos/Habilitacao_PRIME/)
  static const _categoriasHabilitacao = <({String titulo, String subtitulo, IconData icon, Color cor, int qtd})>[
    (titulo: 'Societário', subtitulo: 'Contrato Social, Alterações, CNPJ, Alvará', icon: LucideIcons.building2, cor: Color(0xFF3B82F6), qtd: 9),
    (titulo: 'Certidões', subtitulo: 'CND Federal, Estadual, Municipal, FGTS, Trabalhista', icon: LucideIcons.shieldCheck, cor: Color(0xFF10B981), qtd: 10),
    (titulo: 'Atestados', subtitulo: 'Atestados de capacidade técnica e formulários', icon: LucideIcons.award, cor: Color(0xFF8B5CF6), qtd: 3),
    (titulo: 'Contratos Referência', subtitulo: 'Contratos anteriores, aditivos de serviço', icon: LucideIcons.fileText, cor: Color(0xFFF59E0B), qtd: 8),
    (titulo: 'Notas Fiscais', subtitulo: 'NFs de prestação de serviço executados', icon: LucideIcons.receipt, cor: Color(0xFFEF4444), qtd: 13),
    (titulo: 'Proposta', subtitulo: 'Agora gerada dinâmicamente como DOCX', icon: LucideIcons.fileSpreadsheet, cor: Color(0xFF06B6D4), qtd: 0),
    (titulo: 'Docs dos Sócios', subtitulo: 'CNH, Procuração dos representantes', icon: LucideIcons.userCheck, cor: Color(0xFFEC4899), qtd: 3),
    (titulo: 'Qualificação Econômica', subtitulo: 'Balanço Patrimonial, DRE, Livro Diário', icon: LucideIcons.trendingUp, cor: Color(0xFF6366F1), qtd: 3),
    (titulo: 'Idoneidade', subtitulo: 'Improbidade PJ/PF, Inidôneos TCU', icon: LucideIcons.scale, cor: Color(0xFF78716C), qtd: 6),
  ];

  // --- TEXT CONTROLLERS FOR ALL 45+ MODULAR VARIABLES ---
  
  // Tab 1: Prefeitura / Contratante
  final municipioNomeController = TextEditingController();
  final municipioUFController = TextEditingController();
  final municipioCNPJController = TextEditingController();
  final municipioEnderecoController = TextEditingController();
  final municipioCEPController = TextEditingController();
  final fundoCNPJController = TextEditingController();
  final fundoNomeController = TextEditingController();
  final prefeitoNomeController = TextEditingController();
  final prefeitoNacionalidadeController = TextEditingController();
  final prefeitoRGController = TextEditingController();
  final prefeitoCPFController = TextEditingController();
  final prefeitoEstadoCivilController = TextEditingController();
  final prefeitoEnderecoController = TextEditingController();

  // Tab 2: Empresa / Contratada
  final empresaRazaoSocialController = TextEditingController();
  final empresaCNPJController = TextEditingController();
  final empresaEnderecoController = TextEditingController();
  final empresaCidadeController = TextEditingController();
  final empresaUFController = TextEditingController();
  final empresaCEPController = TextEditingController();
  final representanteNomeController = TextEditingController();
  final representanteCPFController = TextEditingController();
  final representanteRGController = TextEditingController();
  final representanteOrgaoExpController = TextEditingController();
  final representanteNacionalidadeController = TextEditingController();
  final representanteEstadoCivilController = TextEditingController();
  final representanteQualificacaoController = TextEditingController();

  // Tab 3: Processo & Dotação
  final processoNumeroController = TextEditingController();
  final inexigibilidadeNumeroController = TextEditingController();
  final contratoNumeroController = TextEditingController();
  final exercicioController = TextEditingController();
  final baseLegalController = TextEditingController();
  final dataProcessoController = TextEditingController();
  final dotacaoUnidadeController = TextEditingController();
  final dotacaoAtividadeController = TextEditingController();
  final dotacaoElementoController = TextEditingController();
  final dotacaoFonteController = TextEditingController();
  final assessorJuridicoNomeController = TextEditingController();
  final assessorJuridicoOABController = TextEditingController();
  final agenteContratacaoNomeController = TextEditingController();
  final agenteContratacaoDecretoController = TextEditingController();
  final secretarioNomeController = TextEditingController();
  final secretarioDecretoController = TextEditingController();
  final fiscalNomeController = TextEditingController();
  final fiscalPortariaController = TextEditingController();
  final fiscalCargoController = TextEditingController();

  // Tab 4: Valores, Datas e Comarca
  final valorMensalController = TextEditingController();
  final quantidadeMesesController = TextEditingController();
  final valorGlobalController = TextEditingController(); // calculated / read-only
  final valorMensalExtensoController = TextEditingController(); // calculated / read-only
  final valorGlobalExtensoController = TextEditingController(); // calculated / read-only
  final percentualInsumosController = TextEditingController();
  final percentualPessoalController = TextEditingController(); // calculated / read-only
  final dataSolicitacaoController = TextEditingController();
  final dataParecerJuridicoController = TextEditingController();
  final dataRatificacaoController = TextEditingController();
  final dataHomologacaoController = TextEditingController();
  final dataAssinaturaController = TextEditingController();
  final vigenciaInicioController = TextEditingController();
  final vigenciaFimController = TextEditingController();
  final foroComarcaController = TextEditingController();
  final foroUFController = TextEditingController();

  // Utility formatters
  final DateFormat _dateFormat = DateFormat('dd/MM/yyyy', 'pt_BR');
  final NumberFormat _money = NumberFormat.currency(
    locale: 'pt_BR',
    symbol: 'R\$',
  );

  @override
  void initState() {
    super.initState();
    _loadInitialSampleData();
    
    // Add real-time re-calculation listeners
    valorMensalController.addListener(_onFinanceChanged);
    quantidadeMesesController.addListener(_onFinanceChanged);
    percentualInsumosController.addListener(_onFinanceChanged);
  }

  @override
  void dispose() {
    searchDebounce?.cancel();
    searchController.dispose();

    // Dispose all 45+ controllers
    municipioNomeController.dispose();
    municipioUFController.dispose();
    municipioCNPJController.dispose();
    municipioEnderecoController.dispose();
    municipioCEPController.dispose();
    fundoCNPJController.dispose();
    fundoNomeController.dispose();
    prefeitoNomeController.dispose();
    prefeitoNacionalidadeController.dispose();
    prefeitoRGController.dispose();
    prefeitoCPFController.dispose();
    prefeitoEstadoCivilController.dispose();
    prefeitoEnderecoController.dispose();

    empresaRazaoSocialController.dispose();
    empresaCNPJController.dispose();
    empresaEnderecoController.dispose();
    empresaCidadeController.dispose();
    empresaUFController.dispose();
    empresaCEPController.dispose();
    representanteNomeController.dispose();
    representanteCPFController.dispose();
    representanteRGController.dispose();
    representanteOrgaoExpController.dispose();
    representanteNacionalidadeController.dispose();
    representanteEstadoCivilController.dispose();
    representanteQualificacaoController.dispose();

    processoNumeroController.dispose();
    inexigibilidadeNumeroController.dispose();
    contratoNumeroController.dispose();
    exercicioController.dispose();
    baseLegalController.dispose();
    dataProcessoController.dispose();
    dotacaoUnidadeController.dispose();
    dotacaoAtividadeController.dispose();
    dotacaoElementoController.dispose();
    dotacaoFonteController.dispose();
    assessorJuridicoNomeController.dispose();
    assessorJuridicoOABController.dispose();
    agenteContratacaoNomeController.dispose();
    agenteContratacaoDecretoController.dispose();
    secretarioNomeController.dispose();
    secretarioDecretoController.dispose();
    fiscalNomeController.dispose();
    fiscalPortariaController.dispose();
    fiscalCargoController.dispose();

    valorMensalController.dispose();
    quantidadeMesesController.dispose();
    valorGlobalController.dispose();
    valorMensalExtensoController.dispose();
    valorGlobalExtensoController.dispose();
    percentualInsumosController.dispose();
    percentualPessoalController.dispose();
    dataSolicitacaoController.dispose();
    dataParecerJuridicoController.dispose();
    dataRatificacaoController.dispose();
    dataHomologacaoController.dispose();
    dataAssinaturaController.dispose();
    vigenciaInicioController.dispose();
    vigenciaFimController.dispose();
    foroComarcaController.dispose();
    foroUFController.dispose();

    super.dispose();
  }

  // --- INITIAL SAMPLE DATA PRESET (No hardcoded Seropédica/Rocha Prime references) ---
  String _formatDatePtBr(DateTime date) {
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    return '${date.day.toString().padLeft(2, '0')} de ${meses[date.month - 1]} de ${date.year}';
  }

  Future<void> _buscarCnpj(String cnpjText, {bool isPrefeitura = false, bool isEmpresa = false}) async {
    final cnpj = cnpjText.replaceAll(RegExp(r'[^0-9]'), '');
    if (cnpj.length != 14) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CNPJ inválido para busca. Digite os 14 números.')));
      return;
    }
    
    setState(() => _isSaving = true);
    try {
      final response = await http.get(Uri.parse('https://brasilapi.com.br/api/cnpj/v1/$cnpj'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          final logradouro = data['logradouro'] ?? '';
          final numero = data['numero'] ?? '';
          final bairro = data['bairro'] ?? '';
          final ceps = data['cep'] ?? '';
          final uf = data['uf'] ?? '';
          final municipio = data['municipio'] ?? '';
          final razao = data['razao_social'] ?? '';
          
          final addressString = '$logradouro, $numero, $bairro';
          final cepString = ceps.length == 8 ? '${ceps.substring(0,5)}-${ceps.substring(5)}' : ceps;

          if (isPrefeitura) {
            municipioEnderecoController.text = addressString;
            municipioCEPController.text = cepString;
            if (municipioNomeController.text.isEmpty) municipioNomeController.text = municipio;
            if (municipioUFController.text.isEmpty) municipioUFController.text = uf;
          } else if (isEmpresa) {
            empresaRazaoSocialController.text = razao;
            empresaEnderecoController.text = addressString;
            empresaCEPController.text = cepString;
            empresaCidadeController.text = municipio;
            empresaUFController.text = uf;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Dados importados com sucesso!')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CNPJ não encontrado na base de dados.')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao buscar CNPJ. Verifique sua conexão.')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  void _loadInitialSampleData() {
    final currentYear = DateTime.now().year;

    // Prefeitura
    municipioNomeController.text = "Leme";
    municipioUFController.text = "SP";
    municipioCNPJController.text = "46.362.661/0001-44";
    municipioEnderecoController.text = "Praça Manoel Leme, 36, Centro";
    municipioCEPController.text = "13610-210";
    fundoCNPJController.text = "10.222.333/0001-88";
    fundoNomeController.text = "Fundo Municipal de Educação de Leme";
    prefeitoNomeController.text = "Claudemir Borges";
    prefeitoNacionalidadeController.text = "brasileiro";
    prefeitoRGController.text = "12.345.678-9";
    prefeitoCPFController.text = "123.456.789-00";
    prefeitoEstadoCivilController.text = "casado";
    prefeitoEnderecoController.text = "Av. 29 de Agosto, 100, Centro, Leme/SP";

    // Contratada
    empresaRazaoSocialController.text = "ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA";
    empresaCNPJController.text = "29.342.691/0001-93";
    empresaEnderecoController.text = "Rua Riachão, 23, Bairro Caripare";
    empresaCidadeController.text = "Riachão das Neves";
    empresaUFController.text = "BA";
    empresaCEPController.text = "47.970-000";
    representanteNomeController.text = "Paulo Ferreira da Rocha";
    representanteCPFController.text = "014.815.995-85";
    representanteRGController.text = "984391703";
    representanteOrgaoExpController.text = "SSP/BA";
    representanteNacionalidadeController.text = "brasileiro";
    representanteEstadoCivilController.text = "casado";
    representanteQualificacaoController.text = "Sócio-Administrador";

    // Processo & Dotação
    processoNumeroController.text = "PA-2026/045";
    inexigibilidadeNumeroController.text = "INEX-005/2026";
    contratoNumeroController.text = "CONT-012/2026";
    exercicioController.text = currentYear.toString();
    baseLegalController.text = 'Art. 74, inciso III, alínea "f", da Lei Federal nº 14.133/2021';
    dataProcessoController.text = currentYear.toString();
    dotacaoUnidadeController.text = "02.08 SECRETARIA MUNICIPAL DE EDUCAÇÃO";
    dotacaoAtividadeController.text = "12.361.0010.2.030 Manutenção e Desenvolvimento do Ensino";
    dotacaoElementoController.text = "3.3.90.39.00 Outros Serviços de Terceiros - Pessoa Jurídica";
    dotacaoFonteController.text = "1.540.0000 Transferências do FUNDEB - Impostos e Transf. de Impostos";

    // Equipe
    secretarioNomeController.text = "Rita de Cássia S. M. de Oliveira";
    secretarioDecretoController.text = "Decreto nº 4.567/2025";
    fiscalNomeController.text = "Marcos Antônio Barbosa";
    fiscalPortariaController.text = "Portaria nº 890/2026";
    fiscalCargoController.text = "Supervisor de Ensino";
    assessorJuridicoNomeController.text = "Dr. Roberto de Souza Pinto";
    assessorJuridicoOABController.text = "123.456/SP";
    agenteContratacaoNomeController.text = "Mariana Silveira Mendes";
    agenteContratacaoDecretoController.text = "Decreto nº 1.234/2026";

    // Valores & Datas
    valorMensalController.text = "27500";
    quantidadeMesesController.text = "12";
    percentualInsumosController.text = "40";
    
    final now = DateTime.now();
    dataSolicitacaoController.text = _formatDatePtBr(now);
    dataParecerJuridicoController.text = _formatDatePtBr(now.add(const Duration(days: 5)));
    dataRatificacaoController.text = _formatDatePtBr(now.add(const Duration(days: 8)));
    dataHomologacaoController.text = _formatDatePtBr(now.add(const Duration(days: 10)));
    dataAssinaturaController.text = _formatDatePtBr(now.add(const Duration(days: 12)));
    vigenciaInicioController.text = "01/02/$currentYear";
    vigenciaFimController.text = "31/01/${currentYear + 1}";
    foroComarcaController.text = "Leme";
    foroUFController.text = "SP";

    _onFinanceChanged();
  }

  // --- REAL-TIME CALCULATION AND POR EXTENSO HELPER ---
  void _onFinanceChanged() {
    final rawMensal = valorMensalController.text.replaceAll('.', '').replaceAll(',', '.');
    final valorMensal = double.tryParse(rawMensal) ?? 0.0;
    final quantidadeMeses = int.tryParse(quantidadeMesesController.text) ?? 0;
    final valorGlobal = valorMensal * quantidadeMeses;

    final insumosText = percentualInsumosController.text;
    final percentualInsumos = double.tryParse(insumosText.replaceAll(',', '.')) ?? 0.0;
    final percentualPessoal = (100.0 - percentualInsumos).clamp(0.0, 100.0);

    setState(() {
      // Avoid loops by checking if text is already identical
      final globalStr = valorGlobal.toStringAsFixed(2).replaceAll('.', ',');
      if (valorGlobalController.text != globalStr) {
        valorGlobalController.text = globalStr;
      }
      
      final pessoalStr = percentualPessoal.toStringAsFixed(0);
      if (percentualPessoalController.text != pessoalStr) {
        percentualPessoalController.text = pessoalStr;
      }

      final extensoMensal = valorParaExtenso(valorMensal);
      if (valorMensalExtensoController.text != extensoMensal) {
        valorMensalExtensoController.text = extensoMensal;
      }

      final extensoGlobal = valorParaExtenso(valorGlobal);
      if (valorGlobalExtensoController.text != extensoGlobal) {
        valorGlobalExtensoController.text = extensoGlobal;
      }
    });
  }

  // Pure Dart converter from double currency to Portuguese extenso words
  String valorParaExtenso(double valor) {
    if (valor <= 0) return 'zero reais';
    
    final int centavos = ((valor - valor.floor()) * 100).round();
    final int reais = valor.floor();
    
    final parts = <String>[];
    
    if (reais > 0) {
      parts.add('${_converterInteiro(reais)} ${reais == 1 ? 'real' : 'reais'}');
    }
    
    if (centavos > 0) {
      parts.add('${_converterInteiro(centavos)} ${centavos == 1 ? 'centavo' : 'centavos'}');
    }
    
    return parts.join(' e ');
  }

  String _converterInteiro(int numero) {
    if (numero == 0) return 'zero';
    final unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    final dezenas1 = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    final dezenas2 = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    final centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    if (numero < 10) return unidades[numero];
    if (numero < 20) return dezenas1[numero - 10];
    if (numero < 100) {
      final d = numero ~/ 10;
      final u = numero % 10;
      return u == 0 ? dezenas2[d] : '${dezenas2[d]} e ${unidades[u]}';
    }
    if (numero == 100) return 'cem';
    if (numero < 1000) {
      final c = numero ~/ 100;
      final resto = numero % 100;
      return resto == 0 ? centenas[c] : '${centenas[c]} e ${_converterInteiro(resto)}';
    }
    if (numero < 1000000) {
      final mil = numero ~/ 1000;
      final resto = numero % 1000;
      final milText = mil == 1 ? 'um mil' : '${_converterInteiro(mil)} mil';
      if (resto == 0) return milText;
      final sep = (resto < 100 || resto % 100 == 0) ? ' e ' : ' ';
      return '$milText$sep${_converterInteiro(resto)}';
    }
    if (numero < 1000000000) {
      final milhao = numero ~/ 1000000;
      final resto = numero % 1000000;
      final milhaoText = milhao == 1 ? 'um milhão' : '${_converterInteiro(milhao)} milhões';
      if (resto == 0) return milhaoText;
      final sep = (resto < 100 || resto % 100 == 0) ? ' e ' : ' ';
      return '$milhaoText$sep${_converterInteiro(resto)}';
    }
    return numero.toString();
  }

  // --- PREFILL AND SEARCH AUTOFILL ---
  void _scheduleMunicipioSearch() {
    searchDebounce?.cancel();
    final query = searchController.text.trim();
    if (query.length < 2) {
      setState(() {
        suggestions = const <MunicipioSearchItem>[];
        isSearching = false;
      });
      return;
    }
    searchDebounce = Timer(
      const Duration(milliseconds: 280),
      _searchMunicipios,
    );
  }

  Future<void> _searchMunicipios() async {
    final query = searchController.text.trim();
    if (query.length < 2) return;
    final requestToken = ++searchRequestToken;
    setState(() => isSearching = true);
    try {
      final result = await widget.repository.searchMunicipios(query);
      if (!mounted || requestToken != searchRequestToken) return;
      setState(() => suggestions = result);
    } catch (error) {
      if (!mounted || requestToken != searchRequestToken) return;
      setState(() {
        suggestions = const <MunicipioSearchItem>[];
        autofillMessage = 'Erro na busca: $error';
      });
    } finally {
      if (mounted && requestToken == searchRequestToken) {
        setState(() => isSearching = false);
      }
    }
  }

  void _selectSuggestion(MunicipioSearchItem item) {
    setState(() {
      searchController.text = '${item.nome}/${item.uf}';
      suggestions = const <MunicipioSearchItem>[];
      autofillMessage = '${item.nome}/${item.uf} selecionado. Clique em Preencher.';
    });
  }

  Future<void> _autofillFromSync() async {
    final query = searchController.text.trim();
    if (query.isEmpty) {
      _showSnackBar('Informe um município no campo de busca acima.');
      return;
    }

    final parts = query.split('/');
    final nome = parts[0].trim();
    final uf = parts.length > 1 ? parts[1].trim() : '';

    setState(() {
      isAutofilling = true;
      autofillMessage = '🤖 Agente IA buscando dados em diários oficiais, IBGE, TSE...';
    });

    final currentYear = DateTime.now().year;
    final body = <String, dynamic>{
      'municipioNome': nome,
      'uf': uf,
      'exercicio': currentYear,
      'valorMensal': double.tryParse(valorMensalController.text.replaceAll('.', '').replaceAll(',', '.')) ?? 27500,
      'quantidadeMeses': int.tryParse(quantidadeMesesController.text) ?? 12,
    };

    // Timer de progresso para feedback visual (IA pode levar ~60s)
    final progressMessages = [
      '🤖 Agente IA buscando dados em diários oficiais, IBGE, TSE...',
      '🔍 Pesquisando CNPJ da Prefeitura e do Fundo Municipal de Educação...',
      '📋 Buscando secretário de educação, fiscal e assessor jurídico...',
      '📊 Consultando dotação orçamentária na LOA do município...',
      '✨ Finalizando análise e validando dados encontrados...',
    ];
    var progressIndex = 0;
    final progressTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (mounted && isAutofilling) {
        progressIndex = (progressIndex + 1).clamp(0, progressMessages.length - 1);
        setState(() => autofillMessage = progressMessages[progressIndex]);
      }
    });

    try {
      // 1. Attempt calling the AI Agent route (OpenRouter/Qwen 3.7 Plus)
      final response = await widget.repository.obterDadosContratoFundeb(body);
      if (!mounted) return;
      
      if (response['success'] == true && response['contrato'] != null) {
        final contratoJson = response['contrato'] as Map<String, dynamic>;
        
        // Flatten nested structure → flat keys for _applyContractJson
        final flat = _flattenContratoResponse(contratoJson);
        _applyContractJson(flat);
        
        // Use agent stats if available, otherwise compute from metas
        final stats = response['stats'] as Map<String, dynamic>?;
        final warnings = (response['warnings'] as List<dynamic>?) ?? [];
        
        int pct;
        int viaIA;
        if (stats != null) {
          pct = (stats['percentualPreenchido'] as num?)?.toInt() ?? 0;
          viaIA = (stats['preenchidoIA'] as num?)?.toInt() ?? 0;
        } else {
          final metasList = (response['metas'] as List<dynamic>?) ?? [];
          final totalCampos = metasList.length;
          final preenchidos = metasList.where((m) {
            final st = (m as Map<String, dynamic>)['status']?.toString() ?? '';
            return st.startsWith('preenchido') || st == 'auto-inferido' || st == 'auto-calculado';
          }).length;
          pct = totalCampos > 0 ? ((preenchidos / totalCampos) * 100).round() : 0;
          viaIA = 0;
        }
        
        final msg = viaIA > 0
            ? '🤖 Agente IA preencheu $pct% dos campos ($viaIA via IA)'
            : '✅ Preenchimento automático via IBGE/TSE ($pct% concluído)';
        _showSnackBar(msg);
        
        setState(() {
          autofillMessage = warnings.isNotEmpty
              ? '$msg — ${warnings.length} campo(s) precisam de revisão manual'
              : msg;
          _currentStep = 0; // Jump to start of Wizard
        });
      } else {
        throw Exception(response['error'] ?? 'Dados inválidos.');
      }
    } catch (error) {
      // 2. Fallback to standard getLevantamentoFundeb bundle
      debugPrint('Custom API failed or offline: $error. Falling back to SICONFI bundle...');
      try {
        final req = MunicipioLookupRequest(
          nome: nome,
          uf: uf,
          exercicio: currentYear,
        );
        final bundle = await widget.repository.getLevantamentoFundeb(req);
        if (!mounted) return;

        _applyFundebBundle(bundle);
        _showSnackBar('Preenchido com sucesso via levantamento FUNDEB (Fallback).');
        setState(() {
          autofillMessage = 'Preenchido $nome/$uf via dados analíticos do FUNDEB.';
          _currentStep = 0;
        });
      } catch (fallbackError) {
        if (!mounted) return;
        setState(() => autofillMessage = 'Nenhuma base encontrada para "$nome": $fallbackError');
        _showSnackBar('Município não localizado em nossas bases SICONFI/IBGE.');
      }
    } finally {
      progressTimer.cancel();
      if (mounted) {
        setState(() => isAutofilling = false);
      }
    }
  }

  /// Flatten the nested ContratoFundebDados structure into flat keys
  /// that _applyContractJson expects.
  /// Backend returns: { identificacao: {...}, contratante: {...}, contratado: {...}, valor: {...}, foro: {...} }
  /// Flutter expects: { municipioNome: "...", prefeitoNome: "...", ... }
  Map<String, dynamic> _flattenContratoResponse(Map<String, dynamic> nested) {
    final flat = <String, dynamic>{};

    // Identificacao
    final ident = nested['identificacao'] as Map<String, dynamic>?;
    if (ident != null) {
      flat['contratoNumero'] = ident['contratoNumero'];
      // Backend dates use dd.MM.yyyy format, convert to dd/MM/yyyy
      flat['dataAssinatura'] = _convertDotDate(ident['dataAssinatura']?.toString());
      flat['vigenciaInicio'] = _convertDotDate(ident['vigenciaInicio']?.toString());
      flat['vigenciaFim'] = _convertDotDate(ident['vigenciaFim']?.toString());
      flat['processoNumero'] = ident['processoNumero'];
    }

    // Contratante
    final contratante = nested['contratante'] as Map<String, dynamic>?;
    if (contratante != null) {
      flat['municipioNome'] = contratante['municipioNome'];
      // Backend sends full state name (e.g. "Mato Grosso") via estadoBySigla()
      // but Flutter form expects the 2-letter sigla ("MT").
      final rawEstado = contratante['municipioEstado']?.toString() ?? '';
      flat['municipioUF'] = _estadoToSigla(rawEstado);
      flat['municipioCNPJ'] = contratante['municipioCNPJ'];
      flat['municipioEndereco'] = contratante['municipioEndereco'];
      flat['municipioCEP'] = contratante['municipioCEP'];
      flat['prefeitoNome'] = contratante['prefeitoNome'];
      flat['prefeitoNacionalidade'] = contratante['prefeitoNacionalidade'];
      flat['prefeitoRG'] = contratante['prefeitoRG'];
      flat['prefeitoCPF'] = contratante['prefeitoCPF'];
      flat['prefeitoEstadoCivil'] = null; // not in backend yet
      flat['prefeitoEndereco'] = contratante['prefeitoEndereco'];
      flat['fundoCNPJ'] = contratante['fundoMunicipalCNPJ'];
      flat['fundoNome'] = contratante['fundoMunicipalNome'];
    }

    // Contratado
    final contratado = nested['contratado'] as Map<String, dynamic>?;
    if (contratado != null) {
      flat['empresaRazaoSocial'] = contratado['empresaRazaoSocial'];
      flat['empresaCNPJ'] = contratado['empresaCNPJ'];
      flat['empresaEndereco'] = contratado['empresaEndereco'];
      flat['empresaCidade'] = contratado['empresaCidade'];
      flat['empresaUF'] = null; // extract from address
      flat['empresaCEP'] = contratado['empresaCEP'];
      flat['representanteNome'] = contratado['representanteNome'];
      flat['representanteCPF'] = contratado['representanteCPF'];
      flat['representanteQualificacao'] = contratado['representanteQualificacao'];
    }

    // Valor
    final valor = nested['valor'] as Map<String, dynamic>?;
    if (valor != null) {
      flat['valorMensal'] = valor['valorMensal']?.toString();
      flat['quantidadeMeses'] = valor['quantidadeMeses']?.toString();
    }

    // Foro
    final foro = nested['foro'] as Map<String, dynamic>?;
    if (foro != null) {
      flat['foroComarca'] = foro['comarca'];
      flat['foroUF'] = foro['estado'];
    }

    // Dotacao (if present)
    final dotacao = nested['dotacaoOrcamentaria'] as Map<String, dynamic>?;
    if (dotacao != null) {
      final unidades = dotacao['unidadesExecutoras'] as List<dynamic>?;
      if (unidades != null && unidades.isNotEmpty) {
        flat['dotacaoUnidade'] = unidades.first;
      }
      final funcionais = dotacao['funcionais'] as List<dynamic>?;
      if (funcionais != null && funcionais.isNotEmpty) {
        flat['dotacaoAtividade'] = funcionais.first;
      }
      flat['dotacaoElemento'] = dotacao['elementoDespesa'];
      final fontes = dotacao['fontesRecursos'] as List<dynamic>?;
      if (fontes != null && fontes.isNotEmpty) {
        flat['dotacaoFonte'] = fontes.first;
      }
    }

    // If flat keys are missing, also try reading flat keys directly (in case
    // backend sends flat response from AI agent route)
    for (final key in nested.keys) {
      if (!flat.containsKey(key) && nested[key] is! Map && nested[key] is! List) {
        flat[key] = nested[key];
      }
    }

    return flat;
  }

  /// Reverse-map full state name (e.g. "Mato Grosso") to sigla ("MT").
  /// If the input is already a 2-letter code, returns it as-is.
  static String _estadoToSigla(String estado) {
    if (estado.length <= 2) return estado.toUpperCase();
    const mapa = <String, String>{
      'acre': 'AC', 'alagoas': 'AL', 'amazonas': 'AM', 'amapá': 'AP',
      'bahia': 'BA', 'ceará': 'CE', 'distrito federal': 'DF',
      'espírito santo': 'ES', 'goiás': 'GO', 'maranhão': 'MA',
      'minas gerais': 'MG', 'mato grosso do sul': 'MS', 'mato grosso': 'MT',
      'pará': 'PA', 'paraíba': 'PB', 'pernambuco': 'PE', 'piauí': 'PI',
      'paraná': 'PR', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
      'rondônia': 'RO', 'roraima': 'RR', 'rio grande do sul': 'RS',
      'santa catarina': 'SC', 'sergipe': 'SE', 'são paulo': 'SP',
      'tocantins': 'TO',
    };
    return mapa[estado.toLowerCase()] ?? estado;
  }

  /// Convert backend date format "dd.MM.yyyy" → "dd/MM/yyyy".
  /// If already in slash format or null, returns as-is.
  static String? _convertDotDate(String? date) {
    if (date == null || date.isEmpty) return null;
    // dd.MM.yyyy → dd/MM/yyyy
    if (date.contains('.') && !date.contains('/')) {
      return date.replaceAll('.', '/');
    }
    return date;
  }

  void _applyContractJson(Map<String, dynamic> c) {
    setState(() {
      municipioNomeController.text = c['municipioNome']?.toString() ?? '';
      municipioUFController.text = c['municipioUF']?.toString() ?? '';
      municipioCNPJController.text = c['municipioCNPJ']?.toString() ?? 'CNPJ a confirmar';
      municipioEnderecoController.text = c['municipioEndereco']?.toString() ?? 'Praça da Prefeitura, s/n';
      municipioCEPController.text = c['municipioCEP']?.toString() ?? '00000-000';
      fundoCNPJController.text = c['fundoCNPJ']?.toString() ?? 'CNPJ a confirmar';
      fundoNomeController.text = c['fundoNome']?.toString() ?? 'Fundo Municipal de Educação';
      prefeitoNomeController.text = c['prefeitoNome']?.toString() ?? '';
      prefeitoNacionalidadeController.text = c['prefeitoNacionalidade']?.toString() ?? 'brasileiro(a)';
      prefeitoRGController.text = c['prefeitoRG']?.toString() ?? '';
      prefeitoCPFController.text = c['prefeitoCPF']?.toString() ?? '';
      prefeitoEstadoCivilController.text = c['prefeitoEstadoCivil']?.toString() ?? 'casado(a)';
      prefeitoEnderecoController.text = c['prefeitoEndereco']?.toString() ?? 'Residência oficial do Prefeito';

      secretarioNomeController.text = c['secretarioNome']?.toString() ?? '';
      secretarioDecretoController.text = c['secretarioDecreto']?.toString() ?? 'Decreto de Nomeação';
      fiscalNomeController.text = c['fiscalNome']?.toString() ?? '';
      fiscalPortariaController.text = c['fiscalPortaria']?.toString() ?? 'Portaria de Designação';
      fiscalCargoController.text = c['fiscalCargo']?.toString() ?? 'Servidor Público';
      
      assessorJuridicoNomeController.text = c['assessorJuridicoNome']?.toString() ?? 'Dr. Procurador Geral';
      assessorJuridicoOABController.text = c['assessorJuridicoOAB']?.toString() ?? '123.456/OAB';
      agenteContratacaoNomeController.text = c['agenteContratacaoNome']?.toString() ?? 'Presidente da CPL';
      agenteContratacaoDecretoController.text = c['agenteContratacaoDecreto']?.toString() ?? 'Decreto de Nomeação da CPL';

      // Keep Contratada defaults or load if present
      if (c['empresaRazaoSocial'] != null) {
        empresaRazaoSocialController.text = c['empresaRazaoSocial'];
        empresaCNPJController.text = c['empresaCNPJ'] ?? '';
        empresaEnderecoController.text = c['empresaEndereco'] ?? '';
        empresaCidadeController.text = c['empresaCidade'] ?? '';
        empresaUFController.text = c['empresaUF'] ?? '';
        empresaCEPController.text = c['empresaCEP'] ?? '';
        representanteNomeController.text = c['representanteNome'] ?? '';
        representanteCPFController.text = c['representanteCPF'] ?? '';
        representanteRGController.text = c['representanteRG'] ?? '';
        representanteOrgaoExpController.text = c['representanteOrgaoExp'] ?? '';
        representanteNacionalidadeController.text = c['representanteNacionalidade'] ?? '';
        representanteEstadoCivilController.text = c['representanteEstadoCivil'] ?? '';
        representanteQualificacaoController.text = c['representanteQualificacao'] ?? '';
      }

      // Process
      processoNumeroController.text = c['processoNumero']?.toString() ?? 'PA-001/2026';
      inexigibilidadeNumeroController.text = c['inexigibilidadeNumero']?.toString() ?? 'INEX-001/2026';
      contratoNumeroController.text = c['contratoNumero']?.toString() ?? 'CONT-001/2026';
      exercicioController.text = c['exercicio']?.toString() ?? DateTime.now().year.toString();
      baseLegalController.text = c['baseLegal']?.toString() ?? 'Art. 74, inciso III, alínea "f", da Lei Federal nº 14.133/2021';
      dataProcessoController.text = c['dataProcesso']?.toString() ?? DateTime.now().year.toString();

      dotacaoUnidadeController.text = c['dotacaoUnidade']?.toString() ?? '02.08 SECRETARIA MUNICIPAL DE EDUCAÇÃO';
      dotacaoAtividadeController.text = c['dotacaoAtividade']?.toString() ?? 'Manutenção das Atividades do Ensino Básico';
      dotacaoElementoController.text = c['dotacaoElemento']?.toString() ?? '3.3.90.39.00 Outros Serviços';
      dotacaoFonteController.text = c['dotacaoFonte']?.toString() ?? '1.540.0000 Transferências do FUNDEB';

      // Financials
      valorMensalController.text = c['valorMensal']?.toString() ?? '27500';
      quantidadeMesesController.text = c['quantidadeMeses']?.toString() ?? '12';
      percentualInsumosController.text = c['percentualInsumos']?.toString() ?? '40';

      // Chronological
      final now = DateTime.now();
      dataSolicitacaoController.text = c['dataSolicitacao']?.toString() ?? _formatDatePtBr(now);
      dataParecerJuridicoController.text = c['dataParecerJuridico']?.toString() ?? _formatDatePtBr(now.add(const Duration(days: 5)));
      dataRatificacaoController.text = c['dataRatificacao']?.toString() ?? _formatDatePtBr(now.add(const Duration(days: 8)));
      dataHomologacaoController.text = c['dataHomologacao']?.toString() ?? _formatDatePtBr(now.add(const Duration(days: 10)));
      dataAssinaturaController.text = c['dataAssinatura']?.toString() ?? _formatDatePtBr(now.add(const Duration(days: 12)));
      vigenciaInicioController.text = c['vigenciaInicio']?.toString() ?? '22/01/2026';
      vigenciaFimController.text = c['vigenciaFim']?.toString() ?? '31/12/2026';
      
      foroComarcaController.text = c['foroComarca']?.toString() ?? c['municipioNome']?.toString() ?? '';
      foroUFController.text = c['foroUF']?.toString() ?? c['municipioUF']?.toString() ?? '';
    });
    _onFinanceChanged();
  }

  void _applyFundebBundle(LevantamentoFundebBundle bundle) {
    final relatorio = bundle.relatorio;
    final id = relatorio.identificacao;
    final municipality = id.municipioNome.isEmpty ? id.municipio : id.municipioNome;
    final uf = id.uf;
    final prefeito = id.prefeito.trim().isEmpty ? 'Prefeito Municipal' : id.prefeito;

    setState(() {
      municipioNomeController.text = municipality;
      municipioUFController.text = uf;
      municipioCNPJController.text = "CNPJ a confirmar";
      municipioEnderecoController.text = "Praça da Prefeitura, s/n, Centro";
      municipioCEPController.text = "00000-000";
      fundoCNPJController.text = "CNPJ a confirmar";
      fundoNomeController.text = "Fundo Municipal de Educação de $municipality";
      prefeitoNomeController.text = prefeito;
      prefeitoNacionalidadeController.text = "brasileiro(a)";
      prefeitoRGController.text = "";
      prefeitoCPFController.text = "";
      prefeitoEstadoCivilController.text = "casado(a)";
      prefeitoEnderecoController.text = "Residência Oficial do Prefeito";

      processoNumeroController.text = "PA-${id.exercicio}/001";
      inexigibilidadeNumeroController.text = "INEX-${id.exercicio}/001";
      contratoNumeroController.text = "CONT-${id.exercicio}/001";
      exercicioController.text = id.exercicio.toString();
      dataProcessoController.text = id.exercicio.toString();

      foroComarcaController.text = municipality;
      foroUFController.text = uf;
    });
    _onFinanceChanged();
  }

  // --- ZIP KIT COMPILING AND BROWSER DOWNLOAD FLOW ---
  Future<void> _exportZipKit() async {
    final muni = municipioNomeController.text.trim();
    final corp = empresaRazaoSocialController.text.trim();

    if (muni.isEmpty || corp.isEmpty) {
      _showSnackBar('Preencha ao menos o Nome do Município e a Razão Social da Empresa.');
      return;
    }

    setState(() {
      isGeneratingKit = true;
      generationProgressMessage = 'Compilando Kit Completo (14 DOCXs + 55 Habilitação)...';
    });

    // Compile everything into ContratosFundebData payload
    final data = _compilePayload();

    final slug = muni
        .toLowerCase()
        .replaceAll(RegExp(r'[áàâãä]'), 'a')
        .replaceAll(RegExp(r'[éèêë]'), 'e')
        .replaceAll(RegExp(r'[íìîï]'), 'i')
        .replaceAll(RegExp(r'[óòôõö]'), 'o')
        .replaceAll(RegExp(r'[úùûü]'), 'u')
        .replaceAll(RegExp(r'[ç]'), 'c')
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');

    try {
      // 1. Gerar Kit ZIP (sem proposta)
      final zipBytes = await widget.repository.gerarKitContratosFundeb(data);

      setState(() {
        generationProgressMessage = 'Kit gerado! Gerando Proposta separada para assinatura...';
      });

      // 2. Gerar Proposta DOCX separada
      Uint8List? propostaBytes;
      try {
        propostaBytes = await widget.repository.gerarPropostaDocx(data);
      } catch (e) {
        debugPrint('Aviso: Não foi possível gerar a proposta separada: $e');
      }

      setState(() {
        generationProgressMessage = 'Downloads prontos! Salvando arquivos...';
      });

      // 3. Salvar o ZIP
      final zipFilename = 'Kit_Inexigibilidade_FUNDEB_$slug.zip';
      await saveFile(zipBytes, zipFilename);

      // 4. Salvar a Proposta separada (se gerou)
      if (propostaBytes != null && propostaBytes.isNotEmpty) {
        final propostaFilename = 'Proposta_Tecnica_Comercial_$slug.docx';
        await saveFile(propostaBytes, propostaFilename);
        _showSnackBar('✅ 2 arquivos baixados: Kit ZIP (14 DOCXs + 55 docs) + Proposta DOCX (para assinatura)');
      } else {
        _showSnackBar('✅ Kit ZIP baixado (14 DOCXs + 55 docs). Proposta não disponível — gere manualmente.');
      }
    } catch (e) {
      debugPrint('Erro ao compilar kit: $e');
      _showSnackBar('Falha na geração do lote do Kit: $e');
    } finally {
      setState(() {
        isGeneratingKit = false;
        generationProgressMessage = '';
      });
    }
  }

  Map<String, dynamic> _compilePayload() {
    final rawMensal = valorMensalController.text.replaceAll('.', '').replaceAll(',', '.');
    final rawGlobal = valorGlobalController.text.replaceAll('.', '').replaceAll(',', '.');
    final rawInsumos = percentualInsumosController.text.replaceAll(',', '.');
    final rawPessoal = percentualPessoalController.text.replaceAll(',', '.');

    final valorMensal = double.tryParse(rawMensal) ?? 0.0;
    final valorGlobal = double.tryParse(rawGlobal) ?? 0.0;

    return <String, dynamic>{
      // Processo
      'processoNumero': processoNumeroController.text,
      'inexigibilidadeNumero': inexigibilidadeNumeroController.text,
      'contratoNumero': contratoNumeroController.text,
      'exercicio': int.tryParse(exercicioController.text) ?? DateTime.now().year,
      'baseLegal': baseLegalController.text,
      'dataProcesso': dataProcessoController.text,

      // Contratante
      'municipioNome': municipioNomeController.text,
      'municipioCNPJ': municipioCNPJController.text,
      'municipioEndereco': municipioEnderecoController.text,
      'municipioCEP': municipioCEPController.text,
      'municipioUF': municipioUFController.text,
      'fundoCNPJ': fundoCNPJController.text,
      'fundoNome': fundoNomeController.text,
      'prefeitoNome': prefeitoNomeController.text,
      'prefeitoNacionalidade': prefeitoNacionalidadeController.text,
      'prefeitoRG': prefeitoRGController.text,
      'prefeitoCPF': prefeitoCPFController.text,
      'prefeitoEstadoCivil': prefeitoEstadoCivilController.text,
      'prefeitoEndereco': prefeitoEnderecoController.text,

      // Requisitante / Equipe
      'secretarioNome': secretarioNomeController.text,
      'secretarioDecreto': secretarioDecretoController.text,
      'fiscalNome': fiscalNomeController.text,
      'fiscalPortaria': fiscalPortariaController.text,
      'fiscalCargo': fiscalCargoController.text,
      'assessorJuridicoNome': assessorJuridicoNomeController.text,
      'assessorJuridicoOAB': assessorJuridicoOABController.text,
      'agenteContratacaoNome': agenteContratacaoNomeController.text,
      'agenteContratacaoDecreto': agenteContratacaoDecretoController.text,

      // Contratada
      'empresaRazaoSocial': empresaRazaoSocialController.text,
      'empresaCNPJ': empresaCNPJController.text,
      'empresaEndereco': empresaEnderecoController.text,
      'empresaCidade': empresaCidadeController.text,
      'empresaUF': empresaUFController.text,
      'empresaCEP': empresaCEPController.text,
      'representanteNome': representanteNomeController.text,
      'representanteCPF': representanteCPFController.text,
      'representanteRG': representanteRGController.text,
      'representanteOrgaoExp': representanteOrgaoExpController.text,
      'representanteNacionalidade': representanteNacionalidadeController.text,
      'representanteEstadoCivil': representanteEstadoCivilController.text,
      'representanteQualificacao': representanteQualificacaoController.text,

      // Financials
      'valorMensal': valorMensal,
      'quantidadeMeses': int.tryParse(quantidadeMesesController.text) ?? 12,
      'valorGlobal': valorGlobal,
      'valorMensalExtenso': valorMensalExtensoController.text,
      'valorGlobalExtenso': valorGlobalExtensoController.text,
      'percentualInsumos': double.tryParse(rawInsumos) ?? 40.0,
      'percentualPessoal': double.tryParse(rawPessoal) ?? 60.0,
      'dotacaoUnidade': dotacaoUnidadeController.text,
      'dotacaoAtividade': dotacaoAtividadeController.text,
      'dotacaoElemento': dotacaoElementoController.text,
      'dotacaoFonte': dotacaoFonteController.text,
      'foroComarca': foroComarcaController.text,
      'foroUF': foroUFController.text,

      // Chronological dates
      'dataSolicitacao': dataSolicitacaoController.text,
      'dataParecerJuridico': dataParecerJuridicoController.text,
      'dataRatificacao': dataRatificacaoController.text,
      'dataHomologacao': dataHomologacaoController.text,
      'dataAssinatura': dataAssinaturaController.text,
      'vigenciaInicio': vigenciaInicioController.text,
      'vigenciaFim': vigenciaFimController.text,
    };
  }



  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // --- UI BUILDING BLOCKS ---

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          SyncSectionHeader(
            title: 'Contratos Fundeb',
            description: 'Geração modular completa de processo administrativo e contrato (15 anexos) sob a Lei 14.133/21.',
            trailing: OutlinedButton.icon(
              onPressed: widget.onBack,
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Voltar ao Catálogo'),
            ),
          ),
          const SizedBox(height: 20),

          // Autocomplete SICONFI panel
          _buildSearchPanel(context),
          const SizedBox(height: 24),

          // Core Split Screen (Wizard on Left, Dynamic Preview on Right)
          LayoutBuilder(
            builder: (context, constraints) {
              final wideLayout = constraints.maxWidth >= 1150;
              final wizardWidget = _buildWizardPanel(context);
              final previewWidget = _buildPreviewPanel(context);

              if (wideLayout) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 11, child: wizardWidget),
                    const SizedBox(width: 24),
                    Expanded(flex: 8, child: previewWidget),
                  ],
                );
              }

              return Column(
                children: [
                  wizardWidget,
                  const SizedBox(height: 24),
                  previewWidget,
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  // Visual Autocomplete Search panel
  Widget _buildSearchPanel(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: SyncPalette.statusWarning.withValues(alpha: 0.35), width: 1.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            colors: [
              SyncPalette.statusWarning.withValues(alpha: 0.04),
              SyncPalette.statusWarning.withValues(alpha: 0.01),
            ],
          ),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: SyncPalette.statusWarning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(LucideIcons.sparkles, size: 18, color: SyncPalette.statusWarning),
                ),
                const SizedBox(width: 12),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Preenchimento Inteligente (IA + IBGE + TSE)',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: -0.3),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Agente IA busca dados em diários oficiais, portais de transparência e bases públicas.',
                      style: TextStyle(fontSize: 12, color: SyncPalette.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: searchController,
                    onChanged: (_) => _scheduleMunicipioSearch(),
                    decoration: InputDecoration(
                      hintText: 'Digite o nome do município (Ex: Leme, Planaltina, Salvador)...',
                      labelText: 'Município para preenchimento',
                      prefixIcon: const Icon(LucideIcons.search, size: 18),
                      suffixIcon: isSearching
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              ),
                            )
                          : null,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: isAutofilling ? null : _autofillFromSync,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  ),
                  icon: isAutofilling
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(LucideIcons.zap, size: 18),
                  label: Text(isAutofilling ? 'Importando...' : 'Preencher Ficha'),
                ),
              ],
            ),
            if (suggestions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: suggestions
                    .map(
                      (item) => ActionChip(
                        avatar: const Icon(LucideIcons.mapPin, size: 12, color: SyncPalette.statusWarning),
                        label: Text('${item.nome}/${item.uf}'),
                        onPressed: () => _selectSuggestion(item),
                      ),
                    )
                    .toList(),
              ),
            ],
            if (autofillMessage != null) ...[
              const SizedBox(height: 12),
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: SyncPalette.statusWarning.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    const Icon(LucideIcons.info, size: 14, color: SyncPalette.statusWarning),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        autofillMessage!,
                        style: TextStyle(fontSize: 12, color: Colors.orange.shade900, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // Stepper Wizard panel (Takes Left side in split layout)
  Widget _buildWizardPanel(BuildContext context) {
    return Column(
      children: [
        _buildCustomStepper(),
        const SizedBox(height: 18),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 250),
          child: _getStepContentCard(context),
        ),
        const SizedBox(height: 18),
        _buildNavigationButtons(),
      ],
    );
  }

  // Gorgeous Stepper UI
  Widget _buildCustomStepper() {
    final steps = [
      ('Contratante', LucideIcons.building2),
      ('Contratada', LucideIcons.briefcase),
      ('Processo', LucideIcons.fileText),
      ('Valores', LucideIcons.wallet),
      ('Kit ZIP', LucideIcons.download),
    ];
    
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: SyncPalette.borderSubtle),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Row(
          children: steps.asMap().entries.map((entry) {
            final idx = entry.key;
            final (label, icon) = entry.value;
            final isActive = idx == _currentStep;
            final isCompleted = idx < _currentStep;
            
            return Expanded(
              child: InkWell(
                onTap: () => setState(() => _currentStep = idx),
                borderRadius: BorderRadius.circular(8),
                child: Column(
                  children: [
                    Row(
                      children: [
                        if (idx > 0)
                          Expanded(
                            child: Container(
                              height: 2.5,
                              color: isCompleted
                                  ? SyncPalette.statusWarning
                                  : SyncPalette.borderSubtle,
                            ),
                          ),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: isActive
                                ? const LinearGradient(
                                    colors: [
                                      SyncPalette.statusWarning,
                                      Color(0xFFF1C40F),
                                    ],
                                  )
                                : null,
                            color: isActive
                                ? null
                                : (isCompleted
                                    ? SyncPalette.statusWarning.withValues(alpha: 0.15)
                                    : SyncPalette.bgSurface),
                            border: Border.all(
                              color: isActive || isCompleted
                                  ? SyncPalette.statusWarning
                                  : SyncPalette.borderSubtle,
                              width: 2.5,
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              isCompleted ? LucideIcons.check : icon,
                              size: 16,
                              color: isActive
                                  ? Colors.white
                                  : (isCompleted ? SyncPalette.statusWarning : SyncPalette.textSecondary),
                            ),
                          ),
                        ),
                        if (idx < steps.length - 1)
                          Expanded(
                            child: Container(
                              height: 2.5,
                              color: isCompleted && (idx + 1 <= _currentStep)
                                  ? SyncPalette.statusWarning
                                  : SyncPalette.borderSubtle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isActive || isCompleted
                            ? FontWeight.bold
                            : FontWeight.normal,
                        color: isActive
                            ? SyncPalette.statusWarning
                            : (isCompleted ? SyncPalette.textPrimary : SyncPalette.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // Switcher of step cards
  Widget _getStepContentCard(BuildContext context) {
    switch (_currentStep) {
      case 0:
        return _buildContratanteStep(context);
      case 1:
        return _buildContratadaStep(context);
      case 2:
        return _buildProcessoStep(context);
      case 3:
        return _buildValoresStep(context);
      case 4:
      default:
        return _buildGeracaoStep(context);
    }
  }

  // Navigation Panel (Voltar / Avançar)
  Widget _buildNavigationButtons() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (_currentStep > 0)
          OutlinedButton.icon(
            onPressed: () => setState(() => _currentStep--),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            ),
            icon: const Icon(LucideIcons.arrowLeft, size: 16),
            label: const Text('Voltar Etapa'),
          )
        else
          const SizedBox(),
        if (_currentStep < 4)
          ElevatedButton.icon(
            onPressed: () => setState(() => _currentStep++),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
            ),
            icon: const Text('Próxima Etapa'),
            label: const Icon(LucideIcons.arrowRight, size: 16),
          )
        else
          ElevatedButton.icon(
            onPressed: isGeneratingKit ? null : _exportZipKit,
            style: ElevatedButton.styleFrom(
              backgroundColor: SyncPalette.statusWarning,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 18),
            ),
            icon: isGeneratingKit
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(LucideIcons.download, size: 18, color: Colors.white),
            label: Text(
              isGeneratingKit ? 'Exportando Lote...' : 'Exportar Kit Completo (.ZIP)',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
      ],
    );
  }

  // --- STEP PANELS INDIVIDUAL IMPLEMENTATIONS ---

  Widget _buildContratanteStep(BuildContext context) {
    return Column(
      key: const ValueKey('contratante-step'),
      children: [
        _formSection(
          'Dados Institucionais do Município (Contratante)',
          LucideIcons.building,
          [
            _row([
              _field('Nome do Município', municipioNomeController),
              _field('UF do Município', municipioUFController),
            ]),
            _row([
              _field('CNPJ da Prefeitura', municipioCNPJController, 
                suffixIcon: IconButton(
                  icon: const Icon(LucideIcons.search, size: 18),
                  tooltip: "Buscar endereço pelo CNPJ",
                  onPressed: () => _buscarCnpj(municipioCNPJController.text, isPrefeitura: true),
                )
              ),
              _field('Endereço Sede da Prefeitura', municipioEnderecoController),
            ]),
            _field('CEP da Prefeitura', municipioCEPController),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Fundo Municipal de Educação',
          LucideIcons.school,
          [
            _field('Nome do Fundo Municipal', fundoNomeController),
            _field('CNPJ do Fundo de Educação', fundoCNPJController),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Representação Legal (Prefeito/a)',
          LucideIcons.userCheck,
          [
            _field('Nome do Prefeito(a) Completo', prefeitoNomeController),
            _field('Nacionalidade do Prefeito', prefeitoNacionalidadeController),
            _field('Estado Civil do Prefeito', prefeitoEstadoCivilController),
            _field('RG do Prefeito', prefeitoRGController),
            _field('CPF do Prefeito', prefeitoCPFController),
            _field('Endereço de Residência do Prefeito', prefeitoEnderecoController),
          ],
        ),
      ],
    );
  }

  Widget _buildContratadaStep(BuildContext context) {
    return Column(
      key: const ValueKey('contratada-step'),
      children: [
        _formSection(
          'Dados Institucionais da Consultoria (Contratada)',
          LucideIcons.building2,
          [
            _row([
              _field('Razão Social da Contratada', empresaRazaoSocialController),
              _field('CNPJ da Contratada', empresaCNPJController,
                suffixIcon: IconButton(
                  icon: const Icon(LucideIcons.search, size: 18),
                  tooltip: "Buscar dados pelo CNPJ",
                  onPressed: () => _buscarCnpj(empresaCNPJController.text, isEmpresa: true),
                )
              ),
            ]),
            _field('Endereço Sede da Contratada', empresaEnderecoController),
            _row([
              _field('Cidade Sede', empresaCidadeController),
              _field('UF da Sede', empresaUFController),
            ]),
            _field('CEP da Contratada', empresaCEPController),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Representante Legal da Contratada',
          LucideIcons.contact,
          [
            _field('Nome do Representante Legal', representanteNomeController),
            _field('CPF do Representante', representanteCPFController),
            _field('RG do Representante', representanteRGController),
            _field('Órgão Expedidor / UF', representanteOrgaoExpController),
            _field('Nacionalidade do Representante', representanteNacionalidadeController),
            _field('Estado Civil do Representante', representanteEstadoCivilController),
            _field('Qualificação do Representante (ex: Sócio)', representanteQualificacaoController),
          ],
        ),
      ],
    );
  }

  Widget _buildProcessoStep(BuildContext context) {
    return Column(
      key: const ValueKey('processo-step'),
      children: [
        _formSection(
          'Identificação do Processo Administrativo',
          LucideIcons.fileSpreadsheet,
          [
            _field('Número do Processo (PA)', processoNumeroController),
            _field('Número da Inexigibilidade de Licitação', inexigibilidadeNumeroController),
            _field('Número do Contrato', contratoNumeroController),
            _field('Exercício Financeiro', exercicioController),
            _field('Base Legal do Enquadramento', baseLegalController),
            _field('Data / Ano da Publicação', dataProcessoController),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Dotação Orçamentária vinculada ao Fundo/MEC',
          LucideIcons.coins,
          [
            _field('Unidade Orçamentária', dotacaoUnidadeController),
            _field('Atividade / Projeto de Despesa', dotacaoAtividadeController),
            _field('Elemento de Despesa', dotacaoElementoController),
            _field('Fonte de Recursos', dotacaoFonteController),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Equipe Responsável & Agentes Reguladores',
          LucideIcons.users,
          [
            _field('Nome do Secretário de Educação', secretarioNomeController),
            _field('Decreto Secretário de Educação', secretarioDecretoController),
            _field('Nome do Fiscal Nomeado', fiscalNomeController),
            _field('Portaria Nomeação do Fiscal', fiscalPortariaController),
            _field('Cargo Oficial do Fiscal', fiscalCargoController),
            _field('Nome do Assessor Jurídico Geral', assessorJuridicoNomeController),
            _field('Inscrição OAB do Assessor', assessorJuridicoOABController),
            _field('Nome do Agente de Contratação / CPL', agenteContratacaoNomeController),
            _field('Decreto Nomeação Agente / CPL', agenteContratacaoDecretoController),
          ],
        ),
      ],
    );
  }

  Widget _buildValoresStep(BuildContext context) {
    return Column(
      key: const ValueKey('valores-step'),
      children: [
        _formSection(
          'Parâmetros Financeiros e Econômicos',
          LucideIcons.slidersHorizontal,
          [
            _field('Valor da Parcela Mensal (R\$)', valorMensalController),
            _field('Quantidade de Meses de Prestação', quantidadeMesesController),
            _field('Valor Global da Contratação (Calculado)', valorGlobalController, enabled: false),
            _field('Porcento de Custos em Insumos (TR)', percentualInsumosController),
            _field('Porcento de Custos em Mão de Obra (Calculado)', percentualPessoalController, enabled: false),
            _field('Valor Mensal por Extenso (Calculado)', valorMensalExtensoController, enabled: false),
            _field('Valor Global por Extenso (Calculado)', valorGlobalExtensoController, enabled: false),
          ],
        ),
        const SizedBox(height: 18),
        _formSection(
          'Cronologia de Datas do Fluxo e Foro',
          LucideIcons.calendarRange,
          [
            _field('Data da Solicitação Inicial (Demanda)', dataSolicitacaoController),
            _field('Data do Parecer Jurídico Favorável', dataParecerJuridicoController),
            _field('Data do Despacho de Ratificação', dataRatificacaoController),
            _field('Data do Termo de Homologação', dataHomologacaoController),
            _field('Data da Assinatura do Contrato', dataAssinaturaController),
            _field('Data do Início de Vigência (DD/MM/AAAA)', vigenciaInicioController),
            _field('Data de Término da Vigência (DD/MM/AAAA)', vigenciaFimController),
            _field('Comarca Eleita para Foro do Contrato', foroComarcaController),
            _field('UF da Comarca do Foro', foroUFController),
          ],
        ),
      ],
    );
  }

  // Tab 5: ZIP Export Grid & progress
  Widget _buildGeracaoStep(BuildContext context) {
    final docs = [
      ('00', 'Proposta Técnica e Comercial', LucideIcons.fileSpreadsheet),
      ('01', 'Capa Administrativa do Processo', LucideIcons.fileText),
      ('02.1', 'Doc. de Formalização da Demanda (DFD)', LucideIcons.filePlus),
      ('02.2', 'Estudo Técnico Preliminar (ETP)', LucideIcons.brain),
      ('02.3', 'Termo de Referência Técnica (TR)', LucideIcons.scale),
      ('02.4', 'Memorando de Processo Administrativo', LucideIcons.clipboardList),
      ('02.5', 'Justificativa de Escolha de Fornecedor', LucideIcons.award),
      ('03', 'Solicitação de Reserva de Dotação', LucideIcons.wallet),
      ('04', 'Certidão de Resposta de Dotação', LucideIcons.shieldCheck),
      ('05', 'Encaminhamento do PA ao Prefeito', LucideIcons.send),
      ('06', 'Parecer Comissão Contratação (CPL)', LucideIcons.users),
      ('07', 'Parecer Jurídico da Inexigibilidade', LucideIcons.gavel),
      ('08', 'Despacho de Ratificação Dispensa', LucideIcons.fileCheck),
      ('09', 'Termo de Homologação e Adjudicação', LucideIcons.badgeCheck),
      ('10', 'Minuta Contrato Prestação de Assessoria', LucideIcons.penTool),
    ];

    return Card(
      key: const ValueKey('geracao-step'),
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: SyncPalette.borderSubtle),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: SyncPalette.statusWarning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(LucideIcons.folderHeart, color: SyncPalette.statusWarning, size: 22),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kit Documental Completo — 16 Minutas + 56 Docs Habilitatórios',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, letterSpacing: -0.3),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Os 16 anexos serão preenchidos com as variáveis + toda documentação habilitatória da Rocha Prime é incluída automaticamente.',
                        style: TextStyle(fontSize: 12, color: SyncPalette.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 32),

            // Grid of 15 anexos docs
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: docs.length,
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 260,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.8,
              ),
              itemBuilder: (context, index) {
                final doc = docs[index];
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: SyncPalette.bgSurface.withValues(alpha: 0.6),
                    border: Border.all(color: SyncPalette.borderSubtle),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF2C3E50).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Icon(doc.$3, size: 16, color: const Color(0xFF34495E)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Anexo ${doc.$1}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: SyncPalette.statusWarning),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              doc.$2,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, height: 1.1),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),

            // ── Documentação Habilitatória (Automática) ──
            const SizedBox(height: 28),
            const Divider(height: 1),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(LucideIcons.shieldCheck, color: Color(0xFF10B981), size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text(
                            'Documentação Habilitatória',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: -0.3),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: const Text(
                              '55 docs • Automático ✓',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF10B981)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Toda documentação abaixo é incluída automaticamente no ZIP a partir do acervo do servidor.',
                        style: TextStyle(fontSize: 12, color: SyncPalette.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Grid de categorias automáticas
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _categoriasHabilitacao.length,
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 340,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 3.2,
              ),
              itemBuilder: (context, index) {
                final cat = _categoriasHabilitacao[index];
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        cat.cor.withValues(alpha: 0.08),
                        cat.cor.withValues(alpha: 0.03),
                      ],
                    ),
                    border: Border.all(color: cat.cor.withValues(alpha: 0.25), width: 1.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              cat.cor.withValues(alpha: 0.22),
                              cat.cor.withValues(alpha: 0.10),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(9),
                          border: Border.all(color: cat.cor.withValues(alpha: 0.15)),
                        ),
                        child: Icon(cat.icon, size: 16, color: cat.cor),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              cat.titulo,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: cat.cor.withValues(alpha: 0.9),
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 1),
                            Text(
                              cat.subtitulo,
                              style: TextStyle(fontSize: 9.5, color: Colors.grey.shade600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: cat.cor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: cat.cor.withValues(alpha: 0.2)),
                        ),
                        child: Text(
                          '${cat.qtd} docs',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: cat.cor),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),

            if (isGeneratingKit) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: SyncPalette.bgSurface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: SyncPalette.statusWarning.withValues(alpha: 0.2)),
                ),
                child: Column(
                  children: [
                    const LinearProgressIndicator(color: SyncPalette.statusWarning),
                    const SizedBox(height: 12),
                    Text(
                      generationProgressMessage,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SyncPalette.textSecondary),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 24),
            // Call to Action Board
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: SyncPalette.statusWarning.withValues(alpha: 0.04),
                border: Border.all(color: SyncPalette.statusWarning.withValues(alpha: 0.15)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.fileArchive, size: 36, color: SyncPalette.statusWarning),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Exportação Completa (.ZIP) — 16 DOCXs + 55 Habilitação',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Os 15 documentos preenchidos + toda a documentação habilitatória (9 categorias) serão empacotados em um único ZIP.',
                          style: TextStyle(color: SyncPalette.textSecondary, fontSize: 11, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton.icon(
                    onPressed: isGeneratingKit ? null : _exportZipKit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: SyncPalette.statusWarning,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    ),
                    icon: isGeneratingKit
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(LucideIcons.download, size: 16, color: Colors.white),
                    label: Text(
                      isGeneratingKit ? 'Exportando...' : 'Baixar Kit Completo',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Helper form section layout
  Widget _formSection(String title, IconData icon, List<Widget> children) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: SyncPalette.borderSubtle),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: SyncPalette.statusWarning),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Column(
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  children[i],
                  if (i < children.length - 1) const SizedBox(height: 16),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(List<Widget> children) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: children.asMap().entries.map((e) => Expanded(
      child: Padding(
        padding: EdgeInsets.only(left: e.key == 0 ? 0 : 16),
        child: e.value,
      )
    )).toList(),
  );

  Widget _field(String label, TextEditingController controller, {bool enabled = true, Widget? suffixIcon}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          enabled: enabled,
          style: const TextStyle(fontSize: 14, color: Colors.black87),
          decoration: InputDecoration(
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey[300]!)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey[300]!)),
            suffixIcon: suffixIcon,
          ),
        ),
      ],
    );
  }

  // --- DYNAMIC PREVIEW PANEL IMPLEMENTATION (Right side on split layout) ---

  Widget _buildPreviewPanel(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: SyncPalette.borderSubtle),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          // Selector Tabbar inside Preview panel
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: SyncPalette.bgSurface.withValues(alpha: 0.5),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    avatar: const Icon(LucideIcons.fileBadge, size: 14),
                    label: const Text('Capa do Kit'),
                    selected: _activePreviewTab == 0,
                    onSelected: (val) {
                      if (val) setState(() => _activePreviewTab = 0);
                    },
                    showCheckmark: false,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ChoiceChip(
                    avatar: const Icon(LucideIcons.scroll, size: 14),
                    label: const Text('Minuta Contrato'),
                    selected: _activePreviewTab == 1,
                    onSelected: (val) {
                      if (val) setState(() => _activePreviewTab = 1);
                    },
                    showCheckmark: false,
                  ),
                ),
              ],
            ),
          ),
          
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            height: 520,
            padding: const EdgeInsets.all(16),
            child: _activePreviewTab == 0 ? _buildPreviewCoverCard() : _buildPreviewMinutaCard(),
          ),
        ],
      ),
    );
  }

  // Cover Card Simulation
  Widget _buildPreviewCoverCard() {
    final clientName = clientControllerText();
    final processNum = processoNumeroController.text.isNotEmpty ? processoNumeroController.text : "PA-001/2026";
    final comarca = foroComarcaController.text.isNotEmpty ? '${foroComarcaController.text} - ${foroUFController.text}' : "Local indefinido";

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F1E36), Color(0xFF1E3A65)],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFC9A354).withValues(alpha: 0.4), width: 1.5),
      ),
      padding: const EdgeInsets.all(24),
      child: Stack(
        children: [
          // Background watermarks or simulated details
          Positioned(
            right: 0,
            bottom: 0,
            child: Opacity(
              opacity: 0.1,
              child: Icon(LucideIcons.shieldCheck, size: 280, color: const Color(0xFFC9A354)),
            ),
          ),
          
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Premium Gold lines
              Container(width: 140, height: 3, color: const Color(0xFFC9A354)),
              const SizedBox(height: 28),
              
              const Text(
                'KIT DOCUMENTAL DE INEXIGIBILIDADE',
                style: TextStyle(
                  color: Color(0xFFC9A354),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2.0,
                ),
              ),
              const SizedBox(height: 8),
              
              const Text(
                'CONTRATAÇÃO DE ASSESSORIA FUNDEB',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 2),
              
              const Text(
                'LEI FEDERAL Nº 14.133/2021',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              
              const Spacer(),
              
              // Variable metadata lines mapped real-time
              _coverPreviewLine('PROCESSO ADM.', processNum),
              _coverPreviewLine('CONTRATANTE', clientName),
              _coverPreviewLine('CONTRATADA', empresaRazaoSocialController.text.isNotEmpty ? empresaRazaoSocialController.text : "A confirmar"),
              _coverPreviewLine('COMARCA DO FORO', comarca),
            ],
          ),
        ],
      ),
    );
  }

  Widget _coverPreviewLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: Color(0xFFC9A354),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.white,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  String clientControllerText() {
    if (municipioNomeController.text.isEmpty) return "Prefeitura Municipal";
    return "PREFEITURA MUNICIPAL DE ${municipioNomeController.text.toUpperCase()} - ${municipioUFController.text.toUpperCase()}";
  }

  // Scrollable simulated Minute page
  Widget _buildPreviewMinutaCard() {
    final clientName = municipioNomeController.text.isNotEmpty ? municipioNomeController.text : "MUNICÍPIO";
    final cnpj = municipioCNPJController.text.isNotEmpty ? municipioCNPJController.text : "CNPJ CONFIRMAR";
    final corpName = empresaRazaoSocialController.text.isNotEmpty ? empresaRazaoSocialController.text : "EMPRESA DE ASSESSORIA";
    final corpCnpj = empresaCNPJController.text.isNotEmpty ? empresaCNPJController.text : "CNPJ DA EMPRESA";
    final contractNum = contratoNumeroController.text.isNotEmpty ? contratoNumeroController.text : "001/2026";
    final valueMensal = valorMensalController.text.isNotEmpty ? _money.format(double.tryParse(valorMensalController.text.replaceAll('.', '').replaceAll(',', '.')) ?? 0.0) : "R\$ 0,00";
    final valueGlobal = valorGlobalController.text.isNotEmpty ? 'R\$ ${valorGlobalController.text}' : "R\$ 0,00";
    final globalExt = valorGlobalExtensoController.text.isNotEmpty ? valorGlobalExtensoController.text : "extenso global";
    final months = quantidadeMesesController.text.isNotEmpty ? quantidadeMesesController.text : "12";
    final comarca = foroComarcaController.text.isNotEmpty ? foroComarcaController.text : "Cidade Sede";

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey.shade300),
      ),
      padding: const EdgeInsets.all(20),
      child: SelectionArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Text(
                  'MINUTA DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade900,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'CONTRATO DE ASSESSORIA Nº $contractNum',
                  style: TextStyle(
                    fontFamily: 'Georgia',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade800,
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Pelo presente instrumento, de um lado a PREFEITURA MUNICIPAL DE ${clientName.toUpperCase()}, pessoa jurídica de direito público interno, inscrita no CNPJ/MF sob o nº $cnpj, doravante denominada CONTRATANTE, e de outro lado a empresa $corpName, inscrita no CNPJ sob o nº $corpCnpj, doravante denominada CONTRATADA, resolvem firmar este termo sob as seguintes cláusulas:',
                style: TextStyle(
                  fontFamily: 'Georgia',
                  fontSize: 11,
                  color: Colors.grey.shade800,
                  height: 1.45,
                ),
                textAlign: TextAlign.justify,
              ),
              const SizedBox(height: 14),
              _minutaClausula(
                'Cláusula Primeira – Do Objeto:',
                'O presente contrato tem por objeto a contratação de empresa especializada para prestação de serviços de consultoria e assessoria técnica para acompanhamento, monitoramento e diagnóstico dos sistemas corporativos do FNDE, do Ministério da Educação – MEC e recuperação de transferências do FUNDEB.',
              ),
              _minutaClausula(
                'Cláusula Segunda – Da Vigência:',
                'O prazo de vigência deste instrumento será de $months (meses), contado a partir da data de assinatura, podendo ser prorrogado mediante termo aditivo conforme art. 106 da Lei nº 14.133/21.',
              ),
              _minutaClausula(
                'Cláusula Quinta – Do Preço e Dotação:',
                'A CONTRATANTE pagará à CONTRATADA o valor mensal de $valueMensal, perfazendo o montante global estimado de $valueGlobal ($globalExt), correndo as despesas por conta da Dotação Orçamentária da Secretaria de Educação (FUNDEB).',
              ),
              _minutaClausula(
                'Cláusula Décima Sexta – Do Foro:',
                'Fica eleito o foro da Comarca de $comarca para dirimir quaisquer litígios oriundos da execução contratual.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _minutaClausula(String titulo, String texto) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            titulo,
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            texto,
            style: TextStyle(
              fontFamily: 'Georgia',
              fontSize: 11,
              color: Colors.grey.shade800,
              height: 1.4,
            ),
            textAlign: TextAlign.justify,
          ),
        ],
      ),
    );
  }
}
