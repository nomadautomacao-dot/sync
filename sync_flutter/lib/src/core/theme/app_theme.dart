import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────
// Global Sync — direcao "Console Tecnico"
//
// Um accent so (teal), cards planos com borda de 1px, alvo de 48px.
// A hierarquia vem de DUAS familias, nunca de uma segunda cor:
//   · InstrumentSans — interface, rotulos em caixa alta e titulos
//   · IBMPlexMono    — todo numero e rotulo tecnico (tabular, alinhado)
// ─────────────────────────────────────────────────────────────
abstract final class SaaSTokens {
  // Superficies — quatro degraus, do fundo ao card
  static const scaffold      = Color(0xFFEEF1F6); // fundo da area de conteudo
  static const cardWhite     = Color(0xFFFFFFFF); // cards, sidebar, header
  static const surfaceSubtle = Color(0xFFF7F9FB); // cabecalho de tabela, faixas
  static const surfaceAlt    = Color(0xFFF1F3F7); // campo desabilitado, trilho

  // Bordas — 1px sempre; a separacao vem de borda, nunca de sombra
  static const borderLight   = Color(0xFFE2E8F0); // padrao
  static const borderStrong  = Color(0xFFD8DEE6); // divisor com mais peso
  static const borderStronger= Color(0xFFC9D0DB); // contorno de controle

  // Texto — nunca preto puro
  static const textTitle = Color(0xFF111827);
  static const textBody  = Color(0xFF374151);
  static const textSoft  = Color(0xFF4B5563);
  static const textMuted = Color(0xFF6B7280);
  static const textDim   = Color(0xFF9CA3AF);

  // Accent unico — teal institucional
  static const primary      = Color(0xFF049598);
  static const primaryHover = Color(0xFF036B69); // hover/pressed e links
  static const primaryLight = Color(0xFFDCF2F0); // chip ativo, tinta de fundo
  static const primaryDim   = Color(0xFF5FA3A0);

  // Semanticas — cada uma com par claro/escuro para chip e texto sobre chip
  static const success      = Color(0xFF10B981);
  static const successLight = Color(0xFFE7F7F1);
  static const successDark  = Color(0xFF065F46);

  static const warning       = Color(0xFFF59E0B);
  static const warningLight  = Color(0xFFFEF6E7);
  static const warningBorder = Color(0xFFFDE9C8);
  static const warningDark   = Color(0xFFB45309);
  static const warningDarker = Color(0xFF92400E);

  static const error      = Color(0xFFEF4444);
  static const errorLight = Color(0xFFFEF2F2);
  static const errorDark  = Color(0xFF991B1B);

  // Raios — 10 e o padrao de controle; 14 e o card
  static const rControl = 10.0;
  static const rCard    = 14.0;
  static const rChip    = 6.0;
  static const rPill    = 20.0;
}

/// Papeis tipograficos do "Console Tecnico".
///
/// Regra de ouro: se o conteudo e **numero, codigo, data, sigla ou rotulo
/// tecnico**, use um estilo `mono`. Todo o resto e `InstrumentSans`.
/// Numeros em mono usam figuras tabulares para as colunas de dinheiro
/// alinharem na virgula.
abstract final class GsText {
  static const _sans = 'InstrumentSans';
  static const _mono = 'IBMPlexMono';

  static const List<FontFeature> _tabular = [FontFeature.tabularFigures()];

  // ── Interface (InstrumentSans) ──────────────────────────────
  /// Titulo de pagina: "Visao executiva", "Empresas do grupo".
  static const pageTitle = TextStyle(
    fontFamily: _sans, fontSize: 23, fontWeight: FontWeight.w700,
    letterSpacing: -0.7, height: 1.2, color: SaaSTokens.textTitle,
  );

  /// Titulo de painel/dialogo, um degrau abaixo do titulo de pagina.
  static const panelTitle = TextStyle(
    fontFamily: _sans, fontSize: 20, fontWeight: FontWeight.w700,
    letterSpacing: -0.6, height: 1.2, color: SaaSTokens.textTitle,
  );

  /// Titulo de card: "Receita no ano", "Radar executivo".
  static const cardTitle = TextStyle(
    fontFamily: _sans, fontSize: 16, fontWeight: FontWeight.w600,
    letterSpacing: -0.3, height: 1.25, color: SaaSTokens.textTitle,
  );

  /// Titulo de card secundario / subsecao.
  static const cardTitleSm = TextStyle(
    fontFamily: _sans, fontSize: 15, fontWeight: FontWeight.w600,
    letterSpacing: -0.3, height: 1.25, color: SaaSTokens.textTitle,
  );

