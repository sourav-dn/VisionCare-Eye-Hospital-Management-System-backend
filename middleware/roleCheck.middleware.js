/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin', 'receptionist')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — role '${req.user.role}' is not permitted here`,
      });
    }
    next();
  };
};

module.exports = { requireRole };
