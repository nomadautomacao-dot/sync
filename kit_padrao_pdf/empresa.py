# -*- coding: utf-8 -*-
"""
Identidade da empresa para os geradores ReportLab.

Espelho de `core/domain/empresa.ts`. Os dois arquivos precisam andar juntos:
o Python nao consegue importar TypeScript, entao a marca existe duas vezes e
divergir os dois faz o deck sair com um nome e o contrato com outro.

Marca e identidade juridica sao blocos separados pelo mesmo motivo que no lado
TypeScript. Enquanto `PENDENTE` for True, razao social e CNPJ continuam sendo o
par da empresa anterior, de proposito — trocar so o nome deixaria o CNPJ de
outra pessoa juridica embaixo da marca nova.

Sem acento: os geradores usam fontes que nem sempre trazem a tabela completa, e
o projeto ja escreve todo texto de PDF em ASCII por isso.
"""

MARCA = "Global Company"
MARCA_ASSINATURA = "Global Company — Inteligencia Tecnica para Gestao Educacional"

RAZAO_SOCIAL = "GLOBAL SERVICES COMPANY LTDA"
CNPJ = "26.137.996/0001-75"
ENDERECO = "Pe. Orthon Vieira Lima, S/N, Centro"
CIDADE = "Santa Maria da Vitoria"
UF = "BA"
CEP = "47640-058"
TELEFONE = "(77) 9700-5880"
EMAIL = "globalconsultorias@icloud.com"

# Vazio enquanto nao houver dominio proprio. `linhas_de_contato` omite o que
# estiver vazio — melhor faltar a linha que imprimir contato que nao atende.
SITE = ""

# Falta CPF e RG do socio-administrador para a qualificacao das partes.
PENDENTE = True


def linhas_de_contato():
    """As linhas de contato que existem, na ordem de leitura."""
    linhas = []
    if TELEFONE:
        linhas.append("Tel: " + TELEFONE)
    if EMAIL:
        linhas.append("E-mail: " + EMAIL)
    if SITE:
        linhas.append("Site: " + SITE)
    return linhas
