import 'package:flutter/material.dart';

import '../../../app/app.dart';
import '../../../core/theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  /// Fundo claro com leve tinta teal — derivado dos tokens, sem gradiente.
  static final _tintedScaffold = Color.alphaBlend(
    SaaSTokens.primaryLight.withValues(alpha: 0.45),
    SaaSTokens.scaffold,
  );

  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool isSubmitting = false;
  bool obscurePassword = true;
  // TODO(redesign): o repositorio sempre persiste a sessao; nao existe flag
  // "manter sessao" em SyncRepository.signIn. Estado apenas visual por ora.
  bool keepSession = true;
  String? errorText;
  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> handleSubmit() async {
    setState(() {
      isSubmitting = true;
      errorText = null;
    });

    final success = await widget.controller.signIn(
      emailController.text,
      passwordController.text,
    );

    if (!mounted) return;

    setState(() {
      isSubmitting = false;
      errorText = success
          ? null
          : (widget.controller.errorMessage ??
                'Preencha email e senha para iniciar.');
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _tintedScaffold,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Marca ────────────────────────────────────────────
                Image.asset(
                  'assets/branding/global-sync-icon.png',
                  width: 84,
                  height: 84,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 18),
                Text(
                  'Global Sync',
                  style: GsText.pageTitle.copyWith(
                    fontSize: 27,
                    letterSpacing: -0.8,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  'GLOBAL SERVICES CONSULTORIAS',
                  style: GsText.label.copyWith(fontSize: 11),
                ),
                const SizedBox(height: 30),

                // ── Card de acesso ───────────────────────────────────
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Container(
                    decoration: BoxDecoration(
                      color: SaaSTokens.cardWhite,
                      borderRadius: BorderRadius.circular(SaaSTokens.rCard),
                      border: Border.all(color: SaaSTokens.borderLight),
                    ),
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Acesse sua conta',
                          style: GsText.panelTitle.copyWith(
                            fontSize: 21,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Credenciais institucionais da consultoria.',
                          style: GsText.body,
                        ),
                        const SizedBox(height: 28),

                        // Campo de e-mail
                        Text('E-MAIL', style: _fieldLabel),
                        const SizedBox(height: 7),
                        TextField(
                          controller: emailController,
                          autofocus: true,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.email],
                          style: _inputText,
                          decoration: const InputDecoration(
                            hintText: 'consultor@globalsync.com.br',
                          ),
                        ),
                        const SizedBox(height: 18),

                        // Campo de senha
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('SENHA', style: _fieldLabel),
                            InkWell(
                              onTap: () {},
                              borderRadius: BorderRadius.circular(
                                SaaSTokens.rChip,
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 2,
                                ),
                                child: Text(
                                  'Esqueci a senha',
                                  style: GsText.bodySm.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: SaaSTokens.primaryHover,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 7),
                        TextField(
                          controller: passwordController,
                          obscureText: obscurePassword,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.password],
                          onSubmitted: (_) =>
                              isSubmitting ? null : handleSubmit(),
                          style: _inputText,
                          decoration: InputDecoration(
                            hintText: '••••••••',
                            suffixIcon: IconButton(
                              tooltip: obscurePassword
                                  ? 'Mostrar senha'
                                  : 'Ocultar senha',
                              iconSize: 19,
                              style: IconButton.styleFrom(
                                minimumSize: const Size(40, 40),
                              ),
                              icon: Icon(
                                obscurePassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                color: SaaSTokens.textMuted,
                              ),
                              onPressed: () {
                                setState(() {
                                  obscurePassword = !obscurePassword;
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Manter sessao
                        InkWell(
                          onTap: () =>
                              setState(() => keepSession = !keepSession),
                          borderRadius: BorderRadius.circular(
                            SaaSTokens.rChip,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: Checkbox(
                                    value: keepSession,
                                    onChanged: (value) => setState(
                                      () => keepSession = value ?? false,
                                    ),
                                    activeColor: SaaSTokens.primary,
                                    side: const BorderSide(
                                      color: SaaSTokens.borderStronger,
                                    ),
                                    visualDensity: VisualDensity.compact,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(5),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Manter sessão neste dispositivo',
                                  style: GsText.body,
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Erro de autenticacao
                        if (errorText != null) ...[
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: SaaSTokens.errorLight,
                              borderRadius: BorderRadius.circular(
                                SaaSTokens.rControl,
                              ),
                              border: Border.all(color: SaaSTokens.error),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.error_outline,
                                  color: SaaSTokens.error,
                                  size: 18,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    errorText!,
                                    style: GsText.body.copyWith(
                                      color: SaaSTokens.errorDark,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // Botao primario — teal, alvo de 48
                        SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            onPressed: isSubmitting ? null : handleSubmit,
                            style: ElevatedButton.styleFrom(
                              disabledBackgroundColor: SaaSTokens.primaryDim,
                              disabledForegroundColor: Colors.white,
                            ),
                            child: isSubmitting
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Entrar'),
                          ),
                        ),
                        // TODO(redesign): o botao "Entrar com Google Workspace"
                        // do mockup depende de um fluxo de SSO que ainda nao
                        // existe no app (so ha e-mail/senha via Firebase).
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 26),
                _ApiStatusLine(controller: widget.controller),
                const SizedBox(height: 12),
                Text(
                  '© 2026 Global Sync',
                  style: GsText.dataXs.copyWith(color: SaaSTokens.textDim),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static final TextStyle _fieldLabel = GsText.fieldLabel.copyWith(
    fontSize: 11,
  );

  static final TextStyle _inputText = GsText.body.copyWith(
    fontSize: 15,
    color: SaaSTokens.textTitle,
  );
}

/// Rodape discreto: ponto de status + origem da api configurada.
class _ApiStatusLine extends StatelessWidget {
  const _ApiStatusLine({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    // TODO(redesign): a regiao ("us-central1") do mockup nao e exposta pelo
    // repositorio; usamos o host da api configurada, que e o dado existente.
    final remote = controller.usesEnvironmentApi;
    final host = Uri.tryParse(controller.apiBaseUrl)?.host ?? '';
    final label = remote && host.isNotEmpty
        ? 'api conectada · $host'
        : 'modo local · sem api remota';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: remote ? SaaSTokens.success : SaaSTokens.textDim,
          ),
        ),
        const SizedBox(width: 8),
        Text(label, style: GsText.dataXs),
      ],
    );
  }
}
