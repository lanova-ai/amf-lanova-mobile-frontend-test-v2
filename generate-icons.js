/**
 * Generate PWA Icons
 * Creates simple placeholder icons with the wheat emoji for testing
 * For production, replace with professionally designed icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons for each size
sizes.forEach(size => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="#10b981" rx="${size * 0.15}"/>
  
  <!-- Wheat emoji as text (simple placeholder) -->
  <text 
    x="50%" 
    y="50%" 
    font-size="${size * 0.6}" 
    text-anchor="middle" 
    dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
  >🌾</text>
</svg>`;

  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svg);
  console.log(`✅ Generated ${filename}`);
});

console.log('\n🎉 All icons generated successfully!');
console.log('📝 Note: These are placeholder SVG icons. For production, replace with PNG icons designed by a professional.');
console.log('💡 Tip: Use https://www.pwabuilder.com/ to generate proper PNG icons from a single source image.');

