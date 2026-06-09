const express = require("express");
const {
  createTasks,
  enqueueTasks,
  getAllTasks,
  getTaskById,
  getReshootCandidates,
  cancelTask,
} = require("../services/taskService");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { modelIds, skuIds, scenes, cameraAngles, lightings } = req.body;
    const tasks = await createTasks(
      modelIds,
      skuIds,
      scenes,
      cameraAngles,
      lightings,
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/enqueue", async (req, res) => {
  try {
    const { taskIds } = req.body;
    const result = await enqueueTasks(taskIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const result = await cancelTask(taskId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const task = await getTaskById(parseInt(req.params.id));
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/reshoot-candidates", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const candidates = await getReshootCandidates(taskId);
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
