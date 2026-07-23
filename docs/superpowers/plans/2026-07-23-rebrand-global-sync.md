# Rebrand Global Sync (login, navbar, nome do app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a marca "Rocha Prime" pela nova marca "Global Sync" (ícone + nome) na tela de login, na sidebar/navbar, e no nome do app exposto pelo SO (título web, rótulo Android).

**Architecture:** Extração de um novo asset PNG (ícone com gradiente teal/azul + símbolo de bússola) a partir de `public/logo.jpg`, seguida de edições pontuais de texto/asset em 4 arquivos Flutter existentes. Sem lógica nova, sem mudança de paleta, sem testes automatizados novos (o repo não tem suíte de testes Flutter para telas de UI) — verificação via `flutter analyze`, checagem por `grep` e inspeção visual do app rodando.

**Tech Stack:** Flutter (Dart), Python3 + Pillow (só para gerar o asset, não fica no repo como dependência).

## Global Constraints

- Não mudar a paleta de cores do app (navy `#1B2A4A` e tokens de `SaaSTokens` continuam iguais) — spec seção "Fora de escopo"
- Não tocar nos PDF builders/relatórios nem nos assets `logo-rocha-prime-*` — spec seção "Fora de escopo"
- Novo asset vai em `sync_flutter/assets/branding/global-sync-icon.png`, formato RGBA com fundo transparente
- Todo texto "Rocha Prime" trocado por "Global Sync" nos arquivos tocados (spec seção "Mudanças por arquivo")
- Rodapé do login vira exatamente `'© 2026 Global Sync'`

---

### Task 1: Gerar o asset do ícone Global Sync

**Files:**
- Create: `sync_flutter/assets/branding/global-sync-icon.png`

**Interfaces:**
- Produces: um arquivo PNG RGBA quadrado (~298×300px) com o ícone (gradiente teal→azul + símbolo de bússola branco) e fundo transparente, consumido pelas Tasks 2 e 3 via `Image.asset('assets/branding/global-sync-icon.png')`.

- [ ] **Step 1: Rodar o script de extração**

Executar a partir da raiz do repo (`/home/AdrielT87/Área de trabalho/Sync`):

```bash
python3 -c "
from PIL import Image
import numpy as np

im = Image.open('public/logo.jpg').convert('RGB')
pad = 4
box = (165-pad, 252-pad, 455+pad, 544+pad)
crop = im.crop(box)
arr = np.array(crop).astype(int)
bg = np.array([16,16,16])
dist = np.sqrt(((arr-bg)**2).sum(axis=2))
alpha = np.clip((dist-10)/25*255, 0, 255).astype(np.uint8)
rgba = np.dstack([np.array(crop), alpha])
out = Image.fromarray(rgba)
out.save('sync_flutter/assets/branding/global-sync-icon.png')
print('saved', out.size, out.mode)
"
```

Expected output: `saved (298, 300) RGBA`

- [ ] **Step 2: Verificar o arquivo gerado**

```bash
file sync_flutter/assets/branding/global-sync-icon.png
```

Expected: `PNG image data, 298 x 300, 8-bit/color RGBA, non-interlaced`

- [ ] **Step 3: Confirmar que `pubspec.yaml` já cobre a pasta de assets**

```bash
grep -n "assets/branding/" sync_flutter/pubspec.yaml
```

Expected: uma linha `- assets/branding/` (já existe, nenhuma mudança necessária no pubspec).

- [ ] **Step 4: Commit**

```bash
git add sync_flutter/assets/branding/global-sync-icon.png
git commit -m "feat: add Global Sync icon asset extracted from public/logo.jpg"
```

---

### Task 2: Atualizar a tela de login

**Files:**
- Modify: `sync_flutter/lib/src/features/auth/presentation/login_screen.dart:154-186` (badge + wordmark)
- Modify: `sync_flutter/lib/src/features/auth/presentation/login_screen.dart:446-454` (rodapé)

**Interfaces:**
- Consumes: `sync_flutter/assets/branding/global-sync-icon.png` (produzido na Task 1)

- [ ] **Step 1: Trocar o badge do ícone (remove fundo branco, usa o novo asset)**

Em `login_screen.dart`, substituir o bloco (linhas 154-176):

```dart
                      // Logo P icon extracted directly from the user's image
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          color: _PrimeColors.cardWhite,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.25),
                              blurRadius: 30,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Image.asset(
                            'assets/branding/prime-icon-extracted.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                      ),
```

