const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    dosage:   { type: String, required: true, trim: true }, // e.g. "500mg"
    duration: { type: String, required: true, trim: true }, // e.g. "7 days"
    timing:   { type: String, required: true, trim: true }, // e.g. "1-0-1 after meals"
    notes:    { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    result:    { type: String, trim: true, default: '' },
    reportUrl: { type: String, default: null }, // Cloudinary URL
  },
  { _id: false }
);

const visitSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department is required'],
    },
    assignedDoctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Room number snapshotted at ticket creation (from Room collection at that moment)
    roomNumber: {
      type: String,
      default: null,
    },
    bookingType: {
      type: String,
      enum: ['walk-in', 'online'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'scheduled',
        'waiting',
        'in-consultation',
        'in-procedure',
        'ready-for-prescription',
        'completed',
        'cancelled',
      ],
      default: 'waiting',
    },
    priority: {
      type: Number,
      default: 0, // Higher = more urgent
    },
    // Consultation data
    chiefComplaint: { type: String, trim: true, default: '' },
    diagnosis:      { type: String, trim: true, default: '' },
    doctorNotes:    { type: String, trim: true, default: '' },
    medicines:      [medicineSchema],
    testsAdvised:   [testSchema],
    nextVisitDate:  { type: Date, default: null },

    // Appointment scheduling (online bookings)
    appointmentDate: { type: Date, default: null },

    // Finalization
    prescriptionUrl: { type: String, default: null },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finalizedAt: { type: Date, default: null },

    // Timestamps for each status change (for analytics)
    statusHistory: [
      {
        status:    String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate ticket number before save
visitSchema.pre('save', async function () {
  if (!this.ticketNumber) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('Visit').countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt:  new Date(today.setHours(23, 59, 59, 999)),
      },
    });
    this.ticketNumber = `VC-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
});

// Indexes for performance
visitSchema.index({ patient: 1, createdAt: -1 });
visitSchema.index({ assignedDoctor: 1, status: 1 });
visitSchema.index({ status: 1, createdAt: 1 });
visitSchema.index({ department: 1, createdAt: -1 });

module.exports = mongoose.model('Visit', visitSchema);
