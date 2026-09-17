import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  Alert,
  Linking
} from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../utils/constants';
import voiceBookingApi from '../api/voiceBooking.api';
import OfflineBanner from './OfflineBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'mr', name: 'मराठी', label: 'Marathi' },
  { code: 'hi', name: 'हिन्दी', label: 'Hindi' },
  { code: 'en', name: 'English', label: 'English' }
];

const SUGGESTED_RESPONSES = {
  centre: [
    { mr: 'कोपरगाव बाजार समिती', hi: 'कोपरगांव मंडी', en: 'APMC Kopargaon' },
    { mr: 'शिर्डी उपबाजार समिती', hi: 'शिर्डी मंडी', en: 'APMC Shirdi' },
    { mr: 'राहाता बाजार समिती', hi: 'राहाता मंडी', en: 'APMC Rahata' },
    { mr: 'लासलगाव मुख्य बाजार समिती', hi: 'लासलगांव मंडी', en: 'APMC Lasalgaon' }
  ],
  crop: [
    { mr: 'सोयाबीन', hi: 'सोयाबीन', en: 'Soybean' },
    { mr: 'कापूस', hi: 'कपास', en: 'Cotton' },
    { mr: 'गहू', hi: 'गेहूं', en: 'Wheat' },
    { mr: 'कांदा', hi: 'प्याज', en: 'Onion' }
  ],
  quantity: [
    { mr: 'पंचवीस क्विंटल (25)', hi: 'पच्चीस क्विंटल (25)', en: '25 Quintals' },
    { mr: 'पन्नास क्विंटल (50)', hi: 'पचास क्विंटल (50)', en: '50 Quintals' },
    { mr: 'दहा क्विंटल (10)', hi: 'दस क्विंटल (10)', en: '10 Quintals' },
    { mr: 'शंभर क्विंटल (100)', hi: 'सौ क्विंटल (100)', en: '100 Quintals' }
  ],
  slot: [
    { mr: 'उद्या सकाळी (08-10)', hi: 'कल सुबह (08-10)', en: 'Tomorrow morning' },
    { mr: 'आज दुपारी (12-02)', hi: 'आज दोपहर (12-02)', en: 'Today midday' },
    { mr: 'उद्या दुपारी (02-04)', hi: 'कल दोपहर (02-04)', en: 'Tomorrow afternoon' }
  ]
};

