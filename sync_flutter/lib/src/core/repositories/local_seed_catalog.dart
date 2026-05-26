import 'package:flutter/material.dart';

import '../models/sync_models.dart';
import 'mock_sync_repository.dart';

const List<ModuleDefinition> localSeedModules = <ModuleDefinition>[
  ModuleDefinition(
    key: 'consultoria',
    label: 'Consultoria',
    description: 'Projetos, entregas, contratos e pareceres.',
    color: SyncPalette.statusInfo,
    icon: Icons.work_outline_rounded,
    mappedFlows: [
      'Projetos ativos',
      'Tracker de entregas',
      'Resumo contratual',
    ],
  ),
  ModuleDefinition(
    key: 'fundeb',
    label: 'Consultoria FUNDEB',
    description: 'Municipios, indicadores, projecao de faturamento e comissao.',
    color: SyncPalette.statusActive,
    icon: Icons.school_outlined,
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
    icon: Icons.description_outlined,
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
    label: 'Contrato capa a capa',
    description:
        'Proposta, contrato tecnico, precos e assinaturas em PDF premium.',
    color: SyncPalette.statusWarning,
    icon: Icons.assignment_outlined,
    mappedFlows: [
      'Capa executiva premium',
      'Tabela de precos editavel',
      'Minuta e assinaturas',
    ],
  ),
  ModuleDefinition(
    key: 'case-de-sucesso',
    label: 'Case de Sucesso',
    description: 'Analise da evolucao do FUNDEB com cards e graficos.',
    color: SyncPalette.statusWarning,
    icon: Icons.emoji_events_outlined,
    mappedFlows: [
      'Seletor de municipio',
      'Cards de impacto',
      'Graficos de evolucao',
    ],
  ),
  ModuleDefinition(
    key: 'kit-documental',
    label: 'Kit Documental',
    description: 'Documentos para contratacao municipal: TR, parecer, inexigibilidade.',
    color: SyncPalette.statusInfo,
    icon: Icons.folder_special_rounded,
    mappedFlows: [
      'Objeto do contrato',
      'Parecer de legalidade',
      'Modelo de inexigibilidade',
    ],
  ),
  ModuleDefinition(
    key: 'propostas',
    label: 'Propostas Comerciais',
    description: 'Criacao e padronizacao de propostas de servicos.',
    color: SyncPalette.statusActive,
    icon: Icons.request_quote_outlined,
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
    icon: Icons.memory_outlined,
    mappedFlows: ['Inventario interno', 'Roadmap tecnico'],
  ),
];
