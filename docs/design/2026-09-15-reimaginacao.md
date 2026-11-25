# Global Sync — mapa da reformulação

Data: 15/09/2026. Status: proposta para discussão, com prévia local navegável.

## 1. Direção recomendada

**Console editorial:** organização de CRM, identidade tipográfica forte e leitura confortável de dados municipais. Superfícies claras, texto quase-preto, verde-lima em pequenos pontos de identidade. Tabelas continuam sendo a base de trabalho.

Referências escolhidas pelo usuário:

- [CRM Dashboard, Ronas IT](https://dribbble.com/shots/25742359-CRM-Dashboard-App-Design): navegação lateral discreta, ferramentas próximas do conteúdo, neutralidade, cartões de pipeline organizados. A página apresenta também busca, filtros e indicadores. Aproveitar esses princípios na operação do Sync.
- [Mission, Taras Migulko](https://dribbble.com/shots/27388289-Mission-responsive-landing-page): composição editorial, tipografia marcante, preto e lima. Usar a identidade no login, marca e títulos; reduzir sua escala nas telas densas. O autor descreve a referência como protótipo, com apenas o menu funcional: ela não especifica estados operacionais de um sistema.

A combinação é uma interpretação para o Sync; medidas, tipografia exata e comportamento interno das referências não foram disponibilizados. Não são especificações extraídas do Figma.

## 2. O que foi auditado

Inventário das 15 páginas de produto (14 autenticadas + login), dos componentes associados, tema, shell, permissões e fila. O catch-all é encaminhamento, não uma 16ª tela de produto. Amostra visual das duas referências conferida no navegador.

**Limite da auditoria:** as telas autenticadas atuais foram analisadas pelo código, sem sessão do usuário. Não foi feita validação visual da aplicação atual em produção. Números do brief antigo (17 cidades, 43 arquivos) são históricos, não leitura da base atual. A prévia usa dados demonstrativos explicitamente identificados.

### Base técnica verificada

- Next.js 16 / React 19, Ant Design 6 e Pro Components 3 beta, já instalados.
- `core/design/tema-ant.ts` é a fonte de aparência atual; `app/globals.css` só resolve a base do documento.
- `DESIGN.md` e os HTMLs antigos representam direções anteriores. O README ainda cita Tailwind, embora o pacote atual e o código tenham migrado para Ant.
- A skill `.claude/skills/interface-ant/SKILL.md` orienta usar componentes Ant e tokens. A proposta mantém essa base.
- Fontes configuradas: Instrument Sans e IBM Plex Mono, via `next/font`. Entrega ao navegador é local; obtenção no build ainda precisa ser considerada em ambientes sem rede.
- A fila global já existe: `core/providers/fila-emissao-provider.tsx`. Processa um documento por vez; navegar entre telas não interrompe; fechar a janela interrompe o processamento e a fila é retomada ao reabrir. Não prometer execução contínua com o app fechado.
- O catálogo `modules/cidades/documentos-emissiveis.ts` tem **13 tipos**, não os 12 do brief anterior. O catálogo de Módulos mostra três ferramentas ativas: Levantamento FUNDEB, Case de Sucesso e Contrato.

### Problemas concretos e consequência

| Achado no código | Consequência provável | Tratamento |
|---|---|---|
| Cidades define `scroll.x = 1400`; sidebar ocupa 240 px | Colunas excedem a área útil de um notebook; ações e campos se afastam | Visão operacional com 6 colunas essenciais; colunas comerciais opcionais; rolagem confinada à tabela quando necessária |
| Ficha tem até 8 abas e a pasta está no menu de opções | Relatórios, dados e arquivos têm múltiplos pontos de entrada | Documento como destino explícito; agrupar atendimento e separar dado de emissão |
| Ficha concentra 1.244 linhas, Documentos 802, emissão 849 | Alterações de composição têm alto custo de revisão | Extrair seções de domínio com contratos claros; não recriar componentes básicos do Ant |
| Varredura encontrou 255 declarações de tamanho entre 9 e 11, inclusive decimais, em 58 arquivos TSX | Rótulos e metadados podem ficar pequenos na apresentação presencial | Corpo 14, secundário 12, escala padronizada; revisar contraste real após renderização |
| Títulos variam entre níveis 3/4, blocos próprios e título do ProTable | A navegação visual muda de uma área para outra | Mesmo padrão de título, contexto, ação principal e filtros |
| Header global só existe no Painel; sidebar concentra notificações | Recursos globais têm localização desigual | Busca e fila acessíveis no shell sem repetir cabeçalho alto nas listas |
| 5 literais de cor em 3 componentes de pipeline | Tema não controla toda a identidade | Mover cores para tema ou mapa semântico central |
| Painel renderiza receita/lucro e Cidades inclui probabilidade sem filtro interno por perfil nesses arquivos | Liberação de área precisa ser conciliada com separação de dados comerciais | Revisar matriz área × conteúdo; validar com contas de teste antes de migrar |

As contagens são evidência estrutural, não prova de defeito em cada ocorrência. O ponto de permissões é uma pendência de revisão de comportamento; não foi testado como incidente de acesso. A ficha já usa `podeVerAdministrativo` e `podeVerComercial`; reutilizar a política existente e conferir também as regras de leitura.

## 3. Mapa de todas as telas

Os caminhos abaixo são relativos à raiz do repositório. P0 = fundação/piloto, P1 = fluxo principal, P2 = expansão.

| Rota / arquivo `page.tsx` | Conteúdo atual | Direção proposta | Prioridade |
|---|---|---|---|
| `app/(auth)/entrar` | E-mail, Google, recuperação, sessão e saúde da API | Duas áreas: marca editorial e formulário direto; lima pontual; falha junto do campo; preservar autenticação | P2 |
| `app/(sync)/painel` | Receita, lucro estimado, reuniões, pipeline, agenda e tabela | Visão do dia com pendências e próximas ações; indicadores comerciais conforme perfil; no máximo um gráfico que responda uma pergunta | P1 |
| `app/(sync)/cidades` | Carteira em ProTable, responsáveis, atividade, contagens e estágio | Cabeçalho compacto, busca simples, filtros, tabela essencial e ação explícita para ficha | P0 |
| `app/(sync)/cidades/[cityId]` | Linha do tempo, contatos, cronograma, contrato, projetos, panorama, FUNDEB/documentos, relatórios e pasta | Ficha com contexto persistente e 5 grupos; Documentos visível; emissão sempre vinculada à cidade | P0/P1 |
| `app/(sync)/pipeline` | Kanban/lista, KPIs, estágios, detalhe e cadastro | Colunas discretas, totais legíveis, próxima ação em cada cartão; seleção e foco explícitos; manter alternativa por lista | P1 |
| `app/(sync)/documentos` | Acervo global, habilitação e geração de contrato | Biblioteca com contexto municipal, categoria, versão e vencimento; agrupar tarefas administrativas sem duplicar emissão | P1 |
| `app/(sync)/modulos` | Três módulos ativos e retomada | Catálogo por tarefa com descrição curta e último contexto; sem prometer ferramentas ainda sem tela | P1 |
| `app/(sync)/modulos/levantamento-fundeb` | Busca IBGE, dados, 13 documentos, projeção e censo | Bancada de emissão: cidade → tipo → fila → arquivo. Dados/fonte/ano e disponibilidade antes da ação | P0/P1 |
| `app/(sync)/modulos/contratos` | Seleção de cidade e entrada na aba Contrato | Entrada coerente com biblioteca e ficha, preservando URL e acesso administrativo | P1 |
| `app/(sync)/modulos/case-de-sucesso` | Seleção das redes, período, evolução e geração de deck | Formulário de seleção + resumo do que o material mostrará + estado persistente da geração | P2 |
| `app/(sync)/pessoas` | KPIs, tabela, detalhe, cadastro, comissões | Lista e Drawer; separar identidade, vínculos e remuneração conforme permissão | P2 |
| `app/(sync)/caixa` | Mural e auditoria | Duas tarefas claras: equipe e registros. Pendente precisa de ação e contexto; não competir com fila de documentos | P2 |
| `app/(sync)/ajustes` | Grupo, integrações, acessos, perfis e dados locais | Configuração por assunto, explicação junto do controle; remover detalhes de biblioteca da experiência comum | P2 |
| `app/(sync)/sistemas` | Catálogo/estado dos sistemas administrados | Lista de sistemas com saúde e acesso ao detalhe; identidade comum ao restante do console | P2 |
| `app/(sync)/sistemas/[sistema]` | Prefeituras, usuários, registro e ações de conta | ProTable + formulários/gavetas consistentes; preservar confirmações e autorização das ações administrativas | P2 |

### Componentes transversais incluídos no escopo

- Shell: sidebar, header, busca, notificações, ajuda, perfil, navegação recolhida.
- Entrada/cadastro: recuperação de senha, wizard de novo levantamento, nova cidade, responsáveis, pessoas, prefeituras e usuários.
- Cidade: eventos, comentários, contatos, cronograma, iniciativas/projetos, contrato e bloco comercial.
- Documentos: upload, versão, vínculo com projeto/relatório, pasta, habilitação, geração e visualizador PDF/DOCX.
- Operação: fila persistente, falha de emissão, dados parciais, gráficos, fonte/ano e estados vazios.
- Administração: grade de permissões, acesso da pessoa, links de conta e log de dados locais.

## 4. Arquitetura de informação proposta

**Menu principal:** Painel · Cidades · Documentos · Módulos. **Trabalho da equipe:** Caixa de entrada · Pessoas. **Gestão:** Pipeline · Sistemas · Ajustes. A visibilidade continua derivada do catálogo de áreas e das permissões. Agrupar visualmente não muda autorização nem URL.

### Ficha municipal — cinco grupos

1. **Visão geral:** panorama, próximos compromissos e situação dos dados.
2. **Atendimento:** linha do tempo, contatos, cronograma e projetos em subabas. Links existentes devem continuar abrindo a seção certa.
3. **Documentos:** pasta, relatórios emitidos, anexos e versões; filtro de categoria. Reutilizar consultas e visualizador, evitando duplicar registros.
4. **Dados FUNDEB:** valores, censo, projeção, fonte/ano e limitações. Emissão permanece acessível pela ação do cabeçalho.
5. **Contrato:** somente para quem tem acesso administrativo.

A ordem inicial precisa ser validada em duas tarefas: retomar atendimento e apresentar um documento. Manter redirecionamento para os atuais parâmetros `?aba=...`; não quebrar links salvos.

### Quatro padrões de composição

| Padrão | Peças existentes do Ant | Telas |
|---|---|---|
| Lista operacional | ProTable + busca/filtros + ação principal + Drawer | Cidades, Documentos, Pessoas, Sistemas |
| Ficha de entidade | Contexto compacto + Tabs + ProDescriptions + seções de domínio | Cidade, pessoa, sistema |
| Formulário de tarefa | ProForm + validação + resumo + resultado | Cadastro, contrato, case, ajustes |
| Bancada de emissão | Seletor municipal + tabela de tipos + Alert + fila global + visualizador | Levantamento e documentos da cidade |

O padrão é uma regra de composição, não uma biblioteca paralela de botões e inputs. O shell atual usa `Layout/Sider`, enquanto a skill recomenda `ProLayout`: a prévia exercita ProLayout; eventual migração precisa preservar navegação, notificações, permissões e fila.

## 5. Sistema visual proposto

Valores iniciais de projeto, sujeitos à validação nas telas reais:

| Papel | Valor / regra |
|---|---|
| Fundo | `#F7F7F2`, neutro levemente quente inspirado no CRM |
| Superfície | `#FFFFFF`; superfície secundária `#F0F0E9` |
| Texto principal / primário | `#171A17` |
| Texto secundário | `#62665D`; evitar atenuar conteúdo essencial |
| Borda | `#DDDFD5` |
| Identidade lima | `#E4FB02`, derivada da paleta publicada da Mission, sempre com texto escuro |
| Foco | Contorno visível; lima não é suficiente como única borda em fundo branco |
| Estados | Sucesso/atenção/erro do Ant, com rótulo/ícone; lima nunca significa sucesso |
| Família | Instrument Sans para UI; IBM Plex Mono para dados e códigos |
| Escala | Título de entrada 40–48; título de página 28–32; seção 18–20; corpo 14; auxiliar 12 |
| Número | 14 em tabela, 24–28 em resumo; tabular, alinhado à direita |
| Espaçamento | 4 / 8 / 12 / 16 / 24 / 32 |
| Raios | 8 em controles, 12 em superfícies; circular só avatar/ícone quando cabível |
| Sombra | Nenhuma na superfície normal; elevação apenas em popover/Drawer/Modal |
| Geometria | Sidebar 208–224; conteúdo com respiro de 24; toolbar 36; linha alvo 36–40 |
| Movimento | 120–180 ms em interação; respeitar redução de movimento; sem scroll cinematográfico no trabalho |

**Contraste:** meta AA (4,5:1 em texto normal; 3:1 em texto grande e limites essenciais de controles). Validar combinações renderizadas e estados, não presumir que a configuração garante conformidade. Nunca texto lima sobre branco.

**Número com procedência:** valor → unidade/descrição → fonte + ano + situação. Exemplo de estrutura: `— / Repasse VAAR / FNDE · exercício selecionado / Não disponível`. Dado ausente não vira zero. Variação exige período e base comparáveis.

**Densidade:** 17 linhas a 36 px ocupam 612 px. Com 160 px para contexto/filtros, são 772 px úteis. Portanto não prometer 17 linhas sem rolagem em qualquer notebook de 1440 px de largura: altura de janela também importa. Preservar leitura e usar rolagem vertical; medir em 1440×900 e 1280×800.

## 6. Estados e perfis

| Estado | Comportamento necessário |
|---|---|
| Carregando | Skeleton da estrutura; manter contexto municipal e não mostrar zero transitório |
| Vazio | Empty com ação: adicionar cidade, anexar ou selecionar documento |
| Busca sem resultado | Termo preservado + limpar filtros; distinto de carteira vazia |
| Erro de consulta | Result/Alert com contexto e tentar novamente; manter último dado quando apropriado |
| Parcial | Alert discreto, origem indisponível identificada e demais dados utilizáveis |
| Gerando | Item persistente com etapa e tempo decorrido, se medidos; não inventar percentual |
| Na fila | Ordem e município visíveis; a fila real continua serial |
| Falhou | Item persiste, explica causa, permite tentar novamente conscientemente |
| Concluído | Abrir documento e localização do arquivo, sem depender de toast |
| Sem permissão | Result específico; não confundir com conteúdo vazio |

**Técnico/gestão:** opera a carteira e visualiza dados comerciais conforme as permissões atuais. **Consultora:** trabalha com dados municipais e material permitido; receita da consultoria, probabilidade, margem e comissões não entram no enquadramento de apresentação. Dados financeiros públicos do município não são o mesmo que receita comercial da consultoria.

O seletor de perfil da prévia é apenas simulação visual. Em produção, as decisões vêm da sessão e das regras existentes, nunca de um seletor que concede acesso. O documento “Dever de Casa” é descrito no catálogo como interno; não apresentá-lo automaticamente ao gestor.

## 7. Viabilização e sequência

| Etapa | Entrega concreta | Dependência / esforço relativo | Aceite |
|---|---|---|---|
| 0. Referência | Este mapa + prévia de 3 fluxos | Concluída como proposta | Identidade e hierarquia comparáveis |
| 1. Fundação | Tokens, escala, shell e padrão de cabeçalho | Médio; validar ProLayout/Ant 6 beta | Busca, notificações, fila e permissão preservadas |
| 2. Piloto Cidades | Tabela essencial, filtros e entrada na ficha | Médio; mesma consulta | Localizar cidade e abrir ficha sem procurar ação fora da área útil |
| 3. Ficha + acervo | Cinco grupos, documentos/versões e links antigos | Alto; coordenação de seções e URLs | Abrir arquivo existente; voltar sem perder contexto |
| 4. Emissão | Tipos, disponibilidade, fila e falha persistente | Alto; provider e chamadas existentes | Emitir, navegar, reabrir e recuperar falha sem duplicação |
| 5. Fluxo comercial | Painel, Pipeline e Contrato | Médio/alto; separação por perfil | Indicadores legíveis; lista e arrasto equivalentes |
| 6. Demais áreas | Pessoas, Caixa, Ajustes, Sistemas, Case e login | Médio por área | Mesmos padrões; estados e permissões conferidos |

Estimativas são relativas; prazo em dias exige definir profundidade da mudança por tela e verificar sessão/dados de teste. Não é necessário trocar framework, banco, geradores PDF ou identidade dos municípios para viabilizar o visual.

### Arquivos de integração

- Aparência: `core/design/tema-ant.ts` e `app/layout.tsx`.
- Estrutura: `app/(sync)/layout.tsx`, `core/components/sync-shell/sidebar.tsx`, `header.tsx` e `notificacoes-inbox.tsx`.
- Piloto: `app/(sync)/cidades/page.tsx`, `[cityId]/page.tsx` e seus `_components`.
- Emissão: `app/(sync)/modulos/levantamento-fundeb`, `modules/cidades/documentos-emissiveis.ts`, `core/providers/fila-emissao-provider.tsx`.
- Proteções a preservar: `core/domain/rbac.ts`, providers de sessão, regras do Firestore e endpoints administrativos.

### Validação na implementação real

- Conferir 1280×800, 1440×900, 1680×1050 e janela estreita; zoom 125%; sem sobreposição de fila com ações.
- Medir linhas visíveis, ações até o arquivo e acesso por teclado. Ícones de ação sempre com nome acessível.
- Exercitar dois perfis com dados autorizados, inclusive links diretos, busca e visualizador.
- Consultar dado parcial, fonte fora do ar, fila, falha, documento concluído, arquivo sem prévia e acesso negado.
- Executar build, testes de domínio e RBAC exigidos pelo projeto; não fazer push como simples revisão visual: README informa que push em main dispara produção.

## 8. Prévia entregue

Pasta: `docs/design/preview-2026-09-15/`. Executar `node docs/design/preview-2026-09-15/build.mjs`; servir a pasta localmente e abrir `index.html`.

A prévia é um artefato de design isolado com Ant Design/Pro Components instalados. Tem 3 destinos, busca/ordenação, ficha/documentos, visualizador demonstrativo, simulação de perfis e estados. Não faz login, lê Firestore, gera PDF ou altera o sistema. Conteúdo municipal e estados são demonstrativos. Ela comprova a composição sobre a biblioteca atual; a migração funcional ainda está por fazer.

### Conferências desta entrega

- Build da prévia com esbuild: passou.
- `npx tsc --noEmit --incremental false`: passou.
- `npm test`: 84 arquivos de teste, 1.088 testes aprovados.
- Navegador: busca municipal, entrada na ficha, filtro de documento, abertura do visualizador demonstrativo, aba Contrato aparecendo em Gestão e ausente em Consultora, fila após nova tentativa, alerta de dado parcial, recuperação de erro e estado vazio conferidos.
- Inspeção visual em 1440×900 e 1280×800. Na largura de 1280 px, documento e viewport mediram 1280 px: sem transbordamento horizontal da página na visão de Cidades/Consultora. A lista usa rolagem vertical.
- Nenhum erro de console capturado na prévia durante a conferência.
- Build de produção Next, autenticação real, geração de PDF, persistência da fila, toda a matriz de perfis e acessibilidade completa não foram validados nesta entrega de documentação/prévia. São critérios da migração funcional, ainda não executada.
