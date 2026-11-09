import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// CORS & Attachment headers for downloads
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

interface ChatTurn {
  sender: 'user' | 'ai';
  text: string;
}

const defaultApiKey = process.env.GEMINI_API_KEY || '';

function getGenAIClient(customKey?: string) {
  const key = customKey?.trim() || defaultApiKey;
  if (!key) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory cache for generated TTS audio
const audioCache = new Map<string, string>();
let ttsCooldownUntil = 0;

// Helper to generate natural Bengali speech using Gemini TTS models
async function generateGeminiSpeech(
  text: string,
  voiceName: string = 'Kore',
  debateStyle?: string,
  customApiKey?: string
): Promise<{ audioData: string | null; quotaExceeded?: boolean }> {
  try {
    const cleanText = text
      .replace(/[*#_~`>]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return { audioData: null };

    const cacheKey = `${voiceName || 'Kore'}_${debateStyle || 'default'}_${cleanText}`;
    if (audioCache.has(cacheKey)) {
      return { audioData: audioCache.get(cacheKey)! };
    }

    if (!customApiKey && Date.now() < ttsCooldownUntil) {
      return { audioData: null, quotaExceeded: true };
    }

    let stylePrompt = 'Natural, clear, eloquent native Bengali speaker with engaging debate cadence and articulate diction.';
    if (debateStyle === 'savage') {
      stylePrompt = 'Crisp, fiery, energetic Bengali speaker with sharp and persuasive counter-argument intonation.';
    } else if (debateStyle === 'serious') {
      stylePrompt = 'Formal, intellectual, dignified Bengali speaker with clear academic pacing and conviction.';
    } else if (debateStyle === 'funny') {
      stylePrompt = 'Playful, lively, humorous Bengali speaker with witty, smiling, comical and animated debate cadence.';
    } else if (debateStyle === 'friendly') {
      stylePrompt = 'Friendly, warm, lively Bengali speaker with natural and smiling conversational cadence.';
    }

    const client = getGenAIClient(customApiKey);
    if (!client) {
      return { audioData: null };
    }

    const ttsCandidateModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let hitQuota = false;

    for (const modelName of ttsCandidateModels) {
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cleanText,
                  speechMetadata: {
                    style: stylePrompt,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          audioCache.set(cacheKey, base64Audio);
          return { audioData: base64Audio };
        }
      } catch (err: any) {
        const isQuota = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuota) hitQuota = true;
      }
    }

    if (hitQuota && !customApiKey) {
      ttsCooldownUntil = Date.now() + 10 * 1000;
      return { audioData: null, quotaExceeded: true };
    }
  } catch (error: any) {
    console.error('Speech generation error:', error?.message);
  }
  return { audioData: null };
}

// 1-Click Complete Project ZIP Generator
function generateProjectZip(): Buffer {
  const zip = new AdmZip();
  const rootDir = __dirname;

  const rootFiles = [
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'server.ts',
    'index.html',
    'metadata.json',
    '.env.example',
    'README.md',
  ];

  for (const file of rootFiles) {
    const fullPath = path.resolve(rootDir, file);
    if (fs.existsSync(fullPath)) {
      zip.addLocalFile(fullPath);
    }
  }

  const dirs = ['src', 'public'];
  for (const d of dirs) {
    const fullPath = path.resolve(rootDir, d);
    if (fs.existsSync(fullPath)) {
      zip.addLocalFolder(fullPath, d);
    }
  }

  return zip.toBuffer();
}

app.get(['/api/download-zip', '/voice-debate-ai.zip'], (_req: Request, res: Response) => {
  try {
    const zipBuffer = generateProjectZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="voice-debate-ai.zip"');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('ZIP generation error:', err);
    res.status(500).json({ error: 'Failed to create zip package' });
  }
});

// Dedicated TTS endpoint
app.post('/api/debate/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName, style } = req.body;
    const customKey = (req.headers['x-gemini-api-key'] as string) || '';
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }
    const result = await generateGeminiSpeech(text, voiceName, style, customKey);
    if (!result.audioData) {
      return res.status(result.quotaExceeded ? 429 : 503).json({
        error: result.quotaExceeded ? 'DAILY_QUOTA_EXHAUSTED' : 'HD_VOICE_UNAVAILABLE',
        message: result.quotaExceeded
          ? 'Gemini Free Tier দৈনিক ১০টি HD ভয়েস লিমিট পূর্ণ হয়েছে।'
          : 'HD ভয়েস সাময়িকভাবে প্রস্তুত হতে পারছে না।',
      });
    }
    res.json({ audioData: result.audioData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Debate reply endpoint
app.post('/api/debate/reply', async (req: Request, res: Response) => {
  try {
    const { topic, style, userSide, messages, isOpening } = req.body as {
      topic: string;
      style: 'friendly' | 'serious' | 'savage' | 'funny';
      userSide: 'for' | 'against';
      messages: ChatTurn[];
      isOpening?: boolean;
    };

    if (!topic || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Topic and messages are required' });
    }

    const aiStance = userSide === 'for' ? 'বিপক্ষে' : 'পক্ষে';
    const userStance = userSide === 'for' ? 'পক্ষে' : 'বিপক্ষে';

    let stylePrompt = '';
    switch (style) {
      case 'friendly':
        stylePrompt = 'টোন: বন্ধুত্বপূর্ণ, হালকা রসিকতাপূর্ণ এবং হাসিখুশি (Friendly & witty)। যুক্তি দিন কিন্তু সম্মান ও মজার ছলে।';
        break;
      case 'serious':
        stylePrompt = 'টোন: গুরুগম্ভীর, তথ্যবহুল, গভীর যুক্তি ও বিজ্ঞান/পরিসংখ্যান নির্ভর (Formal, analytical & rigorous)। যুক্তির কাঠামো দৃঢ় রাখুন।';
        break;
      case 'savage':
        stylePrompt = 'টোন: তীব্র পাল্টা যুক্তি ও খোঁচা (Savage, punchy & sharp roasts)। ইউজারের পয়েন্টের অসারতা তুলে ধরুন কিন্তু কোনো অশালীন ভাষা ব্যবহার করবেন না।';
        break;
      case 'funny':
        stylePrompt = 'টোন: রম্য বিতর্ক (Humorous & witty comical debate)। তীক্ষ্ণ বুদ্ধিদীপ্ত হাস্যরস, চটুল কৌতুক, হাসিখুশি ও চমৎকার বাস্তব উপমার মাধ্যমে প্রতিপক্ষের যুক্তি খণ্ডন করুন। যুক্তির ভিত্তি শক্ত রেখে এমনভাবে কথা বলুন যাতে সবাই নির্মল আনন্দ পায় ও হেসে ফেলে কিন্তু আপনার পয়েন্ট শক্তিশালী থাকে। কোনো আক্রমণ বা অশ্লীলতা নয়, নিখাদ রম্য বিতর্ক।';
        break;
      default:
        stylePrompt = 'টোন: চিত্তাকর্ষক এবং উদ্দীপনাময়।';
    }

    let systemInstruction = '';
    if (isOpening) {
      systemInstruction = `আপনি একটি লাইভ বাংলা ভয়েস বিতর্ক প্রতিযোগিতার (Voice Debate) ঝানু প্রতিযোগী ও উদ্বোধনী বক্তা (Debate AI)।
বিতর্কের বিষয়: "${topic}"
আপনার (Debate AI) অবস্থান: ${aiStance}
ইউজারের অবস্থান: ${userStance}
${stylePrompt}

নির্দেশনা:
যেহেতু আপনি বিতর্কের সূচনা বক্তব্য (Opening Argument) দিচ্ছেন:
1. মার্জিত, প্রাণবন্ত ও আত্মবিশ্বাসী ভাষায় নিজের অবস্থানের পক্ষে একটি জোরালো সূচনা যুক্তি তুলে ধরুন।
2. কোনোভাবেই ইউজারকে আক্রমণ করবেন না কারণ ইউজার এখনো কোনো বক্তব্য দেননি।
3. বক্তব্যটি ৩ থেকে ৪টি স্পষ্ট বাক্যের মধ্যে (৪০-৬০ শব্দ) রাখুন যাতে ভয়েসে শুনতে আকর্ষণীয় ও টানটান লাগে।
4. বক্তব্য শেষে ইউজারকে তার প্রথম যুক্তি তুলে ধরার জন্য বিনয়ের সাথে আমন্ত্রণ জানান (যেমন: "এবার আপনার বক্তব্য উপস্থাপনের অনুরোধ জানাচ্ছি।")।`;
    } else {
      systemInstruction = `আপনি একটি লাইভ বাংলা ভয়েস বিতর্ক প্রতিযোগিতার (Voice Debate) ঝানু প্রতিযোগী ও বক্তা (Debate AI)।
বিতর্কের বিষয়: "${topic}"
ইউজারের অবস্থান: ${userStance}
আপনার (Debate AI) অবস্থান: ${aiStance} — আপনি অবশ্যই আপনার অবস্থানের পক্ষে এবং ইউজারের বিপরীতে যুক্তি উপস্থাপন করবেন।
${stylePrompt}

নিয়মাবলী:
1. উত্তরটি স্বাভাবিক, স্পষ্ট ও সাবলীল বাংলায় দিন।
2. ইউজারের সাম্প্রতিক বক্তব্যের দুর্বলতা বা মূল পয়েন্টকে সরাসরি খণ্ডন করুন এবং নিজের অবস্থানে নতুন একটি শক্ত যুক্তি যোগ করুন।
3. এটি যেহেতু ভয়েস বিতর্ক (Voice / Audio Debate), উত্তরটি হতে হবে চটপটে, টানটান এবং ৩ থেকে ৪টি বাক্যের মধ্যে (প্রায় ৪০-৭০ শব্দ)। অতিরিক্ত দীর্ঘ প্রবন্ধ লিখবেন না।
4. কোনোভাবেই সহজে পরাজয় স্বীকার করবেন না। আত্মবিশ্বাসের সাথে যুক্তি চালিয়ে যান।`;
    }

    const contents = isOpening
      ? [
          {
            role: 'user',
            parts: [
              {
                text: `বিতর্কের বিষয়: "${topic}"। আপনার অবস্থান (${aiStance}) অনুযায়ী একটি চমৎকার, শক্তিশালী ও আকর্ষণীয় সূচনা বক্তব্য (Opening speech) দিন।`,
              },
            ],
          },
        ]
      : messages.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

    const candidateModels = [
      'gemini-3.1-flash-lite-preview',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
    ];

    const customKey = (req.headers['x-gemini-api-key'] as string) || '';
    const client = getGenAIClient(customKey);
    let replyText = '';
    let lastError: any = null;

    if (client) {
      for (const modelName of candidateModels) {
        try {
          const response = await client.models.generateContent({
            model: modelName,
            contents,
            config: { systemInstruction },
          });
          if (response.text) {
            replyText = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    if (!replyText) {
      // Fallback response for offline or quota cases
      replyText = isOpening
        ? `বিতর্কের বিষয় "${topic}"-এ আমার অবস্থান সুস্পষ্টভাবে ${aiStance}। কারণ বাস্তবতা এবং দীর্ঘমেয়াদি সুবিধার নিরিখে এই অবস্থানই সবচেয়ে যৌক্তিক ও গ্রহণযোগ্য। এবার আপনার প্রথম যুক্তিটি পেশ করুন!`
        : `আপনার যুক্তিটি আগ্রহোদ্দীপক হলেও বাস্তবতা পুরোপুরি ভিন্ন। ${topic} এর ক্ষেত্রে মূল বিষয়টি হলো কার্যকারিতা ও দীর্ঘমেয়াদি প্রভাব। তাই আমার অবস্থান অর্থাৎ ${aiStance} অংশটিই অধিক যুক্তিযুক্ত। আপনার কি এর বিপরীতে আরও সুনির্দিষ্ট কোনো প্রমাণ আছে?`;
    }

    const { voiceName = 'Kore' } = req.body;
    let audioData: string | null = null;
    let quotaExceeded = false;
    try {
      const speechPromise = generateGeminiSpeech(replyText, voiceName, style, customKey);
      const timeoutPromise = new Promise<{ audioData: null; quotaExceeded?: boolean }>((resolve) =>
        setTimeout(() => resolve({ audioData: null }), 12000)
      );
      const result = await Promise.race([speechPromise, timeoutPromise]);
      audioData = result.audioData;
      if (result.quotaExceeded) quotaExceeded = true;
    } catch {}

    res.json({ reply: replyText, audioData, quotaExceeded });
  } catch (error: any) {
    console.error('Debate reply error:', error);
    res.status(500).json({
      error: 'Debate AI-র উত্তর পেতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      details: error.message,
    });
  }
});

// Debate judge / evaluation endpoint
app.post('/api/debate/judge', async (req: Request, res: Response) => {
  try {
    const { topic, userSide, messages } = req.body as {
      topic: string;
      userSide: 'for' | 'against';
      messages: ChatTurn[];
    };

    if (!topic || !messages || messages.length === 0) {
      return res.status(400).json({ error: 'Debate history is required for judging' });
    }

    const transcript = messages
      .map((m, idx) => `[রাউন্ড ${Math.floor(idx / 2) + 1}] ${m.sender === 'user' ? 'বক্তা ১ (ইউজার)' : 'বক্তা ২ (Debate AI)'}: ${m.text}`)
      .join('\n');

    const prompt = `আপনি একজন আন্তর্জাতিক খ্যাতিসম্পন্ন নিরপেক্ষ প্রধান বিচারক (Chief Adjudicator)।
নিচের বিতর্কটি মূল্যায়ন করুন এবং একটি বস্তুনিষ্ঠ ফলাফল প্রদান করুন:

বিষয়: "${topic}"
ইউজারের অবস্থান: ${userSide === 'for' ? 'পক্ষ' : 'বিপক্ষ'}
Debate AI-র অবস্থান: ${userSide === 'for' ? 'বিপক্ষ' : 'পক্ষ'}

বিতর্কের ট্রান্সক্রিপ্ট:
${transcript}

অনুগ্রহ করে নিচের JSON ফরম্যাটে ফলাফল দিন:
{
  "winner": "User" বা "AI" বা "Tie",
  "winnerTitle": "বিজয়ী ঘোষণার ছোট্ট শিরোনাম (যেমন: বক্তা ১ (ইউজার) বিজয়ী!)",
  "userScore": 100-এর মধ্যে ইউজারের স্কোর (যেমন: 85),
  "aiScore": 100-এর মধ্যে Debate AI-র স্কোর (যেমন: 82),
  "summary": "বিতর্কের সামগ্রিক মূল্যায়ন ও রায় নিয়ে ৩-৪ বাক্যের মন্তব্য",
  "userStrengths": ["ইউজারের ১টি বা ২টি সেরা যুক্তির প্রশংসা"],
  "aiStrengths": ["Debate AI-র ১টি বা ২টি সেরা যুক্তির প্রশংসা"],
  "improvementTip": "ইউজারের জন্য ভবিষ্যতে বিতর্কে আরও ভালো করার ১টি গঠনমূলক পরামর্শ"
}
শুধুমাত্র সঠিক JSON দিন, কোনো অতিরিক্ত কোডব্লক বা টেক্সট ছাড়া।`;

    const candidateModels = [
      'gemini-3.1-flash-lite-preview',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
    ];

    const customKey = (req.headers['x-gemini-api-key'] as string) || '';
    const client = getGenAIClient(customKey);
    let jsonStr = '';

    if (client) {
      for (const modelName of candidateModels) {
        try {
          const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            },
          });
          if (response.text) {
            jsonStr = response.text;
            break;
          }
        } catch (err: any) {
          console.warn(`Judge model ${modelName} error:`, err?.message);
        }
      }
    }

    if (!jsonStr) {
      // Heuristic fallback judging
      const userCount = messages.filter((m) => m.sender === 'user').length;
      const userLen = messages.filter((m) => m.sender === 'user').reduce((acc, m) => acc + m.text.length, 0);
      const userScore = Math.min(95, Math.max(70, Math.floor(75 + (userLen / 100) * 3)));
      const aiScore = Math.min(94, Math.max(70, Math.floor(74 + (userCount * 4))));
      const winner = userScore > aiScore ? 'User' : userScore < aiScore ? 'AI' : 'Tie';

      res.json({
        winner,
        winnerTitle: winner === 'User' ? 'বক্তা ১ (ইউজার) বিজয়ী!' : winner === 'AI' ? 'Debate AI বিজয়ী!' : 'লড়াই সমানে সমান!',
        userScore,
        aiScore,
        summary: `উভয় পক্ষই "${topic}" বিষয়ে চমৎকার যুক্তি উপস্থাপন করেছেন। উপস্থাপনা শৈলী, তথ্যের প্রাসঙ্গিকতা এবং দ্রুত পাল্টা জবাবের নিরিখে এটি একটি উপভোগ্য বিতর্ক ছিল।`,
        userStrengths: ['সাহসী উপস্থাপনা ও স্পষ্ট অবস্থান', 'তাত্ক্ষণিক প্রত্যুৎপন্নমতিত্ব'],
        aiStrengths: ['শক্তিশালী লজিক্যাল ধারাবাহিকতা', 'তীক্ষ্ণ পাল্টা যুক্তি'],
        improvementTip: 'পরবর্তী বিতর্কে আরও সুনির্দিষ্ট উদাহরণ ও বাস্তব উপাত্ত যোগ করলে আপনার যুক্তি আরও অখণ্ডনীয় হবে।',
      });
      return;
    }

    const parsed = JSON.parse(jsonStr || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Debate judging error:', error);
    res.status(500).json({
      error: 'বিতর্ক মূল্যায়ন করতে সমস্যা হয়েছে।',
      details: error.message,
    });
  }
});

// Topic suggestions endpoint
app.get('/api/debate/random-topics', async (_req: Request, res: Response) => {
  try {
    const prompt = `বাংলা বিতর্কের জন্য ৫টি আকর্ষণীয় ও ট্রেন্ডি বিষয় তৈরি করুন (ছোট ও স্পষ্ট শিরোনাম)।
JSON ফরম্যাটে দিন: ["টপিক ১", "টপিক ২", "টপিক ৩", "টপিক ৪", "টপিক ৫"]`;
    const client = getGenAIClient();
    if (client) {
      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const topics = JSON.parse(response.text || '[]');
      if (Array.isArray(topics) && topics.length > 0) {
        return res.json({ topics });
      }
    }
  } catch {}

  res.json({
    topics: [
      'চা কফির চেয়ে ভালো',
      'AI মানুষের সৃষ্টিশীলতাকে ধ্বংস করে দেবে',
      'গ্রামের জীবন শহরের জীবনের চেয়ে বেশি সুখকর',
      'বিশ্ববিদ্যালয়ের ডিগ্রির চেয়ে স্কিল বেশি দরকারি',
      'স্মার্টফোন শিক্ষার্থীদের পড়াশোনার ক্ষতি করছে',
    ],
  });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Voice Debate AI Server running on port ${port}`);
  });
}

startServer();
