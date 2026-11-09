import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Send,
  Volume2,
  VolumeX,
  RotateCcw,
  Award,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Flame,
  GraduationCap,
  Smile,
  Laugh,
  RefreshCw,
  Play,
  Square,
  Settings,
  Trash2,
  CheckCircle2,
  Download,
  Camera,
  User,
  Key,
  AlertTriangle,
  History,
  Share2,
  X,
  ChevronDown,
  ChevronUp,
  LogOut,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut, testFirestoreConnection, FIREBASE_PROJECT_ID } from './firebase';
import { initGA, trackEvent, trackPageView } from './utils/analytics';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  audioData?: string | null;
  isLoadingAudio?: boolean;
}

interface JudgeResult {
  winner: 'User' | 'AI' | 'Tie';
  winnerTitle: string;
  userScore: number;
  aiScore: number;
  summary: string;
  userStrengths: string[];
  aiStrengths: string[];
  improvementTip: string;
}

interface DebateHistoryItem {
  id: string;
  timestamp: number;
  dateFormatted: string;
  topic: string;
  style: string;
  userName: string;
  userSide: 'for' | 'against';
  winner: 'User' | 'AI' | 'Tie';
  winnerTitle: string;
  userScore: number;
  aiScore: number;
  summary: string;
  userStrengths: string[];
  aiStrengths: string[];
  improvementTip: string;
  messages: Message[];
}

const PRESET_TOPICS = [
  'চা কফির চেয়ে ভালো',
  'AI মানুষের চাকরি কেড়ে নেবে',
  'বই পড়া সিনেমা দেখার চেয়ে ভালো',
  'ক্রিকেট ফুটবলের চেয়ে ভালো খেলা',
  'সকালে ওঠা রাত জাগার চেয়ে ভালো',
  'টাকা দিয়ে সুখ কেনা যায়',
  'Social media মানুষের জন্য ক্ষতিকর',
  'Remote work অফিসে কাজের চেয়ে ভালো',
];

const PRESET_AVATARS = [
  { id: 'debater', emoji: '🎙️', label: 'বিতার্কিক' },
  { id: 'student', emoji: '👨‍🎓', label: 'শিক্ষার্থী' },
  { id: 'pro', emoji: '👨‍💼', label: 'পেশাজীবী' },
  { id: 'lion', emoji: '🦁', label: 'সিংহহৃদয়' },
  { id: 'fire', emoji: '⚡', label: 'তীব্র তারুণ্য' },
  { id: 'thinker', emoji: '👑', label: 'বুদ্ধিজীবী' },
];

