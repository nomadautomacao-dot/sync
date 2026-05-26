const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const stubDir = path.join(__dirname, '..', 'data-stub');

// Criar diretório stub
if (!fs.existsSync(stubDir)) {
  fs.mkdirSync(stubDir, { recursive: true });
}

// Arquivos grandes que precisam de stub
const largeFiles = [
  'inep-censo-municipal-2023.json',
  'inep-censo-municipal-2024.json',
  'inep-censo-municipal-2025.json',
];

// Criar stubs com estrutura correta
largeFiles.forEach(file => {
  const stubPath = path.join(stubDir, file);
  const stubContent = {}; // Objeto vazio em vez de array

  fs.writeFileSync(stubPath, JSON.stringify(stubContent, null, 2));
  console.log(`Created stub: ${file}`);
});

// Copiar arquivos pequenos
const smallFiles = [
  'govia-municipios-store.json',
  'ideb-municipal-2023.json',
  'tse-prefeitos-2024.json',
  'propostas-public-validation-history.json',
];

smallFiles.forEach(file => {
  const srcPath = path.join(dataDir, file);
  const dstPath = path.join(stubDir, file);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, dstPath);
    console.log(`Copied: ${file}`);
  }
});

console.log('\nStub data created successfully!');
console.log('Use data-stub/ for builds, data/ for local development');
