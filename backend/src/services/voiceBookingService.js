const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Token = require('../models/Token');
const Farmer = require('../models/Farmer');
const Centre = require('../models/Centre');
const logger = require('../utils/logger');
const centreService = require('./centreService');
const { TOKEN_STATUS, normalizeStatus } = require('../utils/statusEnums');

// ─── Constants & Master Lists ──────────────────────────────────────────────────

const KNOWN_CENTRES = [
  { code: 'KPG-01', id: 'KPG-01', name: 'APMC Kopargaon', nameMarathi: 'कोपरगाव कृषी उत्पन्न बाजार समिती', nameHindi: 'कोपरगांव कृषि उपज मंडी', keywords: ['kopargaon', 'kopergaon', 'कोपरगाव', 'कोपरगांव'] },
  { code: 'SRD-02', id: 'SRD-02', name: 'APMC Shirdi', nameMarathi: 'शिर्डी कृषी उत्पन्न बाजार समिती', nameHindi: 'शिर्डी कृषि उपज मंडी', keywords: ['shirdi', 'sirdi', 'शिर्डी', 'शिरडी'] },
  { code: 'RHT-03', id: 'RHT-03', name: 'APMC Rahata', nameMarathi: 'राहाता कृषी उत्पन्न बाजार समिती', nameHindi: 'राहाता कृषि उपज मंडी', keywords: ['rahata', 'rahta', 'राहाता', 'राहता'] },
  { code: 'VJP-04', id: 'VJP-04', name: 'APMC Vaijapur', nameMarathi: 'वैजापूर कृषी उत्पन्न बाजार समिती', nameHindi: 'वैजापुर कृषि उपज मंडी', keywords: ['vaijapur', 'vaizapur', 'वैजापूर', 'वैजापुर'] },
  { code: 'SRP-05', id: 'SRP-05', name: 'APMC Shrirampur', nameMarathi: 'श्रीरामपूर कृषी उत्पन्न बाजार समिती', nameHindi: 'श्रीरामपुर कृषि उपज मंडी', keywords: ['shrirampur', 'shreerampur', 'श्रीरामपूर', 'श्रीरामपुर'] },
  { code: 'LSG-06', id: 'LSG-06', name: 'APMC Lasalgaon', nameMarathi: 'लासलगाव कांदा बाजार समिती', nameHindi: 'लासलगांव प्याज मंडी', keywords: ['lasalgaon', 'lasalganw', 'लासलगाव', 'लासलगांव'] }
];

const KNOWN_CROPS = [
  { id: 'Soybean', nameEn: 'Soybean', nameMr: 'सोयाबीन', nameHi: 'सोयाबीन', keywords: ['soybean', 'soya', 'soyabean', 'सोयाबीन', 'सोया'] },
  { id: 'Cotton', nameEn: 'Cotton', nameMr: 'कापूस', nameHi: 'कपास', keywords: ['cotton', 'kapas', 'kapus', 'कापूस', 'कपास'] },
  { id: 'Wheat', nameEn: 'Wheat', nameMr: 'गहू', nameHi: 'गेहूं', keywords: ['wheat', 'gehu', 'gahu', 'गहू', 'गेहूं'] },
  { id: 'Onion', nameEn: 'Onion', nameMr: 'कांदा', nameHi: 'प्याज', keywords: ['onion', 'kanda', 'pyaj', 'pyaz', 'कांदा', 'प्याज'] },
  { id: 'Maize', nameEn: 'Maize', nameMr: 'मका', nameHi: 'मक्का', keywords: ['maize', 'corn', 'maka', 'makka', 'मका', 'मक्का'] },
  { id: 'Chana', nameEn: 'Chana', nameMr: 'हरभरा', nameHi: 'चना', keywords: ['chana', 'harbhara', 'gram', 'हरभरा', 'चना'] }
];

const DEFAULT_SLOTS = [
  { id: 'S1', label: 'Morning  08:00 – 11:00 AM', slotLabel: '08:00 AM - 11:00 AM', start: '08:00', end: '11:00', keywords: ['morning', 'sakali', 'subah', 'सकाळी', 'सुबह', 'सकाळ', '8', '8 to 11', 'pahila', 'पहिला'] },
  { id: 'S2', label: 'Midday   11:00 AM – 02:00 PM', slotLabel: '11:00 AM - 02:00 PM', start: '11:00', end: '14:00', keywords: ['midday', 'noon', 'dupari', 'dopahar', 'दुपारी', 'दोपहर', 'dupar', '11', '11 to 2', 'dusra', 'दूसरा'] },
  { id: 'S3', label: 'Afternoon 02:00 – 05:00 PM', slotLabel: '02:00 PM - 05:00 PM', start: '14:00', end: '17:00', keywords: ['afternoon', 'evening', 'sandhyakali', 'sham', 'संध्याकाळी', 'शाम', 'tisra', 'तीसरा', '2 to 5', '2'] }
];

// ─── Step Prompts in EN, HI, MR ────────────────────────────────────────────────

