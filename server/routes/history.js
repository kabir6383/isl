const express = require('express');
const router = express.Router();
const History = require('../models/History');

// Save History (Public for now as requested)
router.post('/', async (req, res) => {
  try {
    const { text, sender } = req.body;
    // Use a fixed guest ID or just omit userId if the schema allows
    const newHistory = new History({ 
      userId: '000000000000000000000000', // Dummy guest ID
      text, 
      sender 
    });
    await newHistory.save();
    res.json(newHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get History (Public)
router.get('/', async (req, res) => {
  try {
    const history = await History.find().sort({ timestamp: -1 }).limit(50);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
