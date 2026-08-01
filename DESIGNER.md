# Brief de design — Global Sync

> Documento para colar inteiro num assistente de design. Ele descreve o produto,
> quem usa, o que já foi tentado e o que deu errado. O pedido concreto está no
> fim, em **O que eu quero de você**.

---

## 1. O produto, sem marketing

**Global Sync** é a ferramenta interna da Rocha Prime, uma consultoria educacional
que trabalha com prefeituras brasileiras. O trabalho é este: pegar dados públicos
de um município — repasses do FUNDEB, censo escolar, indicadores de saúde, obras
federais, dados fiscais — e transformar em documento que se põe na mesa de um
secretário de educação.

O sistema **emite doze tipos de documento em PDF**, de 4 a 130 páginas, montados
ao vivo a partir de cerca de **dezenove fontes públicas de governo** (FNDE, INEP,
IBGE, DATASUS, SICONFI, CAGED, TSE, Portal da Transparência). Além de emitir,
guarda: cada município tem uma pasta digital com relatórios, contratos e anexos.

Não é um SaaS com milhares de clientes. São **duas a cinco pessoas**, uma carteira
de **dezessete municípios hoje**, com meta de crescer para algumas centenas.

**A frase que resume:** é uma bancada de trabalho que produz documentos densos a
partir de dados públicos instáveis.

---

## 2. Quem usa — e este é o ponto central

Hoje o sistema tem **um perfil só**, o do dono. Precisa ter dois, e eles são
muito diferentes.

### Perfil A — o técnico (uma pessoa, o dono)

Opera tudo: adiciona município, dispara emissão, acompanha o pipeline comercial,
vê receita estimada, probabilidade de fechamento, comissão de colaborador,
configura o workspace. **Quer densidade.** Quer ver dezessete municípios numa
tela sem rolar, ordenar por qualquer coluna, e disparar ação sem procurar.

Trabalha em MacBook Air 13", janela quase sempre cheia, às vezes em meia tela.

### Perfil B — a consultora pedagoga (várias pessoas, é quem cresce)

Formação em pedagogia, não em dados. Vai ao município, senta na frente do
secretário de educação ou do prefeito e **mostra o material na própria tela do
notebook, girando a tela para o outro lado da mesa**.

O que ela precisa: encontrar o município, ver o que já existe de material, abrir
um relatório e apresentá-lo, gerar o que faltar.

O que ela **não pode ver** — e aqui há risco real de constrangimento comercial:
receita estimada, probabilidade de fechamento, comissão, margem, pipeline. Se ela
girar a tela e o prefeito ler "probabilidade de fechamento: 40%", o dano é
concreto.

**Consequência de design que quero explícita:** existe um terceiro par de olhos
que não é usuário do sistema — o cliente do outro lado da mesa. A tela é lida por
alguém que nunca a viu antes, de cabeça para baixo, a um metro de distância. Isso
não é "modo apresentação" opcional; é a condição normal de uso do Perfil B.

---

## 3. Como o software roda

- **Desktop apenas.** Não há uso em celular, e não vai haver. Pode ignorar
  breakpoints de telefone por completo. Faixa real: **1280px a 1680px**.
- Roda em duas formas: no navegador e num **app Electron** que embarca o mesmo
  servidor. No app não há barra de endereço nem abas do navegador — a janela é o
  produto inteiro.
- Sem CDN: tudo precisa ser local (fontes, ícones, estilos).
- Interface **em português do Brasil**. Vocabulário do domínio é fixo e não se
  traduz nem se simplifica: FUNDEB, VAAF, VAAT, VAAR, IBGE, IDEB, Censo Escolar,
  matrícula ponderada, inexigibilidade.

---

## 4. As telas que existem, com números reais

| Tela | O que mostra | Volume real hoje | Volume em 2 anos |
|---|---|---|---|
| Painel | Resumo do dia | ~6 indicadores | idem |
| **Cidades** | Carteira de municípios | 17 linhas × 8 colunas | 300+ linhas |
| **Ficha da cidade** | 4 abas: visão geral, dados FUNDEB, relatórios, documentos | 43 documentos no total | 30+ por município |
| **Relatórios (emissão)** | Escolher município → emitir 1 de 12 documentos | 12 documentos fixos | 20+ |
| Pipeline | Kanban comercial por estágio | 17 cartões, 7 estágios | 300+ |
| Empresas / Pessoas | Cadastros | dezenas | centenas |
| Documentos | Todos os arquivos, cross-município | 43 | milhares |

**A ficha da cidade é a tela mais carregada** e a que mais cresce: hoje tem 1.158
linhas de código porque cada aba foi desenhada sob medida.

---

## 5. A restrição mais própria deste produto: o dado falta, e isso é normal

Os dados vêm de APIs de governo que caem, mudam de formato, respondem vazio ou
demoram minutos. Um mesmo relatório sai com **dezenove fontes vivas numa máquina
e dezessete em outra**.

Portanto, no desenho, **ausência de dado é estado de primeira classe, não erro**:

- Todo número tem **fonte e ano** (`FNDE, 2024`), e isso é obrigatório: o material
  vai para gestor público e precisa ser defensável.
- Um valor pode ser **"não disponível"** legitimamente. Precisa parecer honesto,
  não quebrado.
- Um número pode ser **preliminar** (Censo 2022 ainda tem resultado de amostra
  provisório) e isso precisa aparecer sem virar poluição.
- Operações demoram: emitir um documento leva de **1 a 5 minutos**, e a fila de
  quatro documentos leva de 8 a 15. Espera longa é rotina, não exceção.
