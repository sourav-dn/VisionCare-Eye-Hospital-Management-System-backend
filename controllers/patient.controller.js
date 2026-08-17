const Patient = require('../models/Patient.model');
const Visit   = require('../models/Visit.model');

// ─── @route  GET /api/patients/search?phone=xxx ───────────────────────────────
const searchPatient = async (req, res, next) => {
  try {
    const { phone, name } = req.query;
    if (!phone && !name) {
      return res.status(400).json({ success: false, message: 'Provide phone or name to search' });
    }

    let query = {};
    if (phone) query.phone = { $regex: phone, $options: 'i' };
    if (name)  query.name  = { $regex: name,  $options: 'i' };

    const patients = await Patient.find(query)
      .populate('userAccount', 'email')
      .limit(10)
      .sort({ createdAt: -1 });

    res.json({ success: true, data: patients, count: patients.length });
  } catch (error) { next(error); }
};

// ─── @route  POST /api/patients ───────────────────────────────────────────────
const createPatient = async (req, res, next) => {
  try {
    const { name, age, gender, phone, address, allergies, chronicConditions } = req.body;

    const existing = await Patient.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A patient with this phone number already exists',
        patient: existing,
      });
    }

    const patient = await Patient.create({
      name, age, gender, phone, address,
      allergies:        allergies        || [],
      chronicConditions: chronicConditions || [],
    });

    res.status(201).json({ success: true, data: patient });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/patients ────────────────────────────────────────────────
const getAllPatients = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const total    = await Patient.countDocuments();
    const patients = await Patient.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userAccount', 'email');

    res.json({ success: true, data: patients, total, page, pages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/patients/:id ───────────────────────────────────────────
const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('userAccount', 'email');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // Fetch complete visit history, most recent first
    const visits = await Visit.find({ patient: req.params.id })
      .populate('assignedDoctor', 'name email')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: patient, visits });
  } catch (error) { next(error); }
};

// ─── @route  PUT /api/patients/:id ───────────────────────────────────────────
const updatePatient = async (req, res, next) => {
  try {
    const { name, age, gender, phone, address, allergies, chronicConditions } = req.body;
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { name, age, gender, phone, address, allergies, chronicConditions },
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/patients/my-history ────────────────────────────────────
// For logged-in patient users
const getMyHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ userAccount: req.user._id });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'No patient profile linked to your account' });
    }

    const visits = await Visit.find({ patient: patient._id })
      .populate('assignedDoctor', 'name')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, patient, visits });
  } catch (error) { next(error); }
};

module.exports = { searchPatient, createPatient, getAllPatients, getPatientById, updatePatient, getMyHistory };
