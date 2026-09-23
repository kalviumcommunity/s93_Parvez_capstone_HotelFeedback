const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    guestName: {
      type: String,
      required: [true, 'Guest name is required'],
      trim: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['Google', 'TripAdvisor', 'Booking.com', 'Internal Survey'],
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, 'Feedback comment cannot be empty'],
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
      default: 'Neutral',
    },
    departmentTag: {
      type: String,
      enum: ['Housekeeping', 'Front Desk', 'Dining', 'Amenities', 'General'],
      default: 'General',
    },
    isActionRequired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Feedback', feedbackSchema);