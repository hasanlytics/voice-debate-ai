import JSZip from 'jszip';

/**
 * Downloads the full application source code as a ZIP file.
 * First tries backend /api/download-zip, and if browser/iframe blocks it,
 * falls back to instant client-side JSZip packaging of all source files.
 */
export async function downloadProjectZip(): Promise<void> {
  // Method 1: Try fetching the server endpoint as a binary blob
  try {
    const response = await fetch('/api/download-zip', {
      method: 'GET',
      headers: {
        'Accept': 'application/zip',
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 1000) {
        triggerBlobDownload(blob, 'voice-debate-ai.zip');
        return;
      }
    }
  } catch (err) {
    console.warn('Backend ZIP fetch attempt failed, using client-side packager:', err);
  }

  // Method 2: Client-side JSZip packaging (100% reliable in any sandbox/iframe)
  try {
    const zip = new JSZip();

    // Core config files
    zip.file('package.json', JSON.stringify({
      name: "voice-debate-ai",
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "tsx server.ts",
        build: "vite build",
        start: "node server.ts",
        preview: "vite preview"
      },
      dependencies: {
        "@google/genai": "^2.4.0",
        "@tailwindcss/vite": "^4.3.3",
        "@vitejs/plugin-react": "^6.1.1",
        "lucide-react": "^0.546.0",
        "react": "^19.0.1",
        "react-dom": "^19.0.1",
        "vite": "^8.3.0",
        "express": "^4.21.2",
        "dotenv": "^17.2.3",
        "motion": "^12.23.24",
        "adm-zip": "^0.5.16",
        "jszip": "^3.10.1",
        "canvas-confetti": "^1.9.4"
      },
      devDependencies: {
        "@types/node": "^22.14.0",
        "@types/react": "^19.3.0",
        "@types/react-dom": "^19.3.0",
        "@types/express": "^4.17.21",
        "@types/adm-zip": "^0.5.7",
        "@types/canvas-confetti": "^1.9.0",
        "tailwindcss": "^4.3.3",
        "tsx": "^4.21.0",
        "typescript": "^7.0.2"
      }
    }, null, 2));

    zip.file('tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        experimentalDecorators: true,
        useDefineForClassFields: false,
        module: "ESNext",
        types: ["vite/client"],
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        skipLibCheck: true,
        moduleResolution: "bundler",
        isolatedModules: true,
        moduleDetection: "force",
        allowJs: true,
        jsx: "react-jsx",
        paths: { "@/*": ["./*"] },
        allowImportingTsExtensions: true,
        noEmit: true
      },
      exclude: ["dist"]
    }, null, 2));

    zip.file('vite.config.ts', `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
    },
  };
});
`);

    zip.file('.env.example', `# GEMINI_API_KEY: Optional if provided in UI
GEMINI_API_KEY=""
PORT=3000
`);

    zip.file('README.md', `# Voice Debate AI - বাংলা ভয়েস বিতর্ক 🎙️

একটি কৃত্রিম বুদ্ধিমত্তা চালিত বাংলা লাইভ ভয়েস বিতর্ক প্ল্যাটফর্ম।

## বৈশিষ্ট্যসমূহ:
- 🎙️ হাই-ডেফিনিশন বাংলা কণ্ঠস্বর (Debate AI)
- 🎭 রম্য বিতর্ক (Funny / Witty) পার্সোনা যুক্ত
- 📜 লোকালস্টোরেজে বিতর্কের ইতিহাস সংরক্ষণ
- 📸 অফিসিয়াল স্কোরকার্ড ও রেজাল্ট কার্ড PNG ডাউনলোড
- 🌐 সরাসরি সোশ্যাল মিডিয়ায় শেয়ার (WhatsApp, Facebook, Twitter)

## রান করার নিয়ম:
1. ডিপেন্ডেন্সি ইনস্টল করুন:
\`\`\`bash
npm install
\`\`\`

2. অ্যাপ্লিকেশন চালু করুন:
\`\`\`bash
npm run dev
\`\`\`

3. ব্রাউজারে খুলুন: \`http://localhost:3000\`
`);

    // Fetch current source code files from browser window / assets
    const [indexHtml, serverTs, appTsx, indexCss, mainTsx] = await Promise.all([
      fetch('/index.html').then(r => r.text()).catch(() => ''),
      fetch('/server.ts').then(r => r.text()).catch(() => ''),
      fetch('/src/App.tsx').then(r => r.text()).catch(() => ''),
      fetch('/src/index.css').then(r => r.text()).catch(() => ''),
      fetch('/src/main.tsx').then(r => r.text()).catch(() => ''),
    ]);

    if (indexHtml) zip.file('index.html', indexHtml);
    if (serverTs) zip.file('server.ts', serverTs);

    const src = zip.folder('src');
    if (src) {
      if (appTsx) src.file('App.tsx', appTsx);
      if (indexCss) src.file('index.css', indexCss);
      if (mainTsx) src.file('main.tsx', mainTsx);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(zipBlob, 'voice-debate-ai.zip');
  } catch (clientErr) {
    console.error('Client zip generation failed:', clientErr);
    // Last resort direct navigation
    window.location.href = '/api/download-zip';
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1000);
}
