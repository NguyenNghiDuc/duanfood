const express = require("express");

const router = express.Router();

const {
  chat,
  feedback,
  correction,
  search,
  combo,
  parse,
  cartCalc,
  alternatives,
  reviewAnalysis,
  showChat
} = require("../controllers/aiController");

// Render the AI chat page
router.get('/', showChat);

router.post("/chat", chat);
router.post("/feedback", feedback);
router.post("/correction", correction);
router.post("/search", search);
router.post("/combo", combo);
router.post("/parse", parse);
router.post('/cart-calc', cartCalc);

router.get('/alternatives/:id', alternatives);
router.post('/alternatives', alternatives);

router.get('/review-analysis/:id', reviewAnalysis);
router.post('/review-analysis', reviewAnalysis);

module.exports = router;
