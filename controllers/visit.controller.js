const Visit               = require('../models/Visit.model');
const Patient             = require('../models/Patient.model');
const assignDoctor        = require('../utils/assignDoctor');
const generatePrescriptionPDF = require('../utils/pdfGenerator');
const uploadToCloudinary  = require('../utils/uploadToCloudinary');

// ─── @route  POST /api/visits ─────────────────────────────────────────────────
// @desc   Create a new ticket (walk-in or online)
// @access Receptionist (walk-in) | Patient (online)
const createVisit = async (req, res, next) => {
  try {
    const {
      patientId,
      departmentId,
      assignedDoctor: manualDoctorId,
      bookingType,
      appointmentDate,
      chiefComplaint,
      priority,
    } = req.body;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    let assignedDoctor = null;
    let roomNumber     = null;
    const Room         = require('../models/Room.model');

    if (manualDoctorId) {
      // Manual assignment specified
      assignedDoctor = manualDoctorId;
      const room = await Room.findOne({ assignedDoctor: manualDoctorId, status: 'active' });
      roomNumber = room ? room.roomNumber : null;
    } else if (bookingType === 'walk-in' || (bookingType === 'online' && !appointmentDate)) {
      // Auto-assign immediately for walk-ins; also for online if no future date
      try {
        const result = await assignDoctor(departmentId);
        assignedDoctor = result.doctor._id;
        roomNumber     = result.room ? result.room.roomNumber : null;
      } catch (assignError) {
        console.warn(`Auto-assign warning: ${assignError.message}`);
      }
    }

    const status = bookingType === 'online' && appointmentDate
      ? 'scheduled'
      : 'waiting';

    const visit = await Visit.create({
      patient:         patientId,
      department:      departmentId,
      assignedDoctor:  assignedDoctor,
      roomNumber:      roomNumber,
      bookingType:     bookingType || 'walk-in',
      status,
      priority:        priority || 0,
      chiefComplaint:  chiefComplaint || '',
      appointmentDate: appointmentDate || null,
      statusHistory: [{
        status,
        changedAt: new Date(),
        changedBy: req.user._id,
      }],
    });

    await visit.populate('patient', 'name phone patientId age gender');
    await visit.populate('assignedDoctor', 'name email');
    await visit.populate('department', 'name');

    // Emit socket event to assigned doctor's room
    const io = req.app.get('io');
    if (io && assignedDoctor) {
      io.to(`doctor-${assignedDoctor}`).emit('new-ticket-assigned', {
        visit: visit.toObject(),
        patient: patient.toObject(),
      });
      // Also update receptionist/waiting room
      io.emit('queue-update', { action: 'new', visit: visit.toObject() });
    }

    res.status(201).json({ success: true, data: visit });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/visits ──────────────────────────────────────────────────
// @desc   List visits filtered by role
const getVisits = async (req, res, next) => {
  try {
    const { status, department, date, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status)     filter.status = status;
    if (department) filter.department = department;

    // Date filter — default to today for non-admin
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(targetDate.setHours(23, 59, 59, 999));

    // Role-based filtering
    if (req.user.role === 'doctor') {
      filter.assignedDoctor = req.user._id;
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.user.role === 'receptionist') {
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ userAccount: req.user._id });
      if (!patient) return res.json({ success: true, data: [] });
      filter.patient = patient._id;
    }
    // Admin sees all

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Visit.countDocuments(filter);
    const visits = await Visit.find(filter)
      .populate('patient', 'name phone patientId age gender')
      .populate('assignedDoctor', 'name email')
      .populate('department', 'name')
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, data: visits, total, page: parseInt(page) });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/visits/:id ──────────────────────────────────────────────
// @desc   Full visit detail + patient's complete history
const getVisitById = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient')
      .populate('assignedDoctor', 'name email')
      .populate('department', 'name')
      .populate('finalizedBy', 'name');

    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    // Patient's full history (all past visits, excluding current)
    const history = await Visit.find({
      patient:  visit.patient._id,
      _id:      { $ne: visit._id },
      status:   'completed',
    })
      .populate('assignedDoctor', 'name')
      .populate('department', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: visit, history });
  } catch (error) { next(error); }
};

