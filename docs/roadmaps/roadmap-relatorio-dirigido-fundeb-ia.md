# Roadmap: Relatorio Dirigido com IA para Levantamento FUNDEB

## 1. Objetivo

Criar uma nova camada de relatorio dentro do ecossistema do `Levantamento FUNDEB` do Sync, voltada para apresentacoes institucionais e diagnostico comercial mais dirigido por municipio.

Essa nova camada nao vai substituir o relatorio tecnico atual. Ela vai operar por cima dele, combinando:

- dados oficiais e estruturados ja consolidados no Sync;
- pesquisa publica orientada por IA na internet;
- validacao cruzada de fontes;
- redacao executiva formal;
- marcacao explicita do que e dado confirmado, inferencia forte, pendencia manual ou ponto juridico a validar.

O caso piloto citado para guiar o desenho inicial e `Novo Gama/GO`.

---

## 2. O que ja existe hoje no projeto

O Sync ja possui base forte para a parte estruturada do levantamento:

- busca e resolucao municipal por `codigo IBGE`;
- consolidacao de relatorio FUNDEB via `core/lib/govia-compat.ts`;
- bloco oficial de receitas FUNDEB;
- censo escolar INEP consolidado;
- indicadores de aprendizagem/IDEB;
- enriquecimento FNDE publico;
- bloco fiscal SICONFI;
- exportacao autonoma de PDF do levantamento.

Arquivos centrais ja existentes:

- `core/lib/govia-compat.ts`
- `modules/levantamento-fundeb/levantamento-fundeb-page.tsx`
- `app/api/modulos/levantamento-fundeb/autonomo/route.ts`
- `core/lib/propostas-public-validation.ts`

Observacao importante: o projeto ja usa Gemini com `google_search` em `core/lib/propostas-public-validation.ts`. Isso reduz bastante o risco da nova camada, porque a base tecnica de integracao com a API do Google ja existe.

---

## 3. O problema que o novo modulo precisa resolver

O levantamento atual responde muito bem ao recorte tecnico e estruturado. O novo relatorio dirigido precisa responder perguntas que nao vivem apenas em API/banco:

- fatos institucionais locais;
- legislacao municipal;
- programas e politicas publicas em vigor;
- sinais de articulacao intersetorial;
- justificativas narrativas para oportunidades ou perdas;
- observacoes estrategicas para apresentacao comercial e institucional.

Em outras palavras: o modulo novo precisa funcionar como uma camada de `pesquisa orientada + validacao + formalizacao`.

---

## 4. Escopo inicial do relatorio dirigido

O primeiro recorte funcional do relatorio deve cobrir os itens abaixo.

### 4.1 Bloco de contexto municipal

- observacoes relevantes sobre a cidade;
- educacao roda em modelo `rede` ou `sistema`;
- quantidade de habitantes;
- ultimo ano de censo populacional confirmado;
- quantidade de escolas;
- quantidade de matriculas da rede;
- modalidades de ensino presentes;
- ultimo ano do censo escolar utilizado.

### 4.2 Bloco financeiro e operacional

- quanto o municipio esta recebendo de transporte escolar;
- sinais publicos sobre perda de recursos do FUNDEB;
- hipoteses documentadas sobre por que recursos foram perdidos;
- evidencias disponiveis e lacunas que ainda exigem validacao manual.

### 4.3 Bloco normativo e institucional

- existe projeto de lei de incentivo ao EJA;
- existe projeto de lei de bonificacao por boas praticas para professores, diretores e alunos;
- existe historico de formacao e capacitacao do quadro;
- existe parceria entre assistencia social e educacao para ativacao de base de EJA;
- existe parceria entre cultura e educacao com apoio de profissional de rua ou acao equivalente;
- existe base legal/financeira sobre o ponto do `ICMS e os 28%` citado por voce, com recorte especifico para Goias.

### 4.4 Bloco de pendencias de especialista

- item juridico/tributario a certificar com `Dr. Douglas`;
- itens que dependem de procuradoria, contador, controlador ou secretario;
- itens sem fonte oficial suficiente para afirmar no PDF final.

---

## 5. Recomendacao de IA Google

## Recomendacao principal

Para esse modulo, a direcao base passa a ser:

- `gemini-3.1-pro-preview` como motor principal do relatorio dirigido;
- `gemini-3-flash-preview` como motor auxiliar para tarefas de triagem, extracao e revalidacao rapida;
- `google_search` como ferramenta obrigatoria nas etapas de pesquisa web;
- `structured outputs` para devolver JSON fechado antes da etapa de redacao final.

Observacao importante de nomenclatura oficial, confirmada nas docs em `31 de marco de 2026`:

