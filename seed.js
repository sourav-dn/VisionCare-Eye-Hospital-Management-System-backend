/**
 * Seed Script — Run with: npm run seed
 *
 * Creates:
 *  - 1 Admin + 1 Receptionist
 *  - 5 Departments
 *  - 6 Doctors (1 per dept + 1 extra General)
 *  - 6 Rooms (assigned to doctors, Room 101–106)
 *  - 3 Sample Patients
 *  - 3 Sample Visits (different statuses)
 *
 * Idempotent — uses findOneAndUpdate with upsert.
 */

require('dotenv').config();
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const connectDB  = require('./config/db');

const User       = require('./models/User.model');
const Patient    = require('./models/Patient.model');
const Department = require('./models/Department.model');
const Room       = require('./models/Room.model');
const Visit      = require('./models/Visit.model');

const DEPTS = [
  { name: 'General Ophthalmology', description: 'General eye care and routine checkups' },
  { name: 'Cornea',                description: 'Corneal diseases, LASIK, keratoplasty' },
  { name: 'Retina',                description: 'Retinal disorders, vitreo-retinal surgery' },
  { name: 'Cataract',              description: 'Cataract evaluation and surgery' },
  { name: 'Glaucoma',              description: 'Glaucoma diagnosis and treatment' },
];

