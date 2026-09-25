// Convert SVG design to high-res PNG for Printful
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const inputSvg = process.argv[2] || 'products/halloween-bandana.svg';
const outputPng = process.argv[3] || 'products/halloween-bandana.png';

// Read SVG
let svgData = fs.readFileSync(inputSvg, 'utf8');

// Force output resolution: replace width/height with target size
const TARGET = 3000;
svgData = svgData.replace(/(<svg[^>]*?)\swidth="[^"]*"/, `$1 width="${TARGET}"`)
                 .replace(/(<svg[^>]*?)\sheight="[^"]*"/, `$1 height="${TARGET}"`);

// Render at high resolution (Printful recommends 150-300 DPI)
const resvg = new Resvg(svgData, {
    background: '#1A1A2E',
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

fs.writeFileSync(outputPng, pngBuffer);

console.log(`✅ Converted: ${inputSvg} → ${outputPng}`);
console.log(`   Size: ${resvg.width}x${resvg.height}px`);
console.log(`   File: ${(pngBuffer.length / 1024).toFixed(1)} KB`);