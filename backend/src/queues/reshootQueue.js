const prisma = require('../shared/prisma');

const reshootQueue = [];
let isReshootProcessing = false;

async function processReshootQueue() {
  if (isReshootProcessing || reshootQueue.length === 0) return;
  isReshootProcessing = true;

  const batch = reshootQueue.splice(0, Math.min(4, reshootQueue.length));
  console.log(`Processing reshoot batch: ${batch.map(c => c.id).join(', ')}`);

  try {
    await Promise.all(batch.map(async (candidate) => {
      await prisma.reshootCandidate.update({
        where: { id: candidate.id },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });
    }));

    const totalTime = 5000 + Math.random() * 8000;
    const steps = 10;
    const stepTime = totalTime / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepTime));
      await Promise.all(batch.map(async (candidate) => {
        await prisma.reshootCandidate.update({
          where: { id: candidate.id },
          data: { progress: i * 10 },
        });
      }));
    }

    await Promise.all(batch.map(async (candidate) => {
      const success = Math.random() > 0.05;
      await prisma.reshootCandidate.update({
        where: { id: candidate.id },
        data: {
          status: success ? 'COMPLETED' : 'FAILED',
          progress: 100,
          resultImageUrl: success ? `https://picsum.photos/seed/reshoot${candidate.id}/800/1000` : null,
          completedAt: success ? new Date() : null,
        },
      });
    }));

    console.log(`Reshoot batch completed`);
  } catch (error) {
    console.error(`Error processing reshoot batch:`, error);
  }

  isReshootProcessing = false;
  setTimeout(processReshootQueue, 500);
}

function enqueueReshootCandidate(candidate) {
  reshootQueue.push(candidate);
  processReshootQueue();
}

module.exports = {
  enqueueReshootCandidate,
};