// ─── @route  PATCH /api/visits/:id/status ────────────────────────────────────
// @desc   Update ticket status
const updateVisitStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const validStatuses = ['scheduled', 'waiting', 'in-consultation', 'in-procedure', 'ready-for-prescription', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    visit.status = status;
    visit.statusHistory.push({ status, changedAt: new Date(), changedBy: req.user._id });

    if (status === 'completed') {
      visit.finalizedBy = req.user._id;
      visit.finalizedAt = new Date();

      // Trigger PDF generation
      try {
        const patient    = await Patient.findById(visit.patient);
        const pdfBuffer  = await generatePrescriptionPDF(visit, patient);
        const publicId   = `prescription-${visit.ticketNumber}`;
        const pdfUrl     = await uploadToCloudinary(pdfBuffer, 'eye-hospital/prescriptions', publicId, 'raw');
        visit.prescriptionUrl = pdfUrl;
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError.message);
        // Don't block visit completion — just log
      }
    }

    await visit.save();
    await visit.populate('patient', 'name phone');
    await visit.populate('assignedDoctor', 'name');

    // Emit socket update
    const io = req.app.get('io');
    if (io) {
      io.emit('queue-update', { action: 'status-change', visit: visit.toObject() });
      if (visit.assignedDoctor) {
        io.to(`doctor-${visit.assignedDoctor._id}`).emit('ticket-status-changed', visit.toObject());
      }
    }

    res.json({ success: true, data: visit });
  } catch (error) { next(error); }
};

// ─── @route  PATCH /api/visits/:id/consultation ──────────────────────────────
// @desc   Doctor adds consultation data
const updateConsultation = async (req, res, next) => {
  try {
    const { diagnosis, medicines, testsAdvised, doctorNotes, nextVisitDate, chiefComplaint } = req.body;

    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    // Only assigned doctor (or admin) can update
    if (
      req.user.role === 'doctor' &&
      visit.assignedDoctor?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You are not the assigned doctor for this visit' });
    }

    if (chiefComplaint !== undefined) visit.chiefComplaint = chiefComplaint;
    if (diagnosis      !== undefined) visit.diagnosis      = diagnosis;
    if (doctorNotes    !== undefined) visit.doctorNotes    = doctorNotes;
    if (nextVisitDate  !== undefined) visit.nextVisitDate  = nextVisitDate;
    if (medicines      !== undefined) visit.medicines      = medicines;
    if (testsAdvised   !== undefined) visit.testsAdvised   = testsAdvised;

    // Auto-advance status to in-consultation if still waiting
    if (visit.status === 'waiting') {
      visit.status = 'in-consultation';
      visit.statusHistory.push({ status: 'in-consultation', changedAt: new Date(), changedBy: req.user._id });
    }

    await visit.save();
    res.json({ success: true, data: visit });
  } catch (error) { next(error); }
};

// ─── @route  PATCH /api/visits/:id/assign-doctor ─────────────────────────────
// @desc   Manually reassign a visit to a different doctor (admin/receptionist)
const reassignDoctor = async (req, res, next) => {
  try {
    const { doctorId } = req.body;

    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });

    // Look up new doctor's current room
    const Room = require('../models/Room.model');
    const room = await Room.findOne({ assignedDoctor: doctorId, status: 'active' });

    visit.assignedDoctor = doctorId;
    visit.roomNumber     = room ? room.roomNumber : null;
    visit.statusHistory.push({ status: visit.status, changedAt: new Date(), changedBy: req.user._id });

    await visit.save();
    await visit.populate('assignedDoctor', 'name email');

    const io = req.app.get('io');
    if (io) {
      io.to(`doctor-${doctorId}`).emit('new-ticket-assigned', visit.toObject());
      io.emit('queue-update', { action: 'reassigned', visit: visit.toObject() });
    }

    res.json({ success: true, data: visit });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/visits/:id/prescription ────────────────────────────────
// @desc   Get prescription URL or regenerate PDF
const getPrescription = async (req, res, next) => {
  try {
    const visit = await Visit.findById(req.params.id)
      .populate('patient')
      .populate('assignedDoctor', 'name')
      .populate('department', 'name');

    if (!visit) return res.status(404).json({ success: false, message: 'Visit not found' });
    if (visit.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Prescription available only after visit is completed' });
    }

    // Return existing URL if available
    if (visit.prescriptionUrl) {
      return res.json({ success: true, prescriptionUrl: visit.prescriptionUrl });
    }

    // Regenerate if missing
    const patient   = await Patient.findById(visit.patient._id || visit.patient);
    const pdfBuffer = await generatePrescriptionPDF(visit, patient);
    const publicId  = `prescription-${visit.ticketNumber}`;
    const pdfUrl    = await uploadToCloudinary(pdfBuffer, 'eye-hospital/prescriptions', publicId, 'raw');

    visit.prescriptionUrl = pdfUrl;
    await visit.save();

    res.json({ success: true, prescriptionUrl: pdfUrl });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/visits/today/stats ─────────────────────────────────────
const getTodayStats = async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [total, waiting, inConsultation, completed] = await Promise.all([
      Visit.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Visit.countDocuments({ status: 'waiting', createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Visit.countDocuments({ status: 'in-consultation', createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      Visit.countDocuments({ status: 'completed', createdAt: { $gte: startOfDay, $lte: endOfDay } }),
    ]);

    res.json({ success: true, data: { total, waiting, inConsultation, completed } });
  } catch (error) { next(error); }
};

module.exports = {
  createVisit, getVisits, getVisitById,
  updateVisitStatus, updateConsultation,
  reassignDoctor, getPrescription, getTodayStats,
};
