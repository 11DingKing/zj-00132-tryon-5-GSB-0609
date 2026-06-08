const express = require('express');
const { validateReview, validateReshootSelect } = require('../middleware/validate');
const { createReview } = require('../services/reviewService');
const { selectReshootCandidate } = require('../services/reshootService');

const router = express.Router();

router.post('/', validateReview, async (req, res) => {
  try {
    const { taskId, userId, tags, rating, comment } = req.body;
    const review = await createReview(taskId, userId, tags, rating, comment);
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reshoot-candidates/:id/select', validateReshootSelect, async (req, res) => {
  try {
    const candidateId = parseInt(req.params.id);
    const { userId } = req.body;
    const result = await selectReshootCandidate(candidateId, userId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Candidate not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
