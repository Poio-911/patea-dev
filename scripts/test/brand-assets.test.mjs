import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const app = 'patea_mobile';
const canonical = await readFile(`${app}/assets/icons/logo_patea.svg`, 'utf8');
const path = canonical.match(/\bd="([^"]+)"/)[1].replace(/\s/g, '');

test('el trazo oficial coincide en Flutter, web y Android sin recortar el pie', async () => {
  assert.match(canonical, /viewBox="0 -0.5 16 16"/);
  const web = await readFile('src/components/icons/soccer-player-icon.tsx', 'utf8');
  assert.equal(web.match(/<path d="([^"]+)"/s)[1].replace(/\s/g, ''), path);
  for (const file of ['logo_patea.xml', 'ic_launcher_foreground.xml']) {
    const xml = await readFile(`${app}/android/app/src/main/res/drawable/${file}`, 'utf8');
    assert.equal(xml.match(/android:pathData="([^"]+)"/s)[1].replace(/\s/g, ''), path);
  }
});

test('todos los iconos de Apple tienen dimensiones correctas y carecen de canal alfa', async () => {
  for (const platform of ['ios', 'macos']) {
    const dir = `${app}/${platform}/Runner/Assets.xcassets/AppIcon.appiconset`;
    const manifest = JSON.parse(await readFile(`${dir}/Contents.json`, 'utf8'));
    for (const item of manifest.images) {
      if (!item.filename) continue;
      const expected = Math.round(parseFloat(item.size) * parseFloat(item.scale));
      const metadata = await sharp(`${dir}/${item.filename}`).metadata();
      assert.equal(metadata.width, expected, item.filename);
      assert.equal(metadata.height, expected, item.filename);
      assert.equal(metadata.hasAlpha, false, item.filename);
    }
  }
});

test('el icono maskable respeta la zona segura y la fotografía está optimizada', async () => {
  const { data, info } = await sharp('public/icons/icon-maskable-512x512.png').raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const p = (y * info.width + x) * info.channels;
    if (data[p] > 100 && data[p + 1] > 150) {
      assert.ok(Math.hypot(x - 256, y - 256) <= 512 * .4, 'logo fuera del círculo seguro');
    }
  }
  const photo = await readFile(`${app}/assets/brand/patea_matchday.webp`);
  assert.ok(photo.length < 250 * 1024, 'la bienvenida no necesita una fotografía pesada');
  assert.deepEqual(photo, await readFile('public/brand/patea_matchday.webp'));
  const metadata = await sharp(photo).metadata();
  assert.equal(metadata.width, 1536);
});