- o modelo geral mais atual e completo listado na pagina de modelos e `Gemini 3.1 Pro`, em status `Preview`;
- o modelo Flash de texto/multimodal listado atualmente e `Gemini 3 Flash Preview`, com model code `gemini-3-flash-preview`;
- `Gemini 3.1 Flash` aparece nas docs como `Gemini 3.1 Flash Live Preview`, voltado para `Live API`, nao como o modelo padrao de `generateContent`.

## Justificativa

Seu caso exige ao mesmo tempo:

- pesquisa web atual;
- raciocinio de varias etapas;
- consolidacao de fatos;
- validacao de evidencias;
- redacao formal;
- boa aderencia a saida estruturada.

Pelas fontes oficiais do Google:

- a pagina de modelos lista `Gemini 3.1 Pro` como a opcao de inteligencia mais avancada da familia atual;
- a mesma pagina lista `Gemini 3 Flash Preview` como a opcao equilibrada para velocidade, escala e frontier intelligence;
- a documentacao de `Gemini 3` indica suporte a contexto longo, thinking, search grounding, structured outputs e capacidades agenticas alinhadas ao seu caso;
- a documentacao oficial recomenda usar o `Google GenAI SDK` como biblioteca oficial de producao;
- a API suporta `Google Search` como ferramenta nativa;
- a API suporta `structured outputs`, que e exatamente o que precisamos para transformar pesquisa aberta em payload confiavel.

## Recomendacao objetiva de uso

### Escolha padrao para producao

Usar `gemini-3.1-pro-preview`.

Essa e a melhor opcao para:

- analisar municipio;
- pesquisar varias fontes;
- cruzar informacoes;
- decidir o que e confirmado e o que e pendencia;
- escrever relatorio final com qualidade.

### Escolha auxiliar de custo/velocidade

Usar `gemini-3-flash-preview`.

Essa e a melhor opcao para:

- buscar pistas iniciais;
- resumir paginas;
- classificar achados;
- preencher campos simples;
- rodar segunda passada de verificacao em lote.

### O que eu nao usaria como base principal agora

- `Gemini 3.1 Flash Live Preview` como base principal do modulo: eu nao usaria, porque ele e orientado a `Live API` e nao ao fluxo principal de pesquisa estruturada e geracao de markdown/PDF.
- `Deep Research Agent` do Google: interessante para investigacoes longas, mas nao e o melhor nucleo do fluxo principal porque o modulo precisa de controle fino, JSON estruturado, composicao com fontes internas e previsibilidade operacional.

## Conclusao da escolha

Se eu fosse implementar agora, eu comecaria com:

- modelo principal: `gemini-3.1-pro-preview`
- modelo auxiliar: `gemini-3-flash-preview`
- SDK: `@google/genai`
- ferramenta obrigatoria: `google_search`
- saida obrigatoria na fase analitica: `JSON estruturado`
- observacao operacional: se voce quiser tambem uma camada conversacional em tempo real no futuro, o candidato coerente da familia atual e `Gemini 3.1 Flash Live Preview`

---

## 6. Principio arquitetural do modulo

O novo relatorio nao deve pedir para a IA "escrever tudo de uma vez".

O fluxo correto e em camadas:

1. coletar o que o Sync ja sabe com alto grau de confianca;
2. descobrir o que falta responder;
3. mandar a IA pesquisar so as lacunas;
4. exigir retorno estruturado por item;
5. validar fontes e classificar nivel de confianca;
6. so depois gerar a narrativa final.

Isso evita:

- alucinacao;
- perda de rastreabilidade;
- PDF bonito com base fraca;
- mistura de dado oficial com inferencia solta.

---

## 7. Matriz de fontes por tipo de informacao

## Camada A: fonte interna/oficial ja estruturada no Sync

Usar sem depender da IA para inventar:

- IBGE;
- INEP censo;
- IDEB/QEdu oficial ja consolidado;
- FNDE/FUNDEB;
- SICONFI;
- blocos publicos FNDE/SIMEC ja integrados.

## Camada B: pesquisa web orientada por IA

Usar Gemini com `google_search` para localizar e resumir:

- site oficial da prefeitura;
- portal da transparencia;
- diario oficial;
- camara municipal;
- secretaria municipal de educacao;
- legislacao municipal;
- noticias oficiais do municipio;
- paginas oficiais do estado de Goias;
- paginas oficiais do FNDE/MEC/Tesouro quando o tema exigir contexto externo.

## Camada C: validacao manual obrigatoria

Nunca fechar automaticamente no PDF final sem revisao humana quando envolver:

- interpretacao juridica;
- regra tributaria/constitucional;
- tese sobre ICMS e vinculacao de recurso;
- motivo de perda de repasse sem documento oficial suficiente;
- afirmacao politica sensivel;
- acusacao de falha da gestao sem evidencia robusta.

---

## 8. Estrutura de dados que o novo relatorio deve produzir