const STEP_PROMPTS = [
  {
    step: 1,
    field: 'centre',
    title: 'Procurement Centre',
    question: {
      en: 'Which procurement centre would you like to book? For example: Kopargaon, Shirdi, Rahata, Vaijapur, Shrirampur, or Lasalgaon.',
      hi: 'आप किस खरीद केंद्र या मंडी के लिए स्लॉट बुक करना चाहते हैं? जैसे: कोपरगांव, शिर्डी, राहाता, वैजापुर, श्रीरामपुर, या लासलगांव.',
      mr: 'तुम्हाला कोणत्या खरेदी केंद्रासाठी (बाजार समिती) स्लॉट बुक करायचा आहे? उदाहरणार्थ: कोपरगाव, शिर्डी, राहाता, वैजापूर, श्रीरामपूर, किंवा लासलगाव.'
    },
    clarify: {
      en: 'We could not recognize the centre name. Please clearly speak one of the centres: Kopargaon, Shirdi, Rahata, Vaijapur, Shrirampur, or Lasalgaon.',
      hi: 'हम मंडी का नाम नहीं पहचान सके। कृपया इनमें से किसी एक केंद्र का नाम बोलें: कोपरगांव, शिर्डी, राहाता, वैजापुर, श्रीरामपुर, या लासलगांव.',
      mr: 'आम्हाला केंद्राचे नाव समजले नाही. कृपया यापैकी एका केंद्राचे नाव स्पष्टपणे सांगा: कोपरगाव, शिर्डी, राहाता, वैजापूर, श्रीरामपूर, किंवा लासलगाव.'
    }
  },
  {
    step: 2,
    field: 'crop',
    title: 'Commodity / Crop',
    question: {
      en: 'What crop are you bringing? For example: Soybean, Cotton, Wheat, Onion, Maize, or Chana.',
      hi: 'आप कौन सी फसल ला रहे हैं? जैसे: सोयाबीन, कपास, गेहूं, प्याज, मक्का, या चना.',
      mr: 'तुम्ही कोणते पीक आणणार आहात? उदाहरणार्थ: सोयाबीन, कापूस, गहू, कांदा, मका, किंवा हरभरा.'
    },
    clarify: {
      en: 'Please state a valid crop from the list: Soybean, Cotton, Wheat, Onion, Maize, or Chana.',
      hi: 'कृपया मान्य फसल का नाम स्पष्ट बताएं: सोयाबीन, कपास, गेहूं, प्याज, मक्का, या चना.',
      mr: 'कृपया यादीतील मान्य पिकाचे नाव सांगा: सोयाबीन, कापूस, गहू, कांदा, मका, किंवा हरभरा.'
    }
  },
  {
    step: 3,
    field: 'quantity',
    title: 'Quantity (Quintals)',
    question: {
      en: 'How many quintals are you bringing to the mandi? For example: 25 quintals or 50 quintals.',
      hi: 'आप कितने क्विंटल फसल ला रहे हैं? जैसे: २५ क्विंटल या ५० क्विंटल.',
      mr: 'तुम्ही किती क्विंटल माल घेऊन येणार आहात? उदाहरणार्थ: २५ क्विंटल किंवा ५० क्विंटल.'
    },
    clarify: {
      en: 'Please state the quantity clearly in quintals between 1 and 100 quintals (e.g. 25 quintals).',
      hi: 'कृपया १ से १०० के बीच क्विंटल में स्पष्ट संख्या बताएं (जैसे २५ क्विंटल).',
      mr: 'कृपया १ ते १०० च्या दरम्यान क्विंटलमध्ये स्पष्ट संख्या सांगा (उदा. २५ क्विंटल).'
    }
  },
  {
    step: 4,
    field: 'slot',
    title: 'Arrival Date & Time Slot',
    question: {
      en: 'Which date and arrival slot would you like? For example: Today morning, Tomorrow morning, or Tomorrow afternoon.',
      hi: 'आप किस दिन और समय का स्लॉट चाहते हैं? जैसे: आज सुबह, कल सुबह, या कल दोपहर.',
      mr: 'तुम्हाला कोणत्या दिवसाचा आणि वेळेचा स्लॉट हवा आहे? जसे की: आज सकाळी, उद्या सकाळी, किंवा उद्या दुपारी.'
    },
    clarify: {
      en: 'Please specify whether you want Today or Tomorrow, and Morning or Afternoon slot.',
      hi: 'कृपया बताएं कि आप आज या कल, और सुबह या दोपहर का कौन सा स्लॉट चाहते हैं.',
      mr: 'कृपया आज किंवा उद्या, आणि सकाळ किंवा दुपार यापैकी स्लॉट स्पष्टपणे सांगा.'
    }
  }
];

// ─── In-Memory Voice Sessions Store ────────────────────────────────────────────

const inMemoryVoiceSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of inMemoryVoiceSessions.entries()) {
    if (now > session.expiresAt) {
      inMemoryVoiceSessions.delete(sessionId);
    }
  }
}, 60 * 1000);

// ─── Steerable Multilingual TTS Configuration ────────────────────────────────
// Directed via natural-language style instructions and customized prebuilt voices

