const express = require('express');
const { protect }     = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const {
  searchPatient, createPatient, getAllPatients,
  getPatientById, updatePatient, getMyHistory,
} = require('../controllers/patient.controller');

const router = express.Router();

router.use(protect);

// Patient self — own history
router.get('/my-history', requireRole('patient'), getMyHistory);

// Staff-facing patient routes
router.get('/search', requireRole('admin', 'receptionist', 'doctor'), searchPatient);
router.get('/', requireRole('admin', 'receptionist', 'doctor'), getAllPatients);
router.post('/', requireRole('admin', 'receptionist'), createPatient);
router.get('/:id', requireRole('admin', 'receptionist', 'doctor'), getPatientById);
router.put('/:id', requireRole('admin', 'receptionist'), updatePatient);

module.exports = router;
