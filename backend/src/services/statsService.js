const prisma = require('../shared/prisma');

async function getStatistics() {
  const allTasks = await prisma.task.findMany({
    where: { status: 'COMPLETED' },
    include: { model: true, sku: true, reviews: true },
  });

  const modelStats = {};
  allTasks.forEach(task => {
    if (!modelStats[task.modelId]) {
      modelStats[task.modelId] = {
        modelName: task.model.name,
        total: 0,
        passed: 0,
        byCategory: {},
      };
    }
    modelStats[task.modelId].total++;
    const hasBadReview = task.reviews.some(r => r.needsRegen);
    if (!hasBadReview) modelStats[task.modelId].passed++;
    
    const cat = task.sku.category;
    if (!modelStats[task.modelId].byCategory[cat]) {
      modelStats[task.modelId].byCategory[cat] = { total: 0, passed: 0 };
    }
    modelStats[task.modelId].byCategory[cat].total++;
    if (!hasBadReview) modelStats[task.modelId].byCategory[cat].passed++;
  });

  const sceneStats = {};
  const cameraStats = {};
  allTasks.forEach(task => {
    if (!sceneStats[task.scene]) sceneStats[task.scene] = { total: 0, totalRating: 0 };
    if (!cameraStats[task.cameraAngle]) cameraStats[task.cameraAngle] = 0;
    
    sceneStats[task.scene].total++;
    cameraStats[task.cameraAngle]++;
    
    task.reviews.forEach(r => {
      sceneStats[task.scene].totalRating += r.rating;
    });
  });

  Object.keys(sceneStats).forEach(scene => {
    sceneStats[scene].avgRating = sceneStats[scene].total > 0 
      ? sceneStats[scene].totalRating / sceneStats[scene].total 
      : 0;
  });

  const monthlyStats = {};
  allTasks.forEach(task => {
    const month = task.completedAt?.toISOString().slice(0, 7) || 'Unknown';
    if (!monthlyStats[month]) monthlyStats[month] = 0;
    monthlyStats[month]++;
  });

  return {
    modelStats: Object.values(modelStats).map(s => ({
      ...s,
      passRate: s.total > 0 ? s.passed / s.total : 0,
    })),
    sceneStats,
    cameraStats,
    monthlyStats,
    totalCompleted: allTasks.length,
  };
}

module.exports = {
  getStatistics,
};
