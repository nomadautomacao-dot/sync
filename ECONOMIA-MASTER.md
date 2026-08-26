# ECONOMIA-MASTER.md — o plano de custo do Sync

> Documento de direção. Diz **o que a nuvem tem direito de cobrar** e o que
> deve voltar para a máquina.
> Criado: 2026-08-05. Números medidos nesta data, nesta conta (`opus-sec`).

---

## 1. O princípio

**O padrão é a máquina do consultor. A nuvem é exceção, e cada exceção precisa
se justificar.**

Isto inverte a pergunta habitual. Não é "o que dá para tirar da nuvem para
economizar" — é "o que **precisa** estar na nuvem, e por quê". Serviço que não
responder a essa pergunta com uma frase concreta desce para a máquina.

Três respostas válidas para ficar na nuvem:

1. **É estado compartilhado entre pessoas.** Duas consultoras precisam ver a
   mesma carteira de cidades. Isso não cabe num disco local.
2. **É identidade.** Quem entra, e até onde vai, tem de ser decidido num lugar
   só — e é o mesmo Auth de outros produtos Global.
3. **Alguém de fora precisa alcançar.** Um gestor municipal abrindo um link.

Tudo que não é uma dessas três é candidato a descer.

---

## 2. Por que isto não é só economia

**A máquina do consultor já produz relatório melhor que o datacenter.**

Medido em 2026-07-31, mesmo município e mesmo código: **19 fontes vivas
localmente contra 17 em produção**. O Portal da Transparência devolve 502/504
para o Cloud Run e responde normalmente a uma conexão comum.

Somam-se o teto de 900s por requisição no Cloud Run e o cold start de quem abre
o sistema na frente do secretário.

Ou seja: descer para a máquina **melhora o produto e reduz a conta ao mesmo
tempo**. É raro um trade-off cair para o mesmo lado duas vezes; quando cai, o
caminho é esse.

---

## 3. O que custa hoje

Medido em 2026-08-05. Os consumos são reais (lidos da conta); os valores em
dólar são estimativa pela tabela pública do Google — **não são a fatura**.

| Item | Antes | Depois da limpeza | Estimativa/mês |
|---|---|---|---|
| Imagens Docker guardadas | 63 GB, 100 imagens | **20,5 GB, 7 imagens** | ~US$ 6 → ~US$ 2 |
| Cloud Build | ~14 builds em agosto, `E2_HIGHCPU_8` | máquina padrão (passo 3) | **~US$ 0** |
| Cloud Run | escala a zero, 2 vCPU / 2 GB | idem | ~US$ 0 |
| Firestore | volume pequeno | idem | ~US$ 0 |

**O grosso não é processamento — é depósito.** As imagens Docker eram 92% do
custo, e eram lixo: 100 imagens de abril a julho, sem política de limpeza.

> **Duas lições da medição, para quem repetir a conta.**
>
> A primeira: **o tamanho relatado leva horas para atualizar.** Logo após apagar
> 94 imagens o painel ainda marcava os mesmos 55 GB, e concluir dali que "não
> economizou" teria sido errado — algumas horas depois marcava 15 GB.
>
> A segunda: **as camadas são compartilhadas.** Dividir 55 GB por 100 imagens dá
> 550 MB e sugere que cada deploy custa isso; o número real é outro. Sobraram
> ~15 GB para 7 imagens porque a base (Chromium, Playwright, Python) é contada
> uma vez e as 100 a compartilhavam. Estimar custo por deploy dividindo o total
> pela contagem superestima a economia.

O Cloud Run está bem configurado e **não deve ser mexido**: sem `minScale`, ele
desliga quando ninguém usa. Só se paga pelos segundos de uso real.

---

## 4. A causa raiz que encarece tudo

**156 MB de JSON entram no projeto por `import`.**

O `tsconfig.json` tem `resolveJsonModule: true` com `strict: true`. O TypeScript
lê cada arquivo e deduz o tipo exato de todo o conteúdo — quatro arquivos de
19 MB só do Censo INEP, 26 importações no total. O compilador constrói um tipo
gigante para cada um.

Isso não é um problema de custo. É **o** problema, e aparece em cinco lugares:

| Onde | Sintoma medido |
|---|---|
| Gate de testes | 4.886 MB de pico com um processo só |
| Build da imagem | 8,5 GB entre dois processos — **não cabe nos 8 GB da máquina** |
| Empacotamento do desktop | precisa de `--max-old-space-size=8192` |
| Tamanho da imagem | ~580 MB por deploy, guardados para sempre |
| Tempo de build | ~10 min quando passa |

Enquanto os JSON forem embutidos na compilação, **toda máquina que tocar neste
projeto precisa ser grande** — e máquina grande é o que se paga.

Carregá-los em execução, lidos do disco, ataca os cinco de uma vez.

---

## 5. O plano, em ordem

A ordem importa: cada passo torna o seguinte mais fácil ou desnecessário.

