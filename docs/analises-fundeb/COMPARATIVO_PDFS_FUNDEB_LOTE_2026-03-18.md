# Comparativo em Lote FUNDEB - 18/03/2026

Snapshot do comparativo automatizado entre PDFs gerados pelo `Sync` e PDFs legados comerciais, usando os arquivos presentes em `C:\Users\Adrie\Downloads`.

Importante: este comparativo mistura gerados de horarios diferentes ao longo do dia. Portanto, parte dos PDFs gerados ainda reflete versoes anteriores da heuristica comercial e nao deve ser lida como retrato final do codigo atual.

## Resultado do lote

| Cidade | Multiplicador gerado | Multiplicador legado | Desvio do multiplicador | Desvio do total projetado | Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sao Joao de Meriti | 1.68x | 1.286160x | 30.62% | 30.62% | 16.63 |
| Teresopolis | 1.51x | 1.777689x | -15.06% | -15.06% | 45.11 |
| Duque de Caxias | 1.68x | 1.870000x | -10.16% | -10.16% | 32.75 |
| Mage | 1.68x | 1.821113x | -7.75% | -7.75% | 47.38 |
| Petropolis | 1.56x | 1.683154x | -7.32% | -7.32% | 51.69 |
| Balneario Camboriu | 1.56x | 1.680552x | -7.17% | -7.17% | 51.52 |
| Cabo Frio | 1.66x | 1.766821x | -6.05% | -6.05% | 63.33 |
| Nova Iguacu | 1.68x | 1.780006x | -5.62% | -5.62% | 25.07 |
| Guapimirim | 1.79x | 1.748342x | 2.38% | 2.38% | 74.83 |

## Leitura rapida

- O lote confirma que `Sao Joao de Meriti` continua fora da curva e precisa de um regime proprio.
- Os arquivos de `Balneario Camboriu`, `Petropolis`, `Cabo Frio`, `Teresopolis`, `Nova Iguacu`, `Guapimirim` e `Mage` que estao em `Downloads` nao representam necessariamente a ultima heuristica calibrada.
- O comparador em lote agora permite repetir a verificacao rapidamente sempre que novos PDFs forem gerados.

## Comando

```bash
npm run fundeb:compare-pdfs-batch -- "C:\Users\Adrie\Downloads"
```
