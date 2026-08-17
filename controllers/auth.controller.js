const jwt        = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User       = require('../models/User.model');
const Patient    = require('../models/Patient.model');

// ─── Helper: generate JWT ─────────────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendAuthResponse = (res, user, statusCode = 200) => {
  const token = signToken(user._id);
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;

  res.status(statusCode).json({
    success: true,
    token,
    user: userObj,
  });
};

// ─── @route  POST /api/auth/register-staff ────────────────────────────────────
// @desc   Admin registers a doctor or receptionist
// @access Admin only
const registerStaff = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, department, phone } = req.body;

    if (!['doctor', 'receptionist', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be doctor, receptionist, or admin',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department: department || null,
      phone: phone || null,
    });

    res.status(201).json({
      success: true,
      message: `${role} account created successfully`,
      user: {
        _id:        user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        department: user.department,
        isAvailable: user.isAvailable,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/register-patient ─────────────────────────────────
// @desc   Patient self-registration (creates User + Patient profile)
// @access Public
const registerPatient = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, phone, age, gender, address } = req.body;

    // Check email uniqueness
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // Check if phone already has a patient record
    let patientProfile = await Patient.findOne({ phone });

    // Create user account
    const user = await User.create({
      name,
      email,
      password,
      role:  'patient',
      phone: phone || null,
    });

    // Link or create patient profile
    if (!patientProfile) {
      patientProfile = await Patient.create({
        name,
        phone,
        age:    age || 0,
        gender: gender || 'other',
        address: address || '',
        userAccount: user._id,
      });
    } else {
      // Existing patient profile — link account
      patientProfile.userAccount = user._id;
      await patientProfile.save();
    }

    user.patientProfile = patientProfile._id;
    await user.save();

    sendAuthResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

// ─── @route  POST /api/auth/login ─────────────────────────────────────────────
// @desc   Login for all roles
// @access Public
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email })
      .select('+password')
      .populate('department', 'name');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
};

// ─── @route  GET /api/auth/me ─────────────────────────────────────────────────
// @desc   Get current logged-in user
// @access Protected
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('department', 'name description')
      .populate('patientProfile');

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PUT /api/auth/change-password ───────────────────────────────────
// @desc   Change own password
// @access Protected
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── @route  PUT /api/auth/profile ───────────────────────────────────────────
// @desc   Update own profile (name, phone, avatar)
// @access Protected
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatarBase64 } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name)              user.name  = name.trim();
    if (phone !== undefined) user.phone = phone || null;

    // Save avatar as a local file under uploads/avatars/
    if (avatarBase64 && avatarBase64 !== 'REMOVE') {
      const fs   = require('fs');
      const path = require('path');

      // Strip data URL header (e.g. "data:image/jpeg;base64,")
      const matches = avatarBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ success: false, message: 'Invalid image format' });
      }
      const ext    = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      // Ensure directory exists
      const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
      if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

      // Delete old avatar file if it exists
      if (user.avatar && user.avatar.includes('/uploads/avatars/')) {
        const oldFile = path.join(__dirname, '..', user.avatar.split('/uploads/')[1]);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      const filename = `user_${user._id}_${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(avatarsDir, filename), buffer);

      // Store a relative URL — frontend will prefix with backend base URL
      user.avatar = `/uploads/avatars/${filename}`;
    }

    if (avatarBase64 === 'REMOVE') {
      // Clean up old file
      if (user.avatar) {
        const fs   = require('fs');
        const path = require('path');
        const oldFile = path.join(__dirname, '..', 'uploads', 'avatars', path.basename(user.avatar));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      user.avatar = null;
    }

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, message: 'Profile updated successfully', user: userObj });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerStaff, registerPatient, login, getMe, changePassword, updateProfile };