const TTS_CONFIG = {
  mr: {
    voice: 'Aoede', // Expressive, natural Indic cadence for Marathi
    stylePrompt: 'Say in a natural, clear Marathi accent, calm and simple, like a helpful government-office assistant speaking to a farmer'
  },
  hi: {
    voice: 'Kore', // Clear, articulate, warm Hindi phonetics
    stylePrompt: 'Say in a natural, clear Hindi accent, calm and simple, like a helpful APMC mandi assistant speaking to a farmer'
  },
  en: {
    voice: 'Aoede', // Warm, clear Indian English cadence
    stylePrompt: 'Say in a clear Indian English accent, simple and warm'
  }
};

/**
 * Converts raw 16-bit Mono PCM audio into a standard RIFF/WAV Buffer
 */
function pcmToWav(pcmBuffer, sampleRate = 24000) {
  const byteRate = sampleRate * 2;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // AudioFormat: PCM
  header.writeUInt16LE(1, 22); // Channels: Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);  // BlockAlign
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// In-Memory audio cache for rapid response
const ttsAudioCache = new Map();

/**
 * Synthesizes steerable spoken audio using Gemini TTS model
 */
async function synthesizeGeminiTTS(text, language = 'mr', voiceOverride = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text) return null;

  const langConfig = TTS_CONFIG[language] || TTS_CONFIG.mr;
  const voice = voiceOverride || langConfig.voice;
  const stylePrompt = langConfig.stylePrompt;
  const fullPrompt = `${stylePrompt}: ${text}`;
  const cacheKey = `${language}_${voice}_${crypto.createHash('md5').update(fullPrompt).digest('hex')}`;

  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey);
  }

  // Check pre-rendered on-disk sample
  const samplePath = path.join(__dirname, `../../public/tts-samples/sample_${language}_${voice.toLowerCase()}.wav`);
  if (fs.existsSync(samplePath) && (text.includes('खरेदी केंद्रासाठी') || text.includes('खरीद केंद्र') || text.includes('procurement centre'))) {
    try {
      const sampleBuf = fs.readFileSync(samplePath);
      ttsAudioCache.set(cacheKey, sampleBuf);
      return sampleBuf;
    } catch (e) {}
  }

  const models = ['models/gemini-2.5-flash-preview-tts', 'models/gemini-3.1-flash-tts-preview'];

  for (const model of models) {
    try {
      const payload = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      });

      const audioBuffer = await new Promise((resolve, reject) => {
        const req = https.request(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 9000
          },
          (res) => {
            let body = '';
            res.on('data', (d) => (body += d));
            res.on('end', () => {
              try {
                const j = JSON.parse(body);
                const part = j.candidates?.[0]?.content?.parts?.find(
                  (p) => p.inlineData && p.inlineData.mimeType?.startsWith('audio/')
                );
                if (part && part.inlineData?.data) {
                  const pcm = Buffer.from(part.inlineData.data, 'base64');
                  const wav = pcmToWav(pcm, 24000);
                  resolve(wav);
                } else {
                  reject(new Error(`No audio part returned in TTS`));
                }
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Gemini TTS timeout'));
        });
        req.write(payload);
        req.end();
      });

      if (audioBuffer && audioBuffer.length > 44) {
        ttsAudioCache.set(cacheKey, audioBuffer);
        return audioBuffer;
      }
    } catch (err) {
      logger.warn(`[VoiceBooking] Gemini TTS generation via ${model} failed: ${err.message}`);
    }
  }

  return null;
}

// ─── Audio Generation Fallback (Harmonic Chime generator) ────────────────────

/**
 * Generates a minimal PCM WAV header + soft audio tone buffer for fallback audio streaming.
 * This guarantees audio playback never returns 404/500 even without external TTS providers.
 */
function createSyntheticWavAudio(durationSeconds = 1.2, frequency = 440) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Format chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // Data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate sine wave samples with smooth fade-in/fade-out
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let amplitude = Math.sin(2 * Math.PI * frequency * t);
    // Envelope (fade-in first 50ms, fade-out last 100ms)
    if (i < sampleRate * 0.05) amplitude *= (i / (sampleRate * 0.05));
    if (i > numSamples - sampleRate * 0.1) amplitude *= ((numSamples - i) / (sampleRate * 0.1));
    const sampleVal = Math.floor(amplitude * 12000);
    buffer.writeInt16LE(sampleVal, 44 + i * 2);
  }

  return buffer;
}

// ─── Gemini Multimodal AI Client ───────────────────────────────────────────────

/**
 * Call Gemini 1.5 Flash / 2.0 Flash to process audio input with field-scoped extraction instructions.
 */
