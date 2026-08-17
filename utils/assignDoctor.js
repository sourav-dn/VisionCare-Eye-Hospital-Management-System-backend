const User  = require('../models/User.model');
const Room  = require('../models/Room.model');
const Visit = require('../models/Visit.model');

/**
 * Auto-assigns the least-busy available doctor in a given department,
 * then dynamically looks up their current room from the Room collection.
 *
 * @param {string} departmentId  - ObjectId of the selected department
 * @returns {{ doctor: User, room: Room|null }}
 */
const assignDoctor = async (departmentId) => {
  // 1. Find all available, active doctors in the department
  const availableDoctors = await User.find({
    role:         'doctor',
    department:   departmentId,
    isAvailable:  true,
    isActive:     true,
  });

  if (availableDoctors.length === 0) {
    throw new Error('No available doctors found in the selected department');
  }

  // 2. Count active (non-completed) visits per doctor
  const doctorLoads = await Promise.all(
    availableDoctors.map(async (doctor) => {
      const activeCount = await Visit.countDocuments({
        assignedDoctor: doctor._id,
        status: { $in: ['waiting', 'in-consultation', 'in-procedure', 'ready-for-prescription'] },
      });
      return { doctor, activeCount };
    })
  );

  // 3. Pick the doctor with the lowest active visit count
  doctorLoads.sort((a, b) => a.activeCount - b.activeCount);
  const { doctor } = doctorLoads[0];

  // 4. Look up the doctor's CURRENT room from the Room collection
  const room = await Room.findOne({
    assignedDoctor: doctor._id,
    status:         'active',
  });

  return { doctor, room };
};

module.exports = assignDoctor;
