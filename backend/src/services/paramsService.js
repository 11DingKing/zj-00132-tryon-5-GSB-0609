const prisma = require('../shared/prisma');

const SCENES = ['WHITE', 'STREET', 'BEACH', 'STUDIO'];
const CAMERA_ANGLES = ['FRONT', 'SIDE_45', 'BACK', 'SITTING'];
const LIGHTINGS = ['SOFT', 'DRAMATIC', 'NATURAL', 'STUDIO'];

function generateNeighborParams(original, count = 4) {
  const candidates = [];
  const used = new Set();
  used.add(`${original.scene}-${original.cameraAngle}-${original.lighting}`);

  const variations = [
    { scene: 0, camera: 1, lighting: 0 },
    { scene: 0, camera: -1, lighting: 0 },
    { scene: 0, camera: 0, lighting: 1 },
    { scene: 0, camera: 0, lighting: -1 },
    { scene: 1, camera: 0, lighting: 0 },
    { scene: -1, camera: 0, lighting: 0 },
    { scene: 1, camera: 1, lighting: 0 },
    { scene: 0, camera: 1, lighting: 1 },
  ];

  const sceneIdx = SCENES.indexOf(original.scene);
  const cameraIdx = CAMERA_ANGLES.indexOf(original.cameraAngle);
  const lightingIdx = LIGHTINGS.indexOf(original.lighting);

  for (const v of variations) {
    if (candidates.length >= count) break;

    const newSceneIdx = (sceneIdx + v.scene + SCENES.length) % SCENES.length;
    const newCameraIdx = (cameraIdx + v.camera + CAMERA_ANGLES.length) % CAMERA_ANGLES.length;
    const newLightingIdx = (lightingIdx + v.lighting + LIGHTINGS.length) % LIGHTINGS.length;

    const key = `${SCENES[newSceneIdx]}-${CAMERA_ANGLES[newCameraIdx]}-${LIGHTINGS[newLightingIdx]}`;
    if (!used.has(key)) {
      used.add(key);
      candidates.push({
        scene: SCENES[newSceneIdx],
        cameraAngle: CAMERA_ANGLES[newCameraIdx],
        lighting: LIGHTINGS[newLightingIdx],
      });
    }
  }

  while (candidates.length < count) {
    const newScene = SCENES[Math.floor(Math.random() * SCENES.length)];
    const newCamera = CAMERA_ANGLES[Math.floor(Math.random() * CAMERA_ANGLES.length)];
    const newLighting = LIGHTINGS[Math.floor(Math.random() * LIGHTINGS.length)];
    const key = `${newScene}-${newCamera}-${newLighting}`;
    if (!used.has(key)) {
      used.add(key);
      candidates.push({ scene: newScene, cameraAngle: newCamera, lighting: newLighting });
    }
  }

  return candidates;
}

async function updateModelParameterStats(modelId, skuCategory, params, isSelected, rating) {
  try {
    const existing = await prisma.modelParameterStats.findUnique({
      where: {
        modelId_skuCategory_scene_cameraAngle_lighting: {
          modelId,
          skuCategory,
          scene: params.scene,
          cameraAngle: params.cameraAngle,
          lighting: params.lighting,
        },
      },
    });

    if (existing) {
      const newTotal = existing.totalAttempts + 1;
      const newSelected = existing.selectedCount + (isSelected ? 1 : 0);
      const newAvgRating = ((existing.avgRating * existing.totalAttempts) + rating) / newTotal;

      await prisma.modelParameterStats.update({
        where: { id: existing.id },
        data: {
          totalAttempts: newTotal,
          selectedCount: newSelected,
          avgRating: newAvgRating,
        },
      });
    } else {
      await prisma.modelParameterStats.create({
        data: {
          modelId,
          skuCategory,
          scene: params.scene,
          cameraAngle: params.cameraAngle,
          lighting: params.lighting,
          totalAttempts: 1,
          selectedCount: isSelected ? 1 : 0,
          avgRating: rating,
        },
      });
    }
  } catch (error) {
    console.error('Error updating parameter stats:', error);
  }
}

module.exports = {
  generateNeighborParams,
  updateModelParameterStats,
  SCENES,
  CAMERA_ANGLES,
  LIGHTINGS,
};