  /// Item de navegacao lateral.
  static const navItem = TextStyle(
    fontFamily: _sans, fontSize: 15, fontWeight: FontWeight.w600,
    letterSpacing: -0.25, height: 1.2,
  );

  /// Corpo forte — nome em linha de tabela, rotulo de toggle.
  static const bodyStrong = TextStyle(
    fontFamily: _sans, fontSize: 14, fontWeight: FontWeight.w600,
    height: 1.35, color: SaaSTokens.textTitle,
  );

  static const bodyMedium = TextStyle(
    fontFamily: _sans, fontSize: 14, fontWeight: FontWeight.w500,
    height: 1.4, color: SaaSTokens.textBody,
  );

  /// Corpo padrao — o texto mais comum da interface.
  static const body = TextStyle(
    fontFamily: _sans, fontSize: 13, fontWeight: FontWeight.w400,
    height: 1.45, color: SaaSTokens.textBody,
  );

  static const bodySm = TextStyle(
    fontFamily: _sans, fontSize: 12, fontWeight: FontWeight.w400,
    height: 1.4, color: SaaSTokens.textMuted,
  );

  static const caption = TextStyle(
    fontFamily: _sans, fontSize: 11, fontWeight: FontWeight.w400,
    height: 1.35, color: SaaSTokens.textMuted,
  );

  /// Rotulo de botao.
  static const button = TextStyle(
    fontFamily: _sans, fontSize: 14, fontWeight: FontWeight.w600,
    letterSpacing: -0.1, height: 1.2,
  );

  // ── Dados (IBMPlexMono) ─────────────────────────────────────
  /// KPI de destaque: "R$ 4,82M".
  static const kpiXl = TextStyle(
    fontFamily: _mono, fontSize: 32, fontWeight: FontWeight.w600,
    letterSpacing: -1.6, height: 1.05, color: SaaSTokens.textTitle,
    fontFeatures: _tabular,
  );

  /// KPI padrao do dashboard e dos cabecalhos de secao.
  static const kpiLg = TextStyle(
    fontFamily: _mono, fontSize: 26, fontWeight: FontWeight.w600,
    letterSpacing: -1.2, height: 1.05, color: SaaSTokens.textTitle,
    fontFeatures: _tabular,
  );

  /// Numero de apoio ao lado de um KPI ("de 26").
  static const dataLg = TextStyle(
    fontFamily: _mono, fontSize: 15, fontWeight: FontWeight.w600,
    height: 1.2, color: SaaSTokens.textDim, fontFeatures: _tabular,
  );

  /// Celula de tabela — dinheiro, CNPJ, contagem.
  static const data = TextStyle(
    fontFamily: _mono, fontSize: 13, fontWeight: FontWeight.w400,
    height: 1.3, color: SaaSTokens.textBody, fontFeatures: _tabular,
  );

  /// Celula de tabela com enfase (o valor que importa na linha).
  static const dataStrong = TextStyle(
    fontFamily: _mono, fontSize: 13, fontWeight: FontWeight.w600,
    height: 1.3, color: SaaSTokens.textTitle, fontFeatures: _tabular,
  );

  static const dataSm = TextStyle(
    fontFamily: _mono, fontSize: 12, fontWeight: FontWeight.w400,
    height: 1.3, color: SaaSTokens.textMuted, fontFeatures: _tabular,
  );

  /// Metadado em linha — horario, lote, versao.
  static const dataXs = TextStyle(
    fontFamily: _mono, fontSize: 11, fontWeight: FontWeight.w400,
    height: 1.3, color: SaaSTokens.textMuted, fontFeatures: _tabular,
  );

  static const dataXsStrong = TextStyle(
    fontFamily: _mono, fontSize: 11, fontWeight: FontWeight.w600,
    height: 1.3, color: SaaSTokens.textTitle, fontFeatures: _tabular,
  );

  /// Cabecalho de coluna e sobretitulo de secao — mono, caixa alta, espacado.
  /// E isto que separa "dado" de "rotulo" sem precisar de segunda cor.
  static const label = TextStyle(
    fontFamily: _mono, fontSize: 10, fontWeight: FontWeight.w600,
    letterSpacing: 1.1, height: 1.2, color: SaaSTokens.textMuted,
  );

  /// Rotulo de campo de formulario — levemente mais apertado que `label`.
  static const fieldLabel = TextStyle(
    fontFamily: _mono, fontSize: 10, fontWeight: FontWeight.w600,
    letterSpacing: 0.9, height: 1.2, color: SaaSTokens.textMuted,
  );

