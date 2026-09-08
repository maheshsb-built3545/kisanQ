const express = require('express');
const router = express.Router();
const centreController = require('../controllers/centreController');

router.get('/', centreController.getAllCentres);
router.get('/:id', centreController.getCentreById);

module.exports = router;
