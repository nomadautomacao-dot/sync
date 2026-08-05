import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// Mesma convenção de core/lib/assets-paths.ts — este arquivo é .mjs e não
// consegue importar o helper TypeScript.
const contratosAssetsDir = process.env.CONTRATOS_ASSETS_DIR?.trim()
    ? path.resolve(process.env.CONTRATOS_ASSETS_DIR.trim())
    : path.join(process.cwd(), 'contratos');
const docxDir = path.join(contratosAssetsDir, 'Anexos_DOCX');

if (!fs.existsSync(docxDir)) {
    console.error(`Templates não encontrados em ${docxDir}. Defina CONTRATOS_ASSETS_DIR.`);
    process.exit(1);
}

function replaceRegexWithMap(xml, regex, getReplaceStr) {
    let pureText = '';
    let map = [];
    let inTag = false;
    for (let i = 0; i < xml.length; i++) {
        if (xml[i] === '<') inTag = true;
        if (!inTag) {
            pureText += xml[i];
            map.push(i);
        }
        if (xml[i] === '>') inTag = false;
    }
    
    let match;
    while ((match = regex.exec(pureText)) !== null) {
        let startXml = map[match.index];
        let endXml = map[match.index + match[0].length - 1] + 1;
        let originalXmlSubstring = xml.substring(startXml, endXml);
        let tagsOnly = originalXmlSubstring.match(/<[^>]+>/g) || [];
        
        let replaceStr = getReplaceStr(match);
        let replacement = replaceStr + tagsOnly.join('');
        
        xml = xml.substring(0, startXml) + replacement + xml.substring(endXml);
        
        pureText = '';
        map = [];
        inTag = false;
        for (let i = 0; i < xml.length; i++) {
            if (xml[i] === '<') inTag = true;
            if (!inTag) {
                pureText += xml[i];
                map.push(i);
            }
            if (xml[i] === '>') inTag = false;
        }
        regex.lastIndex = 0;
    }
    return xml;
}

function replaceStrWithMap(xml, searchStr, replaceStr) {
    return replaceRegexWithMap(xml, new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => replaceStr);
}

