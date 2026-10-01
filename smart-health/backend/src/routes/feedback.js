const router = require('express').Router();
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureFeatureSchema } = require('../services/featureSchema');
const notificationService = require('../services/notificationService');
const { getScopedCenterIds } = require('../utils/adminAccess');

const VALID_STATUSES = ['new', 'in_review', 'resolved'];

function formatFeedback(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    centerId: row.center_id,
    centerName: row.center_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    appointmentId: row.appointment_id,
    category: row.category,
    rating: Number(row.rating),
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminResponse: row.admin_response,
    respondedBy: row.responded_by_name,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFeedback(id) {
  const result = await db.query(
    `SELECT f.*, u.name AS user_name, u.email AS user_email, c.name AS center_name,
            d.name AS doctor_name, responder.name AS responded_by_name
     FROM feedback f
     JOIN users u ON u.id=f.user_id
     LEFT JOIN centers c ON c.id=f.center_id
     LEFT JOIN doctors d ON d.id=f.doctor_id
     LEFT JOIN users responder ON responder.id=f.responded_by
     WHERE f.id=?`,
    [id]
  );
  return result.rows[0] || null;
}

async function assertFeedbackAccess(user, feedback) {
  if (!feedback) {
    const error = new Error('Feedback not found');
    error.status = 404;
    throw error;
  }
  if (user.role !== 'admin') {
    if (feedback.user_id !== user.id) {
      const error = new Error('Forbidden');
      error.status = 403;
      throw error;
    }
    return;
  }
  const scopedCenterIds = await getScopedCenterIds(user);
  if (Array.isArray(scopedCenterIds) && (!feedback.center_id || !scopedCenterIds.includes(feedback.center_id))) {
    const error = new Error('You are not authorized for this feedback');
    error.status = 403;
    throw error;
  }
}

router.use(authenticate);

router.get('/me', asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  const result = await db.query(
    `SELECT f.*, c.name AS center_name, d.name AS doctor_name, responder.name AS responded_by_name
     FROM feedback f
     LEFT JOIN centers c ON c.id=f.center_id
     LEFT JOIN doctors d ON d.id=f.doctor_id
     LEFT JOIN users responder ON responder.id=f.responded_by
     WHERE f.user_id=?
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, feedback: result.rows.map(formatFeedback) });
}));

router.post('/',
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Choose a rating from 1 to 5.'),
    body('category').optional().trim().isLength({ max: 60 }),
    body('subject').trim().isLength({ min: 3, max: 160 }).withMessage('Subject must be 3 to 160 characters.'),
    body('message').trim().isLength({ min: 5, max: 4000 }).withMessage('Feedback must be 5 to 4,000 characters.'),
    body('appointmentId').optional().isString(),
    body('centerId').optional().isString(),
    body('doctorId').optional().isString(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    await ensureFeatureSchema();
    let centerId = req.body.centerId || null;
    let doctorId = req.body.doctorId || null;
    let appointmentId = req.body.appointmentId || null;
    if (appointmentId) {
      const appointment = await db.query('SELECT id, user_id, center_id, doctor_id FROM appointments WHERE id=?', [appointmentId]);
      const item = appointment.rows[0];
      if (!item || item.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only give feedback for your own appointment.' });
      }
      centerId = item.center_id;
      doctorId = item.doctor_id || doctorId;
    }
    if (doctorId) {
      const doctor = await db.query(
        `SELECT d.id, d.center_id, d.name, c.name AS center_name
         FROM doctors d
         JOIN centers c ON c.id=d.center_id
         WHERE d.id=?`,
        [doctorId]
      );
      if (!doctor.rows.length) return res.status(404).json({ success: false, message: 'Doctor not found.' });
      if (centerId && centerId !== doctor.rows[0].center_id) {
        return res.status(400).json({ success: false, message: 'Selected doctor does not belong to the selected hospital.' });
      }
      centerId = doctor.rows[0].center_id;
    }
    if (centerId) {
      const center = await db.query('SELECT id FROM centers WHERE id=?', [centerId]);
      if (!center.rows.length) return res.status(404).json({ success: false, message: 'Center not found.' });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO feedback (id, user_id, center_id, doctor_id, appointment_id, category, rating, subject, message)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        req.user.id,
        centerId,
        doctorId,
        appointmentId,
        req.body.category?.trim() || 'General',
        Number(req.body.rating),
        req.body.subject.trim(),
        req.body.message.trim(),
      ]
    );
    const feedback = await getFeedback(id);
    res.status(201).json({ success: true, feedback: formatFeedback(feedback) });
  })
);

router.get('/admin', authorizeAdmin, asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  const scopedCenterIds = await getScopedCenterIds(req.user);
  const params = [];
  let query = `
    SELECT f.*, u.name AS user_name, u.email AS user_email, c.name AS center_name,
           d.name AS doctor_name, responder.name AS responded_by_name
    FROM feedback f
    JOIN users u ON u.id=f.user_id
    LEFT JOIN centers c ON c.id=f.center_id
    LEFT JOIN doctors d ON d.id=f.doctor_id
    LEFT JOIN users responder ON responder.id=f.responded_by
    WHERE 1=1
  `;
  if (Array.isArray(scopedCenterIds)) {
    if (!scopedCenterIds.length) return res.json({ success: true, feedback: [] });
    query += ` AND f.center_id IN (${scopedCenterIds.map(() => '?').join(',')})`;
    params.push(...scopedCenterIds);
  }
  if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
    query += ' AND f.status=?';
    params.push(req.query.status);
  }
  query += ' ORDER BY CASE f.status WHEN \'new\' THEN 0 WHEN \'in_review\' THEN 1 ELSE 2 END, f.created_at DESC';
  const result = await db.query(query, params);
  res.json({ success: true, feedback: result.rows.map(formatFeedback) });
}));

router.patch('/:id', authorizeAdmin, asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  const feedback = await getFeedback(req.params.id);
  await assertFeedbackAccess(req.user, feedback);
  const updates = [];
  const params = [];
  if (req.body.status !== undefined) {
    if (!VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback status.' });
    }
    updates.push('status=?');
    params.push(req.body.status);
  }
  if (req.body.adminResponse !== undefined) {
    const response = String(req.body.adminResponse || '').trim();
    if (response.length > 4000) return res.status(400).json({ success: false, message: 'Response is too long.' });
    updates.push('admin_response=?', 'responded_by=?', 'responded_at=?');
    params.push(response || null, req.user.id, response ? new Date() : null);
  }
  if (!updates.length) return res.status(400).json({ success: false, message: 'No feedback update provided.' });

  params.push(req.params.id);
  await db.query(`UPDATE feedback SET ${updates.join(', ')} WHERE id=?`, params);
  const updated = await getFeedback(req.params.id);
  if (req.body.adminResponse !== undefined && String(req.body.adminResponse || '').trim()) {
    notificationService.createNotification(req.app.get('io'), {
      user_id: feedback.user_id,
      title: 'Response to your SmartHealth feedback',
      message: `An administrator responded to: ${feedback.subject}`,
      type: 'system',
      appointment_id: feedback.appointment_id,
    }).catch(() => {});
  }
  res.json({ success: true, feedback: formatFeedback(updated) });
}));

module.exports = router;