export default function VoiceBookingModal({
  visible,
  onClose,
  onBookingConfirmed,
  farmerName = 'Farmer',
  farmerPhone = '9876543210'
}) {
  const { t, i18n } = useTranslation();
  const currentAppLang = (i18n.language && ['mr', 'hi', 'en'].includes(i18n.language)) ? i18n.language : 'mr';

  // State
  const [language, setLanguage] = useState(currentAppLang);
  const [sessionId, setSessionId] = useState(null);
  const [step, setStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(4);
  const [fieldTitle, setFieldTitle] = useState('Procurement Centre');
  const [questionText, setQuestionText] = useState('');
  const [collectedData, setCollectedData] = useState({});
  const [transcript, setTranscript] = useState('');
  const [clarification, setClarification] = useState(null);

  // Interaction State:
  // 'INITIALIZING' | 'ASSISTANT_SPEAKING' | 'LISTENING' | 'PROCESSING' | 'COMPLETED'
  const [convState, setConvState] = useState('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualText, setManualText] = useState('');
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [permissionExplaining, setPermissionExplaining] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Completed booking data
  const [completedResult, setCompletedResult] = useState(null);

  // Audio & Recording Refs
  const soundRef = useRef(null);
  const recordingRef = useRef(null);
  const isMountedRef = useRef(true);
  const hardSafetyTimeoutRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const lastSpokenTimeRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for mic
  useEffect(() => {
    let animation;
    if (convState === 'LISTENING') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true
          })
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1.0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [convState]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanupAudio();
    };
  }, []);

  // Sync language with modal prop or app
  useEffect(() => {
    if (currentAppLang && currentAppLang !== language) {
      setLanguage(currentAppLang);
    }
  }, [currentAppLang]);

  // Reset & Start Session when modal opens
  useEffect(() => {
    if (visible) {
      resetSession();
      initAudioMode();
    } else {
      cleanupAudio();
    }
  }, [visible]);

  const initAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });
      const perm = await Audio.getPermissionsAsync();
      setHasPermission(perm.granted);
    } catch (err) {
      console.warn('[VoiceBooking] Audio mode init warning:', err.message);
    }
  };

  const cleanupAudio = async () => {
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }
  };

  const resetSession = async () => {
    await cleanupAudio();
    setSessionId(null);
    setStep(1);
    setTotalSteps(4);
    setCollectedData({});
    setTranscript('');
    setClarification(null);
    setErrorMessage('');
    setManualText('');
    setShowTypeInput(false);
    setIsOffline(false);
    setCompletedResult(null);
    setConsecutiveFailures(0);
    startNewSession(language);
  };

  // ─── Start Session ─────────────────────────────────────────────────────────
  const startNewSession = async (lang) => {
    setConvState('INITIALIZING');
    setErrorMessage('');
    setIsOffline(false);

    try {
      const data = await voiceBookingApi.startSession({
        language: lang,
        farmerName,
        phone: farmerPhone
      });

      if (!isMountedRef.current) return;

      if (data && data.success) {
        setSessionId(data.sessionId);
        setStep(data.step || 1);
        setTotalSteps(data.totalSteps || 4);
        setFieldTitle(data.fieldTitle || 'Procurement Centre');
        setQuestionText(data.question);
        setCollectedData(data.collectedData || {});
        setShowTypeInput(false);
        setManualText('');
        setConsecutiveFailures(0);

        // Auto-play the first question
        speakQuestionAudio(data.sessionId, data.step || 1, 'question', lang, data.audioUrl);
      } else {
        setErrorMessage(data?.message || 'Failed to initialize voice session');
        setConvState('INITIALIZING');
      }
    } catch (err) {
      console.warn('[VoiceBooking] Start session error:', err);
      if (!isMountedRef.current) return;
      setIsOffline(true);
      setErrorMessage('Network error: Unable to connect to Voice Booking service');
      setConvState('INITIALIZING');
    }
  };

  // ─── Playback Audio with expo-av ──────────────────────────────────────────
  const speakQuestionAudio = async (sessId, stepNum, type = 'question', lang = language, directUrl = null) => {
    await cleanupAudio();
    if (!isMountedRef.current) return;

    setConvState('ASSISTANT_SPEAKING');

    const audioUrl = directUrl || voiceBookingApi.getAudioUrl(sessId, stepNum, type, lang);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (playbackStatus) => {
          if (playbackStatus.didJustFinish) {
            if (isMountedRef.current) {
              handleAudioFinished();
            }
          }
        }
      );

      soundRef.current = sound;
    } catch (err) {
      console.warn('[VoiceBooking] Audio playback error:', err.message);
      if (isMountedRef.current) {
        // If TTS playback fails on network or format, gracefully transition to listening
        handleAudioFinished();
      }
    }
  };

  const handleAudioFinished = async () => {
    try {
      const perm = await Audio.getPermissionsAsync();
      if (!isMountedRef.current) return;
      setHasPermission(perm.granted);
      setCanAskAgain(perm.canAskAgain !== false);

      if (!perm.granted) {
        setPermissionExplaining(true);
        setConvState('INITIALIZING');
        if (perm.canAskAgain === false) {
          setShowTypeInput(true);
        }
      } else {
        startRecording();
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      setPermissionExplaining(true);
      setShowTypeInput(true);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.warn('[VoiceBooking] Unable to open app settings:', err.message);
    }
  };

  // ─── Request Microphone Permission ─────────────────────────────────────────
  const requestMicPermission = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      setHasPermission(perm.granted);
      setCanAskAgain(perm.canAskAgain !== false);

      if (perm.granted) {
        setPermissionExplaining(false);
        startRecording();
      } else {
        setPermissionExplaining(true);
        if (perm.canAskAgain === false) {
          // Hard permission denial -> immediately unlock manual input
          setShowTypeInput(true);
        } else {
          Alert.alert(
            language === 'mr' ? 'मायक्रोफोन परवानगी आवश्यक' : language === 'hi' ? 'माइक्रोफ़ोन अनुमति आवश्यक' : 'Microphone Permission Required',
            language === 'mr' ? 'व्हॉईस बुकिंगसाठी मायक्रोफोन परवानगी आवश्यक आहे. कृपया परवानगी द्या किंवा खालील पर्यायातून टाईप करा.' : 'Please enable microphone access to use voice booking, or type instead.'
          );
        }
      }
    } catch (e) {
      setPermissionExplaining(true);
      setShowTypeInput(true);
    }
  };

  // ─── Start Recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    await cleanupAudio();
    if (!isMountedRef.current) return;

    try {
      setConvState('LISTENING');
      setErrorMessage('');
      hasSpokenRef.current = false;
      lastSpokenTimeRef.current = Date.now();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {}
      });

      // Status update for silence detection / VAD
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;

        if (status.metering !== undefined && status.metering > -35) {
          hasSpokenRef.current = true;
          lastSpokenTimeRef.current = Date.now();
        }

        // VAD: Auto-stop after 2 seconds of silence once speech was detected
        if (hasSpokenRef.current && (Date.now() - lastSpokenTimeRef.current > 2000)) {
          if (isMountedRef.current && convState === 'LISTENING') {
            stopRecordingAndSubmit();
          }
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // Hard safety timeout: 12 seconds cap
      hardSafetyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && recordingRef.current) {
          console.log('[VoiceBooking] Hard safety timeout (12s) reached. Stopping recording.');
          stopRecordingAndSubmit();
        }
      }, 12000);
    } catch (err) {
      console.warn('[VoiceBooking] Start recording error:', err);
      if (isMountedRef.current) {
        setErrorMessage('Could not access microphone. You can type instead.');
        setShowTypeInput(true);
        setConvState('INITIALIZING');
      }
    }
  };

  // ─── Stop Recording & Submit ───────────────────────────────────────────────
  const stopRecordingAndSubmit = async () => {
    if (hardSafetyTimeoutRef.current) {
      clearTimeout(hardSafetyTimeoutRef.current);
      hardSafetyTimeoutRef.current = null;
    }

    if (!recordingRef.current) return;

    try {
      setConvState('PROCESSING');
      const rec = recordingRef.current;
      recordingRef.current = null;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      if (!uri) {
        throw new Error('No audio recording found');
      }

      submitAnswerToBackend({ audioUri: uri, mimeType: 'audio/m4a', language });
    } catch (err) {
      console.warn('[VoiceBooking] Stop recording error:', err);
      if (isMountedRef.current) {
        await cleanupAudio();
        setErrorMessage('Failed to capture audio. Please try again or type.');
        setConvState('INITIALIZING');
      }
    }
  };

  // ─── Submit Manual Text Answer ─────────────────────────────────────────────
  const submitTextAnswer = (textToSubmit = manualText) => {
    const text = (textToSubmit || '').trim();
    if (!text) return;
    submitAnswerToBackend({ textAnswer: text, language });
  };

  // ─── Backend Communication & State Handling ──────────────────────────────
  const submitAnswerToBackend = async (payload) => {
    if (!sessionId) {
      setErrorMessage('Active session not found. Restarting...');
      startNewSession(language);
      return;
    }

    const payloadWithLang = {
      language,
      ...payload
    };

    setConvState('PROCESSING');
    setErrorMessage('');
    setIsOffline(false);

    try {
      console.log(`[VoiceBooking] Dispatching payload to /api/voice-booking/${sessionId}/answer:`, {
        type: payloadWithLang.audioUri ? 'multipart/form-data (Native Audio Recording)' : 'textAnswer (Manual Keyed Input)',
        language: payloadWithLang.language,
        audioUri: payloadWithLang.audioUri || null,
        mimeType: payloadWithLang.mimeType || (payloadWithLang.audioUri ? 'audio/m4a' : 'text/plain'),
        textAnswer: payloadWithLang.textAnswer || null,
        activeStep: step,
        consecutiveFailures
      });

      const result = await voiceBookingApi.sendAnswer(sessionId, payloadWithLang);
      if (!isMountedRef.current) return;

      if (!result || !result.success) {
        throw new Error(result?.message || 'Processing failed');
      }

      // Update transcript if available
      if (result.rawTranscript || result.extractedValue) {
        setTranscript(result.rawTranscript || String(result.extractedValue));
      }

      if (result.collectedData) {
        setCollectedData(result.collectedData);
      }

      // 1. Flow Completion Check
      if (result.complete && (result.bookingSummary || result.token)) {
        setConsecutiveFailures(0);
        setConvState('COMPLETED');
        setCompletedResult(result.bookingSummary || result.token);
        setShowTypeInput(false);
        return;
      }

      // 2. Retry / Clarification Check
      if (result.retry || result.status === 'UNCLEAR') {
        const nextFailures = consecutiveFailures + 1;
        setConsecutiveFailures(nextFailures);
        setClarification(result.message || 'Could not understand clearly.');

        // Retry Exhaustion: 2 consecutive unclear audio submissions -> automatically flip to "Type instead"
        if (nextFailures >= 2 || result.fallbackToManual || result.retriesLeft === 0) {
          console.log(`[VoiceBooking] Retry Exhaustion Triggered: ${nextFailures} consecutive unclear answers. Automatically flipping UI to 'Type instead' manual input.`);
          setShowTypeInput(true);
        }

        // Auto-play spoken clarification audio
        speakQuestionAudio(
          sessionId,
          result.step || step,
          'clarification',
          language,
          result.audioUrl
        );
        return;
      }

      // 3. Valid Step Completed -> Auto Advance & Reset Failure Count
      if (result.status === 'VALID' || result.step) {
        setConsecutiveFailures(0); // Reset consecutive failure counter on valid response
        setStep(result.nextStepIndex || result.step);
        setFieldTitle(result.fieldTitle || 'Next Step');
        setQuestionText(result.question || '');
        setClarification(null);
        setShowTypeInput(false);
        setManualText('');

        // Auto-play the next question
        speakQuestionAudio(
          sessionId,
          result.nextStepIndex || result.step,
          'question',
          language,
          result.audioUrl
        );
      }
    } catch (err) {
      console.warn('[VoiceBooking] Answer processing error:', err);
      if (!isMountedRef.current) return;

      await cleanupAudio();

      const nextFailures = consecutiveFailures + 1;
      setConsecutiveFailures(nextFailures);
      if (nextFailures >= 2) {
        console.log(`[VoiceBooking] Retry Exhaustion on Network/Processing Error: ${nextFailures} failures. Automatically flipping UI to 'Type instead' manual mode.`);
        setShowTypeInput(true);
      }

      const isNetworkErr = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('Network');
      if (isNetworkErr) {
        setIsOffline(true);
        setErrorMessage('Network connection lost. Check connectivity or type instead.');
      } else {
        setErrorMessage(err.response?.data?.message || err.message || 'Error processing response. You can type instead.');
      }
      setConvState('INITIALIZING');
    }
  };

  // ─── Change Language ───────────────────────────────────────────────────────
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    startNewSession(newLang);
  };

  // ─── Confirm Booking & Close ───────────────────────────────────────────────
  const handleConfirmFinalBooking = () => {
    if (onBookingConfirmed && completedResult) {
      onBookingConfirmed(completedResult, collectedData);
    }
    onClose();
  };

  // UI Helper strings
  const getFieldKey = () => {
    if (step === 1) return 'centre';
    if (step === 2) return 'crop';
    if (step === 3) return 'quantity';
    if (step === 4) return 'slot';
    return 'centre';
  };

  const currentFieldSuggestions = SUGGESTED_RESPONSES[getFieldKey()] || [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleWithIcon}>
              <View style={styles.micBadge}>
                <Text style={{ fontSize: 18 }}>🎙️</Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>
                  {language === 'mr' ? 'स्मार्ट व्हॉईस बुकिंग' : language === 'hi' ? 'स्मार्ट वॉयस बुकिंग' : 'Smart Voice Booking'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {language === 'mr' ? 'फक्त बोला आणि टोकन मिळवा' : language === 'hi' ? 'बस बोलिए और टोकन पाइए' : 'Speak naturally to book your slot'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Language Selector */}
          <View style={styles.langRow}>
            {LANGUAGES.map((item) => {
              const active = item.code === language;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.langChip, active && styles.langChipActive]}
                  onPress={() => handleLanguageChange(item.code)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                    {item.name} ({item.label})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Offline Banner if disconnected */}
          {isOffline && (
            <OfflineBanner
              onRetry={() => {
                setIsOffline(false);
                if (!sessionId) {
                  startNewSession(language);
                } else {
                  speakQuestionAudio(sessionId, step, 'question', language);
                }
              }}
              message={
                language === 'mr'
                  ? 'इंटरनेट कनेक्शन नाही. कृपया नेटवर्क तपासा.'
                  : language === 'hi'
                  ? 'इंटरनेट कनेक्शन नहीं है। कृपया नेटवर्क जांचें।'
                  : 'No internet connection. Please check your network.'
              }
            />
          )}

          <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Step Progress Indicators */}
            {convState !== 'COMPLETED' && (
              <View style={styles.stepProgressContainer}>
                <View style={styles.stepDotsRow}>
                  {[1, 2, 3, 4].map((s) => {
                    const isDone = s < step;
                    const isCurrent = s === step;
                    return (
                      <View key={s} style={styles.stepDotWrapper}>
                        <View
                          style={[
                            styles.stepDot,
                            isDone && styles.stepDotDone,
                            isCurrent && styles.stepDotCurrent
                          ]}
                        >
                          <Text style={[styles.stepDotText, (isDone || isCurrent) && styles.stepDotTextActive]}>
                            {isDone ? '✓' : s}
                          </Text>
                        </View>
                        {s < 4 && (
                          <View
                            style={[
                              styles.stepLine,
                              isDone && styles.stepLineDone
                            ]}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.stepTitleLabel}>
                  {language === 'mr' ? `टप्पा ${step}/४: ${fieldTitle}` : language === 'hi' ? `चरण ${step}/४: ${fieldTitle}` : `Step ${step}/4: ${fieldTitle}`}
                </Text>
              </View>
            )}

            {/* In-App Pre-Permission Prompt Dialog */}
            {permissionExplaining && (
              <View style={styles.permissionCard}>
                <Text style={styles.permissionIcon}>🎙️</Text>
                <Text style={styles.permissionTitle}>
                  {language === 'mr' ? 'मायक्रोफोन परवानगी आवश्यक' : language === 'hi' ? 'माइक्रोफ़ोन अनुमति आवश्यक' : 'Microphone Access Required'}
                </Text>
                <Text style={styles.permissionText}>
                  {language === 'mr'
                    ? 'आपल्या आवाजाने थेट मराठी/हिंदीत माहिती भरण्यासाठी मायक्रोफोन परवानगी आवश्यक आहे. आपण थेट उत्तर टाईप देखील करू शकता.'
                    : language === 'hi'
                    ? 'अपनी आवाज़ से सीधे बुकिंग करने के लिए माइक्रोफ़ोन एक्सेस की आवश्यकता है। आप उत्तर टाइप भी कर सकते हैं।'
                    : 'KisanQ requires microphone access to transcribe your spoken answers into booking details. You can also choose to type manually.'}
                </Text>
                <View style={styles.permissionBtnRow}>
                  {canAskAgain !== false ? (
                    <TouchableOpacity style={styles.grantPermBtn} onPress={requestMicPermission} activeOpacity={0.8}>
                      <Text style={styles.grantPermBtnText}>
                        {language === 'mr' ? '🎙️ परवानगी द्या / Allow' : language === 'hi' ? '🎙️ अनुमति दें / Allow' : '🎙️ Grant Permission'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.grantPermBtn} onPress={handleOpenSettings} activeOpacity={0.8}>
                      <Text style={styles.grantPermBtnText}>
                        {language === 'mr' ? '⚙️ सेटिंग्ज उघडा / Open Settings' : language === 'hi' ? '⚙️ सेटिंग्स खोलें / Open Settings' : '⚙️ Open App Settings'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.typeInsteadPermBtn}
                    onPress={() => {
                      setPermissionExplaining(false);
                      setShowTypeInput(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeInsteadPermBtnText}>
                      {language === 'mr' ? '⌨️ टाईप करा / Type Instead' : language === 'hi' ? '⌨️ टाइप करें / Type Instead' : '⌨️ Type Instead'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* COMPLETED State: Booking Summary Card */}
            {convState === 'COMPLETED' ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryBadge}>
                  <Text style={{ fontSize: 32 }}>🎉</Text>
                  <Text style={styles.summaryTitle}>
                    {language === 'mr' ? 'नोंदणी तपशील तयार आहेत!' : language === 'hi' ? 'बुकिंग विवरण तैयार है!' : 'Booking Summary Ready!'}
                  </Text>
                  <Text style={styles.summarySubtitle}>
                    {language === 'mr' ? 'कृपया माहिती तपासून अंतिम टोकन पुष्टी करा.' : language === 'hi' ? 'कृपया विवरण जांचकर अंतिम टोकन की पुष्टि करें।' : 'Please review details and confirm your token.'}
                  </Text>
                </View>

                <View style={styles.summaryTable}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>🏢 {language === 'mr' ? 'बाजार समिती:' : language === 'hi' ? 'मंडी:' : 'Mandi:'}</Text>
                    <Text style={styles.summaryValue}>{collectedData.centre || collectedData.mandiName || 'APMC'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>🌱 {language === 'mr' ? 'शेतमाल:' : language === 'hi' ? 'फसल:' : 'Crop:'}</Text>
                    <Text style={styles.summaryValue}>{collectedData.crop || 'Soybean'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>⚖️ {language === 'mr' ? 'अंदाजे वजन:' : language === 'hi' ? 'मात्रा:' : 'Quantity:'}</Text>
                    <Text style={styles.summaryValue}>{collectedData.quantity ? `${collectedData.quantity} Quintals` : '25 Quintals'}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>⏰ {language === 'mr' ? 'वेळ व दिनांक:' : language === 'hi' ? 'समय स्लॉट:' : 'Time Slot:'}</Text>
                    <Text style={styles.summaryValue}>{collectedData.slot || 'Tomorrow 08:00 AM - 10:00 AM'}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.confirmFinalButton}
                  onPress={handleConfirmFinalBooking}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmFinalButtonText}>
                    {language === 'mr' ? 'टोकन बुक करा / Book Token' : language === 'hi' ? 'टोकन बुक करें / Book Token' : 'Confirm & Book Token'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.restartButton}
                  onPress={() => startNewSession(language)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.restartButtonText}>
                    {language === 'mr' ? '🔄 पुन्हा नव्याने बोला' : language === 'hi' ? '🔄 फिर से बोलें' : '🔄 Start Over'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ACTIVE STEP INTERACTION */
              <View>
                {/* Question Prompt Bubble */}
                <View style={styles.questionBubble}>
                  <View style={styles.bubbleHeader}>
                    <Text style={styles.assistantTag}>
                      🤖 {language === 'mr' ? 'किसान सहाय्यक विचारत आहे:' : language === 'hi' ? 'किसान सहायक पूछ रहा है:' : 'Kisan Assistant:'}
                    </Text>
                    {convState === 'ASSISTANT_SPEAKING' && (
                      <View style={styles.speakingIndicator}>
                        <ActivityIndicator size="small" color="#16a34a" />
                        <Text style={styles.speakingText}>
                          {language === 'mr' ? 'ऑडिओ बोलत आहे...' : language === 'hi' ? 'ऑडियो बोल रहा है...' : 'Speaking...'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.questionText}>
                    {questionText || (language === 'mr' ? 'कृपया प्रतीक्षा करा...' : 'Please wait...')}
                  </Text>
                </View>

                {/* Clarification Alert if unclear */}
                {clarification && (
                  <View style={styles.clarificationBox}>
                    <Text style={styles.clarificationIcon}>⚠️</Text>
                    <Text style={styles.clarificationText}>{clarification}</Text>
                  </View>
                )}

                {/* Live Mic Pulsing & Action Area */}
                <View style={styles.micArea}>
                  {convState === 'ASSISTANT_SPEAKING' && (
                    <View style={styles.assistantSpeakingCard}>
                      <Text style={styles.soundWaveIcon}>🔊</Text>
                      <Text style={styles.stateCaption}>
                        {language === 'mr' ? 'प्रश्न ऐका... यानंतर मायक्रोफोन आपोआप सुरू होईल' : language === 'hi' ? 'प्रश्न सुनें... इसके बाद माइक अपने आप शुरू होगा' : 'Listening to question... mic will start automatically'}
                      </Text>
                      <TouchableOpacity
                        style={styles.skipToMicBtn}
                        onPress={() => {
                          cleanupAudio();
                          startRecording();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.skipToMicBtnText}>
                          {language === 'mr' ? 'थेट बोला ▶' : language === 'hi' ? 'सीधे बोलें ▶' : 'Skip & Speak ▶'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {convState === 'LISTENING' && (
                    <View style={styles.listeningCard}>
                      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                        <TouchableOpacity
                          style={styles.bigMicButton}
                          onPress={stopRecordingAndSubmit}
                          activeOpacity={0.9}
                        >
                          <Text style={{ fontSize: 38 }}>🎙️</Text>
                        </TouchableOpacity>
                      </Animated.View>
                      <Text style={styles.listeningTitle}>
                        {language === 'mr' ? 'आता बोला... (आम्ही ऐकत आहोत)' : language === 'hi' ? 'अब बोलिए... (हम सुन रहे हैं)' : 'Your turn — speak now...'}
                      </Text>
                      <Text style={styles.listeningHint}>
                        {language === 'mr' ? 'बोलणे झाल्यावर खालील बटण दाबा किंवा थांबा' : language === 'hi' ? 'बोलने के बाद नीचे बटन दबाएं या रुकें' : 'Tap below when finished speaking or pause'}
                      </Text>
                      <TouchableOpacity
                        style={styles.finishSpeakingBtn}
                        onPress={stopRecordingAndSubmit}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.finishSpeakingBtnText}>
                          {language === 'mr' ? '✓ बोलणे पूर्ण झाले' : language === 'hi' ? '✓ बोलना पूरा हुआ' : '✓ Done Speaking'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {convState === 'PROCESSING' && (
                    <View style={styles.processingCard}>
                      <ActivityIndicator size="large" color="#16a34a" style={{ marginBottom: 12 }} />
                      <Text style={styles.processingTitle}>
                        {language === 'mr' ? 'आवाज तपासत आहे...' : language === 'hi' ? 'आवाज़ की जांच हो रही है...' : 'Gemini AI Processing...'}
                      </Text>
                      <Text style={styles.processingSubtitle}>
                        {language === 'mr' ? 'कृपया थोडा वेळ थांबा' : language === 'hi' ? 'कृपया कुछ क्षण रुकें' : 'Extracting your booking details'}
                      </Text>
                    </View>
                  )}

                  {convState === 'INITIALIZING' && !permissionExplaining && (
                    <View style={styles.idleCard}>
                      <TouchableOpacity
                        style={styles.restartTurnBtn}
                        onPress={() => speakQuestionAudio(sessionId, step, 'question', language)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.restartTurnBtnText}>
                          {language === 'mr' ? '🔊 प्रश्न पुन्हा ऐका' : language === 'hi' ? '🔊 प्रश्न फिर से सुनें' : '🔊 Replay Question'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.restartTurnBtn, { backgroundColor: '#16a34a', marginTop: 8 }]}
                        onPress={startRecording}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.restartTurnBtnText, { color: '#ffffff' }]}>
                          {language === 'mr' ? '🎙️ आता बोला' : language === 'hi' ? '🎙️ अब बोलें' : '🎙️ Speak Now'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Error message */}
                {errorMessage !== '' && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                  </View>
                )}

                {/* Live Transcript / Recognized Answer */}
                {transcript !== '' && (
                  <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptLabel}>
                      {language === 'mr' ? 'ओळखलेला आवाज:' : language === 'hi' ? 'पहचाना गया:' : 'Heard:'}
                    </Text>
                    <Text style={styles.transcriptValue}>"{transcript}"</Text>
                  </View>
                )}

                {/* Quick Utterance Suggestions / Tap Assist */}
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>
                    💡 {language === 'mr' ? 'जलद पर्याय (टॅप करू शकता):' : language === 'hi' ? 'त्वरित विकल्प (टैप कर सकते हैं):' : 'Quick Options (tap to answer):'}
                  </Text>
                  <View style={styles.suggestionChipsRow}>
                    {currentFieldSuggestions.map((item, idx) => {
                      const textLabel = item[language] || item.mr || item.en;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={styles.suggestionChip}
                          onPress={() => submitTextAnswer(textLabel)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.suggestionChipText}>{textLabel}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* "Type Instead" Fallback Input */}
                <View style={styles.typeInsteadContainer}>
                  {!showTypeInput ? (
                    <TouchableOpacity
                      style={styles.typeInsteadToggle}
                      onPress={() => setShowTypeInput(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.typeInsteadToggleText}>
                        ⌨️ {language === 'mr' ? 'टाईप करायचे आहे का? (Type instead)' : language === 'hi' ? 'टाइप करना चाहते हैं? (Type instead)' : 'Prefer to type instead?'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.typeInputBox}>
                      <Text style={styles.typeInputLabel}>
                        {language === 'mr' ? 'उत्तर टाईप करा:' : language === 'hi' ? 'उत्तर टाइप करें:' : 'Type answer for this field:'}
                      </Text>
                      <View style={styles.typeInputRow}>
                        <TextInput
                          style={styles.typeTextInput}
                          placeholder={language === 'mr' ? 'उदा. कोपरगाव, सोयाबीन, 25...' : 'e.g. Kopargaon, Soybean, 25...'}
                          value={manualText}
                          onChangeText={setManualText}
                          placeholderTextColor="#94a3b8"
                        />
                        <TouchableOpacity
                          style={[styles.typeSubmitBtn, !manualText.trim() && styles.typeSubmitBtnDisabled]}
                          onPress={() => submitTextAnswer()}
                          disabled={!manualText.trim()}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.typeSubmitBtnText}>➔</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '92%',
    minHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  micBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a'
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748b'
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b'
  },
  langRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6
  },
  langChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  langChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a'
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  langChipTextActive: {
    color: '#15803d',
    fontWeight: '800'
  },
  scrollArea: {
    flexGrow: 1
  },
  stepProgressContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  stepDotWrapper: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepDotDone: {
    backgroundColor: '#16a34a'
  },
  stepDotCurrent: {
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#b45309'
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b'
  },
  stepDotTextActive: {
    color: '#ffffff'
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4
  },
  stepLineDone: {
    backgroundColor: '#16a34a'
  },
  stepTitleLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  questionBubble: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  assistantTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d'
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  speakingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a'
  },
  questionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22
  },
  clarificationBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  clarificationIcon: {
    fontSize: 16,
    marginRight: 8
  },
  clarificationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    flex: 1
  },
  micArea: {
    alignItems: 'center',
    marginVertical: 10
  },
  assistantSpeakingCard: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  soundWaveIcon: {
    fontSize: 32,
    marginBottom: 6
  },
  stateCaption: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 10
  },
  skipToMicBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16
  },
  skipToMicBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  listeningCard: {
    alignItems: 'center',
    width: '100%'
  },
  pulseCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  bigMicButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6
  },
  listeningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 2
  },
  listeningHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12
  },
  finishSpeakingBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  finishSpeakingBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  processingCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    width: '100%'
  },
  processingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803d'
  },
  processingSubtitle: {
    fontSize: 11,
    color: '#64748b'
  },
  idleCard: {
    alignItems: 'center',
    width: '100%'
  },
  restartTurnBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    width: '80%',
    alignItems: 'center'
  },
  restartTurnBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6
  },
  errorText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600'
  },
  transcriptBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 6
  },
  transcriptValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1
  },
  suggestionsContainer: {
    marginTop: 8,
    marginBottom: 10
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6
  },
  suggestionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  suggestionChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155'
  },
  typeInsteadContainer: {
    marginTop: 4,
    marginBottom: 10
  },
  typeInsteadToggle: {
    alignItems: 'center',
    paddingVertical: 6
  },
  typeInsteadToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a'
  },
  typeInputBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  typeInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6
  },
  typeInputRow: {
    flexDirection: 'row',
    gap: 6
  },
  typeTextInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a'
  },
  typeSubmitBtn: {
    backgroundColor: '#16a34a',
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  typeSubmitBtnDisabled: {
    backgroundColor: '#94a3b8'
  },
  typeSubmitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  permissionCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12
  },
  permissionIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 4
  },
  permissionText: {
    fontSize: 11,
    color: '#1e3a8a',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16
  },
  permissionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4
  },
  grantPermBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  grantPermBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  typeInsteadPermBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14
  },
  typeInsteadPermBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700'
  },
  summaryCard: {
    paddingVertical: 8
  },
  summaryBadge: {
    alignItems: 'center',
    marginBottom: 14
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803d',
    marginTop: 6
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center'
  },
  summaryTable: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    gap: 8
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a'
  },
  confirmFinalButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  confirmFinalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  restartButton: {
    paddingVertical: 8,
    alignItems: 'center'
  },
  restartButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b'
  }
});
