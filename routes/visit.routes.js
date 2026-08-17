const express = require('express');
const { protect }     = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const {
  createVisit, getVisits, getVisitById,
  updateVisitStatus, updateConsultation,
  reassignDoctor, getPrescription, getTodayStats,
} = require('../controllers/visit.controller');

const router = express.Router();

router.use(protect);

// Today stats — receptionist/admin
router.get('/today/stats', requireRole('admin', 'receptionist'), getTodayStats);

// Create ticket — receptionist (walk-in) or patient (online)
router.post('/', requireRole('admin', 'receptionist', 'patient'), createVisit);

// Get visits (filtered by role automatically in controller)
router.get('/', getVisits);

// Visit detail
router.get('/:id', getVisitById);

// Status transitions
router.patch(
  '/:id/status',
  requireRole('admin', 'receptionist', 'doctor'),
  updateVisitStatus
);

// Consultation update — doctors only
router.patch(
  '/:id/consultation',
  requireRole('admin', 'doctor'),
  updateConsultation
);

// Reassign doctor — admin or receptionist
router.patch(
  '/:id/assign-doctor',
  requireRole('admin', 'receptionist'),
  reassignDoctor
);

// Prescription
router.get(
  '/:id/prescription',
  requireRole('admin', 'receptionist', 'doctor', 'patient'),
  getPrescription
);

module.exports = router;