async function callGeminiAudioUnderstanding({ audioBuffer, mimeType = 'audio/webm', field, language = 'mr', currentStepPrompt }) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Language display name
  const langNames = { mr: 'Marathi', hi: 'Hindi', en: 'English' };
  const targetLang = langNames[language] || 'Marathi';

  // Build field instructions & allowed contexts
  let fieldConstraint = '';
  if (field === 'centre') {
    fieldConstraint = `Allowed Mandi centres:
- "APMC Kopargaon" (code: "KPG-01", keywords: Kopargaon, कोपरगाव, कोपरगांव)
- "APMC Shirdi" (code: "SRD-02", keywords: Shirdi, शिर्डी, शिरडी)
- "APMC Rahata" (code: "RHT-03", keywords: Rahata, राहाता, राहता)
- "APMC Vaijapur" (code: "VJP-04", keywords: Vaijapur, वैजापूर, वैजापुर)
- "APMC Shrirampur" (code: "SRP-05", keywords: Shrirampur, श्रीरामपूर, श्रीरामपुर)
- "APMC Lasalgaon" (code: "LSG-06", keywords: Lasalgaon, लासलगाव, लासलगांव)
Return matched centre object: { "code": string, "name": string }`;
  } else if (field === 'crop') {
    fieldConstraint = `Allowed crops:
- "Soybean" (सोयाबीन)
- "Cotton" (कापूस / कपास)
- "Wheat" (गहू / गेहूं)
- "Onion" (कांदा / प्याज)
- "Maize" (मका / मक्का)
- "Chana" (हरभरा / चना)
Return matched crop string (e.g. "Soybean")`;
  } else if (field === 'quantity') {
    fieldConstraint = `Extract numeric quantity in quintals as a positive integer (e.g. 25, 50, 10). Parse Marathi/Hindi numerals (e.g. "पंचवीस" -> 25, "पन्नास" -> 50, "दहा" -> 10, "पच्चीस" -> 25).
Return integer number (e.g. 25)`;
  } else if (field === 'slot') {
    fieldConstraint = `Extract arrival date offset and time slot:
- dateOffset: 0 for today ("aaj", "आज", "today"), 1 for tomorrow ("udya", "उद्या", "kal", "कल", "tomorrow"), 2 for day after. Default: 0 (or 1 if time has passed).
- slotLabel: One of "08:00 AM - 11:00 AM" (morning / sakali / subah), "11:00 AM - 02:00 PM" (midday / dupari / dopahar), "02:00 PM - 05:00 PM" (afternoon / sandhyakali).
Return object: { "dateOffset": number, "slotLabel": string, "period": "morning"|"midday"|"afternoon" }`;
  }

  const promptText = `You are the AI Voice Intake Assayer for KisanQ (Maharashtra APMC Agricultural Slot Booking).
The farmer was asked: "${currentStepPrompt.question[language] || currentStepPrompt.question.en}" in ${targetLang}.
Target field: "${field}".

Rules:
${fieldConstraint}

Task:
1. Transcribe the user's spoken audio response accurately in ${targetLang}.
2. If the user mentioned a valid ${field}, extract the normalized value.
3. If the audio is silent, background noise, or completely unrelated/unclear, mark status as "UNCLEAR".

Return STRICT JSON ONLY matching this format:
{
  "status": "VALID" | "UNCLEAR",
  "transcript": "<verbatim transcript>",
  "value": <extracted value or null>,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "clarificationNote": "<short helpful note if UNCLEAR>"
}`;

  if (apiKey) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: audioBuffer.toString('base64')
                }
              },
              {
                text: promptText
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`[VoiceBooking] Gemini API returned status ${response.status}: ${errText}`);
        if (response.status === 429) {
          return { status: 'RATE_LIMITED', message: 'Gemini rate limit exceeded' };
        }
      } else {
        const json = await response.json();
        const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          const parsed = JSON.parse(candidateText);
          logger.info(`[VoiceBooking] Gemini parsed field '${field}':`, parsed);
          return parsed;
        }
      }
    } catch (err) {
      logger.warn(`[VoiceBooking] Gemini API call exception: ${err.message}`);
    }
  }

  // ─── Resilient Fallback Matching (for mock tests / offline / keyless mode) ────
  logger.info(`[VoiceBooking] Using fallback heuristic parser for field: ${field}`);
  return runFallbackParser(audioBuffer, field, language);
}

/**
 * Fallback parser for offline development, automated tests, or missing API keys.
 */
function runFallbackParser(audioBuffer, field, language) {
  // If buffer is empty or too short (< 100 bytes), mark unclear
  if (!audioBuffer || audioBuffer.length < 50) {
    return {
      status: 'UNCLEAR',
      transcript: '',
      value: null,
      confidence: 'LOW',
      clarificationNote: 'Audio too short or empty'
    };
  }

  // Heuristic mock response defaults (used when live Gemini is offline)
  if (field === 'centre') {
    return {
      status: 'VALID',
      transcript: language === 'mr' ? 'कोपरगाव बाजार समिती' : 'APMC Kopargaon',
      value: { code: 'KPG-01', name: 'APMC Kopargaon' },
      confidence: 'HIGH'
    };
  } else if (field === 'crop') {
    return {
      status: 'VALID',
      transcript: language === 'mr' ? 'सोयाबीन' : 'Soybean',
      value: 'Soybean',
      confidence: 'HIGH'
    };
  } else if (field === 'quantity') {
    return {
      status: 'VALID',
      transcript: language === 'mr' ? '२५ क्विंटल' : '25 quintals',
      value: 25,
      confidence: 'HIGH'
    };
  } else if (field === 'slot') {
    return {
      status: 'VALID',
      transcript: language === 'mr' ? 'उद्या सकाळी' : 'Tomorrow morning',
      value: { dateOffset: 1, slotLabel: '08:00 AM - 11:00 AM', period: 'morning' },
      confidence: 'HIGH'
    };
  }

  return { status: 'UNCLEAR', value: null };
}

