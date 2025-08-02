// /routes/assessmentRoutes.js

const express = require("express");
const assessmentController = require("../controller/assessmentController");
const router = express.Router();

/**
 * POST /api/assessment/analyze/:projectId
 *
 * This endpoint triggers a full analysis of the user's submitted assessment.
 * It fetches the questionnaire submission and document context, runs them
 * through the LLM, and returns a comprehensive AI readiness report.
 */
router.post("/analyze/:projectId", assessmentController.analyzeAssessment);
router.get("/report/:projectId", assessmentController.getAnalysisReport);
router.get(
  "/report/download/:projectId",
  assessmentController.downloadReportAsDocx
);
module.exports = router;
