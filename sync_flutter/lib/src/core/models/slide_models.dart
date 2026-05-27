import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Represents a slide template available for generation.
class SlideTemplate {
  const SlideTemplate({
    required this.id,
    required this.label,
    required this.description,
    required this.slideCount,
    required this.requiresMunicipio,
    required this.icon,
    required this.color,
  });

  final String id;
  final String label;
  final String description;
  final int slideCount;
  final bool requiresMunicipio;
  final IconData icon;
  final Color color;

  factory SlideTemplate.fromJson(Map<String, dynamic> json) {
    return SlideTemplate(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      slideCount: json['slideCount'] as int? ?? 0,
      requiresMunicipio: json['requiresMunicipio'] as bool? ?? false,
      icon: _iconForTemplate(json['id'] as String? ?? ''),
      color: _colorForTemplate(json['id'] as String? ?? ''),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'description': description,
    'slideCount': slideCount,
    'requiresMunicipio': requiresMunicipio,
  };

  static IconData _iconForTemplate(String id) => switch (id) {
    'institucional' => LucideIcons.presentation,
    'proposta-fundeb' => LucideIcons.fileBarChart,
    'resumo-executivo' => LucideIcons.barChart3,
    _ => LucideIcons.slideshow,
  };

  static Color _colorForTemplate(String id) => switch (id) {
    'institucional' => const Color(0xFF7C3AED),   // Violet
    'proposta-fundeb' => const Color(0xFF2F6BFF),  // Blue
    'resumo-executivo' => const Color(0xFF0D9488), // Teal
    _ => const Color(0xFF6B7280),
  };
}

/// Default templates for offline/fallback mode.
const defaultSlideTemplates = <SlideTemplate>[
  SlideTemplate(
    id: 'institucional',
    label: 'Apresentacao Institucional',
    description: 'Apresentacao padrao da Rocha Prime com servicos, diferenciais e cases.',
    slideCount: 16,
    requiresMunicipio: false,
    icon: LucideIcons.presentation,
    color: Color(0xFF7C3AED),
  ),
  SlideTemplate(
    id: 'proposta-fundeb',
    label: 'Proposta FUNDEB Municipal',
    description: 'Apresentacao com dados reais de receita FUNDEB, censo escolar e projecoes.',
    slideCount: 12,
    requiresMunicipio: true,
    icon: LucideIcons.fileBarChart,
    color: Color(0xFF2F6BFF),
  ),
  SlideTemplate(
    id: 'resumo-executivo',
    label: 'Resumo Executivo',
    description: 'Versao compacta com indicadores-chave e projecao financeira.',
    slideCount: 7,
    requiresMunicipio: true,
    icon: LucideIcons.barChart3,
    color: Color(0xFF0D9488),
  ),
];
