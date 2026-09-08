const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');

router.get('/live/:centreId', queueController.getLiveQueue);
router.post('/token', queueController.generateToken);

module.exports = router;
