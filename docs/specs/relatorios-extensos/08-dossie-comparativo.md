# Dossiê Comparativo

> Unidade de análise: **o indicador contra os pares**. Volume: ~12 indicadores
> × 3 réguas. 8 a 14 folhas.

---

## 1. O que ele prova

Todo número deste conjunto de dossiês responde "quanto?". Este responde
**"quanto, comparado a quem?"** — e é a diferença entre um relatório que informa
e um que muda decisão.

"A rede tem 26,8% de distorção idade-série" não move ninguém. "A rede tem 26,8%
de distorção, contra 19,4% da mediana dos 80 municípios de porte semelhante, e
está no percentil 88 — pior que 88% dos seus pares" move.

A comparação é feita contra **três réguas simultâneas**, e as três importam:
a mediana dos municípios de **porte semelhante** (que enfrentam a mesma escala
de problema), a mediana da **UF** (que compartilham a mesma política estadual e
o mesmo VAAF), e o **percentil** na coorte de porte (que diz onde exatamente na
fila o município está).

---

## 2. Fonte e granularidade

| Fonte | Lib | Granularidade |
|---|---|---|
| Gêmeos estatísticos | `municipios-gemeos.ts` | **por indicador** |

Uma fonte só, o que faz deste o dossiê mais barato de construir e um dos de
maior impacto na reunião.

---

## 3. Campos disponíveis

### 3.1 `MunicipiosGemeos`

`matriculas`, `uf`, `faixaPorte`, `coorteUf`, `vaar`, `indicadores[]`.

### 3.2 `IndicadorGemeos` — uma linha por indicador

| Campo | Observação |
|---|---|
| `chave`, `rotulo` | identificação |
| `unidade` | `percentual` \| `reais` \| `fator` |
| `valor` | o município |
| `medianaPorte` | mediana da coorte de porte semelhante |
| `medianaUf` | mediana da UF — `null` quando não computável |
| `percentil` | 0–100 na coorte de porte |
| `sentido` | se maior é melhor ou pior — **sem isso o percentil não se lê** |
| `comparaveis` | **quantos pares têm o dado** |

> `comparaveis` é o campo de honestidade: percentil sobre coorte rala não vale
> nada. O dossiê imprime o N ao lado de todo percentil e suprime a leitura
> quando o N é pequeno demais.

---

## 4. Estrutura do documento

1. **Capa e sumário** — em quantos indicadores o município está acima e em
   quantos está abaixo da mediana dos pares. É o placar que abre a conversa.
2. **O painel de percentis** — uma folha com todos os indicadores em régua
   horizontal de 0 a 100, o município marcado em cada uma, e a cor seguindo o
   `sentido` (não o valor bruto). Visualmente é a folha mais forte do conjunto.
3. **Indicador por indicador** (fluxo) — uma folha ou meia folha para cada, com:
   valor do município, mediana de porte, mediana da UF, percentil, N de
   comparáveis, e a leitura em uma frase — o que aquele percentil significa em
   termos de gestão.
4. **Os três indicadores de maior distância** — desenvolvidos, com o que a
   distância representa em matrículas, reais ou alunos, conforme a unidade.
5. **A coorte** — quem são os pares: faixa de porte, quantos municípios, quantos
   da UF. Transparência de método, porque a primeira pergunta do secretário
   inteligente é "comparado com quem?".

---

## 5. Regras específicas

1. **Percentil sem `sentido` é ruído.** Percentil 90 em despesa por aluno pode
   ser bom ou ruim; sem o sentido, o número não se lê.
2. **N pequeno suprime a leitura.** Abaixo de um piso de `comparaveis`, o
   dossiê mostra os valores e omite o percentil, dizendo por quê.
3. **Mediana, não média.** A distribuição municipal brasileira é assimétrica —
   média é puxada por São Paulo e some com o município típico.
4. **Comparação não é meta.** Estar na mediana não significa estar bem; a
   mediana pode ser ruim. Onde houver parâmetro legal (meta do PNE, limite da
   LRF, piso do magistério), ele aparece junto e prevalece.

---

## 6. O que não existe

- **Escolha da coorte pelo usuário.** A faixa de porte é fixa. Comparar com
  municípios escolhidos a dedo produziria a resposta que se quiser.
- **Comparação com municípios nomeados.** A lib devolve medianas e percentis,
  não a lista de pares. Nomear "o município X vai melhor que você" é
  desnecessário e cria atrito comercial.
- **Série histórica de percentil.** A coorte é recalculada na emissão.

---

## 7. Como ficou — implementado em 2026-07-30

`core/lib/dossie-comparativo.ts` · `-template.ts` · `-pdf.ts` ·
`app/api/modulos/dossies/comparativo/` · 22 testes. 8 folhas.

**A lib precisou dobrar de tamanho antes.** `municipios-gemeos.ts` tinha oito
indicadores e **nenhum** era o do exemplo da própria spec — distorção
idade-série. Agora são dezesseis, todos de dataset local e completo para o país,
porque a coorte inteira precisa da mesma apuração: IDEB das duas etapas,
distorção, abandono, nível insuficiente em LP e MT do 5º ano, alfabetização e
cor/raça não declarada entraram junto com os oito originais. Os indicadores
ganharam `grupo` temático — dezesseis réguas numa folha só viram parede.

**A regra que impede o painel de inverter.** A cor segue o `sentido`, não o
valor: as réguas usam `posicaoOrientada`, em que 100 é sempre o melhor lado, e
indicador neutro sai em cinza com a marca no percentil cru. Investimento por
aluno alto pode ser oferta cara e necessária ou ineficiência — a régua diz onde
a rede está, não se isso é bom.

**O achado que só a comparação produz.** Serra do Ramalho está no percentil 82
em aplicação de MDE e no 72 em remuneração dos profissionais — e no percentil 10
no IDEB dos anos finais, 94 em nível insuficiente de Português e 11 em
alfabetização. Gasta certo e não entrega. Nenhum dos outros sete dossiês diz
isso, porque nenhum deles compara.

**As duas travas de honestidade:** percentil não é publicado abaixo de 20 pares
(coorte rala é ruído com cara de estatística), e onde existe parâmetro legal ele
fecha o bloco do indicador — cumprir a lei não é competir com o vizinho.
