const express = require("express");
const multer = require("multer");
const router = express.Router();
const documentController = require("../controller/document_controller");

// POST /api/documents/upload
// Accepts up to 3 files under "files" field + projectId in form-data/body

const upload = multer({
  dest: "./uploads/",
  limits: { fileSize: 20 * 1024 * 1024 }, // Max 20MB per file
});
router.post(
  "/upload",
  upload.array("files", 3),
  documentController.uploadDocuments
);
router.get("/project/:projectId", documentController.getDocumentsByProject);
router.delete("/:id", documentController.deleteDocument);

module.exports = router;
