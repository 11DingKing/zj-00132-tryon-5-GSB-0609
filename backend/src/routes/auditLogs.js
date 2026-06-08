const express = require('express');
const { getAuditLogs } = require('../services/auditLogService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const logs = await getAuditLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
