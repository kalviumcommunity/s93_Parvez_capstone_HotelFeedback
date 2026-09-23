const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Feedback = require('./models/FeedBack');

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB Database
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel_feedback_db')
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// 1. WRITE Operation: Create a new feedback entry (POST)
app.post('/api/feedback', async (req, res) => {
  try {
    const { guestName, source, rating, comment, sentiment, departmentTag } = req.body;
    const newFeedback = new Feedback({
      guestName,
      source,
      rating,
      comment,
      sentiment,
      departmentTag,
      isActionRequired: rating <= 2,
    });
    const savedFeedback = await newFeedback.save();
    res.status(201).json({ success: true, data: savedFeedback });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 2. READ Operation: Fetch all feedback entries from database (GET)
app.get('/api/feedback', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: feedbacks.length, data: feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
