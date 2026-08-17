const express = require('express');
const { body } = require('express-validator');
const {
  registerStaff, registerPatient, login, getMe, changePassword, updateProfile,
} = require('../controllers/auth.controller');
const { protect }      = require('../middleware/auth.middleware');
const { requireRole }  = require('../middleware/roleCheck.middleware');

const router = express.Router();

// Staff registration — admin only
router.post(
  '/register-staff',
  protect,
  requireRole('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('role').notEmpty().withMessage('Role is required'),
  ],
  registerStaff
);

// Patient self-signup
router.post(
  '/register-patient',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('phone').notEmpty().withMessage('Phone is required'),
  ],
  registerPatient
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// Protected
router.get('/me',              protect, getMe);
router.put('/change-password', protect, changePassword);
router.put('/profile',         protect, updateProfile);

module.exports = router;
