const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { randomBytes, randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const Feedback = require('./models/FeedBack');
const ActionTicket = require('./models/ActionTickets');
const User = require('./models/User');
const {
  authenticate,
  createSession,
  hashPassword,
  hashSessionToken,
  verifyGoogleCredential,
  verifyPassword,
} = require('./auth');
const Session = require('./models/Session');

const app = express();
app.use(express.json({ limit: '7mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
const UPLOAD_DIRECTORY = path.join(__dirname, 'uploads');

function attachmentValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  if (typeof attachment.fileName !== 'string' || typeof attachment.data !== 'string') {
    throw attachmentValidationError('Attachment must include a file name and encoded file data');
  }

  const match = attachment.data.match(/^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw attachmentValidationError('Only PNG, JPEG, and PDF files are supported');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024 || buffer.toString('base64') !== match[2]) {
    throw attachmentValidationError('Files must be smaller than 5 MB and use valid encoding');
  }

  const signatures = [
    { contentType: 'image/png', extension: 'png', matches: buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    { contentType: 'image/jpeg', extension: 'jpg', matches: buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 },
    { contentType: 'application/pdf', extension: 'pdf', matches: buffer.subarray(0, 5).toString('ascii') === '%PDF-' },
  ];
  const detected = signatures.find((signature) => signature.matches);
  if (!detected || detected.contentType !== match[1]) {
    throw attachmentValidationError('File content does not match its declared type');
  }

  const fileName = path.basename(attachment.fileName).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255);
  if (!fileName) throw attachmentValidationError('A valid file name is required');

  return {
    buffer,
    metadata: {
      fileName,
      contentType: detected.contentType,
      storageName: `${randomUUID()}.${detected.extension}`,
    },
  };
}

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
      data: {
        token: session.token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email || null,
          displayName: user.displayName || null,
        },
      },
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
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      if (!user) await hashPassword(password);
      return res.status(401).json({ success: false, message: 'Incorrect username or password' });
    }

    const session = await createSession(user._id);
    res.status(200).json({
      success: true,
      data: {
        token: session.token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email || null,
          displayName: user.displayName || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to sign in' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const { credential } = req.body;
  if (!clientId) {
    return res.status(503).json({ success: false, message: 'Google sign-in is not configured' });
  }
  if (typeof credential !== 'string' || credential.length > 8192) {
    return res.status(400).json({ success: false, message: 'A valid Google credential is required' });
  }

  let identity;
  try {
    identity = await verifyGoogleCredential(credential, clientId);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Google sign-in could not be verified' });
  }

  const { googleId, email, displayName } = identity;
  try {
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
      if (user?.googleId && user.googleId !== googleId) {
        return res.status(409).json({ success: false, message: 'This email is linked to another Google account' });
      }

      if (user) {
        user.googleId = googleId;
        if (displayName) user.displayName = displayName;
        await user.save();
      } else {
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 23) || 'googleuser';
        let username;
        do {
          username = `${baseUsername}-${randomBytes(4).toString('hex')}`;
        } while (await User.exists({ username }));

        user = await User.create({ username, email, googleId, displayName });
      }
    }

    const session = await createSession(user._id);
    res.status(200).json({
      success: true,
      data: {
        token: session.token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email || email,
          displayName: user.displayName || displayName || user.username,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000 && googleId) {
      const existingUser = await User.findOne({ googleId });
      if (existingUser) {
        const session = await createSession(existingUser._id);
        return res.status(200).json({
          success: true,
          data: {
            token: session.token,
            user: {
              id: existingUser._id,
              username: existingUser.username,
              email: existingUser.email || email,
              displayName: existingUser.displayName || displayName || existingUser.username,
            },
          },
        });
      }
    }
    res.status(500).json({ success: false, message: 'Unable to complete Google sign-in' });
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

app.get('/api/feedback/:id/attachment', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback id' });
    }

    const feedback = await Feedback.findById(req.params.id).select('attachment');
    if (!feedback?.attachment?.storageName) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const filePath = path.join(UPLOAD_DIRECTORY, feedback.attachment.storageName);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(feedback.attachment.fileName)}"`);
    res.type(feedback.attachment.contentType);
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode === 404 ? 404 : 500).json({
          success: false,
          message: error.statusCode === 404 ? 'Attachment file not found' : 'Unable to download attachment',
        });
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to download attachment' });
  }
});

// 1. WRITE Operation: Create a new feedback entry (POST)
app.post('/api/feedback', async (req, res) => {
  let uploadedFilePath;
  try {
    const { guestName, source, rating, comment, sentiment, departmentTag, attachment: attachmentInput } = req.body;
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

    const attachment = parseAttachment(attachmentInput);
    if (attachment) {
      await fs.mkdir(UPLOAD_DIRECTORY, { recursive: true });
      uploadedFilePath = path.join(UPLOAD_DIRECTORY, attachment.metadata.storageName);
      await fs.writeFile(uploadedFilePath, attachment.buffer, { flag: 'wx' });
      newFeedback.attachment = attachment.metadata;
    }

    const savedFeedback = await newFeedback.save();
    res.status(201).json({ success: true, data: savedFeedback });
  } catch (error) {
    if (uploadedFilePath) await fs.unlink(uploadedFilePath).catch(() => {});
    const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? error.message : 'Unable to save feedback',
    });
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
    if (feedback.attachment?.storageName) {
      await fs.unlink(path.join(UPLOAD_DIRECTORY, feedback.attachment.storageName)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
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