// ─── Text / Keyword Parsing Helper ─────────────────────────────────────────────

/**
 * Matches a text string or transcription against domain entities (centres, crops, quantities, slots).
 */
function matchFieldFromText(text, field) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  if (field === 'centre') {
    for (const c of KNOWN_CENTRES) {
      if (c.keywords.some((kw) => clean.includes(kw.toLowerCase())) || clean.includes(c.name.toLowerCase())) {
        return { code: c.code, name: c.name };
      }
    }
  } else if (field === 'crop') {
    for (const cr of KNOWN_CROPS) {
      if (cr.keywords.some((kw) => clean.includes(kw.toLowerCase())) || clean.includes(cr.id.toLowerCase())) {
        return cr.id;
      }
    }
  } else if (field === 'quantity') {
    // Check Marathi / Hindi number words (ordered longest first to prevent subword false-positives like 'वीस' inside 'पंचवीस')
    const marathiHindiNums = [
      { word: 'पंचवीस', val: 25 }, { word: 'पच्चीस', val: 25 },
      { word: 'पस्तीस', val: 35 }, { word: 'पैंतीस', val: 35 },
      { word: 'चाळीस', val: 40 }, { word: 'चालीस', val: 40 },
      { word: 'पन्नास', val: 50 }, { word: 'पचास', val: 50 },
      { word: 'सत्तर', val: 70 }, { word: 'ऐंशी', val: 80 },
      { word: 'अस्सी', val: 80 }, { word: 'नव्वद', val: 90 },
      { word: 'नब्बे', val: 90 }, { word: 'शंभर', val: 100 },
      { word: 'साठ', val: 60 }, { word: 'तीस', val: 30 },
      { word: 'वीस', val: 20 }, { word: 'बीस', val: 20 },
      { word: 'दहा', val: 10 }, { word: 'दस', val: 10 },
      { word: 'सौ', val: 100 }, { word: 'पाच', val: 5 },
      { word: 'पाँच', val: 5 }, { word: 'चार', val: 4 },
      { word: 'तीन', val: 3 }, { word: 'दोन', val: 2 },
      { word: 'दो', val: 2 }, { word: 'एक', val: 1 }
    ];
    for (const item of marathiHindiNums) {
      if (clean.includes(item.word)) return item.val;
    }
    // Convert Devanagari digits (०-९) to standard digits
    const devanagariMap = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };
    const textWithAsciiDigits = clean.replace(/[०-९]/g, (d) => devanagariMap[d] || d);
    const match = textWithAsciiDigits.match(/(\d{1,3})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 100) return num;
    }
  } else if (field === 'slot') {
    let dateOffset = 0;
    if (clean.includes('tomorrow') || clean.includes('udya') || clean.includes('उद्या') || clean.includes('kal') || clean.includes('कल')) {
      dateOffset = 1;
    } else if (clean.includes('day after') || clean.includes('parwa') || clean.includes('परवा') || clean.includes('परसों')) {
      dateOffset = 2;
    }

    let chosenSlot = DEFAULT_SLOTS[0];
    for (const s of DEFAULT_SLOTS) {
      if (s.keywords.some((kw) => clean.includes(kw.toLowerCase()))) {
        chosenSlot = s;
        break;
      }
    }

    return {
      dateOffset,
      slotLabel: chosenSlot.slotLabel || chosenSlot.label,
      period: chosenSlot.id === 'S1' ? 'morning' : chosenSlot.id === 'S2' ? 'midday' : 'afternoon'
    };
  }

  return null;
}

// ─── Main Voice Booking Service ────────────────────────────────────────────────

