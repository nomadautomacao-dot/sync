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
class SyncMetricCard extends StatefulWidget {
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
  State<SyncMetricCard> createState() => _SyncMetricCardState();
}

class _SyncMetricCardState extends State<SyncMetricCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutQuart,
        decoration: BoxDecoration(
          color: SaaSTokens.cardWhite,
          border: Border.all(
            color: _hovered
                ? widget.color.withValues(alpha: 0.3)
                : SaaSTokens.borderLight,
          ),
          borderRadius: BorderRadius.circular(12),
          boxShadow: _hovered
              ? [BoxShadow(color: widget.color.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, 4))]
              : [],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Stack(
            children: [
              // Top gradient stripe
              Positioned(
                top: 0, left: 0, right: 0,
                height: 3,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        widget.color.withValues(alpha: 0.7),
                        widget.color.withValues(alpha: 0.15),
                      ],
                    ),
                  ),
                ),
              ),
              // Sparkline layer
              if (widget.sparkData != null && widget.sparkData!.isNotEmpty)
                Positioned(
                  left: 0, right: 0, bottom: 0,
                  height: 48,
                  child: CustomPaint(
                    painter: _SparklinePainter(
                      data: widget.sparkData!,
                      lineColor: widget.color.withValues(alpha: 0.4),
                      fillColor: widget.color.withValues(alpha: 0.06),
                    ),
                    size: Size.infinite,
                  ),
                ),
              // Content layer
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            widget.label.toUpperCase(),
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
                            color: widget.color.withValues(alpha: 0.1),
                          ),
                          child: Icon(widget.icon, size: 18, color: widget.color),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.value,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: SaaSTokens.textTitle,
                        letterSpacing: -0.8,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.helper,
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
        ),
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
        colors: [fillColor, fillColor.withValues(alpha: 0)],
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
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.15)),
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
class EmptyStateWidget extends StatefulWidget {
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
  State<EmptyStateWidget> createState() => _EmptyStateWidgetState();
}

class _EmptyStateWidgetState extends State<EmptyStateWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeSlide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeSlide = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutQuart,
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeSlide,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.05),
          end: Offset.zero,
        ).animate(_fadeSlide),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 48),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Double-ring icon
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: SaaSTokens.scaffold,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: SaaSTokens.borderLight),
                  boxShadow: [
                    BoxShadow(
                      color: SaaSTokens.primary.withValues(alpha: 0.04),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: SaaSTokens.cardWhite,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: SaaSTokens.borderLight.withValues(alpha: 0.6),
                    ),
                  ),
                  child: Icon(widget.icon, size: 22, color: SaaSTokens.primaryDim),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                widget.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: SaaSTokens.textTitle,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Text(
                  widget.subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: SaaSTokens.textMuted,
                    height: 1.5,
                  ),
                ),
              ),
              if (widget.actionLabel != null) ...[
                const SizedBox(height: 24),
                FilledButton.tonal(
                  onPressed: widget.onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: SaaSTokens.primaryLight,
                    foregroundColor: SaaSTokens.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                    textStyle: const TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: Text(widget.actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncShimmer — Shimmer / skeleton loading effect.
// ─────────────────────────────────────────────────────────────
class SyncShimmer extends StatefulWidget {
  const SyncShimmer({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<SyncShimmer> createState() => _SyncShimmerState();
}

class _SyncShimmerState extends State<SyncShimmer>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              colors: [
                SaaSTokens.scaffold,
                SaaSTokens.borderLight.withValues(alpha: 0.5),
                SaaSTokens.scaffold,
              ],
              stops: [0.0, _controller.value, 1.0],
              begin: const Alignment(-1, 0),
              end: const Alignment(2, 0),
            ),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncSkeletonCard — Full card skeleton for loading states.
// ─────────────────────────────────────────────────────────────
class SyncSkeletonCard extends StatelessWidget {
  const SyncSkeletonCard({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return SyncSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SyncShimmer(width: 36, height: 36, borderRadius: 8),
              const SizedBox(width: 12),
              Expanded(child: SyncShimmer(height: 14)),
            ],
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < lines; i++) ...[
            Padding(
              padding: EdgeInsets.only(right: (i == lines - 1) ? 80 : 0),
              child: const SyncShimmer(height: 12),
            ),
            if (i < lines - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncHoverCard — Card with subtle hover effect for desktop.
// ─────────────────────────────────────────────────────────────
class SyncHoverCard extends StatefulWidget {
  const SyncHoverCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(24),
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  State<SyncHoverCard> createState() => _SyncHoverCardState();
}

class _SyncHoverCardState extends State<SyncHoverCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutQuart,
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            border: Border.all(
              color: _hovered
                  ? SaaSTokens.primaryDim.withValues(alpha: 0.4)
                  : SaaSTokens.borderLight,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: _hovered
                ? [
                    BoxShadow(
                      color: SaaSTokens.primary.withValues(alpha: 0.06),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: Padding(padding: widget.padding, child: widget.child),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// SyncPageTransition — Animated wrapper for page content.
// ─────────────────────────────────────────────────────────────
class SyncPageTransition extends StatelessWidget {
  const SyncPageTransition({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      switchInCurve: Curves.easeOutQuart,
      switchOutCurve: Curves.easeInQuart,
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.02),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}
