import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../app/app.dart';
import '../../../core/theme/app_theme.dart';

/// Largura a partir da qual a tela deixa de ser uma coluna centrada e passa a
/// enderecar o visitante numa coluna propria ao lado do formulario.
const double _kSplitBreakpoint = 1080;
const double _kCardWidth = 420;

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

  final _formKey = GlobalKey<FormState>();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final _emailFocus = FocusNode(debugLabel: 'login-email');
  final _passwordFocus = FocusNode(debugLabel: 'login-senha');

  bool isSubmitting = false;
  bool obscurePassword = true;

  /// So a web distingue sessao de navegador de sessao persistente. Fora dela a
  /// escolha nao existe, entao o controle nao aparece — em vez de prometer um
  /// comportamento que a plataforma nao entrega.
  bool keepSession = false;

  /// Erro vindo do servidor. Erros de preenchimento ficam no proprio campo.
  String? authError;

  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOutCubic);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return 'Informe o e-mail institucional.';
    if (!text.contains('@') || !text.contains('.') || text.length < 6) {
      return 'E-mail incompleto — confira o endereço.';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if ((value ?? '').isEmpty) return 'Informe a senha.';
    return null;
  }

  Future<void> handleSubmit() async {
    // Valida antes de sair da tela: erro de preenchimento marca o campo em vez
    // de virar um aviso generico longe da causa.
    if (!(_formKey.currentState?.validate() ?? false)) {
      // O foco vai para o primeiro campo invalido, senao o leitor de tela nao
      // tem como saber o que precisa corrigir.
      if (_validateEmail(emailController.text) != null) {
        _emailFocus.requestFocus();
      } else {
        _passwordFocus.requestFocus();
      }
      return;
    }

    setState(() {
      isSubmitting = true;
      authError = null;
      obscurePassword = true; // nao deixar a senha exposta na transicao
    });

    if (kIsWeb) {
      await widget.controller.setSessionPersistence(keepSignedIn: keepSession);
    }

    final success = await widget.controller.signIn(
      emailController.text,
      passwordController.text,
    );

    if (!mounted) return;

    setState(() {
      isSubmitting = false;
      authError = success ? null : widget.controller.errorMessage;
    });
  }

  Future<void> _openPasswordReset() async {
    await showDialog<void>(
      context: context,
      builder: (_) => _PasswordResetDialog(
        controller: widget.controller,
        initialEmail: emailController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= _kSplitBreakpoint;
    // Respeita "reduzir movimento" do sistema: sem isso a entrada e um efeito
    // imposto a quem pediu para nao ter efeito.
    final animate = !MediaQuery.disableAnimationsOf(context);

    final content = Padding(
      padding: EdgeInsets.symmetric(horizontal: 24, vertical: isWide ? 64 : 40),
      child: isWide ? _buildSplit() : _buildStacked(),
    );

    return Scaffold(
      backgroundColor: _tintedScaffold,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Sem `minHeight` o scroll da altura infinita e o `Align` nao tem
            // contra o que centrar: tudo encosta no topo e sobra meia tela
            // vazia embaixo. Com ela, centra quando cabe e rola quando nao
            // cabe — que e o caso de zoom em 200%.
            return Scrollbar(
              child: SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Align(
                    // Em telas altas o conteudo fica centrado; quando o card
                    // cresce por um erro, o excesso vira rolagem em vez de
                    // empurrar a marca para fora.
                    alignment: isWide ? Alignment.center : Alignment.topCenter,
                    child: animate
                        ? FadeTransition(opacity: _fadeAnim, child: content)
                        : content,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  // ── Composicoes ────────────────────────────────────────────────────────────

  Widget _buildSplit() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 1220),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Expanded(child: _WelcomePanel()),
          const SizedBox(width: 88),
          SizedBox(width: _kCardWidth, child: _buildCard()),
        ],
      ),
    );
  }

  Widget _buildStacked() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: _kCardWidth),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _BrandLockup(compact: true),
          const SizedBox(height: 28),
          _buildCard(),
          const SizedBox(height: 24),
          _FooterLine(controller: widget.controller),
        ],
      ),
    );
  }

  Widget _buildCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 32),
          decoration: BoxDecoration(
            color: SaaSTokens.cardWhite,
            borderRadius: BorderRadius.circular(SaaSTokens.rCard),
            border: Border.all(color: SaaSTokens.borderLight),
          ),
          child: FocusTraversalGroup(
            // A ordem natural do Flutter aqui comecava pelo link de senha e
            // terminava no campo de e-mail, que e o que tem `autofocus`.
            policy: OrderedTraversalPolicy(),
            child: Form(
              key: _formKey,
              child: AutofillGroup(child: _buildFormBody()),
            ),
          ),
        ),
        if (MediaQuery.sizeOf(context).width >= _kSplitBreakpoint) ...[
          const SizedBox(height: 20),
          _FooterLine(controller: widget.controller),
        ],
      ],
    );
  }

  Widget _buildFormBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Entrar', style: GsText.panelTitle),
        const SizedBox(height: 4),
        Text(
          'Use as credenciais da sua consultoria.',
          style: GsText.body.copyWith(color: SaaSTokens.textSoft),
        ),
        if (authError != null) ...[
          const SizedBox(height: 20),
          _AuthErrorBanner(message: authError!, onRecover: _openPasswordReset),
        ],
        const SizedBox(height: 20),

        // ── E-mail
        FocusTraversalOrder(
          order: const NumericFocusOrder(1),
          // Junta o rotulo visivel ao campo: sem isso o nome acessivel vira o
          // texto do placeholder.
          child: MergeSemantics(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('E-MAIL', style: _fieldLabel),
                const SizedBox(height: 8),
                TextFormField(
                  controller: emailController,
                  focusNode: _emailFocus,
                  autofocus: true,
                  style: _inputText,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.username],
                  autovalidateMode: AutovalidateMode.onUserInteraction,
                  validator: _validateEmail,
                  onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                  decoration: const InputDecoration(
                    hintText: 'nome@consultoria.com.br',
                    // Reserva a linha de erro desde o primeiro frame: a
                    // validacao passa a marcar o campo sem mover o botao.
                    helperText: ' ',
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ── Senha
        FocusTraversalOrder(
          order: const NumericFocusOrder(2),
          child: Stack(
            children: [
              // O merge junta rotulo e campo num no so. O olho fica FORA dele:
              // dentro de `suffixIcon` o merge o engolia e ele sumia da arvore
              // de semantica e da tabulacao.
              MergeSemantics(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('SENHA', style: _fieldLabel),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: passwordController,
                      focusNode: _passwordFocus,
                      style: _inputText,
                      obscureText: obscurePassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      validator: _validatePassword,
                      onFieldSubmitted: (_) => handleSubmit(),
                      decoration: const InputDecoration(
                        helperText: ' ',
                        // Abre espaco para o olho sem deixar o texto correr
                        // por baixo dele.
                        contentPadding: EdgeInsets.fromLTRB(16, 14, 52, 14),
                      ),
                    ),
                  ],
                ),
              ),
              // 20 = altura do rotulo (12) + respiro (8); centraliza os 48dp
              // do alvo sobre os 48dp do campo.
              Positioned(
                top: 20,
                right: 4,
                child: FocusTraversalOrder(
                  order: const NumericFocusOrder(3),
                  child: IconButton(
                    tooltip: obscurePassword
                        ? 'Mostrar senha'
                        : 'Ocultar senha',
                    icon: Icon(
                      obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      color: SaaSTokens.textSoft,
                      size: 20,
                    ),
                    onPressed: () =>
                        setState(() => obscurePassword = !obscurePassword),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),

        // ── Sessao + recuperacao
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 4,
          children: [
            if (kIsWeb)
              FocusTraversalOrder(
                order: const NumericFocusOrder(4),
                child: _KeepSessionToggle(
                  value: keepSession,
                  onChanged: (v) => setState(() => keepSession = v),
                ),
              )
            else
              const SizedBox.shrink(),
            FocusTraversalOrder(
              order: const NumericFocusOrder(5),
              // `minimumSize` do tema nao venceu a densidade compacta: medido,
              // o alvo saia com 40dp de altura.
              child: SizedBox(
                height: 48,
                child: TextButton(
                  onPressed: _openPasswordReset,
                  child: const Text('Esqueci a senha'),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        // ── Acao
        FocusTraversalOrder(
          order: const NumericFocusOrder(6),
          child: SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isSubmitting ? null : handleSubmit,
              child: isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : const Text('Entrar'),
            ),
          ),
        ),
      ],
    );
  }

  static final TextStyle _fieldLabel = GsText.fieldLabel.copyWith(fontSize: 11);

  static final TextStyle _inputText = GsText.body.copyWith(
    fontSize: 15,
    color: SaaSTokens.textTitle,
  );
}

// ── Peças ────────────────────────────────────────────────────────────────────

/// Aviso de falha de autenticacao, com a saida para quem ficou de fora.
class _AuthErrorBanner extends StatelessWidget {
  const _AuthErrorBanner({required this.message, required this.onRecover});

  final String message;
  final VoidCallback onRecover;

  @override
  Widget build(BuildContext context) {
    // `liveRegion` faz o leitor de tela anunciar a falha; sem isso a tela muda
    // em silencio para quem nao ve.
    return Semantics(
      liveRegion: true,
      container: true,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: SaaSTokens.errorLight,
          borderRadius: BorderRadius.circular(SaaSTokens.rControl),
          border: Border.all(color: const Color(0xFFF3C2C2)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 1),
              child: Icon(
                Icons.error_outline_rounded,
                size: 18,
                color: SaaSTokens.errorDark,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: GsText.bodySm.copyWith(color: SaaSTokens.errorDark),
                  ),
                  const SizedBox(height: 2),
                  // Um erro de login sem rota de saida e um beco: a mesma tela,
                  // a mesma senha, de novo.
                  TextButton(
                    onPressed: onRecover,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      minimumSize: const Size(0, 40),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: SaaSTokens.errorDark,
                      alignment: Alignment.centerLeft,
                    ),
                    child: const Text('Receber link para redefinir a senha'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Caixa "manter conectado" com area de toque de 48dp e rotulo clicavel.
class _KeepSessionToggle extends StatelessWidget {
  const _KeepSessionToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    // Sem o merge, a caixa e o rotulo viram dois nos: um "grupo Manter
    // conectado" sem estado e uma caixa marcavel sem nome.
    return MergeSemantics(
      child: SizedBox(
        height: 48,
        child: InkWell(
          onTap: () => onChanged(!value),
          borderRadius: BorderRadius.circular(SaaSTokens.rChip),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // `Checkbox` traz foco de teclado e semantica de caixa; o antigo
                // era um quadrado desenhado dentro de um `InkWell` de 20dp.
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: value,
                    onChanged: (v) => onChanged(v ?? false),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    side: const BorderSide(
                      color: SaaSTokens.borderInput,
                      width: 1.5,
                    ),
                    activeColor: SaaSTokens.primaryStrong,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Manter conectado',
                  style: GsText.bodySm.copyWith(color: SaaSTokens.textBody),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Marca. Em telas estreitas ela e o unico enderecamento antes do formulario.
class _BrandLockup extends StatelessWidget {
  const _BrandLockup({this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final icon = Image.asset(
      'assets/branding/global-sync-icon.png',
      width: compact ? 64.0 : 76.0,
      height: compact ? 64.0 : 76.0,
      excludeFromSemantics: true,
    );

    final texts = Column(
      crossAxisAlignment:
          compact ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'Global Sync',
          style: GsText.pageTitle.copyWith(
            fontSize: compact ? 26 : 30,
            letterSpacing: -1.0,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'Rocha Prime Consultorias',
          style: GsText.bodySm.copyWith(
            fontSize: compact ? 12 : 14,
            color: SaaSTokens.textSoft,
          ),
        ),
      ],
    );

    if (compact) {
      return Column(
        children: [icon, const SizedBox(height: 14), texts],
      );
    }

    return Row(
      children: [
        icon,
        const SizedBox(width: 18),
        texts,
      ],
    );
  }
}

/// Coluna de enderecamento: diz o que o sistema faz e cita as bases que ele
/// consulta. Nenhum numero — a tela publica de login nao e lugar para metrica
/// que ninguem pode conferir.
class _WelcomePanel extends StatelessWidget {
  const _WelcomePanel();

  @override
  Widget build(BuildContext context) {
    const fontes = 'IBGE · FNDE · INEP · TSE · SICONFI · QEdu';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _BrandLockup(),
        const SizedBox(height: 52),
        // A manchete e o que o produto faz. Saudacao por horario e enfeite:
        // ocupa o lugar de maior peso da tela sem dizer nada sobre o sistema.
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: Text(
            'Do dado bruto ao documento assinado.',
            style: GsText.pageTitle.copyWith(
              fontSize: 56,
              height: 1.06,
              letterSpacing: -2.4,
              color: SaaSTokens.textTitle,
            ),
          ),
        ),
        const SizedBox(height: 22),
        // Medida de leitura curta: o texto para antes de virar um paragrafo de
        // documento.
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 540),
          child: Text(
            'Levantamentos FUNDEB, kits de inexigibilidade, contratos e o '
            'pipeline comercial, num lugar só.',
            style: GsText.body.copyWith(
              fontSize: 18,
              height: 1.6,
              color: SaaSTokens.textBody,
            ),
          ),
        ),
        const SizedBox(height: 48),
        Text('BASES CONSULTADAS', style: GsText.label),
        const SizedBox(height: 10),
        // Mono aqui e sobre dado, nao fantasia: sao as fontes oficiais que o
        // sistema le.
        Text(
          fontes,
          style: GsText.dataSm.copyWith(
            fontSize: 13,
            color: SaaSTokens.textMuted,
          ),
        ),
      ],
    );
  }
}

/// Rodape: estado do ambiente e assinatura. Sem host — o endereco do servidor
/// nao diz nada a quem usa e informa demais a quem sonda.
class _FooterLine extends StatelessWidget {
  const _FooterLine({required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final remote = controller.usesEnvironmentApi;
    final label = remote ? 'Ambiente de produção' : 'Ambiente local';

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            // `success` puro rende 2.20:1 sobre o fundo tintado e some.
            color: remote ? SaaSTokens.successDot : SaaSTokens.textSoft,
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            '$label  ·  © ${DateTime.now().year} Global Sync',
            style: GsText.dataXs.copyWith(color: SaaSTokens.textSoft),
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}

/// Redefinicao de senha. A resposta e a mesma exista ou nao a conta: dizer
/// "e-mail nao cadastrado" numa tela publica entrega a lista de usuarios.
class _PasswordResetDialog extends StatefulWidget {
  const _PasswordResetDialog({
    required this.controller,
    required this.initialEmail,
  });

  final AppController controller;
  final String initialEmail;

  @override
  State<_PasswordResetDialog> createState() => _PasswordResetDialogState();
}

class _PasswordResetDialogState extends State<_PasswordResetDialog> {
  late final TextEditingController _email = TextEditingController(
    text: widget.initialEmail,
  );
  bool _sending = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final address = _email.text.trim();
    if (!address.contains('@') || !address.contains('.')) {
      setState(() => _error = 'Informe um e-mail válido.');
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    final failure = await widget.controller.sendPasswordReset(address);
    if (!mounted) return;
    setState(() {
      _sending = false;
      _error = failure;
      _sent = failure == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: SaaSTokens.cardWhite,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SaaSTokens.rCard),
      ),
      title: Text(
        _sent ? 'Verifique seu e-mail' : 'Redefinir senha',
        style: GsText.panelTitle,
      ),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: _sent
              ? [
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      'Se houver uma conta para ${_email.text.trim()}, o link '
                      'de redefinição chega em alguns minutos. Confira '
                      'também a caixa de spam.',
                      style: GsText.body.copyWith(color: SaaSTokens.textSoft),
                    ),
                  ),
                ]
              : [
                  Text(
                    'Enviamos um link para você criar uma senha nova.',
                    style: GsText.body.copyWith(color: SaaSTokens.textSoft),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'E-MAIL',
                    style: GsText.fieldLabel.copyWith(fontSize: 11),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _email,
                    autofocus: true,
                    keyboardType: TextInputType.emailAddress,
                    onSubmitted: (_) => _send(),
                    inputFormatters: [
                      FilteringTextInputFormatter.deny(RegExp(r'\s')),
                    ],
                    decoration: InputDecoration(
                      hintText: 'nome@consultoria.com.br',
                      errorText: _error,
                    ),
                  ),
                ],
        ),
      ),
      actions: _sent
          ? [
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Fechar'),
              ),
            ]
          : [
              TextButton(
                onPressed: _sending ? null : () => Navigator.of(context).pop(),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                onPressed: _sending ? null : _send,
                child: _sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(Colors.white),
                        ),
                      )
                    : const Text('Enviar link'),
              ),
            ],
    );
  }
}
