// Manual live smoke test of the committed profile-photo model/prompt pipeline.
// Does not read or modify player profiles, Storage objects, or generation credits.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { GoogleGenAI, Modality } = require('@google/genai');
// Use the SDK's auth dependency (v10 headers), rather than Admin SDK's v9.
const { OAuth2Client } = require(require.resolve('google-auth-library', {
  paths: [path.dirname(require.resolve('@google/genai'))],
}));
const { IMAGE_MODEL_CANDIDATES, PLAYER_PHOTO_ASPECT_RATIO, PROMPT, extractGeneratedImage } =
  require('../lib/callable/generate-player-photo');

async function main() {
  const [source, destination, promptFile] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Usage: node scripts/smoke-player-photo.cjs SOURCE OUTPUT_DIR [PROMPT_FILE]');
  const buffer = fs.readFileSync(source);
  const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8').trim() : PROMPT;
  if (buffer.length > 5 * 1024 * 1024) throw new Error('Source exceeds production 5 MB limit');
  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(source, path.join(destination, 'source.png'));
  const token = execFileSync(process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud', [
    'auth', 'print-access-token', '--account=santiago.lopez.toma@gmail.com',
  ], { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const authClient = new OAuth2Client();
  authClient.setCredentials({ access_token: token });
  const client = new GoogleGenAI({ vertexai: true, project: 'mil-disculpis',
    location: 'global', googleAuthOptions: { authClient } });
  const report = { createdAt: new Date().toISOString(), project: 'mil-disculpis',
    source: 'source.png', prompt, postProcessing: false,
    aspectRatio: PLAYER_PHOTO_ASPECT_RATIO, attempts: [], result: null };
  for (const model of IMAGE_MODEL_CANDIDATES) {
    const start = Date.now();
    console.log('Testing production model:', model);
    try {
      const response = await client.models.generateContent({ model,
        contents: [{ inlineData: { data: buffer.toString('base64'), mimeType: 'image/png' } },
          { text: prompt }], config: { responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: { aspectRatio: PLAYER_PHOTO_ASPECT_RATIO }, httpOptions: { timeout: 65000 } } });
      const image = extractGeneratedImage(response);
      const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType === 'image/webp' ? 'webp' : 'png';
      const filename = 'converted.' + extension;
      fs.writeFileSync(path.join(destination, filename), image.data);
      report.attempts.push({ model, success: true, elapsedMs: Date.now() - start });
      report.result = { file: filename, mimeType: image.mimeType, bytes: image.data.length, model };
      console.log('Saved conversion:', filename);
      break;
    } catch (error) {
      report.attempts.push({ model, success: false, elapsedMs: Date.now() - start,
        message: error.message, status: error.status ?? error.code ?? null });
      console.log('Model failed:', model, error.message);
    }
  }
  fs.writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2));
  if (!report.result) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
