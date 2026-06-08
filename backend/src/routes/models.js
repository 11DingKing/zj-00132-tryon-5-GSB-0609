const express = require('express');
const { getAllModels, getParameterStats } = require('../services/modelService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const models = await getAllModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/parameter-stats', async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    const { category } = req.query;
    const stats = await getParameterStats(modelId, category);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
