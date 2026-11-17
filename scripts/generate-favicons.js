const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'src', 'app');

// Lumenist Camera & Tripod Favicon SVG
// Designed on a 64x64 master grid, balanced on the x=32 optical axis
const lumenistSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <!-- Dark exhibition matting background squircle -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#161824"/>
      <stop offset="100%" stop-color="#08090e"/>
    </linearGradient>

    <!-- Camera body platinum/silver finish -->
    <linearGradient id="camBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>

    <!-- Tripod legs aluminum/carbon gradient -->
    <linearGradient id="tripodLegs" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>

    <!-- "Lumen" core: warm golden hour light captured by the lens -->
    <linearGradient id="lumenCore" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
  </defs>

  <!-- Squircle Base Frame -->
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bgGradient)" stroke="#2F354D" stroke-width="1.5"/>

  <!-- ==================== TRIPOD ==================== -->
  <!-- Left Leg -->
  <line x1="28" y1="36" x2="14" y2="55" stroke="url(#tripodLegs)" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Right Leg -->
  <line x1="36" y1="36" x2="50" y2="55" stroke="url(#tripodLegs)" stroke-width="3.5" stroke-linecap="round"/>
  <!-- Center Leg -->
  <line x1="32" y1="36" x2="32" y2="56" stroke="url(#tripodLegs)" stroke-width="3.5" stroke-linecap="round"/>

  <!-- Twist-Lock Collars (Golden amber accents) -->
  <rect x="18.5" y="44" width="4.5" height="2.5" rx="1" transform="rotate(27 20.75 45.25)" fill="#F59E0B"/>
  <rect x="29.75" y="44.5" width="4.5" height="2.5" rx="1" fill="#F59E0B"/>
  <rect x="41" y="44" width="4.5" height="2.5" rx="1" transform="rotate(-27 43.25 45.25)" fill="#F59E0B"/>

  <!-- Tripod Feet -->
  <circle cx="14" cy="55" r="2" fill="#64748B"/>
  <circle cx="32" cy="56" r="2" fill="#64748B"/>
  <circle cx="50" cy="55" r="2" fill="#64748B"/>

  <!-- Ball Head & Mounting Apex -->
  <rect x="26" y="33" width="12" height="3.5" rx="1" fill="#94A3B8"/>
  <circle cx="32" cy="34" r="3" fill="#E2E8F0"/>
  <rect x="36.5" y="33" width="2.5" height="2" rx="0.5" fill="#F59E0B"/>

  <!-- ==================== CAMERA ==================== -->
  <!-- Pentaprism Viewfinder Housing (aligned to center x=32) -->
  <path d="M25 13 L28.5 9 L35.5 9 L39 13 Z" fill="url(#camBody)"/>
  <!-- Hot Shoe Mount -->
  <rect x="30" y="8" width="4" height="1.5" rx="0.5" fill="#475569"/>

  <!-- Controls: Shutter Button & Left Dial -->
  <rect x="42" y="10" width="5" height="3" rx="1" fill="#F59E0B"/>
  <rect x="17" y="11" width="4" height="2" rx="0.5" fill="#94A3B8"/>

  <!-- Main Camera Body -->
  <rect x="12" y="13" width="40" height="20" rx="3.5" fill="url(#camBody)"/>

  <!-- Ergonomic Handgrip Detail (Left from front view) -->
  <rect x="14.5" y="15" width="4" height="16" rx="1.5" fill="#334155"/>

  <!-- ==================== LENS OPTICS ==================== -->
  <!-- Outer Barrel Ring (Deep midnight chassis) -->
  <circle cx="32" cy="23" r="8.5" fill="#0F172A"/>

  <!-- Aperture Guide Ring (Lumenist periwinkle accent #9999FF) -->
  <circle cx="32" cy="23" r="6.8" fill="#1E293B" stroke="#9999FF" stroke-width="1.2"/>

  <!-- "Lumen" Radiant Optical Core (Atmospheric light & golden hour) -->
  <circle cx="32" cy="23" r="4.2" fill="url(#lumenCore)"/>

  <!-- Iris Aperture Center -->
  <circle cx="32" cy="23" r="2" fill="#78350F" opacity="0.6"/>

  <!-- Specular Lens Glint -->
  <circle cx="30.2" cy="21.2" r="1.2" fill="#FFFFFF"/>
</svg>`;

async function main() {
  console.log('Generating Lumenist Favicon & Icon assets...');

  // 1. Write SVG to src/app/icon.svg
  fs.writeFileSync(path.join(appDir, 'icon.svg'), lumenistSvg.trim());
  console.log('✓ Written src/app/icon.svg');

  // 2. Generate PNG sizes for Apple Touch Icon and ICO generation
  const tempDir = '/tmp/lumenist-favicons';
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 128, 180, 256, 512];
  for (const s of sizes) {
    await sharp(Buffer.from(lumenistSvg))
      .resize(s, s)
      .png()
      .toFile(path.join(tempDir, `icon_${s}.png`));
  }

  // 3. Apple Touch Icon (180x180)
  fs.copyFileSync(path.join(tempDir, 'icon_180.png'), path.join(appDir, 'apple-icon.png'));
  console.log('✓ Written src/app/apple-icon.png (180x180)');

  // 4. Multi-resolution favicon.ico (16x16, 32x32, 48x48)
  const icoPath = path.join(appDir, 'favicon.ico');
  execSync(`magick "${tempDir}/icon_16.png" "${tempDir}/icon_32.png" "${tempDir}/icon_48.png" "${icoPath}"`);
  console.log('✓ Generated multi-resolution src/app/favicon.ico');

  console.log('All Lumenist favicon and app icon assets generated successfully.');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
