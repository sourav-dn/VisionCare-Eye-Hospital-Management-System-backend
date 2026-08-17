const express = require('express');
const { protect }     = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/roleCheck.middleware');
const {
  getOverview, getDoctorLoad, getDepartmentStats,
  getRoomUtilization, getVisitTrend,
} = require('../controllers/analytics.controller');

const router = express.Router();

router.use(protect, requireRole('admin'));

router.get('/overview',           getOverview);
router.get('/doctor-load',        getDoctorLoad);
router.get('/department-stats',   getDepartmentStats);
router.get('/room-utilization',   getRoomUtilization);
router.get('/visit-trend',        getVisitTrend);

module.exports = router;
