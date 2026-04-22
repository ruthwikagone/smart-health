const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ctrl = require('../controllers/authController');
const db = require('../config/db');
const bcrypt = require('bcryptjs');


// ✅ SIGNUP
router.post('/signup',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

    body('email')
      .trim()
      .toLowerCase()
      .isEmail().withMessage('Valid email required')
      .isLength({ max: 150 }).withMessage('Email is too long'),

    body('password')
      .isLength({ min: 6, max: 72 }).withMessage('Password must be between 6 and 72 characters'),

    body('phone')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^\+?[0-9()\-\s]{7,20}$/).withMessage('Valid phone number required'),
  ],
  validate,
  ctrl.signup
);


// ✅ LOGIN
router.post('/login',
  [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  ctrl.login
);


// ✅ GET CURRENT USER
router.get('/me', authenticate, ctrl.getMe);


// ✅ UPDATE PROFILE
router.patch('/profile', authenticate, ctrl.updateProfile);


// ✅ FORGOT PASSWORD (FIXED)
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email required' });
  }

  // 🔥 FIXED (MySQL format)
  const [rows] = await db.query(
    'SELECT id, name FROM users WHERE email=?',
    [email]
  );

  if (rows.length === 0) {
    return res.json({
      success: true,
      message: 'If this email exists, an OTP has been sent.'
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await db.query('DELETE FROM password_resets WHERE email=?', [email]);

  await db.query(
    'INSERT INTO password_resets (id, email, otp, expires_at) VALUES (UUID(),?,?,?)',
    [email, otp, expires]
  );

  const mailService = require('../services/mailService');

  // 🔥 FIXED
  await mailService.sendOTP(
    { name: rows[0].name, email },
    otp
  );

  res.json({
    success: true,
    message: 'OTP sent to your email. Valid for 10 minutes.'
  });
}));


// ✅ RESET PASSWORD (FIXED)
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, OTP and new password required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  // 🔥 FIXED (MySQL format)
  const [rows] = await db.query(
    'SELECT * FROM password_resets WHERE email=? AND otp=? AND used=0 AND expires_at > NOW()',
    [email, otp]
  );

  if (rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP'
    });
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await db.query(
    'UPDATE users SET password_hash=? WHERE email=?',
    [hash, email]
  );

  await db.query(
    'UPDATE password_resets SET used=1 WHERE email=?',
    [email]
  );

  res.json({
    success: true,
    message: 'Password reset successfully. You can now login.'
  });
}));


module.exports = router;
