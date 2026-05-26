import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────
// SyncSurfaceCard — White card, 1px gray border, no shadow.
// The Vercel/Linear flat card pattern.
// ─────────────────────────────────────────────────────────────
class SyncSurfaceCard extends StatelessWidget {
  const SyncSurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.backgroundColor,
    this.borderColor,
    this.radius = 12,
  });

  final Widget child;
  final EdgeInsets padding;
  final Color? backgroundColor;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: backgroundColor ?? SaaSTokens.cardWhite,
        border: Border.all(color: borderColor ?? SaaSTokens.borderLight),
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncSectionHeader — Title + description row.
// ─────────────────────────────────────────────────────────────
class SyncSectionHeader extends StatelessWidget {
  const SyncSectionHeader({
    super.key,
    required this.title,
    required this.description,
    this.trailing,
  });

  final String title;
  final String description;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 720;
        if (compact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(
                fontSize: 22, fontWeight: FontWeight.w700,
                color: SaaSTokens.textTitle, letterSpacing: -0.6,
              )),
              const SizedBox(height: 6),
              Text(description, style: const TextStyle(
                fontSize: 14, color: SaaSTokens.textMuted,
              )),
              if (trailing != null) ...[const SizedBox(height: 16), trailing!],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(
                    fontSize: 22, fontWeight: FontWeight.w700,
                    color: SaaSTokens.textTitle, letterSpacing: -0.6,
                  )),
                  const SizedBox(height: 6),
                  Text(description, style: const TextStyle(
                    fontSize: 14, color: SaaSTokens.textMuted,
                  )),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 16), trailing!],
          ],
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncMetricCard — KPI card with tonal icon, sparkline, value.
// ─────────────────────────────────────────────────────────────
class SyncMetricCard extends StatelessWidget {
  const SyncMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.color,
    this.sparkData,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color color;
  final List<double>? sparkData;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      padding: EdgeInsets.zero,
      child: Stack(
        children: [
          // Sparkline layer (behind content)
          if (sparkData != null && sparkData!.isNotEmpty)
            Positioned(
              left: 0, right: 0, bottom: 0,
              height: 48,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(12),
                ),
                child: CustomPaint(
                  painter: _SparklinePainter(
                    data: sparkData!,
                    lineColor: color.withOpacity(0.4),
                    fillColor: color.withOpacity(0.06),
                  ),
                  size: Size.infinite,
                ),
              ),
            ),
          // Content layer
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        label.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: SaaSTokens.textDim,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                    Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        color: color.withOpacity(0.1),
                      ),
                      child: Icon(icon, size: 18, color: color),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: SaaSTokens.textTitle,
                    letterSpacing: -0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  helper,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: SaaSTokens.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SparklinePainter — smooth bezier mini-chart with gradient fill
// ─────────────────────────────────────────────────────────────
class _SparklinePainter extends CustomPainter {
  _SparklinePainter({
    required this.data,
    required this.lineColor,
    required this.fillColor,
  });

  final List<double> data;
  final Color lineColor;
  final Color fillColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final maxVal = data.reduce(math.max);
    final minVal = data.reduce(math.min);
    final range = maxVal - minVal;
    final safeRange = range == 0 ? 1.0 : range;

    final points = <Offset>[];
    for (var i = 0; i < data.length; i++) {
      final x = (i / (data.length - 1)) * size.width;
      final y = size.height - ((data[i] - minVal) / safeRange) * size.height * 0.85 - size.height * 0.08;
      points.add(Offset(x, y));
    }

    // Build smooth bezier path
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 0; i < points.length - 1; i++) {
      final p0 = points[i];
      final p1 = points[i + 1];
      final cx = (p0.dx + p1.dx) / 2;
      path.cubicTo(cx, p0.dy, cx, p1.dy, p1.dx, p1.dy);
    }

    // Draw line
    final linePaint = Paint()
      ..color = lineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(path, linePaint);

    // Draw gradient fill below line
    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [fillColor, fillColor.withOpacity(0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(fillPath, fillPaint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter old) =>
      old.data != data || old.lineColor != lineColor;
}

// ─────────────────────────────────────────────────────────────
// StatusPill — M3 pill badge.
// ─────────────────────────────────────────────────────────────
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(100),
        color: color.withOpacity(0.1),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// EmptyStateWidget — Premium empty state with CTA.
// ─────────────────────────────────────────────────────────────
class EmptyStateWidget extends StatelessWidget {
  const EmptyStateWidget({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: SaaSTokens.scaffold,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: SaaSTokens.borderLight),
            ),
            child: Icon(icon, size: 24, color: SaaSTokens.textDim),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: SaaSTokens.textTitle,
            ),
          ),
          const SizedBox(height: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 260),
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: SaaSTokens.textMuted,
                height: 1.5,
              ),
            ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(height: 20),
            FilledButton.tonal(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: SaaSTokens.primaryLight,
                foregroundColor: SaaSTokens.primary,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                textStyle: const TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
