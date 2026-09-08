const mongoose = require('mongoose');

/**
 * Farmer Schema
 * STRICT PRIVACY: Data Minimization applied - No Aadhaar or raw banking data stored.
 */
const farmerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, 'Farmer phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    name: {
      type: String,
      required: [true, 'Farmer name is required'],
      trim: true
    },
    preferredLanguage: {
      type: String,
      enum: {
        values: ['mr', 'hi', 'en'],
        message: '{VALUE} is not a supported language'
      },
      default: 'mr'
    },
    registeredVia: {
      type: String,
      enum: {
        values: ['app', 'assisted'],
        message: '{VALUE} is not a valid registration channel'
      },
      default: 'app'
    }
  },
  {
    timestamps: true
  }
);

// Index phone explicitly
farmerSchema.index({ phone: 1 });

const Farmer = mongoose.model('Farmer', farmerSchema);

module.exports = Farmer;
