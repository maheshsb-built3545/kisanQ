import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, X, CheckCircle2, AlertCircle,
  Loader2, Building2, Leaf, Clock, Banknote, Sparkles,
  Ticket, ArrowRight, RotateCcw, ShieldCheck, ChevronRight,
  Radio, Check, Play, Send, MessageSquare
} from 'lucide-react';
import { voiceBookingApi } from '../../api/voiceBooking.api';

/**
 * ─── Fully Conversational Trilingual Voice Booking Modal ────────────────────
 * Features automatic conversational turn-taking:
 * 1. Question audio auto-plays immediately upon entering step.
 * 2. When audio finishes, mic automatically activates with "Your turn — speak now".
 * 3. Farmer speaks -> audio is processed by Gemini multimodal AI.
 * 4. Next question immediately auto-plays with zero manual clicks.
 * 5. Clarification retries also auto-play spoken audio.
 */
export default function VoiceBookingModal({
  isOpen,
  onClose,
  onConfirmBooking,
  defaultMandi,
  farmerName = 'Mahesh Borde',
  farmerPhone = '9876543210',
  farmerCoords,
  pickupLocation,
  onRequestPickupLocation,
  hasActiveBooking,
  activeToken
}) {
  // Session & Step State
  const [language, setLanguage] = useState('mr'); // 'mr' | 'hi' | 'en'
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4);
  const [fieldTitle, setFieldTitle] = useState('Procurement Centre');
  const [questionText, setQuestionText] = useState('');
  const [collectedData, setCollectedData] = useState({});
  const [transcript, setTranscript] = useState('');
  const [clarification, setClarification] = useState(null);

  // Conversational Interaction State:
  // 'INITIALIZING' | 'ASSISTANT_SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED'
  const [convState, setConvState] = useState('INITIALIZING');
  const [audioError, setAudioError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualText, setManualText] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);

  // Result state
  const [completedResult, setCompletedResult] = useState(null);

  // Refs
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const isComponentMountedRef = useRef(true);
  const hardSafetyTimeoutRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const lastSpokenTimeRef = useRef(0);

  const LANGUAGES = [
    { code: 'mr', name: 'मराठी', label: 'Marathi', voiceCode: 'mr-IN' },
    { code: 'hi', name: 'हिन्दी', label: 'Hindi', voiceCode: 'hi-IN' },
    { code: 'en', name: 'English', label: 'English', voiceCode: 'en-IN' }
  ];

  // Quick utterance suggestions for instant demo / tap fallback
  const SUGGESTED_RESPONSES = {
    centre: [
      { mr: 'कोपरगाव बाजार समिती', hi: 'कोपरगांव मंडी', en: 'APMC Kopargaon' },
      { mr: 'शिर्डी कृषी केंद्र', hi: 'शिर्डी मंडी', en: 'APMC Shirdi' },
      { mr: 'राहाता बाजार समिती', hi: 'राहाता मंडी', en: 'APMC Rahata' },
      { mr: 'वैजापूर मंडी', hi: 'वैजापुर मंडी', en: 'APMC Vaijapur' }
    ],
    crop: [
      { mr: 'सोयाबीन', hi: 'सोयाबीन', en: 'Soybean' },
      { mr: 'कापूस', hi: 'कपास', en: 'Cotton' },
      { mr: 'गहू', hi: 'गेहूं', en: 'Wheat' },
      { mr: 'कांदा', hi: 'प्याज', en: 'Onion' }
    ],
    quantity: [
      { mr: 'पंचवीस क्विंटल', hi: 'पच्चीस क्विंटल', en: '25 Quintals' },
      { mr: 'पन्नास क्विंटल', hi: 'पचास क्विंटल', en: '50 Quintals' },
      { mr: 'दहा क्विंटल', hi: 'दस क्विंटल', en: '10 Quintals' },
      { mr: 'शंभर क्विंटल', hi: 'सौ क्विंटल', en: '100 Quintals' }
    ],
    slot: [
      { mr: 'उद्या सकाळी', hi: 'कल सुबह', en: 'Tomorrow morning' },
      { mr: 'आज दुपारी', hi: 'आज दोपहर', en: 'Today midday' },
      { mr: 'उद्या दुपारी', hi: 'कल दोपहर', en: 'Tomorrow afternoon' }
    ]
  };

  // ─── Browser Native / Steerable Gemini TTS Audio Player ───────────────────
  const speakText = useCallback((text, stepNum = 1, langCode = language, audioUrlOverride = null, onComplete = () => {}) => {
    if (!text || typeof window === 'undefined') {
      onComplete();
      return;
    }

    setConvState('ASSISTANT_SPEAKING');

    // Cancel any ongoing audio or speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
    }

    let completed = false;
    const handleSpeechEnd = () => {
      if (!completed) {
        completed = true;
        if (isComponentMountedRef.current) {
          onComplete();
        }
      }
    };

    // Helper for Web Speech Synthesis fallback
    const fallbackWebSpeech = () => {
      if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode === 'mr' ? 'mr-IN' : langCode === 'hi' ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find((v) =>
          v.lang === utterance.lang || v.lang.startsWith(langCode)
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        utterance.onend = handleSpeechEnd;
        utterance.onerror = (e) => {
          console.warn('[VoiceBooking] Speech synthesis error:', e);
          handleSpeechEnd();
        };

        try {
          window.speechSynthesis.speak(utterance);
          const words = text.split(' ').length;
          const estimatedDurationMs = Math.max(2500, words * 450);
          setTimeout(handleSpeechEnd, estimatedDurationMs + 1000);
          return;
        } catch (e) {
          console.warn('[VoiceBooking] SpeechSynthesis speak exception:', e);
        }
      }
      handleSpeechEnd();
    };

    // Attempt 1: Steerable Gemini TTS from backend audio endpoint / pre-rendered sample
    try {
      const audioUrl = audioUrlOverride || (sessionId
        ? voiceBookingApi.getAudioUrl(sessionId, stepNum, 'question', langCode)
        : `/tts-samples/step_${langCode}_${stepNum}.wav`);

      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = handleSpeechEnd;
      audio.onerror = () => {
        console.warn('[VoiceBooking] Audio player network error, falling back to Web Speech synthesis...');
        fallbackWebSpeech();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('[VoiceBooking] Audio play prevented/error:', e);
          fallbackWebSpeech();
        });
      }
      return;
    } catch (e) {
      console.warn('[VoiceBooking] Audio stream initialization error:', e);
      fallbackWebSpeech();
    }
  }, [language, sessionId]);

  // ─── Stop Recording Helper ───────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    // 1. Clear hard safety timeout
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }
    // 2. Clear VAD polling loop
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    // 3. Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
      audioContextRef.current = null;
    }

    // 4. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('[VoiceBooking] MediaRecorder stop error:', e);
      }
    }
  }, []);

  // ─── Microphone Recording with VAD & Hard Safety Cap ─────────────────────
  const startRecording = useCallback(async () => {
    setAudioError(null);
    setErrorMessage('');
    audioChunksRef.current = [];

    // Stop previous instance if active
    stopRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Stop all tracks to release hardware immediately
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (audioBlob.size > 0 && isComponentMountedRef.current) {
          await submitAnswer({ audioBlob, mimeType });
        }
      };

      recorder.start(250);
      setConvState('LISTENING');

      // ─── 1. Hard Safety Cap: Force-stops after 12 seconds ───
      hardSafetyTimeoutRef.current = setTimeout(() => {
        console.log('[VoiceBooking] 12s safety timeout reached. Auto-submitting audio...');
        stopRecording();
      }, 12000);

      // ─── 2. Voice Activity Detection (VAD) via Web Audio API ───
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          hasSpokenRef.current = false;
          lastSpokenTimeRef.current = Date.now();

          // Poll volume every 100ms
          vadIntervalRef.current = setInterval(() => {
            if (!isComponentMountedRef.current) return;
            analyser.getByteFrequencyData(dataArray);

            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avgVolume = sum / dataArray.length;

            const now = Date.now();
            // Human speech threshold (volume > 12 on 0-255 scale)
            if (avgVolume > 12) {
              hasSpokenRef.current = true;
              lastSpokenTimeRef.current = now;
            } else if (hasSpokenRef.current) {
              // Farmer has stopped speaking: check silence duration
              const silenceDuration = now - lastSpokenTimeRef.current;
              if (silenceDuration > 1800) {
                console.log(`[VoiceBooking] Auto-stop: ${silenceDuration}ms of silence detected after speech.`);
                stopRecording();
              }
            }
          }, 100);
        }
      } catch (vadErr) {
        console.warn('[VoiceBooking] VAD initialization skipped:', vadErr);
      }
    } catch (err) {
      console.error('[VoiceBooking] Mic access error:', err);
      setAudioError('Microphone permission required, or select an option below.');
      setConvState('LISTENING');
    }
  }, [stopRecording]);

  // ─── Start Step Interaction (Auto-Play Question -> Auto-Arm Mic) ──────────
  const triggerStepQuestion = useCallback((qText, stepNum = 1, langCode = language, audioUrl = null) => {
    stopRecording();
    setConvState('ASSISTANT_SPEAKING');
    setTranscript('');
    setClarification(null);

    // Auto-play question audio, then automatically transition to listening state
    speakText(qText, stepNum, langCode, audioUrl, () => {
      setConvState('LISTENING');
      // Auto-start recording with VAD and 12s safety cap
      startRecording().catch(() => {});
    });
  }, [language, speakText, startRecording, stopRecording]);

  // ─── Initialize Voice Session ─────────────────────────────────────────────
  const initSession = useCallback(async (langToUse = language) => {
    setConvState('INITIALIZING');
    setErrorMessage('');
    setTranscript('');
    setClarification(null);
    setCompletedResult(null);
    setCollectedData({});

    try {
      const data = await voiceBookingApi.startSession({
        language: langToUse,
        farmerName,
        phone: farmerPhone
      });

      if (data.success) {
        const initialStep = data.step || 1;
        setSessionId(data.sessionId);
        setStep(initialStep);
        setTotalSteps(data.totalSteps || 4);
        setFieldTitle(data.fieldTitle || 'Procurement Centre');
        setQuestionText(data.questionText || '');
        setCollectedData(data.collectedData || {});

        // Immediately auto-play the Step 1 question
        triggerStepQuestion(data.questionText, initialStep, langToUse, data.questionAudioUrl);
      } else {
        setErrorMessage(data.message || 'Failed to start voice booking session');
        setConvState('LISTENING');
      }
    } catch (err) {
      console.error('[VoiceBooking] Init session error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Could not connect to voice service');
      setConvState('LISTENING');
    }
  }, [farmerName, farmerPhone, language, triggerStepQuestion]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    if (isOpen) {
      initSession(language);
    } else {
      stopRecording();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    }
    return () => {
      isComponentMountedRef.current = false;
      stopRecording();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    };
  }, [isOpen]);

  // Handle language switch
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    initSession(newLang);
  };

  // ─── Submit Answer to Gemini Multimodal Engine ───────────────────────────
  const submitAnswer = async ({ audioBlob, mimeType, textAnswer }) => {
    if (!sessionId) return;
    setConvState('PROCESSING');
    setErrorMessage('');
    setClarification(null);

    try {
      const res = await voiceBookingApi.sendAnswer(sessionId, {
        audioBlob,
        mimeType,
        textAnswer
      });

      if (res.success) {
        // Update collected data using the completed field key
        if (res.extractedValue) {
          const completedField = res.completedField || getFieldKey(step);
          setCollectedData((prev) => ({
            ...prev,
            [completedField]: res.extractedValue
          }));
        }

        // ─── Case A: Clarify & Retry (Auto-play clarification audio) ───────
        if (res.retry) {
          setTranscript(res.transcript || textAnswer || '');
          setClarification({
            text: res.clarifyText,
            retriesLeft: res.retriesLeft,
            isExhausted: false
          });

          // Auto-play spoken clarification prompt with exact step number and audio URL
          speakText(res.clarifyText, step, language, res.clarifyAudioUrl, () => {
            setConvState('LISTENING');
            startRecording().catch(() => {});
          });
          return;
        }

        // ─── Case B: Retry Exhaustion -> Graceful Fallback to Type / Tap Options ───
        if (res.fallbackToManual) {
          setTranscript(res.transcript || textAnswer || '');
          setShowTypeInput(true); // Automatically expand the Type Instead box
          setErrorMessage('');
          setClarification({
            text: res.message || res.fallbackText || 'Please select below or type your answer.',
            retriesLeft: 0,
            isExhausted: true
          });

          // Spoken guidance explaining retries are exhausted and to tap or type
          const fallbackSpeech = res.message || res.fallbackText;
          speakText(fallbackSpeech, step, language, null, () => {
            setConvState('LISTENING');
          });
          return;
        }

        // ─── Case C: All 4 Steps Complete (Token Generated!) ──────────────
        if (res.complete && res.token) {
          setTranscript(res.transcript || textAnswer || '');
          setCompletedResult(res);
          setConvState('COMPLETED');

          // Celebratory confirmation spoken audio
          const victoryText = language === 'mr'
            ? 'अभिनंदन! तुमचा स्लॉट यशस्वीरित्या बुक झाला आहे.'
            : language === 'hi'
            ? 'बधाई हो! आपका स्लॉट सफलतापूर्वक बुक हो गया है.'
            : 'Congratulations! Your slot booking has been confirmed.';
          speakText(victoryText, 4, language, null, () => {});
          return;
        }

        // ─── Case D: Next Step Progression (Auto-play next question) ───────
        const nextStepNum = res.step;
        setTranscript('');
        setStep(nextStepNum);
        setFieldTitle(res.fieldTitle || 'Step');
        setQuestionText(res.nextQuestionText || '');

        // Immediately auto-play next question with exact step number and audio URL
        triggerStepQuestion(res.nextQuestionText, nextStepNum, language, res.nextQuestionAudioUrl);
      } else {
        setErrorMessage(res.message || 'Could not understand response. Please try again.');
        setConvState('LISTENING');
      }
    } catch (err) {
      console.error('[VoiceBooking] Submit answer error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Error communicating with Gemini');
      setConvState('LISTENING');
    }
  };

  const getFieldKey = (stepNum) => {
    switch (stepNum) {
      case 1: return 'centre';
      case 2: return 'crop';
      case 3: return 'quantity';
      case 4: return 'slot';
      default: return 'data';
    }
  };

  // Replay question audio manually if farmer requests
  const handleReplayAudio = () => {
    if (questionText) {
      triggerStepQuestion(questionText, step, language);
    }
  };

  // Handle finalize and close
  const handleFinishBooking = () => {
    if (completedResult?.token) {
      onConfirmBooking(completedResult.token);
    }
    onClose();
  };

  // Manual text submit
  const handleManualTextSubmit = (e) => {
    e.preventDefault();
    if (manualText.trim()) {
      submitAnswer({ textAnswer: manualText.trim() });
      setManualText('');
      setShowTypeInput(false);
    }
  };

  if (!isOpen) return null;

  const currentFieldKey = getFieldKey(step);
  const quickOptions = SUGGESTED_RESPONSES[currentFieldKey] || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-scaleIn relative flex flex-col max-h-[92vh]">
        
        {/* Top Gradient Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              convState === 'ASSISTANT_SPEAKING'
                ? 'bg-teal-500/20 border border-teal-400 text-teal-400'
                : convState === 'LISTENING'
                ? 'bg-rose-500/20 border border-rose-400 text-rose-400'
                : 'bg-emerald-500/20 border border-emerald-400 text-emerald-400'
            }`}>
              {convState === 'ASSISTANT_SPEAKING' ? (
                <Volume2 className="w-5 h-5 animate-pulse" />
              ) : convState === 'LISTENING' ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Voice Booking Conversation</h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <Sparkles className="w-2.5 h-2.5" /> Hands-Free AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Auto-Speaks · Auto-Listens</p>
            </div>
          </div>

          {/* Language Switcher Pills */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleLanguageChange(l.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    language === l.code
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {convState === 'INITIALIZING' ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Starting voice conversation in {language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English'}…</p>
            </div>
          ) : completedResult ? (
            /* ─── SUCCESS / COMPLETED TOKEN VIEW ─── */
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 font-black">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h4 className="text-xl font-black text-white">
                  {language === 'mr' ? 'स्लॉट यशस्वीरित्या बुक झाला!' : language === 'hi' ? 'स्लॉट सफलतापूर्वक बुक हो गया!' : 'Slot Booked Successfully!'}
                </h4>
                <p className="text-xs text-emerald-400 font-semibold">
                  {language === 'mr' ? 'तुमचे टोकन तयार झाले आहे' : 'Official APMC Queue Token Generated'}
                </p>
              </div>

              {/* Token Card */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Token Number</span>
                    <p className="text-lg font-mono font-black text-emerald-400">{completedResult.token?.tokenNumber || completedResult.token?.id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Queue Position</span>
                    <p className="text-lg font-mono font-black text-amber-300">#{completedResult.token?.queuePosition || 1}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-emerald-400" /> Mandi Centre</span>
                    <p className="font-bold text-white">{completedResult.token?.mandiName || 'APMC Kopargaon'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5 text-emerald-400" /> Commodity & Qty</span>
                    <p className="font-bold text-white">{completedResult.token?.crop} · {completedResult.token?.quantity} Qtl</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-400" /> Slot Date & Time</span>
                    <p className="font-bold text-white">{completedResult.token?.slotDate} ({completedResult.token?.slotTime})</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Intake Channel</span>
                    <p className="font-bold text-emerald-300">Conversational AI</p>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleFinishBooking}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Ticket className="w-4 h-4" /> View Live Token HUD
              </button>
            </div>
          ) : (
            /* ─── ACTIVE CONVERSATION FLOW ─── */
            <div className="space-y-5">
              {/* Step Progress Chips */}
              <div className="grid grid-cols-4 gap-2">
                {['Mandi', 'Crop', 'Quantity', 'Slot'].map((stg, idx) => {
                  const sNum = idx + 1;
                  const isDone = sNum < step;
                  const isCurrent = sNum === step;
                  return (
                    <div
                      key={stg}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        isDone
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                          : isCurrent
                          ? 'bg-slate-800 border-emerald-400 text-white shadow-xs'
                          : 'bg-slate-800/40 border-slate-700/40 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                        {isDone ? <Check className="w-3 h-3 text-emerald-400" /> : `Step ${sNum}`}
                      </div>
                      <p className="text-[11px] font-bold truncate">{stg}</p>
                    </div>
                  );
                })}
              </div>

              {/* Question Banner with Replay Icon */}
              <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3 h-3 animate-ping text-emerald-400" /> Step {step} of {totalSteps}: {fieldTitle}
                  </span>

                  {/* Replay Button */}
                  <button
                    type="button"
                    onClick={handleReplayAudio}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-300 transition-colors bg-slate-700/60 hover:bg-slate-700 px-2.5 py-1 rounded-lg"
                    title="Replay question"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Replay</span>
                  </button>
                </div>

                <h4 className="text-base font-bold text-white leading-relaxed">
                  {questionText || 'Please speak your response...'}
                </h4>

                {clarification && (
                  <div className={`mt-2 p-2.5 border rounded-xl text-xs flex items-start gap-2 animate-fadeIn ${
                    clarification.isExhausted
                      ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                      : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                  }`}>
                    <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${clarification.isExhausted ? 'text-rose-400' : 'text-amber-400'}`} />
                    <div>
                      <p className="font-bold">
                        {clarification.isExhausted
                          ? (language === 'mr' ? 'पर्याय निवडा (पुन्हा प्रयत्न संपले):' : language === 'hi' ? 'विकल्प चुनें (प्रयास समाप्त):' : 'Select an Option (Retries Exhausted):')
                          : (language === 'mr' ? 'पुन्हा सांगा:' : language === 'hi' ? 'पुनः बताएं:' : 'Clarification:')}
                      </p>
                      <p>{clarification.text}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Central Conversational Visualizer & Turn State */}
              <div className="text-center space-y-4 py-2">
                
                {/* Visual Orb */}
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                  
                  {/* Assistant Speaking state */}
                  {convState === 'ASSISTANT_SPEAKING' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-teal-400/50 animate-ping opacity-75" />
                      <div className="absolute -inset-3 rounded-full border border-teal-400/30 animate-pulse" />
                    </>
                  )}

                  {/* Farmer Speaking / Mic Listening state */}
                  {convState === 'LISTENING' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-75" />
                      <div className="absolute -inset-3 rounded-full border border-rose-400/40 animate-pulse" />
                    </>
                  )}

                  {/* Processing with Gemini */}
                  {convState === 'PROCESSING' && (
                    <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  )}

                  {/* Interactive Mic Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (convState === 'LISTENING') {
                        stopRecording();
                      } else if (convState === 'ASSISTANT_SPEAKING') {
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        if (audioPlayerRef.current) audioPlayerRef.current.pause();
                        setConvState('LISTENING');
                        startRecording().catch(() => {});
                      } else {
                        startRecording().catch(() => {});
                      }
                    }}
                    disabled={convState === 'PROCESSING'}
                    className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all ${
                      convState === 'ASSISTANT_SPEAKING'
                        ? 'bg-gradient-to-tr from-teal-600 to-cyan-500 text-slate-950 shadow-teal-500/30'
                        : convState === 'LISTENING'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 scale-105'
                        : convState === 'PROCESSING'
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-slate-950 shadow-emerald-500/30'
                    }`}
                  >
                    {convState === 'PROCESSING' ? (
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                    ) : convState === 'ASSISTANT_SPEAKING' ? (
                      <Volume2 className="w-10 h-10 animate-pulse text-slate-950" />
                    ) : (
                      <Mic className="w-10 h-10" />
                    )}
                  </button>
                </div>

                {/* State Label & Guidance */}
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                    {convState === 'ASSISTANT_SPEAKING' ? (
                      <span className="text-teal-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                        {language === 'mr' ? 'AI सहाय्यक विचारत आहे…' : language === 'hi' ? 'AI सहायक पूछ रहा है…' : 'AI Assistant is speaking…'}
                      </span>
                    ) : convState === 'LISTENING' ? (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <Radio className="w-3 h-3 text-rose-400 animate-ping" />
                        {language === 'mr' ? 'तुमची वेळ आहे — आता बोला' : language === 'hi' ? 'आपकी बारी — अब बोलें' : 'Your turn — speak now'}
                      </span>
                    ) : convState === 'PROCESSING' ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {language === 'mr' ? 'तुमचे उत्तर तपासत आहे…' : 'Analyzing response with Gemini AI…'}
                      </span>
                    ) : null}
                  </div>

                  {/* Animated Waveform when listening */}
                  {convState === 'LISTENING' && (
                    <div className="flex items-center justify-center gap-1.5 h-6 py-1">
                      {[40, 80, 100, 60, 95, 75, 45].map((h, i) => (
                        <span
                          key={i}
                          className="w-1 bg-gradient-to-t from-rose-500 to-amber-300 rounded-full animate-pulse"
                          style={{
                            height: `${h}%`,
                            animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                            animationDelay: `${i * 0.08}s`
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {convState === 'LISTENING' && (
                    <p className="text-[11px] text-slate-400 font-medium">
                      {language === 'mr' ? 'बोलून झाल्यावर खालील बटनावर टॅप करा किंवा थांबा' : 'Speak clearly into the microphone'}
                    </p>
                  )}
                </div>

                {transcript && (
                  <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 max-w-md mx-auto">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Recognized Utterance:</span>
                    <p className="italic font-medium">"{transcript}"</p>
                  </div>
                )}

                {audioError && (
                  <p className="text-xs text-amber-400 font-medium bg-amber-950/40 p-2 rounded-lg border border-amber-500/30 max-w-md mx-auto">
                    {audioError}
                  </p>
                )}
                {errorMessage && (
                  <p className="text-xs text-rose-400 font-medium bg-rose-950/40 p-2 rounded-lg border border-rose-500/30 max-w-md mx-auto">
                    {errorMessage}
                  </p>
                )}
              </div>

              {/* Stop Speaking / Done Action Button */}
              {convState === 'LISTENING' && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{language === 'mr' ? 'बोलणे पूर्ण झाले' : language === 'hi' ? 'बोलना पूरा हुआ' : 'Done Speaking'}</span>
                  </button>
                </div>
              )}

              {/* Quick Simulated Response Chips (Tap Fallback) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Quick One-Tap Options:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTypeInput(!showTypeInput)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>{showTypeInput ? 'Hide Type Box' : 'Type instead'}</span>
                  </button>
                </div>

                {showTypeInput ? (
                  <form onSubmit={handleManualTextSubmit} className="flex gap-2 animate-fadeIn">
                    <input
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder={language === 'mr' ? 'तुमचे उत्तर येथे टाइप करा…' : 'Type your answer here…'}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {quickOptions.map((opt, i) => {
                      const text = opt[language] || opt.en;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={convState === 'PROCESSING'}
                          onClick={() => submitAnswer({ textAnswer: text })}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500/50 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Mic className="w-3 h-3 text-emerald-400" />
                          <span>{text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => initSession(language)}
              className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
              title="Restart session"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            KisanQ Multimodal Voice Assayer · Fully Conversational
          </span>
        </div>

      </div>
    </div>
  );
}
