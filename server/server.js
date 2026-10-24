const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Feedback = require('./models/FeedBack');
const ActionTicket = require('./models/ActionTickets');
const User = require('./models/User');
const { authenticate, createSession, hashPassword, hashSessionToken, verifyPassword } = require('./auth');
const Session = require('./models/Session');

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));

// Connect to MongoDB Database
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hotel_feedback_db')
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-32 characters using letters, numbers, dots, underscores, or hyphens',
      });
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 128) {
      return res.status(400).json({ success: false, message: 'Password must be 8-128 characters' });
    }

    const user = await User.create({ username: normalizedUsername, passwordHash: await hashPassword(password) });
    const session = await createSession(user._id);
    res.status(201).json({
      success: true,
      data: { token: session.token, user: { id: user._id, username: user.username } },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'That username is already in use' });
    }
    res.status(500).json({ success: false, message: 'Unable to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      if (!user) await hashPassword(password);
      return res.status(401).json({ success: false, message: 'Incorrect username or password' });
    }

    const session = await createSession(user._id);
    res.status(200).json({
      success: true,
      data: { token: session.token, user: { id: user._id, username: user.username } },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to sign in' });
  }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    await Session.deleteOne({ tokenHash: req.auth.tokenHash });
    res.status(200).json({ success: true, message: 'Signed out' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to sign out' });
  }
});

app.use('/api', authenticate);

// 1. WRITE Operation: Create a new feedback entry (POST)
app.post('/api/feedback', async (req, res) => {
  try {
    const { guestName, source, rating, comment, sentiment, departmentTag } = req.body;
    if (!guestName?.trim() || !source || !Number.isInteger(rating) || !comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'guestName, source, integer rating, and comment are required',
      });
    }

    const newFeedback = new Feedback({
      guestName: guestName.trim(),
      source,
      rating,
      comment: comment.trim(),
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

// 2. WRITE Operation: Create an action ticket for existing feedback (POST)
app.post('/api/action-tickets', async (req, res) => {
  try {
    const { feedbackId, assignedTo, issueDescription, priority } = req.body;
    if (!mongoose.isValidObjectId(feedbackId)) {
      return res.status(400).json({ success: false, message: 'A valid feedbackId is required' });
    }
    if (!assignedTo?.trim() || !issueDescription?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'assignedTo and issueDescription are required',
      });
    }

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    const ticket = await ActionTicket.create({
      feedbackId,
      assignedTo: assignedTo.trim(),
      issueDescription: issueDescription.trim(),
      priority,
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/action-tickets', async (req, res) => {
  try {
    const tickets = await ActionTicket.find()
      .populate('feedbackId')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. READ Operation: Fetch feedback entries, optionally filtered by source or rating.
app.get('/api/feedback', async (req, res) => {
  try {
    const { source, rating } = req.query;
    const query = {};

    if (source) query.source = source;
    if (rating) query.rating = Number(rating);

    const feedbacks = await Feedback.find(query)
      .populate({ path: 'actionTickets', options: { sort: { createdAt: -1 } } })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: feedbacks.length, data: feedbacks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. READ Operation: Fetch one feedback entry by its database id (GET)
app.get('/api/feedback/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback id' });
    }

    const feedback = await Feedback.findById(req.params.id).populate('actionTickets');
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. UPDATE Operation: Update an existing feedback entry (PUT)
app.put('/api/feedback/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback id' });
    }

    const allowedFields = ['guestName', 'source', 'rating', 'comment', 'sentiment', 'departmentTag'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => allowedFields.includes(field)),
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one feedback field is required' });
    }
    if (updates.guestName !== undefined) updates.guestName = updates.guestName.trim();
    if (updates.comment !== undefined) updates.comment = updates.comment.trim();
    if (updates.rating !== undefined) {
      if (!Number.isInteger(updates.rating)) {
        return res.status(400).json({ success: false, message: 'rating must be an integer' });
      }
      updates.isActionRequired = updates.rating <= 2;
    }

    const feedback = await Feedback.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 5. UPDATE Operation: Update an action ticket (PUT)
app.put('/api/action-tickets/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid action ticket id' });
    }

    const allowedFields = ['assignedTo', 'issueDescription', 'priority', 'status'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([field]) => allowedFields.includes(field)),
    );
    if (updates.assignedTo !== undefined) updates.assignedTo = updates.assignedTo.trim();
    if (updates.issueDescription !== undefined) updates.issueDescription = updates.issueDescription.trim();
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one ticket field is required' });
    }

    const ticket = await ActionTicket.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Action ticket not found' });
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/api/feedback/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback id' });
    }

    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    await ActionTicket.deleteMany({ feedbackId: req.params.id });
    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/action-tickets/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid action ticket id' });
    }

    const ticket = await ActionTicket.findByIdAndDelete(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Action ticket not found' });
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
