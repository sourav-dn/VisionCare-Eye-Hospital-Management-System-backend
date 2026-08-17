const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: 0,
      max: 150,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    allergies: [
      {
        type: String,
        trim: true,
      },
    ],
    chronicConditions: [
      {
        type: String,
        trim: true,
      },
    ],
    // If this patient has a patient-role user account (for online bookings/portal)
    userAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    patientId: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Auto-generate a readable patient ID before saving
patientSchema.pre('save', async function () {
  if (!this.patientId) {
    const count = await mongoose.model('Patient').countDocuments();
    this.patientId = `VC-P-${String(count + 1).padStart(5, '0')}`;
  }
});

// Index for fast phone search
patientSchema.index({ name: 'text' });

module.exports = mongoose.model('Patient', patientSchema);
