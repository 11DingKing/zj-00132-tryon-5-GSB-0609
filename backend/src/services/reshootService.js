const prisma = require('../shared/prisma');
const { generateNeighborParams, updateModelParameterStats } = require('./paramsService');
const { enqueueReshootCandidate } = require('../queues/reshootQueue');
const { createAuditLog } = require('./auditLogService');

async function createReshootCandidates(taskId, task) {
  const reshootGroupId = `reshoot-${taskId}-${Date.now()}`;
  const candidateParams = generateNeighborParams(task, 4);

  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'RESHOOT_PENDING', progress: 0, reshootGroupId },
  });

  const candidates = await Promise.all(candidateParams.map(async (params) => {
    const candidateTask = await prisma.task.create({
      data: {
        modelId: task.modelId,
        skuId: task.skuId,
        scene: params.scene,
        cameraAngle: params.cameraAngle,
        lighting: params.lighting,
        originalImageUrl: task.originalImageUrl,
        isReshoot: true,
        reshootGroupId,
      },
    });

    const candidate = await prisma.reshootCandidate.create({
      data: {
        taskId: candidateTask.id,
        parentTaskId: taskId,
        scene: params.scene,
        cameraAngle: params.cameraAngle,
        lighting: params.lighting,
      },
    });

    return candidate;
  }));

  candidates.forEach(c => enqueueReshootCandidate(c));

  return candidates;
}

async function selectReshootCandidate(candidateId, userId) {
  const candidate = await prisma.reshootCandidate.findUnique({
    where: { id: candidateId },
    include: { parentTask: true, task: true },
  });

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  await prisma.reshootCandidate.updateMany({
    where: { parentTaskId: candidate.parentTaskId },
    data: { isSelected: false },
  });

  await prisma.reshootCandidate.update({
    where: { id: candidateId },
    data: { isSelected: true },
  });

  await prisma.task.update({
    where: { id: candidate.parentTaskId },
    data: {
      status: 'COMPLETED',
      resultImageUrl: candidate.resultImageUrl,
      scene: candidate.scene,
      cameraAngle: candidate.cameraAngle,
      lighting: candidate.lighting,
      completedAt: new Date(),
    },
  });

  const parentTask = await prisma.task.findUnique({ where: { id: candidate.parentTaskId }, include: { sku: true } });
  await updateModelParameterStats(candidate.task.modelId, parentTask.sku.category, candidate, true, 5);

  await createAuditLog(userId, 'SELECT_RESHOOT', `Selected reshoot candidate ${candidateId} for task ${candidate.parentTaskId}`);

  return { success: true };
}

module.exports = {
  createReshootCandidates,
  selectReshootCandidate,
};
