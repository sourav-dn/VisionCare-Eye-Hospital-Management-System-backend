const User       = require('../models/User.model');
const Room       = require('../models/Room.model');
const Department = require('../models/Department.model');
const Visit      = require('../models/Visit.model');

// ══════════════════════════════════════════════════════════════
//  DEPARTMENT CRUD
// ══════════════════════════════════════════════════════════════

const getDepartments = async (req, res, next) => {
  try {
    const depts = await Department.find().sort({ name: 1 });
    res.json({ success: true, data: depts });
  } catch (error) { next(error); }
};

const createDepartment = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const dept = await Department.create({ name, description });
    res.status(201).json({ success: true, data: dept });
  } catch (error) { next(error); }
};

const updateDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    res.json({ success: true, data: dept });
  } catch (error) { next(error); }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });

    // Check if any doctors or rooms reference this department
    const doctorCount = await User.countDocuments({ department: req.params.id, role: 'doctor' });
    const roomCount   = await Room.countDocuments({ department: req.params.id });

    if (doctorCount > 0 || roomCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete — ${doctorCount} doctor(s) and ${roomCount} room(s) are linked to this department`,
      });
    }

    await Department.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  DOCTOR CRUD
// ══════════════════════════════════════════════════════════════

const getDoctors = async (req, res, next) => {
  try {
    const { department, available } = req.query;
    const filter = { role: 'doctor', isActive: true };
    if (department)           filter.department = department;
    if (available !== undefined) filter.isAvailable = available === 'true';

    const doctors = await User.find(filter)
      .populate('department', 'name')
      .select('-password')
      .sort({ name: 1 });

    // For each doctor, find their current room assignment
    const doctorsWithRoom = await Promise.all(
      doctors.map(async (doc) => {
        const room = await Room.findOne({ assignedDoctor: doc._id }).populate('department', 'name');
        return { ...doc.toObject(), currentRoom: room || null };
      })
    );

    res.json({ success: true, data: doctorsWithRoom });
  } catch (error) { next(error); }
};

const getDoctorById = async (req, res, next) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' })
      .populate('department', 'name description')
      .select('-password');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const room = await Room.findOne({ assignedDoctor: doctor._id }).populate('department', 'name');
    res.json({ success: true, data: { ...doctor.toObject(), currentRoom: room || null } });
  } catch (error) { next(error); }
};

const createDoctor = async (req, res, next) => {
  try {
    const { name, email, password, department, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const doctor = await User.create({
      name, email, password,
      role: 'doctor',
      department: department || null,
      phone: phone || null,
    });

    await doctor.populate('department', 'name');

    res.status(201).json({
      success: true,
      data: {
        _id: doctor._id, name: doctor.name, email: doctor.email,
        department: doctor.department, isAvailable: doctor.isAvailable,
      },
    });
  } catch (error) { next(error); }
};

const updateDoctor = async (req, res, next) => {
  try {
    const { name, email, department, phone, isAvailable, isActive } = req.body;

    const doctor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'doctor' },
      { name, email, department, phone, isAvailable, isActive },
      { new: true, runValidators: true }
    ).populate('department', 'name').select('-password');

    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const room = await Room.findOne({ assignedDoctor: doctor._id });
    res.json({ success: true, data: { ...doctor.toObject(), currentRoom: room || null } });
  } catch (error) { next(error); }
};

const toggleDoctorAvailability = async (req, res, next) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    doctor.isAvailable = !doctor.isAvailable;
    await doctor.save();

    res.json({
      success: true,
      message: `Dr. ${doctor.name} is now ${doctor.isAvailable ? 'available' : 'unavailable'}`,
      isAvailable: doctor.isAvailable,
    });
  } catch (error) { next(error); }
};

const deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Unassign from any room
    await Room.updateMany({ assignedDoctor: req.params.id }, { $set: { assignedDoctor: null } });

    // Soft delete
    doctor.isActive = false;
    await doctor.save();

    res.json({ success: true, message: 'Doctor deactivated successfully' });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  ROOM CRUD + ASSIGNMENT
// ══════════════════════════════════════════════════════════════

const getRooms = async (req, res, next) => {
  try {
    const { department, status } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (status)     filter.status = status;

    const rooms = await Room.find(filter)
      .populate('department', 'name')
      .populate('assignedDoctor', 'name email isAvailable')
      .sort({ roomNumber: 1 });

    res.json({ success: true, data: rooms });
  } catch (error) { next(error); }
};

const createRoom = async (req, res, next) => {
  try {
    const { roomNumber, department, status, notes } = req.body;
    const room = await Room.create({ roomNumber, department, status, notes });
    await room.populate('department', 'name');
    res.status(201).json({ success: true, data: room });
  } catch (error) { next(error); }
};

const updateRoom = async (req, res, next) => {
  try {
    const { roomNumber, department, status, notes } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { roomNumber, department, status, notes },
      { new: true, runValidators: true }
    ).populate('department', 'name').populate('assignedDoctor', 'name email');

    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (error) { next(error); }
};

const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted' });
  } catch (error) { next(error); }
};

// PATCH /api/admin/rooms/:id/assign
const assignDoctorToRoom = async (req, res, next) => {
  try {
    const { doctorId } = req.body; // null = unassign

    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (doctorId) {
      const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
      if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

      // Unassign doctor from any other room first
      await Room.updateMany(
        { assignedDoctor: doctorId, _id: { $ne: room._id } },
        { $set: { assignedDoctor: null } }
      );
    }

    room.assignedDoctor = doctorId || null;
    await room.save();

    await room.populate('department', 'name');
    await room.populate('assignedDoctor', 'name email isAvailable');

    res.json({ success: true, data: room, message: doctorId ? 'Doctor assigned to room' : 'Room unassigned' });
  } catch (error) { next(error); }
};

// ══════════════════════════════════════════════════════════════
//  STAFF (RECEPTIONIST) CRUD
// ══════════════════════════════════════════════════════════════

const getStaff = async (req, res, next) => {
  try {
    const staff = await User.find({ role: { $in: ['receptionist', 'admin'] }, isActive: true })
      .select('-password')
      .sort({ name: 1 });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
};

const createStaff = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!['receptionist', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be receptionist or admin' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const staff = await User.create({ name, email, password, role, phone });
    res.status(201).json({ success: true, data: { _id: staff._id, name: staff.name, email: staff.email, role: staff.role } });
  } catch (error) { next(error); }
};

const updateStaff = async (req, res, next) => {
  try {
    const { name, email, phone, isActive } = req.body;
    const staff = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['receptionist', 'admin'] } },
      { name, email, phone, isActive },
      { new: true, runValidators: true }
    ).select('-password');
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });
    res.json({ success: true, data: staff });
  } catch (error) { next(error); }
};

module.exports = {
  // Departments
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  // Doctors
  getDoctors, getDoctorById, createDoctor, updateDoctor, toggleDoctorAvailability, deleteDoctor,
  // Rooms
  getRooms, createRoom, updateRoom, deleteRoom, assignDoctorToRoom,
  // Staff
  getStaff, createStaff, updateStaff,
};
