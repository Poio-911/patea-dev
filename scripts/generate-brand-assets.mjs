import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

// El logo vectorial oficial es la fuente de todos los iconos, sin redibujarlo.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'patea_mobile');
const source = await readFile(path.join(app, 'assets/icons/logo_patea.svg'), 'utf8');
const markPath = source.match(/\bd="([^"]+)"/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 16 16"><path fill="currentColor" d="${markPath}"/></svg>\n`;
await writeFile(path.join(app, 'assets/icons/logo_patea.svg'), svg);
await mkdir(path.join(root, 'public/brand'), { recursive: true });
await writeFile(path.join(root, 'public/brand/patea-mark.svg'), svg.replace('currentColor', '#CCFF33'));

function raster(size, { transparent = false, launch = false } = {}) {
  const scale = launch ? 1 : 0.64;
  const inset = size * (1 - scale) / 2;
  const document = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${transparent ? '' : `<rect width="${size}" height="${size}" fill="#0B0E13"/>`}
    <svg x="${inset}" y="${inset}" width="${size * scale}" height="${size * scale}" viewBox="0 -0.5 16 16"><path fill="#CCFF33" d="${markPath}"/></svg>
  </svg>`;
  return new Resvg(document).render().asPng();
}
async function save(relative, size, options) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const bytes = options?.transparent
    ? raster(size, options)
    : await sharp(raster(size, options)).removeAlpha().png().toBuffer();
  await writeFile(`${target}.generated`, bytes);
  await rename(`${target}.generated`, target);
}

// iOS exige iconos opacos y todas las escalas del catálogo existente.
for (const platform of ['ios', 'macos']) {
  const dir = `patea_mobile/${platform}/Runner/Assets.xcassets/AppIcon.appiconset`;
  const manifest = JSON.parse(await readFile(path.join(root, dir, 'Contents.json'), 'utf8'));
  for (const entry of manifest.images) {
    if (!entry.filename) continue;
    await save(`${dir}/${entry.filename}`, Math.round(parseFloat(entry.size) * parseFloat(entry.scale)));
  }
}
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  await save(`patea_mobile/android/app/src/main/res/mipmap-${density}/ic_launcher.png`, size);
}
for (const size of [192, 512]) {
  for (const name of [`Icon-${size}`, `Icon-maskable-${size}`]) await save(`patea_mobile/web/icons/${name}.png`, size);
}
await save('patea_mobile/web/favicon.png', 32);
for (const [filename, size] of Object.entries({
  'icon-48-48.png': 48, 'icon-72x72.png': 72, 'icon-96x96.png': 96,
  'icon-144x144.png': 144, 'icon-192x192.png': 192, 'icon-512x512.png': 512,
  'icon-512-512.png': 512, 'icon-maskable-512x512.png': 512,
})) await save(`public/icons/${filename}`, size);

// ICO usa entradas PNG: formato compatible con Windows Vista y posteriores.
const sizes = [16, 32, 48, 128, 256];
const pngs = sizes.map(size => raster(size));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
sizes.forEach((size, index) => {
  const p = 6 + index * 16;
  directory[p] = size === 256 ? 0 : size; directory[p + 1] = directory[p];
  directory.writeUInt16LE(1, p + 4); directory.writeUInt16LE(32, p + 6);
  directory.writeUInt32LE(pngs[index].length, p + 8); directory.writeUInt32LE(offset, p + 12);
  offset += pngs[index].length;
});
const ico = Buffer.concat([directory, ...pngs]);
await writeFile(path.join(root, 'public/favicon.ico'), ico);
await writeFile(path.join(app, 'windows/runner/resources/app_icon.ico'), ico);

for (const [name, scale] of [['LaunchImage.png', 1], ['LaunchImage@2x.png', 2], ['LaunchImage@3x.png', 3]]) {
  await save(`patea_mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/${name}`, 96 * scale, { transparent: true, launch: true });
}

// Compresión de la fotografía generada: no cambia su composición.
if (process.argv[2]) {
  const webp = await sharp(path.resolve(process.argv[2])).resize({ width: 1536, withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  for (const dir of [path.join(app, 'assets/brand'), path.join(root, 'public/brand')]) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'patea_matchday.webp'), webp);
  }
  console.log(`Fotografía optimizada: ${Math.round(webp.length / 1024)} KB`);
}
console.log('Marca oficial aplicada a iOS, Android, escritorio, PWA y favicon.');

const vector = (size, adaptive = false) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado desde assets/icons/logo_patea.svg; no editar el trazo a mano. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${size}dp" android:height="${size}dp" android:viewportWidth="${adaptive ? 108 : 16}" android:viewportHeight="${adaptive ? 108 : 16}">
  <group android:translateX="${adaptive ? 26 : 0}" android:translateY="${adaptive ? 27.75 : 0.5}" android:scaleX="${adaptive ? 3.5 : 1}" android:scaleY="${adaptive ? 3.5 : 1}">
    <path android:fillColor="@color/volt_neon" android:pathData="${markPath}"/>
  </group>
</vector>\n`;
await writeFile(path.join(app, 'android/app/src/main/res/drawable/logo_patea.xml'), vector(96));
await writeFile(path.join(app, 'android/app/src/main/res/drawable/ic_launcher_foreground.xml'), vector(108, true));