### Passo 1 — Parar a hemorragia do depósito *(feito em 2026-08-06)*

Apagadas 94 imagens de abril a julho, preservando a que está no ar e as mais
recentes para reversão. **63 GB → 20,5 GB.**

E a política de limpeza automática está ativa no repositório `gcr.io`, que
contém só o `sync-app` — conferido antes de aplicar, porque a política vale
para o repositório inteiro:

| Regra | Efeito |
|---|---|
| `manter-as-10-mais-recentes` | KEEP — as 10 últimas nunca são apagadas |
| `apagar-com-mais-de-30-dias` | DELETE — o resto sai sozinho |

O KEEP tem precedência sobre o DELETE: uma imagem entre as 10 mais recentes
sobrevive por mais velha que seja. Sempre haverá 10 alvos de reversão.

Foi ativada com 7 imagens no repositório — ou seja, sem apagar nada no ato.
Ativar uma política de exclusão no momento em que ela é comprovadamente inócua
é o jeito de conferir a configuração sem arriscar o acervo.

### Passo 2 — Tirar os JSON da compilação *(feito em 2026-08-06)*

O item de maior retorno do documento. `core/lib/dados-arquivo.ts` lê os
datasets do disco em execução; o TypeScript passa a ver a interface declarada
em vez de deduzir o tipo literal do conteúdo.

Não foram os 26 pontos: **92 dos ~100 MB estavam em 4 arquivos-fonte**. Mexer
neles colheu quase todo o ganho. Os JSON pequenos seguem por `import`, e não há
motivo para mudá-los.

| | Antes | Depois |
|---|---|---|
| `next build`, maior processo | 5.615 MB | 2.300 MB |
| `next build`, soma | 8.519 MB | 4.975 MB |
| `next build` com teto 4096 | falhava | passa |
| Suíte, pico | 4.886 MB | 2.499 MB |
| Suíte, duração | 37s | 4s |

Com a folga recuperada, o gate voltou a paralelizar (`VITEST_MAX_WORKERS=4`),
o que corta minutos de Cloud Build — custo direto.

> **Não confundir com "tirar os dados do repositório".** Os JSON continuam
> versionados — o que muda é *quando* são lidos.

> **O preço:** cada arquivo lido assim precisa de um `COPY` no `Dockerfile` e de
> uma entrada em `COMPLEMENTOS` de `scripts/desktop/preparar-servidor.mjs`. Sem
> elas o arquivo não viaja, e a falha só aparece na primeira requisição.

### Passo 3 — Reavaliar a máquina de build *(feito em 2026-08-26)*

Só depois do passo 2, porque antes dele nada cabe.

O `cloudbuild.yaml` fixava `E2_HIGHCPU_8`. Escolher uma máquina específica
**abre mão dos 2.500 minutos grátis por mês** que o Google dá na máquina padrão.
E a padrão (`e2-standard-2`) tem **os mesmos 8 GB** — muda o número de núcleos,
não a memória, e memória era o único motivo de ter escolhido a outra.

A linha saiu. Medido no último build da máquina antiga (`22332f17`):

| Passo | Duração | Teto |
|---|---|---|
| test | 54s | 900s |
| build | 375s | 1800s → **2400s** |
| push · deploy · smoke | 49s · 30s · 47s | — |
| **total** | **9,3 min** | |

Só o passo `build` é de CPU cheia, e é o único que sente a troca. Mesmo a 3x
ele fica em ~19 min, e ~25 min de build inteiro cabem folgados: são cerca de
100 builds por mês dentro do gratuito, contra os ~15 que fazemos.

O teto do passo subiu junto, de 1800s para 2400s. Não é detalhe: 1800s davam
4,8x sobre os 375s medidos e cairiam para ~1,6x com um quarto dos núcleos — e
build que estoura teto não parece defeito, porque a revisão anterior continua
respondendo. É o modo de falha de 2 a 5 de agosto.

> **Não peça cota para máquina maior.** É o caminho oposto ao deste documento:
> paga-se mensalmente para não consertar a causa. `E2_HIGHCPU_32` já foi
> tentado em 2026-08-05 e nem está disponível nesta região.

### Passo 4 — ~~O desktop vira o caminho principal~~ *(revertido em 2026-08-26)*

**Decisão do dono: o navegador é o caminho, e ninguém instala nada.** Este passo
fica registrado porque a análise continua valendo — o que mudou foi o peso dado
a ela.

O que derrubou o desktop como padrão não foi nenhum dos três itens da tabela
abaixo, e sim um quarto que este documento não previa: **o app desktop exige a
`FIREBASE_SERVICE_ACCOUNT`** (`obrigatoria: true` em
`scripts/desktop/credenciais-locais.mjs`), que não é senha de usuário — é acesso
administrativo ao Firebase inteiro, capaz de ler e apagar todo o Firestore de
todos os produtos Global, emitir token em nome de qualquer pessoa e conceder a
si mesma `owner`. Ela ficaria em texto puro no notebook de cada consultor, sem
como revogar de uma pessoa só: laptop perdido significa trocar a chave e
reinstalar em todo mundo.