const STYLES = [
  {
    id: 'friendly',
    label: 'Friendly',
    bengaliLabel: 'বন্ধুত্বপূর্ণ',
    desc: 'হালকা, মজার ও চটপটে টোন',
    icon: Smile,
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'serious',
    label: 'Serious',
    bengaliLabel: 'তথ্যবহুল',
    desc: 'যুক্তি, প্রমাণ ও তথ্যনির্ভর',
    icon: GraduationCap,
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'savage',
    label: 'Savage',
    bengaliLabel: 'খোঁচাময়',
    desc: 'তীব্র পাল্টা যুক্তি ও খোঁচা',
    icon: Flame,
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  {
    id: 'funny',
    label: 'রম্য বিতর্ক',
    bengaliLabel: 'রম্য ও হাস্যকৌতুক',
    desc: 'হাস্যরস, মজার উপমা ও চটুল রসিকতাপূর্ণ যুক্তি',
    icon: Laugh,
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
] as const;

type StyleType = (typeof STYLES)[number]['id'];

const GEMINI_VOICES = [
  {
    id: 'Kore',
    name: 'কোরি (Kore)',
    gender: 'নারী কণ্ঠ',
    desc: 'স্বাভাবিক, মিষ্টি ও অত্যন্ত স্পষ্ট বাংলা উচ্চারণ (সেরা ও প্রস্তাবিত)',
    sampleText: 'নমস্কার! আমি কোরি। আপনার সাথে যুক্তিতর্কে অংশ নিতে আমি প্রস্তুত।',
  },
  {
    id: 'Puck',
    name: 'পাক (Puck)',
    gender: 'পুরুষ কণ্ঠ',
    desc: 'প্রাণবন্ত, চটপটে ও আক্রমণাত্মক বিতার্কিক ব্যক্তিত্ব',
    sampleText: 'হ্যালো! আমার যুক্তি এত সহজে কিন্তু আপনি খণ্ডন করতে পারবেন না!',
  },
  {
    id: 'Zephyr',
    name: 'জেফির (Zephyr)',
    gender: 'শান্ত কণ্ঠ',
    desc: 'ধীরস্থির, গভীর ও বিশ্লেষণধর্মী যুক্তিপূর্ণ ব্যক্তিত্ব',
    sampleText: 'আসুন তর্কের গভীরে গিয়ে বাস্তব সত্যকে বিচার করি।',
  },
  {
    id: 'Fenrir',
    name: 'ফেনরির (Fenrir)',
    gender: 'ভারী কণ্ঠ',
    desc: 'বলিষ্ঠ, আত্মবিশ্বাসী ও রাশভারী বিতার্কিক কণ্ঠস্বর',
    sampleText: 'বিতর্কের ময়দানে কোনো আপস নয়, সরাসরি শক্তিশালী যুক্তি দিন!',
  },
] as const;

export default function App() {
  const [screen, setScreen] = useState<'setup' | 'debate'>('setup');

  // User Profile
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('voice_debate_username') || 'বক্তা ১ (আপনি)';
  });
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    return localStorage.getItem('voice_debate_avatar') || '';
  });
  const [selectedEmojiAvatar, setSelectedEmojiAvatar] = useState<string>(() => {
    return localStorage.getItem('voice_debate_emoji_avatar') || '🎙️';
  });

  // Debate Settings
  const [topic, setTopic] = useState<string>('চা কফির চেয়ে ভালো');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [style, setStyle] = useState<StyleType>('funny');
  const [userSide, setUserSide] = useState<'for' | 'against'>('for');
  const [language] = useState<'bn-BD'>('bn-BD');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const [dynamicTopics, setDynamicTopics] = useState<string[]>(PRESET_TOPICS);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Debate Arena State
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState<string>('');
  const [isAiReplying, setIsAiReplying] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [speechInterim, setSpeechInterim] = useState<string>('');
  const [isSpeakingTTS, setIsSpeakingTTS] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);

  // Adjudication / Judge State
  const [isJudging, setIsJudging] = useState<boolean>(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
  const [showJudgeModal, setShowJudgeModal] = useState<boolean>(false);

  // History State
  const [historyItems, setHistoryItems] = useState<DebateHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('voice_debate_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Share & Certificate State
  const [isGeneratingCard, setIsGeneratingCard] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Gemini API Key Management
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    return localStorage.getItem('voice_debate_gemini_key') || '';
  });
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [quotaExceededNotice, setQuotaExceededNotice] = useState<boolean>(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState<boolean>(false);
  const [apiKeyTestMessage, setApiKeyTestMessage] = useState<string | null>(null);

  // Debate Phase: 'intro' | 'debating'
  const [debatePhase, setDebatePhase] = useState<'intro' | 'debating'>('intro');

  // Status message
  const [statusText, setStatusText] = useState<string>('মাইকে চাপুন আর আপনার যুক্তি বলুন');

  // Toast & Auth Domain Notice State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuthDomainModal, setShowAuthDomainModal] = useState<boolean>(false);
  const [domainCopied, setDomainCopied] = useState<boolean>(false);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Refs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const isRecordingActiveRef = useRef<boolean>(false);
  const accumulatedSpeechRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechQueueTimeoutRef = useRef<any>(null);
  const speechIsCancelledRef = useRef<boolean>(false);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast('ছবির আকার ৩ MB-র কম রাখুন!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setUserAvatar(result);
      localStorage.setItem('voice_debate_avatar', result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setUserAvatar('');
    localStorage.removeItem('voice_debate_avatar');
  };

  // Firebase Auth & GA4 State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Initialize GA4 and Firebase Auth listener
  useEffect(() => {
    initGA();
    trackPageView('Voice Debate AI - হোম পেজ');
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        if (user.displayName && (!userName || userName === 'বক্তা ১ (আপনি)')) {
          setUserName(user.displayName);
          localStorage.setItem('voice_debate_username', user.displayName);
        }
        if (user.photoURL && !userAvatar) {
          setUserAvatar(user.photoURL);
          localStorage.setItem('voice_debate_avatar', user.photoURL);
        }

        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(
            userRef,
            {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || userName,
              photoURL: user.photoURL || '',
              lastLoginAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Firestore user sync notice:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        if (user.displayName) {
          setUserName(user.displayName);
          localStorage.setItem('voice_debate_username', user.displayName);
        }
        if (user.photoURL) {
          setUserAvatar(user.photoURL);
          localStorage.setItem('voice_debate_avatar', user.photoURL);
        }
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(
            userRef,
            {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email || 'বক্তার নাম',
              photoURL: user.photoURL || '',
              lastLoginAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Firestore user write notice:', err);
        }

        trackEvent('login', { method: 'google', email: user.email });
        showToast(`স্বাগতম, ${user.displayName || user.email || 'বক্তা'}! গুগল দিয়ে সাইন ইন সম্পন্ন হয়েছে।`);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        setShowAuthDomainModal(true);
      } else if (err?.code === 'auth/popup-closed-by-user') {
        // user voluntarily closed popup
      } else {
        showToast('গুগল দিয়ে সাইন ইন ত্রুটি: ' + (err?.message || 'আবার চেষ্টা করুন'));
      }
    }
  };

  const handleSignOut = async () => {
    await logOut();
    setCurrentUser(null);
    setUserAvatar('');
    localStorage.removeItem('voice_debate_avatar');
    trackEvent('logout');
  };

  // Continuous Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        isRecordingActiveRef.current = true;
        setStatusText('🎙️ শুনছি... সময় নিয়ে আপনার সম্পূর্ণ যুক্তি বলুন...');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let newlyFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newlyFinal += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (newlyFinal) {
          accumulatedSpeechRef.current = (accumulatedSpeechRef.current + ' ' + newlyFinal).trim();
          setLiveTranscript(accumulatedSpeechRef.current);
        }

        setSpeechInterim(interim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
          isRecordingActiveRef.current = false;
          setStatusText('মাইক্রোফোন পারমিশন ব্লক করা। অনুগ্রহ করে ব্রাউজারে অনুমতি দিন।');
        } else if (event.error === 'no-speech') {
          if (isRecordingActiveRef.current) {
            setStatusText('আপনি বিরতি নিয়েছেন। আরও বলতে পারেন অথবা "যুক্তি পাঠান" চাপুন।');
          }
        }
      };

      recognition.onend = () => {
        if (isRecordingActiveRef.current) {
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (isRecordingActiveRef.current) {
                try {
                  recognition.start();
                } catch {}
              }
            }, 200);
          }
        } else {
          setIsListening(false);
          setSpeechInterim('');
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      isRecordingActiveRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      stopSpeech();
    };
  }, [language]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript, speechInterim, isAiReplying]);

  // Start Voice Recording
  const startRecording = () => {
    if (!recognitionRef.current) {
      setStatusText('আপনার ব্রাউজারে স্পিচ রিকগনিশন নেই। নিচে টেক্সট বক্সে যুক্তি লিখুন।');
      return;
    }

    stopSpeech();
    accumulatedSpeechRef.current = '';
    setLiveTranscript('');
    setSpeechInterim('');
    isRecordingActiveRef.current = true;

    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
    } catch {
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (isRecordingActiveRef.current) {
            recognitionRef.current.start();
          }
        }, 150);
      } catch {}
    }
  };

  // Stop Recording and Send Argument
  const finishRecordingAndSend = () => {
    isRecordingActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);

    const fullText = (accumulatedSpeechRef.current + ' ' + speechInterim).trim();
    setLiveTranscript('');
    setSpeechInterim('');
    accumulatedSpeechRef.current = '';

    if (fullText) {
      handleUserSubmission(fullText);
    } else {
      setStatusText('কোনো কথা রেকর্ড করা হয়নি। মাইকে চাপুন অথবা লিখে পাঠান।');
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    isRecordingActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setLiveTranscript('');
    setSpeechInterim('');
    accumulatedSpeechRef.current = '';
    setStatusText('রেকর্ডিং বাতিল করা হয়েছে। আবার মাইকে চাপুন বা লিখুন।');
  };

  // Play Audio
  const playGeminiAudio = (base64Audio: string, index?: number) => {
    if (!ttsEnabled) return;
    stopSpeech();

    try {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.playbackRate = speechRate;
      audioPlayerRef.current = audio;
      setIsSpeakingTTS(true);
      if (typeof index === 'number') setCurrentPlayingIndex(index);
      setStatusText('🔊 Debate AI প্রাঞ্জল বাংলায় বক্তব্য উপস্থাপন করছে...');

      audio.onplay = () => {
        setIsSpeakingTTS(true);
      };

      audio.onended = () => {
        setIsSpeakingTTS(false);
        setCurrentPlayingIndex(null);
        setStatusText('এবার আপনার পালা। সময় নিয়ে আপনার যুক্তি বলুন।');
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        setIsSpeakingTTS(false);
        setCurrentPlayingIndex(null);
      };

      audio.play().catch((err) => {
        console.warn('Audio autoplay blocked:', err);
        setIsSpeakingTTS(false);
        setCurrentPlayingIndex(null);
      });
    } catch (err) {
      console.error('Audio creation error:', err);
      setIsSpeakingTTS(false);
    }
  };

  // Speak text with fallback
  const speakText = async (text: string, existingAudioData?: string | null, index?: number) => {
    if (!ttsEnabled) return;

    if (existingAudioData) {
      playGeminiAudio(existingAudioData, index);
      return;
    }

    stopSpeech();
    setStatusText('Debate AI-র বাংলা ভয়েস তৈরি হচ্ছে...');

    if (typeof index === 'number') {
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, isLoadingAudio: true } : m))
      );
    }

    try {
      const res = await fetch('/api/debate/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userApiKey.trim() ? { 'x-gemini-api-key': userApiKey.trim() } : {}),
        },
        body: JSON.stringify({
          text,
          voiceName: selectedVoice,
          style,
        }),
      });

      const data = await res.json();
      if (res.status === 429 || data.error === 'DAILY_QUOTA_EXHAUSTED') {
        setQuotaExceededNotice(true);
      }

      if (data.audioData) {
        if (typeof index === 'number') {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === index ? { ...m, audioData: data.audioData, isLoadingAudio: false } : m
            )
          );
        }
        playGeminiAudio(data.audioData, index);
      } else {
        speakWithNaturalVoice(text);
        if (typeof index === 'number') {
          setMessages((prev) =>
            prev.map((m, i) => (i === index ? { ...m, isLoadingAudio: false } : m))
          );
        }
      }
    } catch {
      speakWithNaturalVoice(text);
      if (typeof index === 'number') {
        setMessages((prev) =>
          prev.map((m, i) => (i === index ? { ...m, isLoadingAudio: false } : m))
        );
      }
    }
  };

  // Browser SpeechSynthesis fallback
  const speakWithNaturalVoice = (text: string) => {
    if (!window.speechSynthesis || !ttsEnabled) return;
    stopSpeech();

    speechIsCancelledRef.current = false;
    const cleanText = text
      .replace(/[*#_~`>]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    const rawSentences = cleanText.split(/(?<=[।?!;\n])\s+/);
    const sentences = rawSentences.map((s) => s.trim()).filter(Boolean);
    if (sentences.length === 0) return;

    const voices = window.speechSynthesis.getVoices();
    let bnVoice = voices.find(
      (v) =>
        v.lang === 'bn-BD' ||
        v.lang === 'bn-IN' ||
        v.lang.toLowerCase().startsWith('bn') ||
        v.name.toLowerCase().includes('bangla') ||
        v.name.toLowerCase().includes('bengali')
    );
    if (!bnVoice) {
      bnVoice = voices.find((v) => v.lang.startsWith('hi-') || v.lang.startsWith('en-IN'));
    }

    setIsSpeakingTTS(true);
    setStatusText('🔊 Debate AI বক্তব্য উপস্থাপন করছে...');

    let currentSentenceIndex = 0;

    const speakNextSentence = () => {
      if (speechIsCancelledRef.current) return;

      if (currentSentenceIndex >= sentences.length) {
        setIsSpeakingTTS(false);
        setCurrentPlayingIndex(null);
        setStatusText('এবার আপনার পালা। সময় নিয়ে আপনার যুক্তি বলুন।');
        return;
      }

      const sentence = sentences[currentSentenceIndex++];
      const utterance = new SpeechSynthesisUtterance(sentence);
      if (bnVoice) {
        utterance.voice = bnVoice;
        utterance.lang = bnVoice.lang;
      } else {
        utterance.lang = language;
      }

      utterance.rate = speechRate * 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        if (!speechIsCancelledRef.current) {
          speechQueueTimeoutRef.current = setTimeout(speakNextSentence, 80);
        }
      };

      utterance.onerror = () => {
        if (!speechIsCancelledRef.current) {
          speechQueueTimeoutRef.current = setTimeout(speakNextSentence, 50);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNextSentence();
  };

  const stopSpeech = () => {
    speechIsCancelledRef.current = true;
    if (speechQueueTimeoutRef.current) {
      clearTimeout(speechQueueTimeoutRef.current);
      speechQueueTimeoutRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingTTS(false);
    setCurrentPlayingIndex(null);
  };

  // Test voice sample
  const testVoiceSample = async (voiceId: string, sampleText: string) => {
    stopSpeech();
    setTestingVoiceId(voiceId);

    try {
      const res = await fetch('/api/debate/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userApiKey.trim() ? { 'x-gemini-api-key': userApiKey.trim() } : {}),
        },
        body: JSON.stringify({
          text: sampleText,
          voiceName: voiceId,
          style,
        }),
      });
      const data = await res.json();
      if (data.audioData) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioData}`);
        audioPlayerRef.current = audio;
        audio.onended = () => setTestingVoiceId(null);
        audio.onerror = () => setTestingVoiceId(null);
        audio.play();
      } else {
        setTestingVoiceId(null);
      }
    } catch {
      setTestingVoiceId(null);
    }
  };

  // Start Debate Session with AI Persona Introduction
  const startDebate = async (chosenTopic?: string) => {
    const finalTopic = (chosenTopic || customTopic.trim() || topic).trim();
    if (!finalTopic) return;

    setTopic(finalTopic);
    setScreen('debate');
    setMessages([]);
    setJudgeResult(null);
    setDebatePhase('intro');
    stopSpeech();

    trackEvent('debate_start', {
      topic: finalTopic,
      user_side: userSide,
      style,
      voice: selectedVoice,
      logged_in: !!currentUser,
    });

    const voiceObj = GEMINI_VOICES.find((v) => v.id === selectedVoice) || GEMINI_VOICES[0];
    const userStanceClean = userSide === 'for' ? 'পক্ষে' : 'বিপক্ষে';
    const aiStanceClean = userSide === 'for' ? 'বিপক্ষে' : 'পক্ষে';

    // Pure Bengali greeting without English annotations (For) / (Against)
    const introText = `আসসালামু আলাইকুম ও আদাব! আমি আপনার AI বিতর্ক প্রতিপক্ষ ${voiceObj.name}। আজকের বিতর্কের বিষয়: "${finalTopic}"। আপনি বলছেন ${userStanceClean} এবং আমি অবস্থান নিয়েছি ${aiStanceClean}। বিতর্কের সূচনা যুক্তি কি আপনি উপস্থাপন করবেন, নাকি আমি শুরু করব?`;

    const introMsg: Message = {
      sender: 'ai',
      text: introText,
      audioData: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([introMsg]);
    setStatusText('শুরুতে কে বক্তব্য রাখবেন? নিচের বোতামে চাপুন অথবা সরাসরি মুখে বলুন।');
    speakText(introText, null, 0);
  };

  // User starts debate first
  const handleUserStartsDebate = () => {
    setDebatePhase('debating');
    stopSpeech();
    const userChoiceMsg: Message = {
      sender: 'user',
      text: 'আমি প্রথমে শুরু করছি।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userChoiceMsg]);
    setStatusText('মঞ্চ আপনার! মাইকে চাপুন আর আপনার প্রথম সূচনা যুক্তিটি বলুন।');
    setTimeout(() => {
      startRecording();
    }, 300);
  };

  // AI starts debate first
  const handleAiStartsDebate = async () => {
    setDebatePhase('debating');
    stopSpeech();
    setIsAiReplying(true);
    setStatusText('Debate AI প্রথম সূচনা যুক্তি প্রস্তুত করছে...');

    const userChoiceMsg: Message = {
      sender: 'user',
      text: 'আপনি আগে শুরু করুন। আপনার সূচনা বক্তব্য শুনতে চাই।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userChoiceMsg]);

    try {
      const payload = {
        topic,
        style,
        userSide,
        voiceName: selectedVoice,
        isOpening: true,
        messages: [userChoiceMsg],
      };

      const res = await fetch('/api/debate/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userApiKey.trim() ? { 'x-gemini-api-key': userApiKey.trim() } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.quotaExceeded) {
        setQuotaExceededNotice(true);
      }

      if (data.reply) {
        const aiMsg: Message = {
          sender: 'ai',
          text: data.reply,
          audioData: data.audioData || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => {
          const updated = [...prev, aiMsg];
          const newIndex = updated.length - 1;
          if (data.audioData && ttsEnabled) {
            playGeminiAudio(data.audioData, newIndex);
          } else if (ttsEnabled) {
            speakText(data.reply, null, newIndex);
          }
          return updated;
        });

        setStatusText('Debate AI সূচনা বক্তব্য দিয়েছে। এবার মাইকে আপনার পাল্টা যুক্তি বলুন!');
      } else {
        throw new Error(data.error || 'Opening statement failed');
      }
    } catch {
      setStatusText('নেটওয়ার্কে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsAiReplying(false);
    }
  };

  // Submit User Argument
  const handleUserSubmission = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isAiReplying) return;

    if (debatePhase === 'intro') {
      const lower = trimmed.toLowerCase();
      if (
        lower.includes('আমি শুরু') ||
        lower.includes('আমি বলব') ||
        lower.includes('আমি বলি') ||
        lower.includes('আমার পালা') ||
        lower.includes('i will start') ||
        lower.includes('me')
      ) {
        handleUserStartsDebate();
        return;
      }
      if (
        lower.includes('আপনি শুরু') ||
        lower.includes('তুমি শুরু') ||
        lower.includes('এআই শুরু') ||
        lower.includes('ai start') ||
        lower.includes('you start')
      ) {
        handleAiStartsDebate();
        return;
      }
      setDebatePhase('debating');
    }

    const newMsg: Message = {
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setTextInput('');
    setIsAiReplying(true);
    setStatusText('Debate AI আপনার যুক্তির খণ্ডন প্রস্তুত করছে...');

    try {
      const payload = {
        topic,
        style,
        userSide,
        voiceName: selectedVoice,
        messages: updatedMessages.map((m) => ({ sender: m.sender, text: m.text })),
      };

      const res = await fetch('/api/debate/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userApiKey.trim() ? { 'x-gemini-api-key': userApiKey.trim() } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.quotaExceeded) {
        setQuotaExceededNotice(true);
      }

      if (data.reply) {
        const aiMsg: Message = {
          sender: 'ai',
          text: data.reply,
          audioData: data.audioData || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        const allMessages = [...updatedMessages, aiMsg];
        setMessages(allMessages);

        if (data.audioData && ttsEnabled) {
          playGeminiAudio(data.audioData, allMessages.length - 1);
        } else if (ttsEnabled) {
          speakText(data.reply, null, allMessages.length - 1);
        }
      } else {
        throw new Error(data.error || 'Failed to get reply');
      }
    } catch {
      const errorMsg: Message = {
        sender: 'ai',
        text: 'আপনার যুক্তিটি ভাবার মতো, তবে সার্ভার থেকে উত্তর দিতে সাময়িক বিলম্ব হচ্ছে। অনুগ্রহ করে আরেকবার চেষ্টা করুন।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...updatedMessages, errorMsg]);
      setStatusText('নেটওয়ার্কে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsAiReplying(false);
    }
  };

  // Fetch AI Judge Evaluation and Save to LocalStorage History
  const requestJudgement = async () => {
    if (messages.length < 2) {
      showToast('রায় পাওয়ার জন্য অন্তত একটি রাউন্ড তর্ক সম্পন্ন করুন!');
      return;
    }

    setIsJudging(true);
    setShowJudgeModal(true);

    try {
      const res = await fetch('/api/debate/judge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userApiKey.trim() ? { 'x-gemini-api-key': userApiKey.trim() } : {}),
        },
        body: JSON.stringify({
          topic,
          userSide,
          messages: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data: JudgeResult = await res.json();
      setJudgeResult(data);

      if (data.winner === 'User') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      // Save to localStorage history
      const newHistoryItem: DebateHistoryItem = {
        id: 'deb_' + Date.now(),
        timestamp: Date.now(),
        dateFormatted: new Date().toLocaleString('bn-BD', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        topic,
        style,
        userName,
        userSide,
        winner: data.winner,
        winnerTitle: data.winnerTitle,
        userScore: data.userScore,
        aiScore: data.aiScore,
        summary: data.summary,
        userStrengths: data.userStrengths || [],
        aiStrengths: data.aiStrengths || [],
        improvementTip: data.improvementTip || '',
        messages,
      };

      const updatedHistory = [newHistoryItem, ...historyItems].slice(0, 50);
      setHistoryItems(updatedHistory);
      localStorage.setItem('voice_debate_history', JSON.stringify(updatedHistory));

      // Sync to Firestore if authenticated
      if (currentUser) {
        try {
          await setDoc(doc(db, 'debates', newHistoryItem.id), {
            id: newHistoryItem.id,
            userId: currentUser.uid,
            topic: newHistoryItem.topic,
            userSide: newHistoryItem.userSide,
            style: newHistoryItem.style,
            winner: newHistoryItem.winner,
            winnerTitle: newHistoryItem.winnerTitle || '',
            userScore: newHistoryItem.userScore,
            aiScore: newHistoryItem.aiScore,
            summary: newHistoryItem.summary || '',
            createdAt: new Date().toISOString(),
          });

          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              debatesCount: updatedHistory.length,
              lastLoginAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('Firestore debate record notice:', dbErr);
        }
      }

      // Track with GA4
      trackEvent('debate_complete', {
        topic,
        winner: data.winner,
        user_score: data.userScore,
        ai_score: data.aiScore,
        style,
      });
    } catch (err) {
      console.error('Judge error:', err);
    } finally {
      setIsJudging(false);
    }
  };

  // Generate and Download Official Scorecard PNG Image using HTML5 Canvas
  const downloadScorecardImage = (
    debTopic: string,
    result: JudgeResult,
    targetUserName: string,
    targetUserSide: 'for' | 'against'
  ) => {
    setIsGeneratingCard(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1200 x 675 (16:9 social media optimal resolution)
      canvas.width = 1200;
      canvas.height = 675;

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
      bgGrad.addColorStop(0, '#0a0d1d');
      bgGrad.addColorStop(0.5, '#121630');
      bgGrad.addColorStop(1, '#1b132f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 675);

      // Glow Accents
      const glow1 = ctx.createRadialGradient(150, 120, 10, 150, 120, 350);
      glow1.addColorStop(0, 'rgba(124, 92, 255, 0.25)');
      glow1.addColorStop(1, 'rgba(124, 92, 255, 0)');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, 1200, 675);

      const glow2 = ctx.createRadialGradient(1050, 550, 10, 1050, 550, 400);
      glow2.addColorStop(0, 'rgba(255, 92, 138, 0.2)');
      glow2.addColorStop(1, 'rgba(255, 92, 138, 0)');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, 1200, 675);

      const drawRoundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
        fillColor?: string | CanvasGradient,
        strokeColor?: string,
        strokeWidth: number = 1
      ) => {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, r);
        } else {
          ctx.rect(x, y, w, h);
        }
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        if (strokeColor) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
        }
      };

      // Outer Glowing Frame
      drawRoundRect(30, 30, 1140, 615, 28, undefined, 'rgba(124, 92, 255, 0.5)', 3);

      // Brand Header
      ctx.font = 'bold 30px "Hind Siliguri", "Noto Sans Bengali", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🎙️ Voice Debate AI — বাংলা ভয়েস বিতর্ক', 70, 85);

      ctx.font = '500 18px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#a38bff';
      ctx.fillText('অফিসিয়াল বিতর্ক মূল্যায়ন সনদ ও স্কোরকার্ড', 70, 115);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#666a85';
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toLocaleDateString('bn-BD', { dateStyle: 'long' }), 1120, 85);
      ctx.textAlign = 'left';

      // Topic Box
      drawRoundRect(70, 145, 1060, 80, 18, 'rgba(23, 27, 48, 0.85)', 'rgba(42, 47, 77, 0.9)', 1.5);
      ctx.font = '600 17px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#9a9db5';
      ctx.fillText('বিতর্কের বিষয়:', 95, 175);

      ctx.font = 'bold 26px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#ffffff';
      const truncatedTopic = debTopic.length > 55 ? debTopic.slice(0, 52) + '...' : debTopic;
      ctx.fillText(`"${truncatedTopic}"`, 95, 208);

      // Winner Banner
      const winnerGrad = ctx.createLinearGradient(70, 245, 1130, 245);
      winnerGrad.addColorStop(0, 'rgba(124, 92, 255, 0.22)');
      winnerGrad.addColorStop(1, 'rgba(255, 92, 138, 0.22)');
      drawRoundRect(70, 240, 1060, 65, 16, winnerGrad, '#7c5cff', 2);

      ctx.font = 'bold 24px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#fbbf24';
      const winnerString =
        result.winner === 'User'
          ? `🏆 বিজয়ী: ${targetUserName}!`
          : result.winner === 'AI'
          ? '🤖 বিজয়ী: Debate AI!'
          : '🤝 লড়াই সমানে সমান (Tie)!';
      ctx.fillText(winnerString, 95, 280);

      ctx.font = '600 16px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'right';
      ctx.fillText(result.winnerTitle || 'প্রধান বিচারকের রায়', 1100, 280);
      ctx.textAlign = 'left';

      // Scores: User vs Debate AI
      drawRoundRect(70, 325, 515, 160, 20, 'rgba(17, 20, 42, 0.9)', 'rgba(67, 209, 122, 0.4)', 2);
      ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#43d17a';
      ctx.fillText(`👤 ${targetUserName}`, 95, 365);

      ctx.font = '500 15px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#9a9db5';
      ctx.fillText(`অবস্থান: ${targetUserSide === 'for' ? 'পক্ষে' : 'বিপক্ষে'}`, 95, 395);

      ctx.font = 'extrabold 52px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#43d17a';
      ctx.fillText(`${result.userScore}`, 95, 455);
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#9a9db5';
      ctx.fillText('/ ১০০', 165, 455);

      drawRoundRect(615, 325, 515, 160, 20, 'rgba(17, 20, 42, 0.9)', 'rgba(124, 92, 255, 0.4)', 2);
      ctx.font = 'bold 22px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#a38bff';
      ctx.fillText('🤖 Debate AI', 640, 365);

      ctx.font = '500 15px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#9a9db5';
      ctx.fillText(`অবস্থান: ${targetUserSide === 'for' ? 'বিপক্ষে' : 'পক্ষে'}`, 640, 395);

      ctx.font = 'extrabold 52px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#a38bff';
      ctx.fillText(`${result.aiScore}`, 640, 455);
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#9a9db5';
      ctx.fillText('/ ১০০', 710, 455);

      // Judge Observation
      drawRoundRect(70, 505, 1060, 90, 16, 'rgba(23, 27, 48, 0.9)', 'rgba(42, 47, 77, 0.8)', 1);
      ctx.font = 'bold 15px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('⚖️ প্রধান বিচারকের পর্যবেক্ষণ:', 95, 535);

      ctx.font = '400 15px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#cbd5e1';
      const cleanSummary = result.summary || 'উভয় বক্তা চমৎকার যুক্তিতর্ক উপস্থাপন করেছেন।';
      const summaryText = cleanSummary.length > 130 ? cleanSummary.slice(0, 127) + '...' : cleanSummary;
      ctx.fillText(summaryText, 95, 565);

      // Footer
      ctx.font = '13px "Hind Siliguri", sans-serif';
      ctx.fillStyle = '#666a85';
      ctx.textAlign = 'center';
      ctx.fillText('Voice Debate AI • AI চালিত বাংলা লাইভ ভয়েস বিতর্ক প্ল্যাটফর্ম', 600, 625);
      ctx.textAlign = 'left';

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-debate-result-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }, 'image/png');
      trackEvent('scorecard_download', { topic: debTopic });
    } catch (e) {
      console.error('Image generation error:', e);
    } finally {
      setIsGeneratingCard(false);
    }
  };

  // Social Media Share
  const shareDebateResult = async (resObj: JudgeResult, debTopic: string) => {
    trackEvent('scorecard_share', { topic: debTopic, winner: resObj.winner });
    const winnerText =
      resObj.winner === 'User'
        ? `আমি (${userName}) Debate AI-র সাথে বিতর্ক করে বিজয়ী হয়েছি!`
        : resObj.winner === 'AI'
        ? `আমি Debate AI-র সাথে প্রাণবন্ত বিতর্ক প্রতিযোগিতা করেছি!`
        : `আমি Debate AI-র সাথে তুমুল বিতর্ক করেছি এবং লড়াই সমানে সমান হয়েছে!`;

    const shareText = `🎙️ Voice Debate AI — বাংলা ভয়েস বিতর্ক\n\n📌 বিষয়: "${debTopic}"\n${winnerText}\n📊 স্কোর: ${userName} ${resObj.userScore} বনাম Debate AI ${resObj.aiScore}\n\nআপনিও AI-র সাথে সরাসরি ভয়েসে বাংলায় বিতর্ক করুন!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Voice Debate AI রেজাল্ট',
          text: shareText,
          url: window.location.href,
        });
        setShareFeedback('শেয়ার সফল হয়েছে!');
        setTimeout(() => setShareFeedback(null), 2500);
        return;
      } catch {}
    }

    navigator.clipboard.writeText(shareText);
    setShareFeedback('রেজাল্ট টেক্সট ক্লিপবোর্ডে কপি করা হয়েছে! সোশ্যাল মিডিয়ায় পেস্ট করুন।');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Delete single history item
  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyItems.filter((item) => item.id !== id);
    setHistoryItems(updated);
    localStorage.setItem('voice_debate_history', JSON.stringify(updated));
  };

  // Clear all history
  const clearAllHistory = () => {
    if (confirm('আপনি কি পূর্ববর্তী সমস্ত বিতর্কের ইতিহাস মুছে ফেলতে চান?')) {
      setHistoryItems([]);
      localStorage.removeItem('voice_debate_history');
    }
  };

  // Suggest random topics
  const fetchRandomTopics = async () => {
    setIsSuggestingTopics(true);
    try {
      const res = await fetch('/api/debate/random-topics');
      const data = await res.json();
      if (data.topics && Array.isArray(data.topics)) {
        setDynamicTopics(data.topics);
        setTopic(data.topics[0]);
      }
    } catch {
    } finally {
      setIsSuggestingTopics(false);
    }
  };

  const copyMessageText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const testAndSaveApiKey = async (keyToSave: string) => {
    const trimmed = keyToSave.trim();
    if (!trimmed) {
      setUserApiKey('');
      localStorage.removeItem('voice_debate_gemini_key');
      setApiKeyTestMessage('API Key মুছে ফেলা হয়েছে।');
      setQuotaExceededNotice(false);
      return;
    }

    setIsTestingApiKey(true);
    setApiKeyTestMessage('যাচাই করা হচ্ছে...');

    try {
      const res = await fetch('/api/debate/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': trimmed,
        },
        body: JSON.stringify({
          text: 'অভিনন্দন! আপনার নিজস্ব Gemini API Key সফলভাবে সক্রিয় হয়েছে।',
          voiceName: selectedVoice,
          style: 'funny',
        }),
      });

      const data = await res.json();
      if (data.audioData) {
        setUserApiKey(trimmed);
        localStorage.setItem('voice_debate_gemini_key', trimmed);
        setQuotaExceededNotice(false);
        setApiKeyTestMessage('✅ API Key সফলভাবে যাচাই ও সংরক্ষিত হয়েছে! (HD অডিও সক্রিয়)');
        playGeminiAudio(data.audioData);
        setTimeout(() => {
          setShowApiKeyModal(false);
          setApiKeyTestMessage(null);
        }, 1800);
      } else {
        setApiKeyTestMessage('❌ কী যাচাই ব্যর্থ: ' + (data.message || data.error || 'ভুল কী'));
      }
    } catch (e: any) {
      setApiKeyTestMessage('❌ সংযোগ সমস্যা: ' + e.message);
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const currentStyleObj = STYLES.find((s) => s.id === style) || STYLES[0];
  const currentVoiceObj = GEMINI_VOICES.find((v) => v.id === selectedVoice) || GEMINI_VOICES[0];
  const combinedUserTranscript = (liveTranscript + ' ' + speechInterim).trim();

  return (
    <div className="min-h-screen text-[#f1f2f8] flex flex-col items-center justify-start antialiased selection:bg-[#7c5cff] selection:text-white bg-[#0a0d1d] w-full font-['Hind_Siliguri',sans-serif]">
      {/* GLOBAL PERSISTENT HEADER (No cluttered ZIP/FileCode icons) */}
      <header className="w-full border-b border-[#2a2f4d]/80 bg-[#0d1021]/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* Brand Logo & Title */}
          <div
            onClick={() => setScreen('setup')}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
            title="সেটআপ স্ক্রিনে ফিরুন"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7c5cff] to-[#ff5c8a] flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
              🎙️
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight block">
                Voice Debate AI
              </span>
              <span className="text-[10px] text-[#a38bff] hidden sm:block">বাংলা ভয়েস বিতর্ক</span>
            </div>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Debate History Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#171b30] hover:bg-[#202542] border border-[#2a2f4d] text-[#c8cbdf] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="পূর্ববর্তী বিতর্কের ইতিহাস দেখুন"
            >
              <History className="w-3.5 h-3.5 text-[#a38bff]" />
              <span>ইতিহাস</span>
              {historyItems.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#7c5cff] text-white text-[10px] flex items-center justify-center font-bold">
                  {historyItems.length}
                </span>
              )}
            </button>

            {/* Google Sign-in / User Profile Badge */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#171b30] border border-emerald-500/40 text-xs">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    G
                  </div>
                )}
                <span className="text-[11px] font-semibold text-emerald-300 max-w-[80px] sm:max-w-[120px] truncate hidden sm:inline">
                  {currentUser.displayName || currentUser.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1 hover:text-rose-400 text-[#9a9db5] transition-colors cursor-pointer"
                  title="লগআউট"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white text-gray-900 hover:bg-gray-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Google দিয়ে লগইন করুন"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="hidden sm:inline">সাইন ইন</span>
              </button>
            )}

            {/* API Key Modal Button */}
            <button
              type="button"
              onClick={() => {
                setApiKeyInput(userApiKey);
                setApiKeyTestMessage(null);
                setShowApiKeyModal(true);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                userApiKey
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-[#171b30] border-[#2a2f4d] text-[#c8cbdf] hover:text-white hover:border-[#7c5cff]'
              }`}
              title="Gemini API Key দিয়ে আনলিমিটেড HD ভয়েস চালান"
            >
              <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">{userApiKey ? 'HD সক্রিয়' : 'API Key'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* SCREEN 1: TOPIC & PERSONA SETUP */}
      {screen === 'setup' && (
        <div className="w-full max-w-xl my-auto px-4 py-6">
          <div className="bg-[#171b30] border border-[#2a2f4d] rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm">
            {/* Header Badge: Debate AI */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#7c5cff]/15 border border-[#7c5cff]/30 text-xs font-semibold text-[#a38bff] mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Debate AI</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-[#7c5cff] via-[#d06bff] to-[#ff5c8a] bg-clip-text text-transparent pb-1">
                🎙️ Voice Debate AI
              </h1>
              <p className="text-sm sm:text-base text-[#9a9db5] mt-1">
                উচ্চমানের স্পষ্ট বাংলা কণ্ঠস্বরে AI-র সাথে লাইভ বিতর্ক প্রতিযোগিতা
              </p>
            </div>

            {/* User Profile / Photo Setup Card */}
            <div className="mb-6 p-4 rounded-2xl bg-[#11142a] border border-[#2a2f4d]">
              <label className="text-sm font-semibold text-[#c8cbdf] flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#a38bff]" />
                  <span>আপনার ছবি ও প্রোফাইল (Avatar & Name)</span>
                </span>
                <span className="text-[11px] text-[#43d17a] font-medium">বিতর্কে দৃশ্যমান</span>
              </label>

              {/* Continue with Google Banner */}
              {!currentUser ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-3.5 mb-3.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer border border-gray-200 group"
                >
                  <svg className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google (গুগল দিয়ে লগইন)</span>
                </button>
              ) : (
                <div className="flex items-center justify-between p-2.5 mb-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <span className="text-emerald-300 font-semibold block">{currentUser.displayName || 'Google User'}</span>
                      <span className="text-[10px] text-[#9a9db5]">{currentUser.email}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs text-rose-300 hover:text-white px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 transition-colors cursor-pointer"
                  >
                    লগআউট
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#7c5cff] bg-[#171b30] flex items-center justify-center shadow-[0_0_20px_rgba(124,92,255,0.3)] transition-transform group-hover:scale-105">
                    {userAvatar ? (
                      <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl select-none">{selectedEmojiAvatar}</span>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2.5">
                  <div>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        setUserName(e.target.value);
                        localStorage.setItem('voice_debate_username', e.target.value);
                      }}
                      placeholder="আপনার নাম বা পরিচয় লিখুন..."
                      className="w-full px-3.5 py-2 rounded-xl bg-[#171b30] border border-[#2a2f4d] text-sm text-white placeholder-[#666a85] focus:outline-none focus:border-[#7c5cff]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#7c5cff]/20 hover:bg-[#7c5cff]/30 border border-[#7c5cff]/40 text-[#a38bff] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{userAvatar ? 'ছবি পরিবর্তন' : 'গ্যালারি থেকে ছবি দিন'}</span>
                    </button>

                    {userAvatar && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#9a9db5]">অথবা অবতার বাছুন:</span>
                    <div className="flex items-center gap-1">
                      {PRESET_AVATARS.map((av) => (
                        <button
                          key={av.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmojiAvatar(av.emoji);
                            localStorage.setItem('voice_debate_emoji_avatar', av.emoji);
                            if (userAvatar) removePhoto();
                          }}
                          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                            selectedEmojiAvatar === av.emoji && !userAvatar
                              ? 'bg-[#7c5cff] shadow-sm'
                              : 'bg-[#171b30] hover:bg-[#202542]'
                          }`}
                          title={av.label}
                        >
                          {av.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Persona Selection */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-[#c8cbdf] flex items-center justify-between mb-2.5">
                <span>AI প্রতিপক্ষের কণ্ঠস্বর বাছুন (Voice Persona)</span>
                <span className="text-xs text-[#a38bff]">Gemini Studio Voices</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
                {GEMINI_VOICES.map((v) => {
                  const isSelected = selectedVoice === v.id;
                  const isTesting = testingVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#7c5cff]/20 border-[#7c5cff] text-white shadow-[0_0_15px_rgba(124,92,255,0.25)]'
                          : 'bg-[#11142a] border-[#2a2f4d] text-[#c1c4dc] hover:border-[#7c5cff]/50 hover:bg-[#1a1f3c]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className="text-xs sm:text-sm font-bold block text-white">{v.name}</span>
                          <span className="text-[10px] text-[#a38bff] font-medium">{v.gender}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            testVoiceSample(v.id, v.sampleText);
                          }}
                          className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                            isTesting
                              ? 'bg-emerald-500 border-emerald-500 text-white animate-pulse'
                              : 'bg-[#171b30] border-[#2a2f4d] text-[#c8cbdf] hover:border-emerald-500 hover:text-white'
                          }`}
                          title="কণ্ঠ শুনুন"
                        >
                          <Play className="w-2.5 h-2.5" />
                          <span>{isTesting ? 'বাজছে...' : 'নমুনা শুনুন'}</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-[#9a9db5] leading-tight line-clamp-2">{v.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Topic Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-sm font-semibold text-[#c8cbdf] flex items-center gap-1.5">
                  <span>তর্কের বিষয় বাছুন</span>
                </label>
                <button
                  type="button"
                  onClick={fetchRandomTopics}
                  disabled={isSuggestingTopics}
                  className="text-xs text-[#a38bff] hover:text-[#d06bff] flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isSuggestingTopics ? 'animate-spin' : ''}`} />
                  <span>নতুন টপিক আনুন</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {dynamicTopics.map((item) => {
                  const isSelected = topic === item && !customTopic.trim();
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setTopic(item);
                        setCustomTopic('');
                      }}
                      className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#7c5cff]/20 border-[#7c5cff] text-white font-medium shadow-[0_0_15px_rgba(124,92,255,0.25)]'
                          : 'bg-[#11142a] border-[#2a2f4d] text-[#c1c4dc] hover:border-[#7c5cff]/50 hover:bg-[#1a1f3c]'
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="অথবা নিজের কোনো পছন্দের বিষয় লিখুন..."
                  className="w-full px-4 py-3 rounded-xl bg-[#11142a] border border-[#2a2f4d] text-white placeholder-[#666a85] focus:outline-none focus:border-[#7c5cff] text-sm sm:text-base transition-all"
                />
                {customTopic && (
                  <button
                    type="button"
                    onClick={() => setCustomTopic('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#666a85] hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    মুছুন
                  </button>
                )}
              </div>
            </div>

            {/* Side Selection: For vs Against */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-[#c8cbdf] block mb-2.5">
                আপনার অবস্থান (Side)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserSide('for')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    userSide === 'for'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-[#11142a] border-[#2a2f4d] text-[#9a9db5] hover:border-emerald-500/50'
                  }`}
                >
                  <span className="text-base font-bold text-emerald-400">👍 আমি পক্ষে (For)</span>
                  <span className="text-xs text-[#9a9db5]">Debate AI বলবে বিপক্ষে</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserSide('against')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    userSide === 'against'
                      ? 'bg-rose-500/15 border-rose-500 text-white font-semibold shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      : 'bg-[#11142a] border-[#2a2f4d] text-[#9a9db5] hover:border-rose-500/50'
                  }`}
                >
                  <span className="text-base font-bold text-rose-400">👎 আমি বিপক্ষে (Against)</span>
                  <span className="text-xs text-[#9a9db5]">Debate AI বলবে পক্ষে</span>
                </button>
              </div>
            </div>

            {/* Debate Style / Persona: Featuring Funny / রম্য বিতর্ক */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-[#c8cbdf] block mb-2.5">
                AI প্রতিপক্ষের স্টাইল (Debate Persona)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STYLES.map((st) => {
                  const Icon = st.icon;
                  const active = style === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStyle(st.id)}
                      className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                        active
                          ? 'bg-[#7c5cff]/20 border-[#7c5cff] text-white shadow-[0_0_15px_rgba(124,92,255,0.25)]'
                          : 'bg-[#11142a] border-[#2a2f4d] text-[#9a9db5] hover:border-[#7c5cff]/50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${active ? 'text-[#ff5c8a]' : 'text-[#7c5cff]'}`} />
                      <span className="text-xs font-bold text-white">{st.label}</span>
                      <span className="text-[11px] text-[#9a9db5] line-clamp-1 mt-0.5">{st.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={() => startDebate()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white font-bold text-base sm:text-lg shadow-[0_8px_25px_rgba(124,92,255,0.4)] hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>তর্ক শুরু করো</span>
              <span className="text-xl">→</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 2: LIVE DEBATE ARENA */}
      {screen === 'debate' && (
        <div className="w-full h-screen flex flex-col max-w-3xl bg-[#0f1221] shadow-2xl relative">
          {/* Header Bar */}
          <header className="px-4 py-3 bg-[#11142a]/90 backdrop-blur-md border-b border-[#2a2f4d] flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  stopSpeech();
                  if (isListening) cancelRecording();
                  setScreen('setup');
                }}
                className="p-2 rounded-xl bg-[#171b30] hover:bg-[#202542] border border-[#2a2f4d] text-white transition-colors cursor-pointer"
                title="ফিরে যান"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#7c5cff] bg-[#171b30] flex items-center justify-center shrink-0">
                {userAvatar ? (
                  <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base select-none">{selectedEmojiAvatar}</span>
                )}
              </div>

              <div>
                <h2 className="text-sm sm:text-base font-bold text-white line-clamp-1 max-w-[150px] sm:max-w-xs">
                  {topic}
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${currentStyleObj.badgeColor}`}>
                    {currentStyleObj.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                    🎙️ {currentVoiceObj.name}
                  </span>
                  <span className="text-[11px] text-[#9a9db5] hidden sm:inline">
                    {userName}: <strong className={userSide === 'for' ? 'text-emerald-400' : 'text-rose-400'}>
                      {userSide === 'for' ? 'পক্ষে' : 'বিপক্ষে'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 relative">
              {/* History Button in Arena */}
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="p-2 rounded-xl bg-[#171b30] hover:bg-[#202542] border border-[#2a2f4d] text-[#c8cbdf] hover:text-white transition-colors cursor-pointer"
                title="বিতর্কের ইতিহাস"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Voice Settings Dropdown */}
              <button
                type="button"
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  showVoiceSettings
                    ? 'bg-[#7c5cff] border-[#7c5cff] text-white'
                    : 'bg-[#171b30] border-[#2a2f4d] text-[#9a9db5] hover:text-white'
                }`}
                title="ভয়েস সেটিংস"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* TTS Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (ttsEnabled && isSpeakingTTS) stopSpeech();
                  setTtsEnabled(!ttsEnabled);
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  ttsEnabled
                    ? 'bg-[#7c5cff]/20 border-[#7c5cff] text-[#a38bff]'
                    : 'bg-[#171b30] border-[#2a2f4d] text-[#666a85]'
                }`}
                title={ttsEnabled ? 'AI ভয়েস চালু' : 'AI ভয়েস বন্ধ'}
              >
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Judge / Evaluate Debate */}
              <button
                type="button"
                onClick={requestJudgement}
                disabled={messages.length < 2 || isJudging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
                title="বিতর্কের ফলাফল ও রায় জানুন"
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">রায় ঘোষণা</span>
              </button>

              {/* Reset Session */}
              <button
                type="button"
                onClick={() => startDebate(topic)}
                className="p-2 rounded-xl bg-[#171b30] hover:bg-[#202542] border border-[#2a2f4d] text-[#9a9db5] hover:text-white transition-colors cursor-pointer"
                title="নতুন করে শুরু করুন"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Voice Settings Popover */}
              {showVoiceSettings && (
                <div className="absolute right-0 top-12 w-64 bg-[#171b30] border border-[#2a2f4d] rounded-2xl p-4 shadow-2xl z-30 animate-fadeIn">
                  <h4 className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                    <span>ভয়েস পরিবর্তন করুন</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Debate AI HD</span>
                  </h4>
                  <div className="space-y-1.5 mb-3">
                    {GEMINI_VOICES.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVoice(v.id);
                          setShowVoiceSettings(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          selectedVoice === v.id
                            ? 'bg-[#7c5cff]/30 text-white font-semibold border border-[#7c5cff]/50'
                            : 'text-[#c8cbdf] hover:bg-[#11142a]'
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className="text-[10px] text-[#9a9db5]">{v.gender}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-[#2a2f4d]">
                    <div className="flex items-center justify-between text-xs text-[#9a9db5] mb-1">
                      <span>কথা বলার গতি:</span>
                      <span className="text-white font-bold">{speechRate}x</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[0.9, 1.0, 1.15].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => setSpeechRate(rate)}
                          className={`flex-1 py-1 rounded-md text-xs border transition-all cursor-pointer ${
                            speechRate === rate
                              ? 'bg-[#7c5cff] border-[#7c5cff] text-white font-bold'
                              : 'border-[#2a2f4d] text-[#9a9db5] hover:text-white'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Quota limit notice */}
          {quotaExceededNotice && !userApiKey && (
            <div className="mx-4 mt-2.5 mb-1 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>ফ্রি HD ভয়েস দৈনিক কোটা পূর্ণ হয়েছে।</strong> আনলিমিটেড স্পষ্ট HD ভয়েস চালাতে নিজের API Key যোগ করুন।
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput('');
                  setApiKeyTestMessage(null);
                  setShowApiKeyModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 cursor-pointer shrink-0"
              >
                Key যোগ করুন
              </button>
            </div>
          )}

          {/* Transcript Scroll Area */}
          <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && !isAiReplying && (
              <div className="text-center py-16 text-[#666a85]">
                <p>বিতর্ক শুরু হচ্ছে...</p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const isPlayingThis = isSpeakingTTS && currentPlayingIndex === index;

              return (
                <div
                  key={index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full animate-fadeIn`}
                >
                  {/* Speaker Label: Debate AI instead of Gemini AI */}
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {isUser ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-[#ff5c8a] bg-[#171b30] flex items-center justify-center shrink-0">
                        {userAvatar ? (
                          <img src={userAvatar} alt="You" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] select-none">{selectedEmojiAvatar}</span>
                        )}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#7c5cff] to-cyan-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                        🤖
                      </div>
                    )}
                    <span className="text-[11px] font-medium text-[#c8cbdf]">
                      {isUser
                        ? `${userName} (${userSide === 'for' ? 'পক্ষে' : 'বিপক্ষে'})`
                        : `Debate AI (${userSide === 'for' ? 'বিপক্ষে' : 'পক্ষে'})`}
                    </span>
                    <span className="text-[10px] text-[#666a85]">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`relative group rounded-2xl px-4 py-3 text-sm sm:text-base leading-relaxed max-w-[85%] sm:max-w-[78%] shadow-md ${
                      isUser
                        ? 'bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white rounded-tr-sm'
                        : `bg-[#171b30] border ${
                            isPlayingThis ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-[#2a2f4d]'
                          } text-[#f1f2f8] rounded-tl-sm`
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    <div
                      className={`flex items-center gap-2 mt-2 pt-1.5 border-t ${
                        isUser ? 'border-white/15' : 'border-[#2a2f4d]'
                      }`}
                    >
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPlayingThis) {
                              stopSpeech();
                            } else {
                              speakText(msg.text, msg.audioData, index);
                            }
                          }}
                          disabled={msg.isLoadingAudio}
                          className={`text-xs flex items-center gap-1.5 transition-all px-2.5 py-1 rounded-lg cursor-pointer font-medium ${
                            isPlayingThis
                              ? 'bg-emerald-500 text-white animate-pulse'
                              : msg.isLoadingAudio
                              ? 'bg-[#11142a] text-[#a38bff] border border-[#7c5cff]/40 animate-pulse'
                              : 'bg-[#11142a] text-[#43d17a] hover:bg-emerald-500/20 border border-emerald-500/30'
                          }`}
                          title={isPlayingThis ? 'ভয়েস থামান' : 'স্পষ্ট HD ভয়েসে শুনুন'}
                        >
                          {isPlayingThis ? (
                            <>
                              <Square className="w-2.5 h-2.5 fill-white" />
                              <span className="text-[10px]">থামান</span>
                            </>
                          ) : msg.isLoadingAudio ? (
                            <>
                              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              <span className="text-[10px]">ভয়েস প্রস্তুত হচ্ছে...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-2.5 h-2.5 fill-current" />
                              <span className="text-[10px]">HD ভয়েস শুনুন</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => copyMessageText(msg.text, index)}
                        className={`text-xs flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded cursor-pointer ${
                          isUser ? 'text-white/80 hover:text-white' : 'text-[#9a9db5] hover:text-white'
                        }`}
                        title="কপি করুন"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span className="text-[10px]">কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">কপি</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* INTRO SELECTION CARD: WHO WILL START? */}
            {debatePhase === 'intro' && !isAiReplying && (
              <div className="bg-gradient-to-b from-[#1c2242] to-[#151930] border-2 border-[#7c5cff]/60 rounded-3xl p-5 sm:p-6 shadow-[0_0_35px_rgba(124,92,255,0.3)] text-center animate-fadeIn my-3 max-w-lg mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7c5cff]/20 border border-[#7c5cff]/40 text-xs font-bold text-[#a38bff] mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>বিতর্কের সূচনা পর্ব</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                  বিতর্কটি কে শুরু করবেন?
                </h3>
                <p className="text-xs text-[#c8cbdf] mb-4">
                  আপনি কি প্রথম যুক্তি দিয়ে শুরু করতে চান, নাকি Debate AI-কে প্রথম সূচনা বক্তব্য দেওয়ার সুযোগ দেবেন?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleUserStartsDebate}
                    className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs sm:text-sm hover:opacity-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
                  >
                    <Mic className="w-4 h-4" />
                    <span>🎙️ আমি শুরু করব (You First)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAiStartsDebate}
                    className="px-4 py-3 rounded-2xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white font-bold text-xs sm:text-sm hover:opacity-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>🤖 Debate AI শুরু করুক (AI First)</span>
                  </button>
                </div>
              </div>
            )}

            {/* LIVE CONTINUOUS SPEECH PANEL */}
            {isListening && (
              <div className="bg-[#171b30] border-2 border-[#ff5c8a] rounded-2xl p-4 shadow-[0_0_25px_rgba(255,92,138,0.25)] animate-fadeIn">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-rose-400">
                      🎙️ শুনছি... সময় নিয়ে সম্পূর্ণ কথা বলুন (থামলে কাটবে না)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="text-xs text-[#9a9db5] hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                    title="বাতিল করুন"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>বাতিল</span>
                  </button>
                </div>

                <div className="min-h-[48px] bg-[#11142a] p-3 rounded-xl border border-[#2a2f4d] text-sm leading-relaxed text-white">
                  {combinedUserTranscript ? (
                    <p>
                      <span>{liveTranscript}</span>{' '}
                      <span className="text-[#ff5c8a] italic font-medium">{speechInterim}</span>
                    </p>
                  ) : (
                    <p className="text-[#666a85] italic text-xs">
                      কথা বলুন... আপনার বক্তব্য এখানে লেখা হবে। থামলে বা চিন্তা করলেও ইনপুট কাটবে না।
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-[#2a2f4d]">
                  <span className="text-[11px] text-[#9a9db5]">
                    বক্তব্য শেষ হলে পাশের বাটনে চাপুন →
                  </span>
                  <button
                    type="button"
                    onClick={finishRecordingAndSend}
                    disabled={!combinedUserTranscript}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg hover:opacity-95 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>কথা শেষ, যুক্তি পাঠান</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Thinking Animation */}
            {isAiReplying && (
              <div className="flex flex-col items-start max-w-full">
                <span className="text-[10px] text-[#a38bff] mb-1 font-medium">Debate AI ভাবছে...</span>
                <div className="bg-[#171b30] border border-[#2a2f4d] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#7c5cff] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#d06bff] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#ff5c8a] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-[#9a9db5] ml-1">যুক্তি খণ্ডন ও HD বাংলা ভয়েস তৈরি হচ্ছে...</span>
                </div>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </main>

          {/* Action Area Deck */}
          <footer className="bg-[#11142a] border-t border-[#2a2f4d] p-4 flex flex-col items-center gap-3">
            {debatePhase === 'intro' ? (
              <div className="w-full flex flex-col items-center gap-3 py-1">
                <div className="text-xs text-center text-[#c8cbdf] flex items-center justify-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>বিতর্কের সূচনা কে করবেন? নিচের যেকোনো একটি বাটন বেছে নিন:</span>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={handleUserStartsDebate}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs sm:text-sm hover:opacity-95 shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Mic className="w-4 h-4" />
                    <span>🎙️ আমি শুরু করব</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAiStartsDebate}
                    className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white font-bold text-xs sm:text-sm hover:opacity-95 shadow-[0_0_25px_rgba(124,92,255,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>🤖 Debate AI শুরু করুক</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs text-center text-[#9a9db5] flex items-center justify-center gap-1.5 min-h-[20px]">
                  {isSpeakingTTS && (
                    <div className="flex items-center gap-0.5 h-3">
                      <span className="w-1 bg-[#43d17a] animate-wave-1 rounded-full inline-block" />
                      <span className="w-1 bg-[#43d17a] animate-wave-2 rounded-full inline-block" />
                      <span className="w-1 bg-[#43d17a] animate-wave-3 rounded-full inline-block" />
                      <span className="w-1 bg-[#43d17a] animate-wave-4 rounded-full inline-block" />
                      <span className="w-1 bg-[#43d17a] animate-wave-5 rounded-full inline-block" />
                    </div>
                  )}
                  <span className={isListening ? 'text-[#ff5c8a] font-semibold animate-pulse' : ''}>
                    {statusText}
                  </span>
                </div>

                <div className="relative flex items-center justify-center my-1 gap-4">
                  <div
                    className={`absolute w-20 h-20 rounded-full border-2 border-[#ff5c8a] ${
                      isListening ? 'pulse-ring-active' : 'opacity-0'
                    }`}
                  />
                  <div
                    className={`absolute w-24 h-24 rounded-full border border-[#7c5cff] ${
                      isListening ? 'pulse-ring-active' : 'opacity-0'
                    }`}
                    style={{ animationDelay: '0.4s' }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        finishRecordingAndSend();
                      } else {
                        startRecording();
                      }
                    }}
                    className={`w-18 h-18 rounded-full flex items-center justify-center z-10 transition-all duration-200 shadow-xl cursor-pointer ${
                      isListening
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.6)]'
                        : isSpeakingTTS
                        ? 'bg-gradient-to-r from-[#43d17a] to-[#2ea8ff] shadow-[0_0_25px_rgba(67,209,122,0.5)]'
                        : 'bg-gradient-to-br from-[#7c5cff] to-[#ff5c8a] hover:scale-105 active:scale-95 shadow-[0_8px_25px_rgba(124,92,255,0.45)]'
                    }`}
                    title={isListening ? 'কথা শেষ, পাঠাতে চাপুন' : 'মাইকে কথা বলা শুরু করুন'}
                  >
                    {isListening ? (
                      <CheckCircle2 className="w-8 h-8 text-white animate-pulse" />
                    ) : isSpeakingTTS ? (
                      <Volume2 className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </button>

                  {isSpeakingTTS && (
                    <button
                      type="button"
                      onClick={stopSpeech}
                      className="p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30 transition-all cursor-pointer"
                      title="ভয়েস বন্ধ করুন"
                    >
                      <Square className="w-4 h-4 fill-rose-400" />
                    </button>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUserSubmission(textInput);
                  }}
                  className="w-full flex items-center gap-2 mt-1"
                >
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="অথবা এখানে টাইপ করে আপনার যুক্তি পাঠান..."
                    disabled={isAiReplying || isListening}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[#171b30] border border-[#2a2f4d] text-sm text-white placeholder-[#666a85] focus:outline-none focus:border-[#7c5cff] transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isAiReplying || isListening}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white disabled:opacity-40 hover:opacity-95 transition-all cursor-pointer"
                    title="পাঠান"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </footer>
        </div>
      )}

      {/* MODAL: ADJUDICATOR'S VERDICT (রেজাল্ট কার্ড ডাউনলোড ও সোশ্যাল শেয়ার সহ) */}
      {showJudgeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171b30] border border-[#2a2f4d] rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl relative animate-fadeIn">
            <button
              type="button"
              onClick={() => setShowJudgeModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#11142a] text-[#9a9db5] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.4)]">
                <Award className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-extrabold text-white">প্রধান বিচারকের রায়</h3>
              <p className="text-xs sm:text-sm text-[#9a9db5] mt-1">বিষয়: {topic}</p>
            </div>

            {isJudging ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-[#7c5cff] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#c8cbdf] font-medium">উভয় পক্ষের যুক্তিতর্ক নিরপেক্ষভাবে বিশ্লেষণ করা হচ্ছে...</p>
                <p className="text-xs text-[#666a85]">লজিক, প্রামাণিকতা ও উপস্থাপনা শৈলী বিবেচনাধীন</p>
              </div>
            ) : judgeResult ? (
              <div className="space-y-4">
                {/* Winner Callout */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#7c5cff]/20 to-[#ff5c8a]/20 border border-[#7c5cff]/40 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    {judgeResult.winnerTitle || 'বিজয়ী ঘোষণা'}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-white mt-1">
                    {judgeResult.winner === 'User'
                      ? `🏆 ${userName} বিজয়ী হয়েছেন!`
                      : judgeResult.winner === 'AI'
                      ? '🤖 Debate AI বিজয়ী হয়েছে!'
                      : '🤝 লড়াই সমানে সমান (Tie)!'}
                  </div>
                </div>

                {/* Score Comparison Bars */}
                <div className="space-y-3 bg-[#11142a] p-4 rounded-2xl border border-[#2a2f4d]">
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
                      <span className="text-emerald-400">{userName}</span>
                      <span className="text-white font-bold">{judgeResult.userScore} / ১০০</span>
                    </div>
                    <div className="w-full bg-[#1e233f] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, Math.max(0, judgeResult.userScore))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
                      <span className="text-[#a38bff]">Debate AI</span>
                      <span className="text-white font-bold">{judgeResult.aiScore} / ১০০</span>
                    </div>
                    <div className="w-full bg-[#1e233f] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] h-full rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(100, Math.max(0, judgeResult.aiScore))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Judge's Observation Summary */}
                <div className="bg-[#11142a] p-4 rounded-2xl border border-[#2a2f4d]">
                  <h4 className="text-xs font-bold text-[#c8cbdf] uppercase tracking-wider mb-2">
                    বিচারকের পর্যবেক্ষণ:
                  </h4>
                  <p className="text-xs sm:text-sm text-[#f1f2f8] leading-relaxed">{judgeResult.summary}</p>
                </div>

                {/* Strengths Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-bold text-emerald-400 block mb-1">আপনার শক্তিশালী দিক:</span>
                    <ul className="list-disc list-inside space-y-1 text-[#c8cbdf]">
                      {judgeResult.userStrengths?.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-[#7c5cff]/10 border border-[#7c5cff]/20">
                    <span className="font-bold text-[#a38bff] block mb-1">Debate AI-র শক্তিশালী দিক:</span>
                    <ul className="list-disc list-inside space-y-1 text-[#c8cbdf]">
                      {judgeResult.aiStrengths?.map((str, i) => (
                        <li key={i}>{str}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action Buttons: Image Card Download & Social Media Share */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-[#7c5cff]/15 via-[#171b30] to-[#ff5c8a]/15 border border-[#7c5cff]/40 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center justify-between">
                    <span>শেয়ার ও ডাউনলোড করুন</span>
                    <span className="text-[10px] text-amber-300 font-normal">সোশ্যাল মিডিয়া রেডি</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Image Download Button */}
                    <button
                      type="button"
                      onClick={() => downloadScorecardImage(topic, judgeResult, userName, userSide)}
                      disabled={isGeneratingCard}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-md hover:opacity-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isGeneratingCard ? 'ইমেজ তৈরি হচ্ছে...' : '📸 রেজাল্ট কার্ড ডাউনলোড'}</span>
                    </button>

                    {/* Social Media Share Button */}
                    <button
                      type="button"
                      onClick={() => shareDebateResult(judgeResult, topic)}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white font-bold text-xs shadow-md hover:opacity-95 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>🌐 সোশ্যাল মিডিয়ায় শেয়ার</span>
                    </button>
                  </div>

                  {shareFeedback && (
                    <div className="text-center text-xs text-emerald-400 font-semibold animate-fadeIn">
                      {shareFeedback}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowJudgeModal(false);
                  startDebate(topic);
                }}
                className="flex-1 py-3 rounded-xl bg-[#202542] hover:bg-[#282e52] text-white font-bold text-sm transition-all cursor-pointer text-center"
              >
                পুনরায় বিতর্ক করুন
              </button>
              <button
                type="button"
                onClick={() => setShowJudgeModal(false)}
                className="px-5 py-3 rounded-xl bg-[#11142a] border border-[#2a2f4d] text-[#c8cbdf] hover:text-white text-sm font-semibold transition-all cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEBATE HISTORY DRAWER */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#171b30] border border-[#2a2f4d] rounded-3xl p-6 sm:p-8 max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl relative animate-fadeIn">
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#11142a] text-[#9a9db5] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#7c5cff]/20 border border-[#7c5cff]/40 flex items-center justify-center text-[#a38bff]">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">বিতর্কের ইতিহাস</h3>
                <p className="text-xs text-[#9a9db5]">
                  আপনার ডিভাইসে সংরক্ষিত পূর্ববর্তী বিতর্কের ফলাফল ও ট্রান্সক্রিপ্ট ({historyItems.length}টি)
                </p>
              </div>
            </div>

            {historyItems.length === 0 ? (
              <div className="text-center py-12 bg-[#11142a] rounded-2xl border border-[#2a2f4d] p-6">
                <p className="text-sm text-[#c8cbdf] mb-1">এখনো কোনো বিতর্ক সম্পন্ন হয়নি।</p>
                <p className="text-xs text-[#666a85]">একটি বিতর্ক শেষ করে রায় গ্রহণ করলে তা এখানে স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকবে।</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {historyItems.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#11142a] border border-[#2a2f4d] rounded-2xl p-4 transition-all"
                    >
                      <div
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm sm:text-base font-bold text-white line-clamp-2">
                            {item.topic}
                          </h4>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap ${
                              item.winner === 'User'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.winner === 'AI'
                                ? 'bg-[#7c5cff]/20 text-[#a38bff] border border-[#7c5cff]/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {item.winner === 'User' ? '🏆 আপনি বিজয়ী' : item.winner === 'AI' ? '🤖 Debate AI বিজয়ী' : '🤝 ড্র'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#9a9db5] pt-1">
                          <div className="flex items-center gap-3">
                            <span>স্কোর: <strong className="text-emerald-400">{item.userScore}</strong> বনাম <strong className="text-[#a38bff]">{item.aiScore}</strong></span>
                            <span>{item.dateFormatted}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#a38bff]">
                            <span>{isExpanded ? 'সংক্ষেপ' : 'বিস্তারিত'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[#2a2f4d] space-y-3 animate-fadeIn">
                          <div className="p-3 rounded-xl bg-[#171b30] text-xs text-[#c8cbdf] leading-relaxed">
                            <strong className="text-amber-300 block mb-1">বিচারকের মন্তব্য:</strong>
                            {item.summary}
                          </div>

                          <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-[#171b30] rounded-xl text-xs">
                            <strong className="text-[#9a9db5] block mb-1 px-1">বিতর্কের কথপোকথন:</strong>
                            {item.messages.map((m, idx) => (
                              <div key={idx} className={`p-2 rounded-lg ${m.sender === 'user' ? 'bg-[#7c5cff]/20 text-right ml-4' : 'bg-[#11142a] mr-4'}`}>
                                <span className="font-bold block text-[10px] text-[#9a9db5] mb-0.5">
                                  {m.sender === 'user' ? item.userName : 'Debate AI'}
                                </span>
                                <span>{m.text}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const dummyResult: JudgeResult = {
                                  winner: item.winner,
                                  winnerTitle: item.winnerTitle,
                                  userScore: item.userScore,
                                  aiScore: item.aiScore,
                                  summary: item.summary,
                                  userStrengths: item.userStrengths,
                                  aiStrengths: item.aiStrengths,
                                  improvementTip: item.improvementTip,
                                };
                                downloadScorecardImage(item.topic, dummyResult, item.userName, item.userSide);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>স্কোরকার্ড ডাউনলোড</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>মুছুন</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {historyItems.length > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-[#2a2f4d]">
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সমস্ত ইতিহাস মুছুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#202542] text-[#c8cbdf] hover:text-white text-xs font-semibold cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GEMINI API KEY MODAL */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#171b30] border border-[#2a2f4d] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => {
                setShowApiKeyModal(false);
                setApiKeyTestMessage(null);
              }}
              className="absolute top-5 right-5 p-1.5 rounded-full text-[#9a9db5] hover:text-white hover:bg-[#202542] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7c5cff] to-cyan-400 flex items-center justify-center text-white shadow-lg">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Gemini API Key সেটিংস</h3>
                <span className="text-[11px] text-[#43d17a] font-semibold">আনলিমিটেড ক্রিস্টাল-ক্লিয়ার HD ভয়েস</span>
              </div>
            </div>

            <div className="text-xs text-[#c8cbdf] leading-relaxed mb-4 bg-[#11142a] p-3 rounded-xl border border-[#2a2f4d] space-y-1.5">
              <p>
                💡 Google Gemini Free Tier-এ দিনে <strong>১০টি HD ভয়েসের কোটা</strong> থাকে। কোটা শেষ হলেও লেখা ও বিতর্ক স্বাভাবিক থাকে। আনলিমিটেড স্পষ্ট HD ভয়েস পেতে আপনার ফ্রি API Key এখানে বসাতে পারেন।
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-[#c8cbdf] block mb-1">আপনার Gemini API Key:</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11142a] border border-[#2a2f4d] text-white text-xs sm:text-sm font-mono placeholder-[#666a85] focus:outline-none focus:border-[#7c5cff]"
              />
            </div>

            {apiKeyTestMessage && (
              <div className={`p-3 rounded-xl text-xs mb-4 ${
                apiKeyTestMessage.includes('✅')
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}>
                {apiKeyTestMessage}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => testAndSaveApiKey(apiKeyInput)}
                disabled={isTestingApiKey}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#ff5c8a] text-white font-bold text-xs sm:text-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isTestingApiKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>যাচাই হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>যাচাই ও সক্রিয় করুন</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowApiKeyModal(false);
                  setApiKeyTestMessage(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#11142a] border border-[#2a2f4d] text-[#c8cbdf] hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] sm:max-w-md w-auto">
          <div className="px-4 py-2.5 rounded-2xl bg-[#171b30] border border-[#3b4269] text-white shadow-2xl flex items-center gap-3 backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="p-1 rounded-lg text-[#9a9db5] hover:text-white hover:bg-[#202542] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AUTH UNAUTHORIZED DOMAIN MODAL */}
      {showAuthDomainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#171b30] border border-[#2a2f4d] rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAuthDomainModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-[#9a9db5] hover:text-white hover:bg-[#202542] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-lg">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Google Sign-in ডোমেন অনুমতি প্রয়োজন</h3>
                <span className="text-xs text-amber-400 font-medium">Firebase: auth/unauthorized-domain</span>
              </div>
            </div>

            <div className="text-xs text-[#c8cbdf] leading-relaxed mb-4 bg-[#11142a] p-3.5 rounded-2xl border border-[#2a2f4d] space-y-2">
              <p>
                আপনার অ্যাপটি বর্তমানে <strong className="text-white font-mono text-cyan-300">{typeof window !== 'undefined' ? window.location.hostname : 'onrender.com'}</strong> ডোমেনে চলছে।
              </p>
              <p className="text-[#9a9db5]">
                Google Firebase-এর নিরাপত্তা নিয়মানুযায়ী নতুন যেকোনো হোস্টিং ডোমেন (Render, Vercel ইত্যাদি) থেকে Google Sign-In চালু করতে Firebase Console-এ সেই ডোমেনটি ১ বার <strong>Authorized domain</strong> হিসেবে যুক্ত করতে হয়।
              </p>
            </div>

            {/* Current Domain Box with 1-Click Copy */}
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-[#9a9db5] block mb-1.5">
                আপনার বর্তমান হোস্টিং ডোমেন:
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0d1022] border border-[#2a2f4d]">
                <code className="text-xs sm:text-sm font-mono text-teal-300 flex-1 truncate select-all">
                  {typeof window !== 'undefined' ? window.location.hostname : 'voice-debate-ai-osqa.onrender.com'}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(window.location.hostname);
                      setDomainCopied(true);
                      setTimeout(() => setDomainCopied(false), 3000);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#202542] hover:bg-[#2c3358] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  {domainCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ডোমেন কপি</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-step resolution */}
            <div className="mb-5 bg-[#14182e] p-3.5 rounded-xl border border-[#242948] text-xs space-y-2 text-[#c8cbdf]">
              <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                <span>⚡ ১ মিনিটে ঠিক করার সহজ ধাপ:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#9a9db5] text-[11px] sm:text-xs">
                <li>নিচের <strong className="text-white">Firebase Console খুলুন</strong> বাটনে চাপ দিন।</li>
                <li>সেটিংস পাতার <strong className="text-white">Authorized domains</strong> সেকশনে <strong className="text-teal-300">Add domain</strong> বাটনে ক্লিক করুন।</li>
                <li>কপি করা ডোমেনটি পেস্ট করে <strong className="text-white">Save</strong> দিন। ব্যাস, সাথে সাথে সাইন-ইন কাজ করবে!</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-gray-950 font-bold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
              >
                <span>Firebase Console খুলুন</span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                type="button"
                onClick={() => setShowAuthDomainModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#11142a] hover:bg-[#202542] border border-[#2a2f4d] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                গেস্ট হিসেবে বিতর্ক করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
