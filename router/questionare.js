const express = require("express");
const questionnaireController = require("../controller/questionareController"); // Adjust path if needed
const router = express.Router();

/**
 * GET /api/questionnaire/generate/:projectId
 * Returns auto-generated adaptive questionnaire for this project
 */
router.get(
  "/generate/:projectId",
  questionnaireController.generateQuestionnaire
);
router.get(
  "/submission/:projectId",
  questionnaireController.getSubmissionByProject
); // <-- ADD THIS

router.post("/submit", questionnaireController.submitQuestionnaire);
module.exports = router;