Antes de gerar o markdown/PDF final, a IA deve devolver um objeto estruturado com esse perfil:

```ts
interface RelatorioDirigidoMunicipio {
  municipio: string;
  uf: string;
  codigoIbge: string;
  geradoEm: string;
  modeloIa: string;
  resumoExecutivo: string;
  itens: Array<{
    id: string;
    titulo: string;
    pergunta: string;
    resposta: string;
    status: "confirmado" | "sinalizado" | "pendente_manual" | "nao_encontrado";
    confianca: number;
    fontes: Array<{
      url: string;
      titulo: string;
      tipo: "oficial" | "institucional" | "imprensa" | "base_interna";
    }>;
    observacoes: string[];
  }>;
  pendenciasHumanas: string[];
  alertasJuridicos: string[];
  proximosPassos: string[];
}
```

Esse payload deve ser o contrato do modulo. A narrativa final vem depois.

---

## 9. Etapas de implementacao

## Etapa 1: desenhar o contrato do novo relatorio

Objetivo:

- definir exatamente quais perguntas o modulo responde;
- separar `dado estruturado`, `dado pesquisavel`, `dado juridico sensivel` e `pendencia humana`.

Entregas:

- tipo TS do `RelatorioDirigidoMunicipio`;
- lista fechada de perguntas do primeiro MVP;
- classificacao de fonte por prioridade.

Resultado esperado:

- o modulo passa a ter escopo controlado;
- a IA deixa de trabalhar em prompt aberto e passa a trabalhar em schema.

## Etapa 2: inventario das fontes ja disponiveis

Objetivo:

- mapear tudo que ja sai de `buildGoviaMunicipioCompleto`;
- marcar quais itens do relatorio novo ja podem ser preenchidos sem IA.

Entregas:

- tabela `pergunta -> origem`;
- lista de campos preenchidos internamente;
- lista de lacunas que dependem de pesquisa web.

Resultado esperado:

- evitar custo desnecessario de IA;
- usar IA apenas onde ela realmente agrega.

## Etapa 3: criar servico de pesquisa publica por municipio

Objetivo:

- implementar uma camada nova, separada do levantamento tecnico, para pesquisa web orientada.

Sugestao de arquivo:

- `core/lib/fundeb-directed-report-ai.ts`

Responsabilidades:

- montar prompt com contexto do municipio;
- acionar `google_search`;
- pedir retorno em JSON;
- registrar consultas, fontes e confianca;
- normalizar a resposta da IA.

Resultado esperado:

- um servico reutilizavel, nao acoplado ao componente React.

## Etapa 4: criar pipeline de validacao em duas passadas

Objetivo:

- reduzir erro e aumentar rastreabilidade.

Passada 1:

- `gemini-3-flash-preview` faz descoberta ampla e preenche rascunho estruturado.

Passada 2:

- `gemini-3.1-pro-preview` revisa os pontos mais importantes, reclassifica confianca e formaliza.

Regra:

- qualquer item sem fonte oficial suficiente vira `pendente_manual` ou `sinalizado`.

Resultado esperado:

- menos alucinacao;
- mais previsibilidade.

## Etapa 5: separar claramente fato, inferencia e parecer

Objetivo:

- impedir que o relatorio final misture evidencia com opiniao.

Blocos no texto final:

- `Fato confirmado`
- `Leitura tecnica`
- `Pendencia de validacao`
- `Acao recomendada`

Resultado esperado:

- documento mais defensavel comercialmente e juridicamente.

## Etapa 6: integrar ao Sync como nova experiencia dentro do modulo atual

Objetivo:

- adicionar essa camada sem quebrar o fluxo do `Levantamento FUNDEB`.

Caminho recomendado:

- manter `Levantamento FUNDEB` como modulo principal;
- adicionar dentro dele um novo tipo de saida, algo como:
  - `levantamento tecnico`
  - `apresentacao executiva`
  - `relatorio dirigido com IA`

Motivo:

- reaproveita base de municipio, codigo IBGE, payload atual e exportacao;
- evita fragmentar a experiencia em modulos demais agora.

## Etapa 7: gerar preview em markdown antes do PDF

Objetivo:

- validar o conteudo antes de investir em template final.

Entrega:

- exportacao `.md` do relatorio dirigido;
- depois conversao para PDF.

Motivo:

- markdown facilita auditoria interna;
- muito mais rapido iterar estrutura, linguagem e blocos de fonte.

## Etapa 8: piloto controlado com Novo Gama/GO

Objetivo:

- provar o fluxo com um municipio real.

Checklist do piloto:

- carregar base interna do municipio;
- preencher automaticamente o que ja existe no Sync;
- rodar pesquisa web para lacunas;
- validar itens normativos e institucionais;
- gerar primeiro markdown;
- revisar manualmente os pontos juridicos;
- ajustar prompt, schema e prioridade de fontes.

