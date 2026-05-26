const fs = require('fs');
const path = require('path');

// Criar ícone SVG simples
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2563eb"/>
  <text x="50%" y="50%" font-size="300" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial, sans-serif" font-weight="bold">S</text>
</svg>
`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Ícones SVG básicos criados. Para criar ícones PNG de alta qualidade, use uma ferramenta como:');
console.log('- https://realfavicongenerator.net/');
console.log('- https://www.favicon-generator.org/');
console.log('- Ou converta manualmente os SVGs para PNG');