por:

```dart
                      // Logo Global Sync — ícone extraído do logo comercial
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.25),
                              blurRadius: 30,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Image.asset(
                          'assets/branding/global-sync-icon.png',
                          fit: BoxFit.contain,
                        ),
                      ),
```

- [ ] **Step 2: Trocar o nome e remover o subtítulo**

Substituir (linhas 178-186, logo após o badge):

```dart
                      const Text(
                        'Rocha Prime',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'SERVIÇOS ESPECIALIZADOS',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.45),
                          letterSpacing: 3.0,
                        ),
                      ),
                      const SizedBox(height: 36),
```

por:

```dart
                      const Text(
                        'Global Sync',
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 36),
```

- [ ] **Step 3: Trocar o rodapé de copyright**

Substituir a linha (próxima ao final do arquivo, dentro do rodapé):

```dart
                        '© 2026 Rocha Prime Serviços Especializados Ltda',
```

por:

```dart
                        '© 2026 Global Sync',
```

- [ ] **Step 4: Rodar análise estática**

```bash
cd sync_flutter && flutter analyze lib/src/features/auth/presentation/login_screen.dart
```

Expected: `No issues found!`

- [ ] **Step 5: Confirmar que não sobrou referência antiga no arquivo**

```bash
grep -n "Rocha Prime\|SERVIÇOS ESPECIALIZADOS\|prime-icon-extracted" sync_flutter/lib/src/features/auth/presentation/login_screen.dart
```

Expected: nenhuma saída (comando retorna vazio).

- [ ] **Step 6: Commit**

```bash
git add sync_flutter/lib/src/features/auth/presentation/login_screen.dart
git commit -m "feat: rebrand login screen to Global Sync"
```

---

### Task 3: Atualizar a sidebar/navbar

**Files:**
- Modify: `sync_flutter/lib/src/features/shell/presentation/sync_shell.dart:250-287` (logo area)
- Modify: `sync_flutter/lib/src/features/shell/presentation/sync_shell.dart:585` (texto de notificação)
- Modify: `sync_flutter/lib/src/features/shell/presentation/sync_shell.dart:624` (texto de configurações)
- Modify: `sync_flutter/lib/src/features/shell/presentation/sync_shell.dart:636` (texto de suporte)

**Interfaces:**
- Consumes: `sync_flutter/assets/branding/global-sync-icon.png` (produzido na Task 1)

- [ ] **Step 1: Trocar o bloco de logo da sidebar**

Substituir (linhas 250-287):

```dart
          // Logo area — synthesized with the extracted P icon and typography
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Image.asset(
                'assets/branding/prime-icon-extracted.png',
                height: 32,
                width: 32,
                fit: BoxFit.contain,
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Rocha Prime',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: SaaSTokens.primary,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    'SERVIÇOS ESPECIALIZADOS',
                    style: TextStyle(
                      fontSize: 7.5,
                      fontWeight: FontWeight.w700,
                      color: SaaSTokens.primaryDim,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ],
          ),
```

por:

```dart
          // Logo area — ícone Global Sync + wordmark
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Image.asset(
                'assets/branding/global-sync-icon.png',
                height: 32,
                width: 32,
                fit: BoxFit.contain,
              ),
              const SizedBox(width: 10),
              const Text(
                'Global Sync',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: SaaSTokens.primary,
                  letterSpacing: -0.5,
                  height: 1.1,
                ),
              ),
            ],
          ),
```

- [ ] **Step 2: Trocar os 3 textos soltos que citam a marca antiga**

```dart
            body: 'Nenhuma nova atualizacao no sistema Rocha Prime.',
```
por:
```dart
            body: 'Nenhuma nova atualizacao no sistema Global Sync.',
```

```dart
                    ? 'Visualizando as configuracoes e informacoes corporativas exclusivas da Rocha Prime.'
```
por:
```dart
                    ? 'Visualizando as configuracoes e informacoes corporativas exclusivas da Global Sync.'
```

```dart
            body: 'Para assistencia, entre em contato com a equipe de TI da Rocha Prime.',
```
por:
```dart
            body: 'Para assistencia, entre em contato com a equipe de TI da Global Sync.',
```

- [ ] **Step 3: Rodar análise estática**