const seed = async () => {
  await connectDB();
  console.log('\n🌱  Starting seed...\n');

  // ─── 1. Departments ─────────────────────────────────────────────────────────
  const deptDocs = {};
  for (const d of DEPTS) {
    const dept = await Department.findOneAndUpdate(
      { name: d.name },
      d,
      { upsert: true, returnDocument: 'after' }
    );
    deptDocs[d.name] = dept;
    console.log(`  ✅ Department: ${dept.name}`);
  }

  // ─── 2. Admin ────────────────────────────────────────────────────────────────
  const adminPwd = await bcrypt.hash('Admin@123', 12);
  await User.findOneAndUpdate(
    { email: 'admin@visioncare.com' },
    {
      name: 'System Admin',
      email: 'admin@visioncare.com',
      password: adminPwd,
      role: 'admin',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('  ✅ Admin: admin@visioncare.com / Admin@123');

  // ─── 3. Receptionist ────────────────────────────────────────────────────────
  const recPwd = await bcrypt.hash('Recept@123', 12);
  await User.findOneAndUpdate(
    { email: 'reception@visioncare.com' },
    {
      name: 'Sarah Ali',
      email: 'reception@visioncare.com',
      password: recPwd,
      role: 'receptionist',
      isActive: true,
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('  ✅ Receptionist: reception@visioncare.com / Recept@123');

  // ─── 4. Doctors ──────────────────────────────────────────────────────────────
  const doctorDefs = [
    { name: 'Dr. Arjun Mehta',   email: 'arjun@visioncare.com',   dept: 'General Ophthalmology' },
    { name: 'Dr. Priya Sharma',  email: 'priya@visioncare.com',   dept: 'General Ophthalmology' },
    { name: 'Dr. Khalid Hassan', email: 'khalid@visioncare.com',  dept: 'Cornea' },
    { name: 'Dr. Nadia Islam',   email: 'nadia@visioncare.com',   dept: 'Retina' },
    { name: 'Dr. Rohan Das',     email: 'rohan@visioncare.com',   dept: 'Cataract' },
    { name: 'Dr. Fatima Khan',   email: 'fatima@visioncare.com',  dept: 'Glaucoma' },
  ];

  const docPwd = await bcrypt.hash('Doctor@123', 12);
  const doctorDocs = [];
  for (const d of doctorDefs) {
    const doc = await User.findOneAndUpdate(
      { email: d.email },
      {
        name:        d.name,
        email:       d.email,
        password:    docPwd,
        role:        'doctor',
        department:  deptDocs[d.dept]._id,
        isAvailable: true,
        isActive:    true,
      },
      { upsert: true, returnDocument: 'after' }
    );
    doctorDocs.push(doc);
    console.log(`  ✅ Doctor: ${d.name} → ${d.dept}`);
  }

  // ─── 5. Rooms ─────────────────────────────────────────────────────────────────
  const roomDefs = [
    { roomNumber: '101', dept: 'General Ophthalmology', doctor: doctorDocs[0] },
    { roomNumber: '102', dept: 'General Ophthalmology', doctor: doctorDocs[1] },
    { roomNumber: '103', dept: 'Cornea',                doctor: doctorDocs[2] },
    { roomNumber: '104', dept: 'Retina',                doctor: doctorDocs[3] },
    { roomNumber: '105', dept: 'Cataract',              doctor: doctorDocs[4] },
    { roomNumber: '106', dept: 'Glaucoma',              doctor: doctorDocs[5] },
  ];

  for (const r of roomDefs) {
    await Room.findOneAndUpdate(
      { roomNumber: r.roomNumber },
      {
        roomNumber:      r.roomNumber,
        department:      deptDocs[r.dept]._id,
        assignedDoctor:  r.doctor._id,
        status:          'active',
      },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`  ✅ Room ${r.roomNumber} → ${r.dept} → ${r.doctor.name}`);
  }

  // ─── 6. Sample Patients ───────────────────────────────────────────────────────
  const patientDefs = [
    {
      name: 'Ahmed Rahman',
      age: 45, gender: 'male',
      phone: '01711000001',
      address: '12 Gulshan Ave, Dhaka',
      allergies: ['Penicillin'],
      chronicConditions: ['Hypertension', 'Diabetes'],
    },
    {
      name: 'Nasrin Begum',
      age: 32, gender: 'female',
      phone: '01711000002',
      address: '5 Banani Road, Dhaka',
      allergies: [],
      chronicConditions: [],
    },
    {
      name: 'Karim Uddin',
      age: 60, gender: 'male',
      phone: '01711000003',
      address: '78 Dhanmondi, Dhaka',
      allergies: ['Sulfa drugs'],
      chronicConditions: ['Glaucoma (family history)'],
    },
  ];

  const patientDocs = [];
  let pIndex = 1;
  for (const p of patientDefs) {
    let patient = await Patient.findOne({ phone: p.phone });
    if (!patient) {
      const patientId = `VC-P-${String(pIndex).padStart(5, '0')}`;
      patient = await Patient.create({ ...p, patientId });
    } else {
      patient = await Patient.findOneAndUpdate({ phone: p.phone }, p, { returnDocument: 'after' });
    }
    pIndex++;
    patientDocs.push(patient);
    console.log(`  ✅ Patient: ${p.name} (${p.phone})`);
  }

  // ─── 7. Sample Visits ─────────────────────────────────────────────────────────
  const todayVisits = await Visit.countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
  });

  if (todayVisits === 0) {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const admin   = await User.findOne({ email: 'admin@visioncare.com' });

    const visitDefs = [
      {
        ticketNumber:   `VC-${dateStr}-0001`,
        patient:        patientDocs[0]._id,
        department:     deptDocs['General Ophthalmology']._id,
        assignedDoctor: doctorDocs[0]._id,
        roomNumber:     '101',
        bookingType:    'walk-in',
        status:         'in-consultation',
        chiefComplaint: 'Blurred vision in left eye for 3 weeks',
        finalizedBy:    null,
      },
      {
        ticketNumber:   `VC-${dateStr}-0002`,
        patient:        patientDocs[1]._id,
        department:     deptDocs['Retina']._id,
        assignedDoctor: doctorDocs[3]._id,
        roomNumber:     '104',
        bookingType:    'walk-in',
        status:         'waiting',
        chiefComplaint: 'Floaters and flashes of light',
        finalizedBy:    null,
      },
      {
        ticketNumber:   `VC-${dateStr}-0003`,
        patient:        patientDocs[2]._id,
        department:     deptDocs['Glaucoma']._id,
        assignedDoctor: doctorDocs[5]._id,
        roomNumber:     '106',
        bookingType:    'online',
        status:         'completed',
        chiefComplaint: 'Routine glaucoma checkup',
        diagnosis:      'Open-angle glaucoma, stable',
        doctorNotes:    'Continue current medication. IOP within normal range.',
        medicines: [
          { name: 'Latanoprost Eye Drops', dosage: '0.005%', duration: 'Ongoing', timing: '1 drop at bedtime' },
        ],
        finalizedBy: admin._id,
        finalizedAt: new Date(),
      },
    ];

    for (const v of visitDefs) {
      await Visit.findOneAndUpdate(
        { ticketNumber: v.ticketNumber },
        v,
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`  ✅ Visit: ${v.ticketNumber} (${v.status})`);
    }
  } else {
    console.log(`  ℹ️  Visits already exist for today — skipping sample visit creation`);
  }

  console.log('\n🎉  Seed completed successfully!\n');
  console.log('  📧  Admin login:        admin@visioncare.com / Admin@123');
  console.log('  📧  Receptionist login: reception@visioncare.com / Recept@123');
  console.log('  📧  Doctor login:       arjun@visioncare.com / Doctor@123');
  console.log('  📞  Test patients:      01711000001, 01711000002, 01711000003\n');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