Isso é contornável — só duas rotas (`/api/acessos`) precisam mesmo do Admin SDK;
as demais usam a chave só para conferir a assinatura do login, o que se faz com
chave pública. Mas some com o "instalar é grátis".

**O preço da reversão, e ele é real:** na nuvem o relatório sai com 17 fontes
vivas, não 19. O Portal da Transparência recusa conexão do Cloud Run, e
convênios e sanções CEIS/CNEP saem vazios (seção 2). Quem quiser recuperar as
duas tem três caminhos: aceitar, manter o desktop só para quem emite, ou IP
fixo de saída — que é conta fixa e vai contra este documento.

O que faltava para o desktop ser o padrão, mantido para quando a decisão for
revisitada:

| Falta | Por quê importa |
|---|---|
| Assinatura de código | Sem ela, o instalador esbarra em Gatekeeper e SmartScreen na frente de quem recebe |
| Atualização automática | Hoje uma versão nova exige reinstalar à mão |
| Python embarcado | 3 rotas de PDF dependem do Python do sistema |

Nenhum dos três é de custo — são de **atrito de entrega**. Mas são o que decide
se o consultor usa o app ou abre o site.

### Passo 5 — Definir o que fica na nuvem para sempre

Ao fim do plano, a nuvem deve conter **apenas** o que passa no teste da seção 1:

| Fica | Qual das três razões |
|---|---|
| Firebase Auth | Identidade — e é compartilhado com outros produtos Global |
| Firestore | Estado compartilhado entre consultoras |
| Cloud Functions (comissões, lucro) | Reagem a escrita no Firestore; moram junto do dado |
| Cloud Run | **É por onde o trabalho passa**, desde a reversão do passo 4 — além do alcance externo |

Os dois primeiros são praticamente gratuitos no volume atual. O Cloud Run
continua sendo por onde o trabalho passa — e continua custando ~US$ 0, porque
escala a zero e o volume de uma equipe pequena cabe na cota gratuita.

---

## 6. O que não fazer

Cada linha aqui é um caminho que parece economia e não é.

- **Não pedir cota para máquina de build maior.** Paga-se todo mês para adiar o
  passo 2.
- **Não desligar a checagem de TypeScript** (`ignoreBuildErrors: true`) para o
  build caber na memória. Isso já esteve desligado e custou 59 erros
  acumulados, um `ReferenceError` garantido em execução e um recurso inteiro
  quebrado em silêncio. Memória não se compra com qualidade.
- **Não colocar `minScale` no Cloud Run.** Tiraria o cold start e transformaria
  um custo de ~US$ 0 em conta fixa mensal.
- **Não apagar as imagens recentes.** Cinco delas são a única forma de reverter
  um deploy ruim. A economia é de centavos; o risco é a produção.
- **Não desligar o Cloud Run "para economizar".** Ele custa ~US$ 0 parado e é a
  rede de segurança de quando a máquina do consultor não estiver disponível.

---

## 7. Como saber se está funcionando

Sem medição, este documento vira opinião. Três números para conferir de tempos
em tempos:

```bash
# 1. Depósito de imagens — deve ficar estável, nao crescer
gcloud artifacts repositories list --format="table(name,sizeBytes)"

# 2. Quantas imagens acumuladas — deve ficar em ~10
gcloud container images list-tags gcr.io/opus-sec/sync-app --format="value(digest)" | wc -l

# 3. O Cloud Run continua escalando a zero (nao pode aparecer minScale)
gcloud run services describe sync-app --region=us-central1 \
  --format="yaml(spec.template.metadata.annotations)" | grep -i scale

# 4. A politica de limpeza continua ativa (cleanupPolicyDryRun tem de estar ausente)
gcloud artifacts repositories describe gcr.io --location=us --format="json"
```

> **Lembre do atraso da métrica.** O item 1 leva horas para refletir uma
> exclusão. Comparar antes e depois no mesmo minuto sempre mostra "não mudou
> nada", e a conclusão errada seria abandonar a limpeza.

A política vive versionada em
[`scripts/deploy/politica-limpeza-imagens.json`](scripts/deploy/politica-limpeza-imagens.json) — configuração de
nuvem que não está no repositório é configuração que ninguém revisa. Para
reaplicar (ou restaurar depois de alguém mexer pelo console):

```bash
gcloud artifacts repositories set-cleanup-policies gcr.io --location=us \
  --policy=scripts/deploy/politica-limpeza-imagens.json --no-dry-run
```

Trocar `--no-dry-run` por `--dry-run` registra a política sem apagar nada — é
como conferir o efeito antes de valer.

O sinal de que o plano está funcionando não é a fatura cair de uma vez — é ela
**parar de subir sozinha** a cada deploy.
