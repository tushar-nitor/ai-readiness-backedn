// models/project.js
const mongoose = require("mongoose");

let nanoid;

const ProjectSchema = new mongoose.Schema({
  projectId: { type: String, required: true, unique: true }, // Custom readable ID
  name: { type: String, required: true },
  clientName: { type: String, required: true },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

ProjectSchema.pre("validate", async function (next) {
  if (!nanoid) {
    nanoid = (await import("nanoid")).nanoid;
  }
  if (!this.projectId) {
    this.projectId = `PRJ-${nanoid(8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("Project", ProjectSchema);