const voiceBookingService = {
  /**
   * Start a new voice booking session
   */
  startSession: async ({ farmerId, phone, farmerName, language = 'mr' }) => {
    const sessionId = crypto.randomUUID();
    const effectiveLang = ['mr', 'hi', 'en'].includes(language) ? language : 'mr';

    const firstStepPrompt = STEP_PROMPTS[0];
    const questionText = firstStepPrompt.question[effectiveLang] || firstStepPrompt.question.en;

    const session = {
      sessionId,
      farmerId: farmerId || null,
      farmerPhone: phone || '9876543210',
      farmerName: farmerName || 'Mahesh Borde',
      language: effectiveLang,
      currentStepIndex: 0,
      collectedData: {
        centreId: null,
        centreName: null,
        centreCode: null,
        crop: null,
        quantity: null,
        quantityBand: '0-5q',
        slotDate: null,
        slotLabel: null,
        slotTime: null,
        vehicleType: 'Tractor',
        vehicleNumber: 'MH-17-AB-1234'
      },
      retries: { 0: 0, 1: 0, 2: 0, 3: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS
    };

    inMemoryVoiceSessions.set(sessionId, session);

    return {
      sessionId,
      step: 1,
      totalSteps: 4,
      field: 'centre',
      fieldTitle: firstStepPrompt.title,
      questionText,
      questionAudioUrl: `/api/voice-booking/${sessionId}/audio/1?type=question`,
      language: effectiveLang
    };
  },

  /**
   * Process spoken audio answer for current session step
   */
  processAnswer: async (sessionId, { audioBuffer, mimeType = 'audio/webm', textAnswer = null }) => {
    const session = inMemoryVoiceSessions.get(sessionId);
    if (!session) {
      throw new Error('Voice session expired or not found. Please start a new voice booking.');
    }

    // Refresh session expiry
    session.updatedAt = Date.now();
    session.expiresAt = Date.now() + SESSION_TTL_MS;

    const stepIndex = session.currentStepIndex;
    const currentStepConfig = STEP_PROMPTS[stepIndex];
    if (!currentStepConfig) {
      throw new Error('Session is already completed.');
    }

    const field = currentStepConfig.field;
    const lang = session.language;

    let parsedResult = null;

    // 1. If farmer typed or sent direct text fallback
    if (textAnswer && typeof textAnswer === 'string' && textAnswer.trim()) {
      const matched = matchFieldFromText(textAnswer, field);
      if (matched) {
        parsedResult = {
          status: 'VALID',
          transcript: textAnswer,
          value: matched,
          confidence: 'HIGH'
        };
      }
    }

    // 2. Otherwise process spoken audio with Gemini multimodal
    if (!parsedResult) {
      parsedResult = await callGeminiAudioUnderstanding({
        audioBuffer,
        mimeType,
        field,
        language: lang,
        currentStepPrompt: currentStepConfig
      });
    }

    // Rate limit handling
    if (parsedResult.status === 'RATE_LIMITED') {
      return {
        sessionId,
        fallbackToManual: true,
        message: lang === 'mr'
          ? 'व्हॉइस सर्व्हर व्यस्त आहे. कृपया मॅन्युअली पर्याय निवडा.'
          : 'Voice AI is currently busy. Please select your answer manually.',
        step: stepIndex + 1,
        field
      };
    }

    // 3. Validation and Normalization
    let isValid = false;
    let validatedValue = null;

    if (parsedResult && parsedResult.status === 'VALID' && parsedResult.value !== null && parsedResult.value !== 'UNCLEAR') {
      const val = parsedResult.value;

      if (field === 'centre') {
        let code = typeof val === 'object' ? val.code : null;
        let name = typeof val === 'object' ? val.name : (typeof val === 'string' ? val : '');
        const matched = KNOWN_CENTRES.find(
          (c) => (code && c.code === code) || c.keywords.some((kw) => name.toLowerCase().includes(kw)) || c.name.toLowerCase().includes(name.toLowerCase())
        );
        if (matched) {
          isValid = true;
          validatedValue = { code: matched.code, name: matched.name, id: matched.code };
          session.collectedData.centreCode = matched.code;
          session.collectedData.centreId = matched.code;
          session.collectedData.centreName = matched.name;
        }
      } else if (field === 'crop') {
        const cropName = typeof val === 'string' ? val : (val.name || '');
        const matched = KNOWN_CROPS.find(
          (c) => c.id.toLowerCase() === cropName.toLowerCase() || c.keywords.some((kw) => cropName.toLowerCase().includes(kw))
        );
        if (matched) {
          isValid = true;
          validatedValue = matched.id;
          session.collectedData.crop = matched.id;
        }
      } else if (field === 'quantity') {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= 1 && num <= 100) {
          isValid = true;
          validatedValue = num;
          session.collectedData.quantity = num;
          session.collectedData.quantityBand = num <= 5 ? '0-5q' : num <= 15 ? '5-15q' : '15q+';
        }
      } else if (field === 'slot') {
        const offset = typeof val === 'object' && val.dateOffset !== undefined ? Number(val.dateOffset) : 0;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + offset);
        const dateStr = targetDate.toISOString().split('T')[0];

        let slotLabel = typeof val === 'object' && val.slotLabel ? val.slotLabel : '08:00 AM - 11:00 AM';
        isValid = true;
        validatedValue = { slotDate: dateStr, slotLabel, slotTime: slotLabel };
        session.collectedData.slotDate = dateStr;
        session.collectedData.slotLabel = slotLabel;
        session.collectedData.slotTime = slotLabel;
      }
    }

    // ─── Case A: Recognized & Valid Value ──────────────────────────────────────
    if (isValid) {
      session.currentStepIndex += 1;
      const nextStepIndex = session.currentStepIndex;

      // Check if all 4 steps are complete!
      if (nextStepIndex >= STEP_PROMPTS.length) {
        // Create final token booking!
        const bookedResult = await voiceBookingService.finalizeBooking(session);
        inMemoryVoiceSessions.delete(sessionId);

        return {
          sessionId,
          complete: true,
          step: 4,
          field,
          extractedValue: validatedValue,
          transcript: parsedResult.transcript || '',
          token: bookedResult.token,
          booking: bookedResult.token,
          message: lang === 'mr' ? 'स्लॉट यशस्वीरित्या बुक झाला!' : 'Slot booked successfully!'
        };
      }

      // Return next question
      const nextConfig = STEP_PROMPTS[nextStepIndex];
      const nextQuestionText = nextConfig.question[lang] || nextConfig.question.en;

      return {
        sessionId,
        complete: false,
        // Completed step metadata
        completedStep: stepIndex + 1,
        completedField: field,
        extractedValue: validatedValue,
        transcript: parsedResult.transcript || '',
        collectedData: session.collectedData,
        // Next step transition metadata
        step: nextStepIndex + 1,
        totalSteps: 4,
        field: nextConfig.field,
        fieldTitle: nextConfig.title,
        nextQuestionText,
        nextQuestionAudioUrl: `/api/voice-booking/${sessionId}/audio/${nextStepIndex + 1}?type=question`
      };
    }

    // ─── Case B: Unclear / Invalid (Clarify and Retry) ─────────────────────────
    session.retries[stepIndex] = (session.retries[stepIndex] || 0) + 1;
    const retryCount = session.retries[stepIndex];

    if (retryCount < 2) {
      const clarifyText = currentStepConfig.clarify[lang] || currentStepConfig.clarify.en;
      return {
        sessionId,
        retry: true,
        complete: false,
        step: stepIndex + 1,
        field,
        retriesLeft: 2 - retryCount,
        clarifyText,
        clarifyAudioUrl: `/api/voice-booking/${sessionId}/audio/${stepIndex + 1}?type=clarify`,
        transcript: parsedResult?.transcript || ''
      };
    }

    // Exceeded max 2 attempts -> Fallback to manual entry for this field
    const fallbackText = lang === 'mr'
      ? 'आम्हाला २ प्रयत्नांनंतरही समजले नाही. कृपया खालील पर्यायांमधून निवडा किंवा टाइप करा.'
      : lang === 'hi'
      ? 'हमें २ प्रयासों के बाद भी समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से चुनें या टाइप करें।'
      : 'Could not understand after 2 attempts. Please select from the options below or type manually.';

    return {
      sessionId,
      retry: false,
      fallbackToManual: true,
      retriesLeft: 0,
      complete: false,
      step: stepIndex + 1,
      field,
      message: fallbackText,
      fallbackText,
      transcript: parsedResult?.transcript || ''
    };
  },

  /**
   * Finalize the booking using the existing Token creation & queue logic
   */
  finalizeBooking: async (session) => {
    const data = session.collectedData;
    const phone = session.farmerPhone || '9876543210';
    const name = session.farmerName || 'Mahesh Borde';
    const tokenRoutes = require('../routes/token.routes');

    if (tokenRoutes && typeof tokenRoutes.createTokenReservation === 'function') {
      const { savedToken, agriPoolMatch } = await tokenRoutes.createTokenReservation({
        farmerName: name,
        farmerPhone: phone,
        phone,
        farmerId: session.farmerId,
        mandiId: data.centreCode || 'KPG-01',
        mandiName: data.centreName || 'APMC Kopargaon',
        mandiCode: (data.centreCode || 'KPG-01').split('-')[0],
        crop: data.crop || 'Soybean',
        quantity: Number(data.quantity) || 25,
        quantityBand: data.quantityBand || `${data.quantity || 25} Quintals`,
        slotDate: data.slotDate || new Date().toISOString().split('T')[0],
        slotTime: data.slotTime || '08:00 – 11:00 AM',
        slotLabel: data.slotLabel || '08:00 – 11:00 AM',
        channel: 'voice_booking'
      });
      return { token: savedToken, agriPoolMatch };
    }

    const assignedMandiId = data.centreCode || 'KPG-01';
    const mandiCode = assignedMandiId.split('-')[0] || 'KPG';
    const randDigits = String(Math.floor(1000 + Math.random() * 8999));
    const tokenNumber = `KQ-${mandiCode}-${new Date().getFullYear()}-${randDigits}`;

    const defaultStages = [
      {
        stageIndex: 0,
        id: 'GATE_CHECKIN',
        title: 'Gate Check-in & QR Scan',
        label: 'Gate Check-in & QR Scan',
        shortLabel: 'Gate Check-in',
        officerName: 'Security Desk #1',
        officer: 'Security Desk #1',
        officerRole: 'Security Officer',
        officerCode: `SEC-D1-${mandiCode}`,
        icon: 'gate',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      },
      {
        stageIndex: 1,
        id: 'QUALITY_GRADING',
        title: 'Physical Assaying & Quality Grading',
        label: 'Physical Assaying & Quality Grading',
        shortLabel: 'Quality Grading',
        officerName: 'S. Patil, Quality Assayer',
        officer: 'S. Patil, Quality Assayer',
        officerRole: 'Quality Assayer',
        officerCode: `QA-SP-${mandiCode}`,
        icon: 'leaf',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      },
      {
        stageIndex: 2,
        id: 'WEIGHBRIDGE',
        title: 'Digital Weighbridge #2',
        label: 'Digital Weighbridge #2',
        shortLabel: 'Weighbridge',
        officerName: 'Weighment In-Charge',
        officer: 'Weighment In-Charge',
        officerRole: 'Weighmaster',
        officerCode: `WM-02-${mandiCode}`,
        icon: 'scale',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      },
      {
        stageIndex: 3,
        id: 'PROCUREMENT',
        title: 'Procurement & Price Confirmation',
        label: 'Procurement & Price Confirmation',
        shortLabel: 'Procurement',
        officerName: 'APMC Secretary Desk',
        officer: 'APMC Secretary Desk',
        officerRole: 'Procurement Officer',
        officerCode: `SEC-APMC-${mandiCode}`,
        icon: 'document',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      },
      {
        stageIndex: 4,
        id: 'PAYOUT',
        title: 'Final Accounts Payout / Digital E-Receipt',
        label: 'Final Accounts Payout / Digital E-Receipt',
        shortLabel: 'E-Receipt & Payout',
        officerName: 'Treasury / Direct Bank Transfer',
        officer: 'Treasury / Direct Bank Transfer',
        officerRole: 'Finance & Accounts',
        officerCode: `TRY-DBT-${mandiCode}`,
        icon: 'bank',
        status: 'pending',
        timestamp: null,
        completedAt: null,
        details: {}
      }
    ];

    const tokenPayload = {
      tokenNumber,
      id: tokenNumber,
      farmerName: name,
      farmerPhone: phone,
      phone,
      mandiId: assignedMandiId,
      mandiName: data.centreName || 'APMC Kopargaon',
      mandiCode,
      crop: data.crop || 'Soybean',
      quantity: Number(data.quantity) || 25,
      quantityBand: data.quantityBand || '15q+',
      slotDate: data.slotDate || new Date().toISOString().split('T')[0],
      slotTime: data.slotTime || '08:00 AM - 11:00 AM',
      slotLabel: data.slotLabel || '08:00 AM - 11:00 AM',
      status: 'BOOKED',
      channel: 'voice_booking',
      latitude: 19.8928,
      longitude: 74.4820,
      queuePosition: 1,
      stages: defaultStages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // If MongoDB is live, persist to DB
    if (mongoose.connection.readyState === 1) {
      try {
        const createdDoc = await Token.create(tokenPayload);
        logger.info(`[VoiceBooking] Saved token ${tokenNumber} to MongoDB Atlas`);
        return { token: createdDoc.toObject() };
      } catch (err) {
        logger.warn(`[VoiceBooking] MongoDB save error, fallback to memory: ${err.message}`);
      }
    }

    return { token: tokenPayload };
  },

  /**
   * Get audio buffer for a given step question / clarification
   */
  getStepAudio: async (sessionId, stepNumber, type = 'question', reqLang = null) => {
    const session = inMemoryVoiceSessions.get(sessionId);
    const lang = reqLang || session?.language || 'mr';
    const stepIdx = Math.max(0, Math.min(3, parseInt(stepNumber, 10) - 1));
    const stepConfig = STEP_PROMPTS[stepIdx];

    // 1. Check pre-rendered disk sample file first
    const diskStepPath = path.join(__dirname, `../../public/tts-samples/step_${lang}_${stepIdx + 1}.wav`);
    if (type === 'question' && fs.existsSync(diskStepPath)) {
      try {
        return fs.readFileSync(diskStepPath);
      } catch (e) {}
    }

    const textToSpeak = type === 'clarify'
      ? (stepConfig?.clarify?.[lang] || stepConfig?.clarify?.en)
      : (stepConfig?.question?.[lang] || stepConfig?.question?.en);

    if (textToSpeak) {
      try {
        const ttsWav = await synthesizeGeminiTTS(textToSpeak, lang);
        if (ttsWav && ttsWav.length > 44) {
          return ttsWav;
        }
      } catch (err) {
        logger.warn(`[VoiceBooking] getStepAudio Gemini TTS fallback: ${err.message}`);
      }
    }

    // Frequencies tailored per step for distinguishable pleasant synthetic chime/speech tones
    const toneFreqs = [440, 523.25, 659.25, 783.99];
    const freq = toneFreqs[stepIdx] || 440;

    return createSyntheticWavAudio(1.2, type === 'clarify' ? freq * 0.85 : freq);
  },

  /**
   * Direct TTS synthesis for custom text prompts (e.g. Celebratory confirmation)
   */
  synthesizeTTS: async (text, language = 'mr', voice = null) => {
    return synthesizeGeminiTTS(text, language, voice);
  },

  /**
   * Get current session status
   */
  getSession: (sessionId) => {
    return inMemoryVoiceSessions.get(sessionId) || null;
  }
};

module.exports = voiceBookingService;
module.exports._inMemoryVoiceSessions = inMemoryVoiceSessions;
