const express = require('express');
const router = express.Router();
const multer = require('multer');
const voiceBookingService = require('../services/voiceBookingService');
const logger = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Configure multer memory storage for audio file uploads (WAV, WebM, MP4, AAC, OGG)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * @route   POST /api/voice-booking/start
 * @desc    Initialize a voice-based booking session
 * @access  Public (Farmer)
 */
router.post('/start', async (req, res) => {
  try {
    const { farmerId, phone, farmerName, language = 'mr' } = req.body;

    const sessionData = await voiceBookingService.startSession({
      farmerId: farmerId || req.user?.id,
      phone: phone || req.user?.phone,
      farmerName: farmerName || req.user?.name,
      language
    });

    logger.info(`[VoiceBooking] Started session ${sessionData.sessionId} in language '${language}'`);

    return res.status(200).json({
      success: true,
      ...sessionData
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Start session error: ${error.message}`);
    return errorResponse(res, error.message, 500);
  }
});

/**
 * @route   POST /api/voice-booking/:sessionId/answer
 * @desc    Submit spoken audio or text answer for current step
 * @access  Public (Farmer)
 */
router.post('/:sessionId/answer', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { textAnswer, mimeType: bodyMimeType, audioBase64, language } = req.body;

    let audioBuffer = null;
    let mimeType = bodyMimeType || 'audio/webm';

    if (req.file && req.file.buffer) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || mimeType;
    } else if (audioBase64) {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    }

    // Call service to process answer
    const result = await voiceBookingService.processAnswer(sessionId, {
      audioBuffer,
      mimeType,
      textAnswer,
      language
    });

    logger.info(`[VoiceBooking] Processed answer for session ${sessionId} (Step ${result.step}, Complete: ${result.complete || false}, Retry: ${result.retry || false})`);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error(`[VoiceBooking] Process answer error: ${error.message}`);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/voice-booking/:sessionId/audio/:step
 * @desc    Serve generated question or clarification audio via steerable Gemini TTS
 * @access  Public
 */
router.get('/:sessionId/audio/:step', async (req, res) => {
  try {
    const { sessionId, step } = req.params;
    const { type = 'question', lang } = req.query;

    const audioBuffer = await voiceBookingService.getStepAudio(sessionId, step, type, lang);

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes'
    });

    return res.send(audioBuffer);
  } catch (error) {
    logger.error(`[VoiceBooking] Audio stream error: ${error.message}`);
    return res.status(404).send('Audio not found');
  }
});

/**
 * @route   GET /api/voice-booking/tts
 * @desc    Direct steerable Gemini TTS synthesis for custom text
 * @access  Public
 */
router.get('/tts', async (req, res) => {
  try {
    const { text, lang = 'mr', voice } = req.query;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Missing text parameter' });
    }

    const audioBuffer = await voiceBookingService.synthesizeTTS(text, lang, voice);
    if (!audioBuffer) {
      return res.status(500).json({ success: false, message: 'TTS synthesis failed' });
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes'
    });

    return res.send(audioBuffer);
  } catch (error) {
    logger.error(`[VoiceBooking] Direct TTS error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/voice-booking/:sessionId/status
 * @desc    Get status of an active voice booking session
 * @access  Public
 */
router.get('/:sessionId/status', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = voiceBookingService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or expired'
      });
    }

    return res.status(200).json({
      success: true,
      session: {
        sessionId: session.sessionId,
        language: session.language,
        currentStepIndex: session.currentStepIndex,
        collectedData: session.collectedData,
        expiresAt: session.expiresAt
      }
    });
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
});

module.exports = router;
