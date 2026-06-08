const prisma = require('../shared/prisma');
const { splitTags } = require('../helpers/serializer');
const { createAuditLog } = require('./auditLogService');
const { updateModelParameterStats } = require('./paramsService');
const { createReshootCandidates } = require('./reshootService');

async function createReview(taskId, userId, tags, rating, comment) {
  const tagsArray = Array.isArray(tags) ? tags : splitTags(tags);
  const needsRegen = rating < 3 || tagsArray.includes('CLIPPING');

  const review = await prisma.review.create({
    data: { taskId, userId, tags: tagsArray.join(','), rating, comment, needsRegen },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { sku: true } });

  if (task) {
    await updateModelParameterStats(task.modelId, task.sku.category, task, false, rating);

    if (needsRegen && tagsArray.includes('CLIPPING')) {
      await createReshootCandidates(taskId, task);
    } else if (needsRegen) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'PENDING', progress: 0, resultImageUrl: null },
      });
    }
  }

  await createAuditLog(userId, 'CREATE_REVIEW', `Reviewed task ${taskId}, rating: ${rating}, needsRegen: ${needsRegen}`);

  return review;
}

module.exports = {
  createReview,
};
