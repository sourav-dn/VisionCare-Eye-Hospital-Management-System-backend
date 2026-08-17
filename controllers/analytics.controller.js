const Visit      = require('../models/Visit.model');
const Patient    = require('../models/Patient.model');
const User       = require('../models/User.model');
const Room       = require('../models/Room.model');
const Department = require('../models/Department.model');

// ─── @route  GET /api/analytics/overview ─────────────────────────────────────
const getOverview = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday   = new Date(today.setHours(23, 59, 59, 999));

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth   = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const [
      todayVisits, monthVisits,
      totalPatients, todayCompleted,
      activeDoctors, activeRooms,
    ] = await Promise.all([
      Visit.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } }),
      Visit.countDocuments({ createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      Patient.countDocuments(),
      Visit.countDocuments({ status: 'completed', createdAt: { $gte: startOfToday, $lte: endOfToday } }),
      User.countDocuments({ role: 'doctor', isAvailable: true, isActive: true }),
      Room.countDocuments({ status: 'active', assignedDoctor: { $ne: null } }),
    ]);

    res.json({
      success: true,
      data: { todayVisits, monthVisits, totalPatients, todayCompleted, activeDoctors, activeRooms },
    });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/analytics/doctor-load ───────────────────────────────────
const getDoctorLoad = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(today.setHours(23, 59, 59, 999));

    const doctors = await User.find({ role: 'doctor', isActive: true })
      .populate('department', 'name')
      .select('name department isAvailable');

    const load = await Promise.all(
      doctors.map(async (doc) => {
        const [todayCount, activeCount] = await Promise.all([
          Visit.countDocuments({ assignedDoctor: doc._id, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
          Visit.countDocuments({
            assignedDoctor: doc._id,
            status: { $in: ['waiting', 'in-consultation', 'in-procedure'] },
          }),
        ]);
        const room = await Room.findOne({ assignedDoctor: doc._id });
        return {
          doctor:      { _id: doc._id, name: doc.name, department: doc.department, isAvailable: doc.isAvailable },
          room:        room ? room.roomNumber : null,
          todayCount,
          activeCount,
        };
      })
    );

    res.json({ success: true, data: load });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/analytics/department-stats ──────────────────────────────
const getDepartmentStats = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = await Visit.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id:       '$department',
          total:     { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          waiting:   { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from:         'departments',
          localField:   '_id',
          foreignField: '_id',
          as:           'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmpty: true } },
      { $sort: { total: -1 } },
    ]);

    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/analytics/room-utilization ──────────────────────────────
const getRoomUtilization = async (req, res, next) => {
  try {
    const rooms = await Room.find()
      .populate('department', 'name')
      .populate('assignedDoctor', 'name isAvailable')
      .sort({ roomNumber: 1 });

    const utilization = await Promise.all(
      rooms.map(async (room) => {
        const activeVisits = room.assignedDoctor
          ? await Visit.countDocuments({
              assignedDoctor: room.assignedDoctor._id,
              status:         { $in: ['waiting', 'in-consultation', 'in-procedure'] },
            })
          : 0;
        return { room, activeVisits };
      })
    );

    res.json({ success: true, data: utilization });
  } catch (error) { next(error); }
};

// ─── @route  GET /api/analytics/visit-trend ───────────────────────────────────
// Returns daily visit counts for the past 30 days
const getVisitTrend = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const trend = await Visit.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: trend });
  } catch (error) { next(error); }
};

module.exports = { getOverview, getDoctorLoad, getDepartmentStats, getRoomUtilization, getVisitTrend };