  /// Texto de chip de status.
  static const chip = TextStyle(
    fontFamily: _mono, fontSize: 11, fontWeight: FontWeight.w500,
    height: 1.1,
  );

  /// Atalho de teclado (⌘K, ⌘N).
  static const kbd = TextStyle(
    fontFamily: _mono, fontSize: 10, fontWeight: FontWeight.w600,
    letterSpacing: 0.5, height: 1.1, color: SaaSTokens.textDim,
  );
}

class AppTheme {
  static ThemeData get themeData {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: SaaSTokens.primary,
      brightness: Brightness.light,
      primary: SaaSTokens.primary,
      surface: SaaSTokens.scaffold,
      onSurface: SaaSTokens.textTitle,
      onSurfaceVariant: SaaSTokens.textMuted,
      outline: SaaSTokens.borderLight,
      outlineVariant: SaaSTokens.borderLight,
      error: SaaSTokens.error,
    );

    const fontFamily = 'InstrumentSans';

    final textTheme = TextTheme(
      // Numero grande e mono: o dashboard compara valores linha a linha.
      headlineMedium: GsText.kpiXl,
      headlineSmall: GsText.pageTitle,
      titleLarge: GsText.panelTitle,
      titleMedium: GsText.cardTitle,
      titleSmall: GsText.cardTitleSm,
      bodyLarge: GsText.bodyMedium,
      bodyMedium: GsText.body,
      bodySmall: GsText.bodySm,
      labelLarge: GsText.button.copyWith(color: SaaSTokens.textTitle),
      labelMedium: GsText.caption,
      // Rotulo pequeno e sempre mono maiusculo — o "instrumento" do console.
      labelSmall: GsText.label,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: SaaSTokens.scaffold,
      canvasColor: SaaSTokens.scaffold,
      textTheme: textTheme,
      splashFactory: InkSparkle.splashFactory,
      dividerColor: SaaSTokens.borderLight,
      dividerTheme: const DividerThemeData(
        color: SaaSTokens.borderLight,
        thickness: 1,
        space: 1,
      ),

      // Cards: brancos, borda de 1px, sem sombra
      cardTheme: CardThemeData(
        color: SaaSTokens.cardWhite,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rCard),
          side: const BorderSide(color: SaaSTokens.borderLight),
        ),
      ),

      // Botoes (alvo minimo de 48dp)
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: SaaSTokens.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          minimumSize: const Size(64, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
          textStyle: GsText.button,
        ).copyWith(
          overlayColor: const WidgetStatePropertyAll(SaaSTokens.primaryHover),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          minimumSize: const Size(64, 48),
          side: const BorderSide(color: SaaSTokens.borderLight),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
          foregroundColor: SaaSTokens.textTitle,
          textStyle: GsText.button,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          minimumSize: const Size(64, 48),
          foregroundColor: SaaSTokens.primary,
          textStyle: GsText.button,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      ),

      // Inputs: sem preenchimento, borda de 1px, foco em teal
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: GsText.body.copyWith(color: SaaSTokens.textDim, fontSize: 14),
        labelStyle: GsText.body.copyWith(color: SaaSTokens.textMuted, fontSize: 14),
        // O rotulo flutuante vira mono maiusculo, como no design.
        floatingLabelStyle: GsText.fieldLabel.copyWith(fontSize: 11),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          borderSide: const BorderSide(color: SaaSTokens.error, width: 1.5),
        ),
      ),

      // Chips: status em mono, raio menor que o dos controles
      chipTheme: ChipThemeData(
        backgroundColor: SaaSTokens.surfaceSubtle,
        selectedColor: SaaSTokens.primaryLight,
        disabledColor: SaaSTokens.surfaceAlt,
        labelStyle: GsText.chip.copyWith(color: SaaSTokens.textMuted),
        side: const BorderSide(color: SaaSTokens.borderLight),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SaaSTokens.rChip),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),

      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: SaaSTokens.primaryLight,
        backgroundColor: SaaSTokens.cardWhite,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: SaaSTokens.primary, size: 22);
          }
          return const IconThemeData(color: SaaSTokens.textDim, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GsText.navItem.copyWith(
              fontSize: 12, color: SaaSTokens.primary,
            );
          }
          return GsText.navItem.copyWith(
            fontSize: 12, fontWeight: FontWeight.w500,
            color: SaaSTokens.textDim,
          );
        }),
      ),
    );
  }
}
