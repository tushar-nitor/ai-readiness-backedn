const Document = require("../models/document_schema");
const llm = require("../config/gemini");
const QuestionnaireSubmission = require("../models/questionare_schema"); // Ensure this is imported
const AnalysisReport = require("../models/analysis_report_schema"); // Ensure this is imported

// Helper: Extract relevant project/document context from uploads
async function getProjectContext(projectId) {
  // Aggregate all extracted summaries from documents in this project
  const docs = await Document.find({ projectId }).sort({ uploadedAt: -1 });
  // Concatenate or structure the summaries as a single context
  return docs
    .map((d) => d.context)
    .filter(Boolean)
    .join("\n\n");
}

// Helper: Gemini+LangChain to generate questions based on context
async function generateQuestionnaire(context) {
  const prompt = `
      You are an expert AI Readiness Assessor. Your job is to generate a targeted, multiple-choice questionnaire based on the provided document context. The answers to this questionnaire will be used to create a detailed analysis report covering four key areas.

      For each of the four areas below, generate 1-2 focused questions. For each question, extract plausible options directly from the context. If the context is missing crucial information for an area, generate questions that will help fill that gap.

      The four analysis areas are:
      1.  **Business Strategy & KPIs:** Questions about primary goals, objectives, and success metrics.
      2.  **Team & Skills:** Questions to identify the roles and stakeholders involved in the project.
      3.  **Technology Stack:** Questions to determine the software, platforms, and infrastructure being used.
      4.  **Data & Governance:** Questions about available datasets, data quality, and any existing privacy or governance policies.

      Return the entire questionnaire as a single, valid JSON array. Each object in the array must have this exact format:
      {
        "id": "a_unique_camelCase_id",
        "label": "The question you generated.",
        "options": ["Option 1 from context", "Option 2 from context"],
        "allowOther": true
      }

      Here is the document context to analyze:
      ---
      ${context}
      ---
    `;

  const response = await llm.invoke(prompt);
  try {
    return JSON.parse(response.content);
  } catch (err) {
    const match = response.content.match(/\[[\s\S]+\]/);
    return match ? JSON.parse(match[0]) : [];
  }
}

// ---- Controller Endpoint ----
exports.generateQuestionnaire = async (req, res) => {
  const { projectId } = req.params;

  try {
    // 1. Get contextual summary from your project docs
    const context = await getProjectContext(projectId);

    // 2. Generate questionnaire questions/options using LLM
    const questionnaire = await generateQuestionnaire(context);

    res.json({
      projectId,
      questionnaire,
      generatedAt: new Date(),
    });
  } catch (err) {
    console.error("Error generating questionnaire:", err);
    res.status(500).json({
      error: "Failed to generate questionnaire",
      details: err.message,
    });
  }
};

exports.getSubmissionByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ error: "Project ID is required." });
    }

    const submission = await QuestionnaireSubmission.findOne({ projectId });

    if (submission) {
      // If a submission is found, return it
      res.status(200).json({ submission });
    } else {
      // If no submission is found, return a clear null response
      // This tells the frontend to generate a new questionnaire
      res.status(200).json({ submission: null });
    }
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ error: "Failed to fetch submission." });
  }
};

// ---- UPDATED: submitQuestionnaire now handles upsert ----
exports.submitQuestionnaire = async (req, res) => {
  try {
    const { projectId, submission } = req.body;

    if (!projectId || !submission || !Array.isArray(submission)) {
      return res.status(400).json({ error: "Invalid payload." });
    }

    // Perform both database operations concurrently for efficiency
    await Promise.all([
      // 1. Delete any existing analysis report for this project.
      // This ensures the old report is cleared when new answers are submitted.
      AnalysisReport.findOneAndDelete({ projectId }),

      // 2. Update or create the questionnaire submission with the new answers.
      QuestionnaireSubmission.findOneAndUpdate(
        { projectId: projectId }, // The filter to find the document
        {
          $set: {
            submission: submission,
            submittedAt: new Date(),
          },
          $setOnInsert: { projectId: projectId }, // Set projectId only on insert
        },
        {
          upsert: true, // Creates a new doc if no match is found
          new: true, // Returns the updated doc
        }
      ),
    ]);

    res.status(201).json({
      success: true,
      message: "Assessment submitted successfully.",
    });
  } catch (error) {
    console.error("Error submitting questionnaire:", error);
    res
      .status(500)
      .json({ error: "Failed to submit assessment.", details: error.message });
  }
};
