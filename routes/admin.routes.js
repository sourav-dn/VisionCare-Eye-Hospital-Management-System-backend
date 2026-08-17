const express = require('express');
const { protect }     = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDoctors, getDoctorById, createDoctor, updateDoctor, toggleDoctorAvailability, deleteDoctor,
  getRooms, createRoom, updateRoom, deleteRoom, assignDoctorToRoom,
  getStaff, createStaff, updateStaff,
} = require('../controllers/admin.controller');

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, requireRole('admin'));

// ─── Departments ──────────────────────────────────────────
router.get('/departments',        getDepartments);
router.post('/departments',       createDepartment);
router.put('/departments/:id',    updateDepartment);
router.delete('/departments/:id', deleteDepartment);

// ─── Doctors ──────────────────────────────────────────────
router.get('/doctors',                       getDoctors);
router.get('/doctors/:id',                   getDoctorById);
router.post('/doctors',                      createDoctor);
router.put('/doctors/:id',                   updateDoctor);
router.patch('/doctors/:id/toggle-availability', toggleDoctorAvailability);
router.delete('/doctors/:id',                deleteDoctor);

// ─── Rooms ────────────────────────────────────────────────
router.get('/rooms',               getRooms);
router.post('/rooms',              createRoom);
router.put('/rooms/:id',           updateRoom);
router.delete('/rooms/:id',        deleteRoom);
router.patch('/rooms/:id/assign',  assignDoctorToRoom); // { doctorId: '...' | null }

// ─── Staff ────────────────────────────────────────────────
router.get('/staff',        getStaff);
router.post('/staff',       createStaff);
router.put('/staff/:id',    updateStaff);

module.exports = router;
