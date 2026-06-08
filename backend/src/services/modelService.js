const prisma = require('../shared/prisma');
const { serializeModels } = require('../helpers/serializer');

async function getAllModels() {
  const models = await prisma.model.findMany();
  return serializeModels(models);
}

async function getParameterStats(modelId, category) {
  const where = { modelId };
  if (category) where.skuCategory = category;

  const stats = await prisma.modelParameterStats.findMany({
    where,
    orderBy: [
      { selectedCount: 'desc' },
      { avgRating: 'desc' },
    ],
  });

  return stats.map(s => ({
    ...s,
    winRate: s.totalAttempts > 0 ? s.selectedCount / s.totalAttempts : 0,
  }));
}

module.exports = {
  getAllModels,
  getParameterStats,
};
