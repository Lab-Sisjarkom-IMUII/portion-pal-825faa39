/**
 * Simple script untuk generate PWA icons menggunakan canvas (Node.js dengan canvas package)
 * Alternative: Gunakan public/generate-icons.html di browser
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '..', 'public');
const htmlPath = path.join(publicDir, 'generate-icons.html');

console.log('🎨 PWA Icon Generator');
console.log('');
console.log('📋 Cara 1: Gunakan HTML Generator (Recommended)');
console.log(`   1. Buka file: ${htmlPath}`);
console.log('   2. Buka di browser');
console.log('   3. Klik "Download All Icons"');
console.log('   4. Simpan icons ke folder public/');
console.log('');
console.log('📋 Cara 2: Install sharp dan jalankan script');
console.log('   1. npm install -D sharp');
console.log('   2. npm run generate:pwa-icons');
console.log('');
console.log('✅ HTML generator sudah tersedia di: public/generate-icons.html');

