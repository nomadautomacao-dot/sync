import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────
// SaaS-grade design tokens (Vercel / Linear / Stripe aesthetic)
// ─────────────────────────────────────────────────────────────
abstract final class SaaSTokens {
  // Background & Surface
  static const scaffold    = Color(0xFFEEF1F6); // Cooler, slightly deeper gray for contrast
  static const cardWhite   = Color(0xFFFFFFFF);
  static const borderLight = Color(0xFFE2E8F0); // Softer blue-gray border

  // Text hierarchy (never pure black)
  static const textTitle    = Color(0xFF111827); // Gray-900
  static const textBody     = Color(0xFF374151); // Gray-700
  static const textMuted    = Color(0xFF6B7280); // Gray-500
  static const textDim      = Color(0xFF9CA3AF); // Gray-400

  // Primary palette (Global Sync Teal)
  static const primary        = Color(0xFF049598);
  static const primaryLight   = Color(0xFFDCF2F0);
  static const primaryDim     = Color(0xFF5FA3A0);

  // Semantic
  static const success = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const error   = Color(0xFFEF4444);

  // Premium Gold Accent
  static const gold      = Color(0xFFD4A853);
  static const goldLight = Color(0xFFFAF3E3);
  static const goldDim   = Color(0xFFB8943F);
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

    const fontFamily = 'Inter';

    final textTheme = const TextTheme(
      headlineMedium: TextStyle(
        fontSize: 36, fontWeight: FontWeight.w700,
        color: SaaSTokens.textTitle, letterSpacing: -1.4, height: 1,
      ),
      headlineSmall: TextStyle(
        fontSize: 22, fontWeight: FontWeight.w700,
        color: SaaSTokens.textTitle, letterSpacing: -0.6, height: 1.15,
      ),
      titleLarge: TextStyle(
        fontSize: 18, fontWeight: FontWeight.w600,
        color: SaaSTokens.textTitle, letterSpacing: -0.3, height: 1.2,
      ),
      titleMedium: TextStyle(
        fontSize: 15, fontWeight: FontWeight.w600,
        color: SaaSTokens.textTitle, letterSpacing: -0.15, height: 1.25,
      ),
      bodyLarge: TextStyle(
        fontSize: 15, fontWeight: FontWeight.w400,
        color: SaaSTokens.textBody, height: 1.5,
      ),
      bodyMedium: TextStyle(
        fontSize: 14, fontWeight: FontWeight.w400,
        color: SaaSTokens.textMuted, height: 1.45,
      ),
      bodySmall: TextStyle(
        fontSize: 12, fontWeight: FontWeight.w500,
        color: SaaSTokens.textMuted, height: 1.3,
      ),
      labelLarge: TextStyle(
        fontSize: 13, fontWeight: FontWeight.w600,
        color: SaaSTokens.textTitle, letterSpacing: 0.05,
      ),
      labelSmall: TextStyle(
        fontSize: 11, fontWeight: FontWeight.w600,
        color: SaaSTokens.textDim, letterSpacing: 0.8,
      ),
    ).apply(fontFamily: fontFamily);

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

      // Cards: white, 1px border, NO shadow
      cardTheme: CardThemeData(
        color: SaaSTokens.cardWhite,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: SaaSTokens.borderLight),
        ),
      ),

      // Buttons (48dp minimum touch target)
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: SaaSTokens.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          minimumSize: const Size(64, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(
            fontFamily: fontFamily, fontSize: 14,
            fontWeight: FontWeight.w600, letterSpacing: 0,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          minimumSize: const Size(64, 48),
          side: const BorderSide(color: SaaSTokens.borderLight),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          foregroundColor: SaaSTokens.textTitle,
          textStyle: const TextStyle(
            fontFamily: fontFamily, fontSize: 14,
            fontWeight: FontWeight.w600, letterSpacing: 0,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          minimumSize: const Size(64, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      ),

      // Inputs (Outlined, clean)
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: const TextStyle(
          fontFamily: fontFamily, color: SaaSTokens.textDim, fontSize: 14,
        ),
        labelStyle: const TextStyle(
          fontFamily: fontFamily, color: SaaSTokens.textMuted, fontSize: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: SaaSTokens.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: SaaSTokens.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: SaaSTokens.error, width: 1.5),
        ),
      ),

      // Chips
      chipTheme: ChipThemeData(
        backgroundColor: SaaSTokens.scaffold,
        selectedColor: SaaSTokens.primaryLight,
        disabledColor: SaaSTokens.scaffold,
        labelStyle: const TextStyle(
          fontFamily: fontFamily, color: SaaSTokens.textMuted, fontSize: 13,
        ),
        side: const BorderSide(color: SaaSTokens.borderLight),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),

      // NavigationBar (M3 strict)
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
            return const TextStyle(
              fontFamily: fontFamily, fontSize: 12,
              fontWeight: FontWeight.w600, color: SaaSTokens.primary,
            );
          }
          return const TextStyle(
            fontFamily: fontFamily, fontSize: 12,
            fontWeight: FontWeight.w500, color: SaaSTokens.textDim,
          );
        }),
      ),
    );
  }
}
