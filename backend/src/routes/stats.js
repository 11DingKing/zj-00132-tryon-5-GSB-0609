const express = require('express');
const { getStatistics } = require('../services/statsService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