```bash
cd sync_flutter && flutter analyze lib/src/features/shell/presentation/sync_shell.dart
```

Expected: `No issues found!`

- [ ] **Step 4: Confirmar que não sobrou referência antiga no arquivo**

```bash
grep -n "Rocha Prime\|SERVIÇOS ESPECIALIZADOS\|prime-icon-extracted" sync_flutter/lib/src/features/shell/presentation/sync_shell.dart
```

Expected: nenhuma saída (comando retorna vazio).

- [ ] **Step 5: Commit**

```bash
git add sync_flutter/lib/src/features/shell/presentation/sync_shell.dart
git commit -m "feat: rebrand sidebar to Global Sync"
```

---

### Task 4: Atualizar o título web (`index.html`)

**Files:**
- Modify: `sync_flutter/web/index.html`

- [ ] **Step 1: Trocar todas as ocorrências de "PrimeOS" pelo novo nome**

Substituir o comentário (linhas 4-6):

```html
  <!--
    PrimeOS — Plataforma de gestão municipal e empresarial.
    Base href será substituído pelo flutter build --base-href.
  -->
```

por:

```html
  <!--
    Global Sync — Plataforma de gestão municipal e empresarial.
    Base href será substituído pelo flutter build --base-href.
  -->
```

Substituir a meta description (linha 13):

```html
  <meta name="description" content="PrimeOS — Plataforma de gestão municipal e empresarial integrada.">
```

por:

```html
  <meta name="description" content="Global Sync — Plataforma de gestão municipal e empresarial integrada.">
```

Substituir o título da aba iOS (linha 20):

```html
  <meta name="apple-mobile-web-app-title" content="PrimeOS">
```

por:

```html
  <meta name="apple-mobile-web-app-title" content="Global Sync">
```

Substituir o título da aba do navegador (linha 26):

```html
  <title>PrimeOS</title>
```

por:

```html
  <title>Global Sync</title>
```

- [ ] **Step 2: Confirmar que não sobrou "PrimeOS" no arquivo**

```bash
grep -n "PrimeOS" sync_flutter/web/index.html
```

Expected: nenhuma saída (comando retorna vazio).

- [ ] **Step 3: Commit**

```bash
git add sync_flutter/web/index.html
git commit -m "feat: rename web app title to Global Sync"
```

---

### Task 5: Atualizar o rótulo do app Android

**Files:**
- Modify: `sync_flutter/android/app/src/main/AndroidManifest.xml:5`

- [ ] **Step 1: Trocar o label**

Substituir:

```xml
        android:label="SYNC"
```

por:

```xml
        android:label="Global Sync"
```

- [ ] **Step 2: Confirmar a mudança**

```bash
grep -n "android:label" sync_flutter/android/app/src/main/AndroidManifest.xml
```

Expected: `        android:label="Global Sync"`

- [ ] **Step 3: Commit**

```bash
git add sync_flutter/android/app/src/main/AndroidManifest.xml
git commit -m "feat: rename Android app label to Global Sync"
```

---

### Task 6: Verificação final — analyze completo + inspeção visual

**Files:**
- Nenhum (task de verificação)

- [ ] **Step 1: Rodar `flutter analyze` no projeto inteiro**

```bash
cd sync_flutter && flutter analyze
```

Expected: nenhum erro novo introduzido pelas Tasks 1-5 (podem existir warnings pré-existentes no projeto; o objetivo é não adicionar novos).

- [ ] **Step 2: Confirmar que nenhuma referência a "Rocha Prime" ou ao ícone antigo sobrou fora do escopo combinado**

```bash
grep -rn "prime-icon-extracted" sync_flutter/lib
```

Expected: nenhuma saída (os dois usos das Tasks 2 e 3 eram os únicos no projeto).

- [ ] **Step 3: Subir o app localmente e conferir visualmente**

```bash
cd sync_flutter && flutter run -d chrome
```

Verificar manualmente no navegador:
- Tela de login mostra o ícone Global Sync (gradiente teal/azul) sem fundo branco ao redor, nome "Global Sync", sem subtítulo, rodapé "© 2026 Global Sync"
- Após login, a sidebar mostra o mesmo ícone 32×32 e "Global Sync" sem subtítulo
- Título da aba do navegador mostra "Global Sync"

- [ ] **Step 4: Encerrar o `flutter run` (Ctrl+C) após a conferência visual**
