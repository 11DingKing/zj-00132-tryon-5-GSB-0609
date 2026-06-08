const express = require('express');
const { getAllSkus } = require('../services/skuService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const skus = await getAllSkus();
    res.json(skus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
