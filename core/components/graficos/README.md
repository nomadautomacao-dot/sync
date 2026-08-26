# Gráficos próprios — a terceira exceção

A regra do projeto é "se o Ant já resolve, não escreva" (`.claude/skills/interface-ant/SKILL.md`).
O Ant **não** resolve gráfico: `antd` não tem nenhum, e o pacote da casa
(`@ant-design/plots`) carrega o AntV G2 inteiro.

Aqui a exceção não é preguiça de procurar biblioteca — é peso de build. A seção 7
do `CLAUDE.md` documenta três dias de produção parada porque a checagem de tipos
e a suíte não cabiam na memória da máquina do gate, e o conserto foi tirar 156 MB
de JSON do `import`. Somar um megabyte de biblioteca de gráfico a um build que já
esteve nesse limite é gastar a folga recuperada em quatro tipos de gráfico.

E são quatro mesmo: barra horizontal, série temporal com meta, e nada além disso
por enquanto. Uma biblioteca que desenha trinta tipos para usar três é um mau
negócio quando o custo é medido em memória de build.

**O que isso nos obriga a manter:** aparência. É o preço declarado da exceção. Em
troca, tudo aqui usa `theme.useToken()` — nenhum hexadecimal — então o gráfico
acompanha o tema como qualquer componente do Ant.

**Quando reverter:** se aparecer necessidade de gráfico interativo de verdade
(zoom, seleção de faixa, mil pontos), parar de escrever e instalar. Esses
componentes são para números pequenos e leitura direta, não para exploração.