async function processDocxFile(filePath) {
  const content = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(content);

  const filesToProcess = [];
  zip.forEach((relativePath, file) => {
    if (relativePath.endsWith('.xml') && (relativePath.startsWith('word/document') || relativePath.startsWith('word/header') || relativePath.startsWith('word/footer'))) {
      filesToProcess.push(relativePath);
    }
  });

  for (const relativePath of filesToProcess) {
    let xml = await zip.file(relativePath).async('string');

    const exactReplacements = [
      // ===== MUNICÍPIO (SEROPÉDICA) =====
      ['MUNICIPIO DE SEROPÉDICA', 'MUNICIPIO DE {municipioNomeUpper}'],
      ['MUNICÍPIO DE SEROPÉDICA', 'MUNICÍPIO DE {municipioNomeUpper}'],
      ['MUNICIPIO DE SEROPEDICA', 'MUNICIPIO DE {municipioNomeUpper}'],
      ['MUNICÍPIO DE SEROPEDICA', 'MUNICÍPIO DE {municipioNomeUpper}'],
      ['Município de Seropédica', 'Município de {municipioNome}'],
      ['Município de Seropedica', 'Município de {municipioNome}'],
      ['SEROPEDICA/RJ', '{municipioNomeUpper}/{municipioUF}'],
      ['SEROPÉDICA/RJ', '{municipioNomeUpper}/{municipioUF}'],
      ['SEROPÉDICA – RJ', '{municipioNomeUpper} – {municipioUF}'],
      ['SEROPÉDICA - RJ', '{municipioNomeUpper} - {municipioUF}'],
      ['SEROPEDICA – RJ', '{municipioNomeUpper} – {municipioUF}'],
      ['SEROPEDICA - RJ', '{municipioNomeUpper} - {municipioUF}'],
      ['Seropédica – RJ', '{municipioNome} – {municipioUF}'],
      ['Seropédica - RJ', '{municipioNome} - {municipioUF}'],
      ['Seropedica – RJ', '{municipioNome} – {municipioUF}'],
      ['Seropedica - RJ', '{municipioNome} - {municipioUF}'],
      ['SEROPÉDICA', '{municipioNomeUpper}'],
      ['SEROPEDICA', '{municipioNomeUpper}'],
      ['Seropédica', '{municipioNome}'],
      ['Seropedica', '{municipioNome}'],
      ['seropédica', '{municipioNome}'],
      ['seropedica', '{municipioNome}'],

      // ===== MUNICÍPIO (SERRA DO RAMALHO - template base) =====
      ['Serra do Ramalho – Bahia', '{municipioNome} – {municipioEstado}'],
      ['Serra do Ramalho - Bahia', '{municipioNome} - {municipioEstado}'],
      ['Serra do Ramalho', '{municipioNome}'],

      // ===== MUNICÍPIO (LEME - aparece em docs antigos) =====
      ['LEME/SP', '{municipioNomeUpper}/{municipioUF}'],
      ['Leme/SP', '{municipioNome}/{municipioUF}'],
      ['LEME – SP', '{municipioNomeUpper} – {municipioUF}'],
      ['LEME - SP', '{municipioNomeUpper} - {municipioUF}'],
      ['Leme – SP', '{municipioNome} – {municipioUF}'],
      ['Leme - SP', '{municipioNome} - {municipioUF}'],
      ['LEME', '{municipioNomeUpper}'],
      ['Leme', '{municipioNome}'],

      // ===== ESTADO =====
      ['Estado de Rio de Janeiro', 'Estado de {municipioEstado}'],
      ['ESTADO DO RIO DE JANEIRO', 'ESTADO DO {municipioEstadoUpper}'],
      ['Estado de RJ', 'Estado de {municipioEstado}'],
      ['ESTADO DE RJ', 'ESTADO DE {municipioEstadoUpper}'],
      ['Estado do RJ', 'Estado de {municipioEstado}'],
      ['ESTADO DO RJ', 'ESTADO DO {municipioEstadoUpper}'],

      // ===== CNPJ DO MUNICÍPIO =====
      ['01.604.139/0002-98', '{municipioCNPJ}'],

      // ===== CNPJ a confirmar (critical fix) =====
      ['CNPJ nº. CNPJ a confirmar', 'CNPJ nº {municipioCNPJ}'],
      ['CNPJ nº CNPJ a confirmar', 'CNPJ nº {municipioCNPJ}'],
      ['localizada a CNPJ a confirmar', 'localizada na {municipioEndereco}'],
      ['Exmo. Sr. CNPJ a confirmar', 'Exmo. Sr. {prefeitoNome}'],
      ['o senhor CNPJ a confirmar', 'o senhor {fiscalNome}'],
      ['CNPJ a confirmar', '{fundoCNPJ}'],

      // ===== PROCESSOS =====
      ['INEXIGIBILIDADE DE LICITAÇÃO Nº. 000/2026', 'INEXIGIBILIDADE DE LICITAÇÃO Nº {inexigibilidadeNumero}'],
      ['INEXIGIBILIDADE DE LICITAÇÃO Nº 000/2026', 'INEXIGIBILIDADE DE LICITAÇÃO Nº {inexigibilidadeNumero}'],
      ['PROCESSO ADMINISTRATIVO Nº. 000/2026', 'PROCESSO ADMINISTRATIVO Nº {processoNumero}'],
      ['PROCESSO ADMINISTRATIVO Nº 000/2026', 'PROCESSO ADMINISTRATIVO Nº {processoNumero}'],
      ['Processo Administrativo nº: ___/2026', 'Processo Administrativo nº: {processoNumero}'],
      ['Processo Administrativo n.º 000/2026', 'Processo Administrativo n.º {processoNumero}'],
      ['Processo  Administrativo n.º 000/2026', 'Processo Administrativo n.º {processoNumero}'],
      ['nº 000/2026', 'nº {processoNumero}'],
      ['n.º 000/2026', 'n.º {processoNumero}'],
      ['n.º 000.2026', 'n.º {processoNumero}'],
      ['Nº 000.2026', 'Nº {processoNumero}'],
      ['Nº. 000/2026', 'Nº {processoNumero}'],
      ['Nº 000/2026', 'Nº {processoNumero}'],
      ['nº. 000/2026', 'nº {processoNumero}'],
      ['000.26', '{processoNumero}'],

      // ===== EMPRESA =====
      // Os literais abaixo são os da empresa ANTERIOR, de propósito: este
      // script lê os DOCX originais e troca o que estiver escrito neles por
      // placeholder. Quem preenche o placeholder é core/domain/empresa.ts, na
      // geração. Se um dia os DOCX forem refeitos já com a Global Services
      // Company, atenção ao par abaixo — "Santa Maria da Vitória" mapeia para
      // {foroComarca} e passou a ser também o município da empresa.
      ['ROCHA PRIME SERVIÇOS ESPECIALIZADOS LTDA', '{empresaRazaoSocialUpper}'],
      ['ROCHA PRIME', '{empresaRazaoSocialUpper}'],
      ['29.342.691/0001-93', '{empresaCNPJ}'],
      ['Rua Riachão, 23, CEP: 47.970-000', '{empresaEndereco}'],
      ['Rua Riachão, nº 23 – Bairro Caripare – Riachão das Neves – BA- CEP 47.970-000', '{empresaEndereco} – Bairro {empresaCidade} – {empresaUF} - CEP {empresaCEP}'],
      ['Rua  Riachão,  nº  23,  Bairro  Caripare,  no  Município  de', '{empresaEndereco}, Bairro {empresaCidade}, no Município de'],
      ['Riachão das Neves – BA, CEP 47.970-000', '{empresaCidade} – {empresaUF}, CEP {empresaCEP}'],
      ['Riachão das Neves', '{empresaCidade}'],
      ['Riachão das  Neves', '{empresaCidade}'],
      ['Caripare', '{empresaCidade}'],

      // ===== REPRESENTANTE =====
      ['Paulo Ferreira da Rocha', '{representanteNome}'],
      ['014.815.995-85', '{representanteCPF}'],
      ['984391703 SSP/BA', '{representanteRG} {representanteOrgaoExp}'],

      // ===== COMARCA =====
      ['Santa Maria da Vitória', '{foroComarca}'],

      // ===== VALORES =====
      ['180.000,00', '{valorGlobal}'],
      ['cento e oitenta mil reais', '{valorGlobalExtenso}'],
      ['15.000,00', '{valorMensal}'],
      ['15.000,0', '{valorMensal}'],
      ['quinze mil reais', '{valorMensalExtenso}'],
      ['12 (doze) meses', '{quantidadeMesesExtenso} meses'],
      ['12 meses', '{quantidadeMeses} meses'],
      ['(PAR)12{valorMensal}', '(PAR){quantidadeMeses}{valorMensal}'],

      // ===== PORTARIAS =====
      ['Portaria 000 de 00 de XXXXX de 2026', 'Portaria nº {fiscalPortaria} de {dataSolicitacao}'],
      ['Portaria 000 de 00 de xxxxxxxxx de 2026', 'Portaria nº {fiscalPortaria} de {dataSolicitacao}'],
      ['Portaria 000', 'Portaria nº {fiscalPortaria}'],

      // ===== DATAS FIXAS =====
      ['DATA: 00.00.2026', 'DATA: {dataDocumento}'],
      ['00.00.2026', '{dataDocumento}'],
      ['31/12/2026', '{vigenciaFim}'],
      ['31.12.2026', '{vigenciaFim}'],

      // ===== FALLBACKS for state codes =====
      ['{municipioNomeUpper} – RJ', '{municipioNomeUpper} – {municipioUF}'],
      ['{municipioNomeUpper} - RJ', '{municipioNomeUpper} - {municipioUF}'],
      ['{municipioNomeUpper}/RJ', '{municipioNomeUpper}/{municipioUF}'],
      ['{municipioNome} – RJ', '{municipioNome} – {municipioUF}'],
      ['{municipioNome} - RJ', '{municipioNome} - {municipioUF}'],
      ['{municipioNome}/RJ', '{municipioNome}/{municipioUF}'],
      ['{municipioNomeUpper} – SP', '{municipioNomeUpper} – {municipioUF}'],
      ['{municipioNomeUpper} - SP', '{municipioNomeUpper} - {municipioUF}'],
      ['{municipioNomeUpper}/SP', '{municipioNomeUpper}/{municipioUF}'],
      ['{municipioNome} – SP', '{municipioNome} – {municipioUF}'],
      ['{municipioNome} - SP', '{municipioNome} - {municipioUF}'],
      ['{municipioNome}/SP', '{municipioNome}/{municipioUF}'],
    ];

    for (const [searchStr, replaceStr] of exactReplacements) {
      xml = replaceStrWithMap(xml, searchStr, replaceStr);
    }

    // ===== REGEX-BASED REPLACEMENTS =====

    // Prefeito name patterns
    xml = replaceRegexWithMap(xml, /Exmo\.? Sr\.? [X]{10,}/gi, () => "Exmo. Sr. {prefeitoNome}");
    xml = replaceRegexWithMap(xml, /[x]{15,}\s*[-–]\s*Prefeito Municipal/gi, () => "{prefeitoNome} – Prefeito Municipal");
    
    // Prefeito personal docs (RG, CPF, address in the Minuta)
    xml = replaceRegexWithMap(xml, /portador do RG n[ºo]\s*[xX]{5,}/gi, () => "portador do RG nº {prefeitoRG}");
    xml = replaceRegexWithMap(xml, /CPF\/MF n[ºo]\.?\s*[xX]{5,}/gi, () => "CPF/MF nº {prefeitoCPF}");
    xml = replaceRegexWithMap(xml, /,\s*residente\s+e\s+domiciliado[\s\S]{10,200}CEP\.?:?\s*[xX]+,/gi, () => ", residente e domiciliado em {prefeitoEndereco},");
    
    // Decreto
    xml = replaceRegexWithMap(xml, /Decreto N[ºo]\s*[x]{5,}/gi, () => "Decreto Nº {secretarioDecreto}");
    
    // Signature lines with underscores and X's — note: replaceRegexWithMap puts name in pure text only
    // The formatting (new line) must come from the original XML paragraph structure 
    xml = replaceRegexWithMap(xml, /[X_]{5,}\s*Prefeito Municipal/gi, () => "_______________________________ {prefeitoNome} Prefeito Municipal");
    xml = replaceRegexWithMap(xml, /Prefeito Municipal\s*[X]{10,}/gi, () => "Prefeito Municipal {prefeitoNome}");
    xml = replaceRegexWithMap(xml, /[X_]{5,}\s*Secretário Municipal/gi, () => "_______________________________ {secretarioNome} Secretário Municipal");
    xml = replaceRegexWithMap(xml, /[X_]{5,}\s*Assessor Jurídico/gi, () => "_______________________________ {assessorJuridicoNome} Assessor Jurídico");
    
    // CRITICAL: X's immediately before "Secretário" must be {secretarioNome}, NOT {prefeitoNome}
    // Pattern: "____xxxxxxxxxxxSecretário xxxxxxxxxxxDecreto" (from DFD, ETP, TR, Justificativa)
    xml = replaceRegexWithMap(xml, /[xX]{10,}\s*Secretário/gi, () => "{secretarioNome} Secretário");
    
    // X's before "DIRETOR DO DEPARTAMENTO" = agenteContratacaoNome
    xml = replaceRegexWithMap(xml, /[xX]{10,}\s*DIRETOR/gi, () => "{agenteContratacaoNome} DIRETOR");
    
    // CNPJ patterns with X's
    xml = replaceRegexWithMap(xml, /CNPJ n[ºo]\.?\s*[X]{14,}/gi, () => "CNPJ nº {empresaCNPJ}");
    xml = replaceRegexWithMap(xml, /CNPJ\s*[X]{14,}/gi, () => "CNPJ {empresaCNPJ}");
    xml = replaceRegexWithMap(xml, /FUNDO MUNICIPAL DE EDUCAÇÃO-FME - CNPJ n[ºo]\s*[xX]{10,}/gi, () => "FUNDO MUNICIPAL DE EDUCAÇÃO-FME - CNPJ nº {fundoCNPJ}");
    xml = replaceRegexWithMap(xml, /CNPJ n[ºo]\s*[xX]{10,}/gi, () => "CNPJ nº {fundoCNPJ}");

    // Date patterns (all variations)
    xml = replaceRegexWithMap(xml, /Início:\s*[xX]{5,}\s*de\s*202[56]/gi, () => "Início: {dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\s*de\s*[A-Za-z\u00C0-\u00FA]{4,}\s*de\s*202[56]/gi, () => "{dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\s*de\s*[X]{5,}\s*de\s*202[56]/gi, () => "{dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\s*de\s*[xX]{5,}\s*de\s*202[56]/gi, () => "{dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\s*de\s*[X_]{5,}\s*de\s*202[56]/gi, () => "{dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\s*de\s*00\s*de\s*_+\s*de\s*202[56]/gi, () => "{dataDocumento}");
    xml = replaceRegexWithMap(xml, /00\/00\/202[56]/gi, () => "{dataDocumento}");
    
    // Secretário patterns
    xml = replaceRegexWithMap(xml, /Secretário\s*[xX]{10,}/gi, () => "Secretário {secretarioNome}");
    xml = replaceRegexWithMap(xml, /Responsável pela demanda: SR\s*[X]{10,}/gi, () => "Responsável pela demanda: SR {secretarioNome}");
    xml = replaceRegexWithMap(xml, /FUNÇÃO:\s*[X]{5,}/gi, () => "FUNÇÃO: {secretarioCargo}");
    
    // Standalone X blocks (ordered from largest to smallest)
    // IMPORTANT: These must run AFTER all contextual patterns above
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{19}(?![xX])/gi, () => "{dotacaoUnidade} | {dotacaoAtividade} | Elemento: {dotacaoElemento} | Fonte: {dotacaoFonte}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{18}(?![xX])/gi, () => "{secretarioNome}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{17}(?![xX])/gi, () => "{dotacaoAtividade}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{15,16}(?![xX])/gi, () => "{secretarioNome}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{14}(?![xX])/gi, () => "{fundoCNPJ}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{13}(?![xX])/gi, () => "{dotacaoElemento}");
    xml = replaceRegexWithMap(xml, /(?<![xX])[X]{12}(?![xX])/gi, () => "{dotacaoFonte}");
    
    // Final catch-all: any remaining /RJ or /SP that survived
    xml = replaceRegexWithMap(xml, /\/RJ(?=[,.\s)])/g, () => "/{municipioUF}");
    xml = replaceRegexWithMap(xml, /– RJ(?=[,.\s)])/g, () => "– {municipioUF}");
    xml = replaceRegexWithMap(xml, /- RJ(?=[,.\s)])/g, () => "- {municipioUF}");
    xml = replaceRegexWithMap(xml, /\/SP(?=[,.\s)])/g, () => "/{municipioUF}");
    xml = replaceRegexWithMap(xml, /– SP(?=[,.\s)])/g, () => "– {municipioUF}");
    xml = replaceRegexWithMap(xml, /- SP(?=[,.\s)])/g, () => "- {municipioUF}");
    
    // Remaining small x blocks -> generic fiscal name
    xml = replaceRegexWithMap(xml, /(?<![xX])[xX]{8,10}(?![xX])/gi, () => "{fiscalNome}");
    
    // ===== TABLE CELL FIX =====
    // The original templates have "(PAR)12 15.000,00" inside the DISCRIMINAÇÃO cell
    // but the Mês and PREÇO UNT. columns are empty <w:tc> cells.
    // After replacement, this became "(PAR){quantidadeMeses}{valorMensal}" stuck in wrong cell.
    // Fix: find empty cells in LOTE I table and insert the values there.
    
    // Step 1: Remove "(PAR){quantidadeMeses}{valorMensal}" from wherever it ended up
    xml = xml.replace(/\(PAR\)\{quantidadeMeses\}\{valorMensal\}/g, '');
    
    // Step 2: Find tables containing "LOTE I" and fill empty cells
    // Pattern: after a <w:tc> with long text (discriminação), look for next 2 empty <w:tc>
    const tableRegex = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(xml)) !== null) {
      const tableXml = tableMatch[0];
      const tableText = tableXml.replace(/<[^>]+>/g, '');
      
      // Only process tables containing "LOTE I" and "PREÇO"
      if (!tableText.includes('LOTE I') || !tableText.includes('PREÇO')) continue;
      
      // Find data rows (rows containing "Prestação" or item number "1")
      const rowRegex = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
      let rowMatch;
      let newTableXml = tableXml;
      
      while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
        const rowXml = rowMatch[0];
        const rowText = rowXml.replace(/<[^>]+>/g, '');
        
        // Only process data rows (not header or total rows)
        if (!rowText.includes('Prestação') && !rowText.includes('consultoria')) continue;
        
        // Split row into cells
        const cells = rowXml.split(/<w:tc[ >]/);
        
        // We expect: ITEM | DISCRIMINAÇÃO | Mês (empty) | PREÇO UNT (empty) | PREÇO TOTAL
        // cells[0] is before first <w:tc, cells[1]=ITEM, cells[2]=DISCRIMINAÇÃO, cells[3]=Mês, etc.
        if (cells.length >= 5) {
          let newRowXml = rowXml;
          
          // Cell 3 (index 3) = Mês column - insert {quantidadeMeses}
          const cell3 = cells[3];
          const cell3Text = cell3.replace(/<[^>]+>/g, '').trim();
          if (cell3Text === '' || cell3Text === '|') {
            // Find an empty <w:p> in this cell and insert text
            const emptyParagraph = cell3.match(/<w:p[ >][^]*?<\/w:p>/);
            if (emptyParagraph) {
              const newParagraph = emptyParagraph[0].replace('</w:p>', '<w:r><w:t>{quantidadeMeses}</w:t></w:r></w:p>');
              newRowXml = newRowXml.replace(emptyParagraph[0], newParagraph);
            }
          }
          
          // Cell 4 (index 4) = PREÇO UNT. column - insert {valorMensal}
          const cell4 = cells[4];
          const cell4Text = cell4.replace(/<[^>]+>/g, '').trim();
          if (cell4Text === '' || cell4Text === '|') {
            const emptyParagraph = cell4.match(/<w:p[ >][^]*?<\/w:p>/);
            if (emptyParagraph) {
              const newParagraph = emptyParagraph[0].replace('</w:p>', '<w:r><w:t>{valorMensal}</w:t></w:r></w:p>');
              newRowXml = newRowXml.replace(emptyParagraph[0], newParagraph);
            }
          }
          
          if (newRowXml !== rowXml) {
            newTableXml = newTableXml.replace(rowXml, newRowXml);
          }
        }
      }
      
      if (newTableXml !== tableXml) {
        xml = xml.replace(tableXml, newTableXml);
      }
    }
    
    zip.file(relativePath, xml);
  }

  const generatedBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(filePath, generatedBuffer);
  console.log(`Processed ${filePath}`);
}

async function main() {
  const files = fs.readdirSync(docxDir);
  for (const file of files) {
    if (file.endsWith('.docx')) {
      await processDocxFile(path.join(docxDir, file));
    }
  }
}

main().catch(console.error);
