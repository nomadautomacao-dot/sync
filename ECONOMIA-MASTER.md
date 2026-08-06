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

| Item | Consumo real | Estimativa/mês |
|---|---|---|
| Imagens Docker guardadas | 63 GB, 100 imagens | ~US$ 6 |
| Cloud Build | ~14 builds em agosto, `E2_HIGHCPU_8` | ~US$ 2–3 |
| Cloud Run | escala a zero, 2 vCPU / 2 GB | ~US$ 0 |
| Firestore | volume pequeno | ~US$ 0 |

**O grosso não é processamento — é depósito.** As imagens Docker eram 92% do
custo, e eram lixo: 100 imagens de abril a julho, sem política de limpeza,
crescendo ~580 MB por deploy, para sempre.

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

### Passo 1 — Parar a hemorragia do depósito *(feito em 2026-08-05)*

Apagadas as imagens antigas, preservando a que está no ar e as 5 mais recentes
para reversão. Falta configurar **política de limpeza automática** no Artifact
Registry, senão o problema volta sozinho em três meses.

> Regra: guardar as 10 mais recentes, apagar o resto. Sem isso, todo deploy
> acrescenta custo permanente.

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

### Passo 3 — Reavaliar a máquina de build

Só depois do passo 2, porque antes dele nada cabe.

Hoje o `cloudbuild.yaml` fixa `E2_HIGHCPU_8`. Escolher uma máquina específica
**abre mão dos 2.500 minutos grátis por mês** que o Google dá na máquina padrão.
E a padrão (`e2-standard-2`) tem **os mesmos 8 GB** — muda o número de núcleos,
não a memória.

Como o gate já roda em um processo só, os oito núcleos não servem para nada.
Depois do passo 2, a troca provavelmente zera o custo de build.

> **Não peça cota para máquina maior.** É o caminho oposto ao deste documento:
> paga-se mensalmente para não consertar a causa. `E2_HIGHCPU_32` já foi
> tentado em 2026-08-05 e nem está disponível nesta região.

### Passo 4 — O desktop vira o caminho principal

O app Electron já existe, roda em macOS e Windows com o mesmo código, e já
produz relatório melhor que a nuvem (seção 2).

O que falta para ele ser o caminho padrão, e não a alternativa:

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
| Cloud Run | Alcance externo — e reserva para quando a máquina não estiver disponível |

Os dois primeiros são praticamente gratuitos no volume atual. O Cloud Run
continua existindo, mas deixa de ser por onde o trabalho passa.

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
```

O sinal de que o plano está funcionando não é a fatura cair de uma vez — é ela
**parar de subir sozinha** a cada deploy.
