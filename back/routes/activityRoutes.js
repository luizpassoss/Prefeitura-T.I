const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

router.get('/', activityController.listRecentActions);
router.post('/', activityController.createRecentAction);

module.exports = router;