- Emissão falha às vezes, e a falha precisa ficar visível até alguém resolver —
  um documento que faltou e ninguém viu é descoberto na frente do cliente.

---

## 6. O que já existe, e por que estou trocando

A direção atual chama-se **"Console Soft"**: glassmorphism, fundo lavanda em
gradiente, cartões de vidro flutuantes, cantos de 16–20px, sombras suaves, accent
quase-preto `#16181D`, pastéis para estágios de pipeline. Duas famílias
tipográficas: uma de interface e uma monoespaçada para número.

**O que funciona e quero preservar:** o accent quase-preto (sóbrio, adequado a
material que vai para prefeitura), a separação tipográfica interface/dado, a
paleta neutra fria.

**O que não funciona:**

1. **Foi desenhado para caber pouco.** Cada município era um cartão de 300×250px
   para carregar seis informações; cabiam seis numa tela de dezessete. Já troquei
   essa tela por tabela e a diferença foi enorme — quero essa lição aplicada ao
   sistema inteiro.
2. **Cada tela é peça única.** Não existem primitivas reutilizáveis, então
   acrescentar conteúdo obriga a redesenhar a tela. É o problema que mais dói.
3. **Sobra decoração e falta informação.** Quatro cartões coloridos gastavam
   110px de altura para exibir quatro números, um dos quais já estava no título.
4. **Parece SaaS genérico.** É uma ferramenta de dados usada por profissionais,
   não um produto de aquisição. O visual promete leveza onde deveria prometer
   competência.

---

## 7. Referências de mercado — o que pegar e o que rejeitar

Quero que você use estas referências de forma analítica: cada uma resolve um
pedaço, e nenhuma serve inteira.

| Referência | O que pegar | O que rejeitar |
|---|---|---|
| **Linear** | Densidade sem aperto; um accent só; teclado como caminho principal; estados de lista impecáveis | Identidade escura e "de engenheiro"; a consultora não é dev |
| **Stripe Dashboard** | Número com procedência ao lado; vazios que explicam; hierarquia entre valor e rótulo | Excesso de gráfico decorativo |
| **Retool / consoles administrativos** | Tabela como cidadã de primeira classe; ação por linha | Cara de CRUD genérico, sem opinião |
| **Terminais financeiros (Bloomberg)** | Monoespaçado para número, alinhamento à direita, varredura vertical rápida | Feiura funcional — esta tela é vista por prefeitos |
| **Leitores de documento (Notion, Craft)** | Calma na leitura longa; tipografia confortável | Fluidez de documento onde precisa haver estrutura fixa |
| **Portais de dado público (IBGE Cidades)** | Fonte e ano sempre visíveis; vocabulário oficial | Densidade governamental sem hierarquia |

A síntese que procuro: **densidade de console, sobriedade de documento oficial.**
Uma ferramenta que, quando girada para o outro lado da mesa, faz o gestor pensar
"essas pessoas sabem o que estão fazendo".

---

## 8. O que eu quero de você

**Três variações completas de sistema de design** — não três skins da mesma
coisa. Cada uma deve ser uma aposta diferente, com trade-off nomeado, e deve
mostrar as mesmas três telas para eu poder comparar de verdade:

1. **Cidades** — lista/tabela de 17 municípios com filtro, ordenação e ação
2. **Ficha da cidade** — abas, com a aba de documentos cheia (30 arquivos)
3. **Emissão de relatórios** — 12 documentos disponíveis, 1 gerando, 3 na fila,
   1 falhado

Para cada variação, entregue:

- **Nome e tese em uma frase** ("o que esta aposta acredita")
- **Tokens**: cor, tipografia (escala completa), espaçamento, raio, sombra,
  borda — em valores concretos, prontos para virar CSS
- **Três a quatro primitivas de layout** que cubram todas as telas do sistema:
  a tela-tabela, a tela-ficha-com-abas, a tela-formulário, a tela-de-ação. Quero
  poder construir a décima terceira tela sem redesenhar nada.
- **Os estados obrigatórios**, desenhados e não apenas mencionados: carregando,
  vazio, erro, **dado parcial** (metade das fontes respondeu), **operação longa
  em segundo plano** (fila de emissão), **falha que precisa continuar visível**
- **A regra dos dois perfis**: o que a consultora vê, o que some, e como o mesmo
  layout se comporta nos dois casos sem virar duas interfaces
- **Como um número se apresenta com fonte e ano** — este é o átomo mais repetido
  do sistema inteiro, quero ele resolvido explicitamente

### Critérios pelos quais vou escolher

1. Quantos municípios cabem na tela de Cidades sem rolar, em 1440px
2. O que acontece quando o conteúdo dobra — a tela aguenta ou precisa ser
   redesenhada
3. Se a tela girada para o cliente transmite competência
4. Se a consultora consegue achar e abrir um relatório sem treinamento
5. Se dá para construir uma tela nova só compondo as primitivas

### Regras rígidas

- Nada de tema escuro como identidade principal (material impresso e reunião
  diurna)
- Nada que dependa de recurso externo (fonte, ícone ou script de CDN)
- Sem tom lúdico, sem ilustração, sem mascote: o interlocutor final é gestor
  público
- Contraste mínimo AA; a tela é lida a um metro de distância por pessoas que não
  a conhecem
- Português do Brasil em toda a interface

### O que não quero

- Três paletas da mesma estrutura
- Componentes soltos sem regra de composição
- Telas de exemplo com dado fictício redondo: use números reais deste brief
  (17 municípios, 43 documentos, 42 páginas, 12 tipos de documento)
