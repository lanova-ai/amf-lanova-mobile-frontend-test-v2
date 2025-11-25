/**
 * Generate PNG Icons using Sharp
 * Install: npm install -D sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

// Simple SVG template with wheat emoji (rendered as text)
const generateSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#10b981" rx="${size * 0.15}"/>
  <text x="50%" y="50%" font-size="${size * 0.6}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif">🌾</text>
</svg>
`;

async function generatePNGIcons() {
  console.log('🌾 Generating PNG icons...\n');
  
  for (const size of sizes) {
    try {
      const svgBuffer = Buffer.from(generateSVG(size));
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}x${size}:`, error.message);
    }
  }
  
  console.log('\n🎉 All PNG icons generated!');
  console.log('📍 Location: mobile-ui/public/icons/');
}

generatePNGIcons().catch(console.error);

