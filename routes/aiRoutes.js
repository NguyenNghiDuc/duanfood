const express = require("express");

const router = express.Router();

const {
  chat,
  feedback,
  correction
} = require("../controllers/aiController");

router.post("/chat", chat);

router.post("/feedback", feedback);

router.post("/correction", correction);

module.exports = router;
