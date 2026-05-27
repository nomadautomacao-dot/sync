import fs from "fs";
import { gerarKitContratoZip } from "../modules/contrato-fundeb/services/contrato-docx-generator";

async function main() {
  const data = {
    municipioNome: "Serra do Ramalho",
    municipioUF: "BA",
    municipioCNPJ: "12.345.678/0001-90",
    municipioEndereco: "Rua X",
    municipioCEP: "12345-000",
    fundoNome: "Fundo Municipal",
    fundoCNPJ: "00.000.000/0000-00",
    
    prefeitoNome: "Prefeito João",
    prefeitoNacionalidade: "Brasileiro",
    prefeitoRG: "123456",
    prefeitoCPF: "111.111.111-11",
    prefeitoEstadoCivil: "Casado",
    prefeitoEndereco: "Rua Y",

    processoNumero: "001/2026",
    inexigibilidadeNumero: "002/2026",
    contratoNumero: "003/2026",
    exercicio: 2026,
    baseLegal: "Lei X",
    dataProcesso: "01/01/2026",

    secretarioNome: "Sec Maria",
    secretarioDecreto: "001/2024",
    fiscalNome: "Fiscal Pedro",
    fiscalPortaria: "002/2024",
    fiscalCargo: "Auditor",
    assessorJuridicoNome: "Dr. José",
    assessorJuridicoOAB: "1234/BA",
    agenteContratacaoNome: "Agente Marcos",
    agenteContratacaoDecreto: "003/2024",

    empresaRazaoSocial: "Empresa Teste LTDA",
    empresaCNPJ: "99.999.999/0001-99",
    empresaEndereco: "Rua Empresa",
    empresaCidade: "Salvador",
    empresaUF: "BA",
    empresaCEP: "40000-000",

    representanteNome: "Rep Carlos",
    representanteCPF: "222.222.222-22",
    representanteRG: "987654",
    representanteOrgaoExp: "SSP/BA",
    representanteNacionalidade: "Brasileiro",
    representanteEstadoCivil: "Casado",
    representanteQualificacao: "Diretor",

    valorMensal: 15000,
    valorMensalExtenso: "quinze mil reais",
    quantidadeMeses: 12,
    valorGlobal: 180000,
    valorGlobalExtenso: "cento e oitenta mil reais",
    percentualInsumos: 0,
    percentualPessoal: 100,

    dotacaoUnidade: "01",
    dotacaoAtividade: "2001",
    dotacaoElemento: "3.3.90.39",
    dotacaoFonte: "1500",

    foroComarca: "Serra do Ramalho",
    foroUF: "BA",

    dataSolicitacao: "10 de janeiro de 2026",
    dataParecerJuridico: "15 de janeiro de 2026",
    dataRatificacao: "20 de janeiro de 2026",
    dataHomologacao: "22 de janeiro de 2026",
    dataAssinatura: "25 de janeiro de 2026",
    vigenciaInicio: "01/02/2026",
    vigenciaFim: "31/12/2026"
  };

  try {
    const zipBuffer = await gerarKitContratoZip(data as any);
    fs.writeFileSync("kit_teste.zip", zipBuffer);
    console.log("ZIP gerado com sucesso em kit_teste.zip!");
  } catch (error) {
    console.error("Erro gerando ZIP:", error);
  }
}

main();