Critério de aceite do piloto:

- o relatorio precisa sair com fontes rastreaveis;
- nenhuma afirmacao sensivel pode sair sem evidencia;
- as pendencias humanas precisam aparecer explicitamente;
- o texto precisa servir para apresentacao comercial real.

---

## 10. Itens do caso Novo Gama que devem entrar como perguntas canonicas do MVP

Essas perguntas devem virar campos fixos do schema inicial:

- Quais observacoes institucionais relevantes sobre a cidade aparecem nas fontes oficiais?
- A educacao municipal opera em rede municipal, sistema municipal ou outro arranjo formal?
- Qual a populacao mais recente disponivel e qual o ano de referencia?
- Quantas matriculas existem na rede e como se distribuem por modalidade?
- Qual foi o ultimo ano de censo escolar usado no relatorio?
- Quantas escolas existem no recorte municipal?
- Quanto o municipio recebe de transporte escolar e em qual fonte isso foi localizado?
- Existe projeto de lei, programa ou acao institucional de incentivo ao EJA?
- Existe projeto de lei, programa ou normativa de bonificacao por boas praticas?
- Ha evidencias publicas de formacao e capacitacao do quadro?
- Ha evidencias de articulacao entre assistencia social e educacao para EJA?
- Ha evidencias de articulacao entre cultura e educacao com acao de rua ou apoio equivalente?
- O ponto do ICMS e dos 28% possui base normativa aplicavel a Goias?
- Existem evidencias publicas sobre perda dos tres recursos do FUNDEB? Se sim, quais? Se nao, o item deve ser tratado como pendencia de apuracao.

---

## 11. Decisoes tecnicas recomendadas

## Decisao 1

Nao deixar a IA gerar o PDF final direto.

Primeiro:

- JSON estruturado
- depois markdown validavel
- depois PDF

## Decisao 2

Nao usar apenas prompt longo.

Fazer schema fixo + lista fixa de perguntas.

## Decisao 3

Nao confiar em uma unica passada.

Usar:

- passada de descoberta;
- passada de revisao;
- opcionalmente uma passada final de redacao.

## Decisao 4

Registrar sempre as fontes retornadas.

Cada item do relatorio precisa carregar:

- URL;
- titulo da fonte;
- tipo da fonte;
- confianca;
- status de validacao.

## Decisao 5

Manter o que ja esta em `core/lib/propostas-public-validation.ts` como referencia de integracao, mas nao reaproveitar o prompt literalmente.

O fluxo novo precisa de:

- schema mais rico;
- perguntas mais amplas;
- duas camadas de validacao;
- integracao com o payload interno do FUNDEB.

---

## 12. Ordem pratica dos proximos passos

### Passo 1

Mapear no codigo atual quais campos do novo relatorio ja saem de `buildGoviaMunicipioCompleto`.

### Passo 2

Definir o schema TS do `RelatorioDirigidoMunicipio`.

### Passo 3

Criar `core/lib/fundeb-directed-report-ai.ts` usando Gemini.

### Passo 4

Implementar retorno estruturado com `google_search`.

### Passo 5

Adicionar rota interna para gerar o markdown do relatorio dirigido.

### Passo 6

Adicionar preview na interface do modulo `levantamento-fundeb`.

### Passo 7

Rodar piloto completo com `Novo Gama/GO`.

### Passo 8

Depois do piloto, partir para template PDF.

---

## 13. Recomendacao final

O melhor caminho nao e criar uma IA "solta" que pesquisa e escreve livremente.

O melhor caminho e criar uma `camada de inteligencia dirigida` dentro do modulo atual, com este desenho:

- base oficial do Sync como ancora;
- Gemini com `google_search` para preencher lacunas;
- `gemini-3.1-pro-preview` como cerebro principal;
- `gemini-3-flash-preview` como apoio operacional;
- saida estruturada antes de narrativa;
- classificacao clara entre confirmado, sinalizado e pendente manual.

Esse desenho atende exatamente o que voce quer:

- buscar dados na internet;
- validar;
- formalizar;
- pensar;
- construir um relatorio serio;
- e ainda manter o Sync controlavel, auditavel e defendivel.

---

## 14. Fontes oficiais usadas para a escolha do modelo

- Google AI for Developers, Models: https://ai.google.dev/gemini-api/docs/models
- Google AI for Developers, Thinking: https://ai.google.dev/gemini-api/docs/thinking
- Google AI for Developers, API Libraries: https://ai.google.dev/gemini-api/docs/libraries
- Google AI for Developers, Google Search tool: https://ai.google.dev/gemini-api/docs/google-search
- Google AI for Developers, Structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Google AI for Developers, Release notes: https://ai.google.dev/gemini-api/docs/changelog
