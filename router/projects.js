const express = require("express");
const router = express.Router();
const Project = require("../models/project_schema");

// (Optional) Auth middleware can go here if you want only logged-in users

// GET /api/projects  - Get all projects
router.get("/", async (req, res) => {
  try {
    // You can limit to user's projects, or return all
    // const projects = await Project.find({ createdBy: req.user._id });
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects  - Create new project
router.post("/", async (req, res) => {
  const { name, clientName, description } = req.body;
  if (!name || !clientName) {
    return res.status(400).json({ error: "Name and Client Name required." });
  }
  try {
    const project = new Project({
      name,
      clientName,
      description,
      // createdBy: req.user._id,  // If you track owner
    });
    await project.save();
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// PUT /api/projects/:id  - Update project
router.put("/:id", async (req, res) => {
  const { name, clientName, description } = req.body;
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: { name, clientName, description } },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id  - Delete project
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

module.exports = router;
