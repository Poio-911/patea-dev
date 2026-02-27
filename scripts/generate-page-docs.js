const fs = require('fs');
const path = require('path');
const https = require('https');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GOOGLE_GENAI_API_KEY=([^\r\n]+)/);

if (!match) {
    process.exit(1);
}

const API_KEY = match[1];
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

const APP_DIR = path.join(__dirname, '..', 'src', 'app');
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'pages');

if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function findPageFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findPageFiles(fullPath, fileList);
        } else if (file === 'page.tsx') {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const pageFiles = findPageFiles(APP_DIR);
console.log(`Found ${pageFiles.length} pages to document.`);

async function generateDoc(filePath) {
    const relativePath = path.relative(APP_DIR, filePath).replace(/\\/g, '/');
    const route = relativePath.replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, 'Home (/)');
    let saveName = route.replace(/[\/\\]/g, '-').replace(/\[|\]/g, '') + '.md';
    if (saveName === 'Home (/).md') saveName = 'index.md';
    if (!saveName.endsWith('.md')) saveName = saveName + '.md';

    const docPath = path.join(DOCS_DIR, saveName);

    // Only skip if the file is large enough (to avoid skipping empty/truncated files)
    if (fs.existsSync(docPath) && fs.statSync(docPath).size > 500) {
        console.log(`[SKIP] ${saveName} already exists and is complete.`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    if (content.length > 15000) {
        content = content.substring(0, 15000);
    }

    console.log(`[START] ${route} ...`);

    const prompt = `Analiza el siguiente código TypeScript/React (Next.js) para la ruta: /${route.replace('Home (/)', '')}.
Por favor, genera un documento Markdown que resuma y documente rigurosamente, SIN textos introductorios, usando directamente el siguiente formato:

# Ruta: /${route.replace('Home (/)', '')}
## Propósito General
(descripción base de para qué sirve)
## Componentes y Estructura
(layout y componentes hijos renderizados)
## Hooks, Server Actions y Lógica
(hooks useState/useEffect/Custom, Server Actions importadas y manejo de base de datos)

Aquí tienes el código:
\`\`\`tsx
${content}
\`\`\`
`.trim();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: "Solo output en Markdown crudo. Sin hola ni despedidas." }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        const result = await response.json();

        if (result.error) {
            console.error(`[ERROR API] ${route}:`, result.error.message);
            return;
        }

        let text = result.candidates[0]?.content?.parts[0]?.text || '';
        if (text.length > 50) {
            fs.writeFileSync(docPath, text, 'utf8');
            console.log(`[DONE] ${saveName} (${text.length} bytes)`);
        } else {
            console.error(`[EMPTY OR TRUNCATED] ${saveName}`, JSON.stringify(result));
        }

    } catch (error) {
        console.error(`[CATCH] calling API for ${route}`, error.message);
    }
}

async function run() {
    const concurrencyLimit = 5;
    let index = 0;

    async function worker() {
        while (index < pageFiles.length) {
            const current = index++;
            await generateDoc(pageFiles[current]);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const workers = [];
    for (let i = 0; i < concurrencyLimit; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    console.log('Finished all pages!');
}

run();
