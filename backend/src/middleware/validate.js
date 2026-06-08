function validateReview(req, res, next) {
  const { taskId, userId, rating } = req.body;
  const errors = [];

  if (!taskId) errors.push('taskId is required');
  if (!userId) errors.push('userId is required');
  if (rating === undefined) errors.push('rating is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
}

function validateReshootSelect(req, res, next) {
  const { userId } = req.body;
  const errors = [];

  if (!userId) errors.push('userId is required');

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
}

module.exports = {
  validateReview,
  validateReshootSelect,
};
