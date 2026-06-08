const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      { username: 'operator', password: hashedPassword, role: 'OPERATOR' },
      { username: 'auditor', password: hashedPassword, role: 'AUDITOR' },
      { username: 'designer', password: hashedPassword, role: 'DESIGNER' },
    ],
  });

  await prisma.model.createMany({
    data: [
      {
        name: '模特 A - 甜美风格',
        avatarUrl: 'https://picsum.photos/seed/model1/200/200',
        bodyData: JSON.stringify({ height: 168, weight: 48, bust: 86, waist: 60, hip: 88 }),
        styleTags: '甜美,日系,清新',
      },
      {
        name: '模特 B - 御姐风格',
        avatarUrl: 'https://picsum.photos/seed/model2/200/200',
        bodyData: JSON.stringify({ height: 175, weight: 55, bust: 90, waist: 64, hip: 92 }),
        styleTags: '御姐,欧美,时尚',
      },
    ],
  });

  await prisma.sKU.createMany({
    data: [
      {
        name: '夏季碎花连衣裙',
        category: '连衣裙',
        sizeRange: 'S-M-L',
        flatImageUrl: 'https://picsum.photos/seed/sku1/400/500',
        mock3dUrl: 'https://picsum.photos/seed/sku1-3d/400/500',
      },
      {
        name: '休闲牛仔外套',
        category: '外套',
        sizeRange: 'M-L-XL',
        flatImageUrl: 'https://picsum.photos/seed/sku2/400/500',
        mock3dUrl: 'https://picsum.photos/seed/sku2-3d/400/500',
      },
      {
        name: '商务修身衬衫',
        category: '衬衫',
        sizeRange: 'S-M-L-XL',
        flatImageUrl: 'https://picsum.photos/seed/sku3/400/500',
        mock3dUrl: 'https://picsum.photos/seed/sku3-3d/400/500',
      },
    ],
  });

  const scenes = ['WHITE', 'STREET', 'BEACH', 'STUDIO'];
  const cameraAngles = ['FRONT', 'SIDE_45', 'BACK', 'SITTING'];
  const lightings = ['SOFT', 'DRAMATIC', 'NATURAL', 'STUDIO'];
  const statuses = ['PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED', 'COMPLETED'];

  const tasks = [];
  let taskId = 1;

  for (let modelId = 1; modelId <= 2; modelId++) {
    for (let skuId = 1; skuId <= 3; skuId++) {
      for (let i = 0; i < 2; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const now = new Date();
        tasks.push({
          modelId,
          skuId,
          scene: scenes[Math.floor(Math.random() * scenes.length)],
          cameraAngle: cameraAngles[Math.floor(Math.random() * cameraAngles.length)],
          lighting: lightings[Math.floor(Math.random() * lightings.length)],
          status,
          progress: status === 'COMPLETED' ? 100 : status === 'PROCESSING' ? Math.floor(Math.random() * 60) + 20 : 0,
          resultImageUrl: status === 'COMPLETED' ? `https://picsum.photos/seed/result${taskId}/800/1000` : null,
          originalImageUrl: `https://picsum.photos/seed/original${taskId}/800/1000`,
          queuedAt: status !== 'PENDING' ? now : null,
          startedAt: ['PROCESSING', 'COMPLETED', 'FAILED'].includes(status) ? now : null,
          completedAt: status === 'COMPLETED' ? now : null,
        });
        taskId++;
      }
    }
  }

  await prisma.task.createMany({ data: tasks });

  const completedTasks = await prisma.task.findMany({ where: { status: 'COMPLETED' } });
  const reviews = [];
  const tags = ['FIT', 'SIZE_ISSUE', 'CLIPPING', 'LIGHTING_ISSUE', 'COLOR_DISTORTION'];

  for (const task of completedTasks.slice(0, 5)) {
    const rating = Math.floor(Math.random() * 3) + 3;
    const numTags = Math.floor(Math.random() * 2) + 1;
    const taskTags = [];
    for (let i = 0; i < numTags; i++) {
      taskTags.push(tags[Math.floor(Math.random() * tags.length)]);
    }
    const uniqueTags = [...new Set(taskTags)];
    reviews.push({
      taskId: task.id,
      userId: 2,
      tags: uniqueTags.join(','),
      rating,
      needsRegen: rating < 3 || taskTags.includes('CLIPPING'),
    });
  }

  if (reviews.length > 0) {
    await prisma.review.createMany({ data: reviews });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
