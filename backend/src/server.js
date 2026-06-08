const express = require('express');
const cors = require('cors');
const path = require('path');

const { getQueueSize } = require('./queues/taskQueue');
const tasksRouter = require('./routes/tasks');
const reviewsRouter = require('./routes/reviews');
const modelsRouter = require('./routes/models');
const skusRouter = require('./routes/skus');
const statsRouter = require('./routes/stats');
const auditLogsRouter = require('./routes/auditLogs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/tasks', tasksRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/reshoot-candidates', reviewsRouter);
app.use('/api/models', modelsRouter);
app.use('/api/skus', skusRouter);
app.use('/api/statistics', statsRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', queueSize: getQueueSize() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
