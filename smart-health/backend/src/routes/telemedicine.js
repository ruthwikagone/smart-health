const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { ensureFeatureSchema } = require('../services/featureSchema');
const notificationService = require('../services/notificationService');
const { assertAppointmentAccess } = require('../utils/adminAccess');

function roomIdFor(appointmentId) {
  return `smarthealth-${appointmentId}`;
}

async function getAppointment(id) {
  const result = await db.query(
    `SELECT a.*, c.name AS center_name, d.name AS doctor_name, u.name AS user_name, u.email AS user_email
     FROM appointments a
     JOIN centers c ON c.id=a.center_id
     LEFT JOIN doctors d ON d.id=a.doctor_id
     JOIN users u ON u.id=a.user_id
     WHERE a.id=?`,
    [id]
  );
  return result.rows[0] || null;
}

function canAccessAppointment(user, appointment) {
  return user.role !== 'admin' ? appointment.user_id === user.id : true;
}

router.use(authenticate);

router.get('/appointments/:id', asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  const appointment = await getAppointment(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
  if (!canAccessAppointment(req.user, appointment)) return res.status(403).json({ success: false, message: 'Forbidden.' });
  if (req.user.role === 'admin') await assertAppointmentAccess(req.user, appointment.id);
  res.json({
    success: true,
    room: {
      appointmentId: appointment.id,
      roomId: appointment.telemedicine_room_id || roomIdFor(appointment.id),
      consultationType: appointment.consultation_type,
      status: appointment.telemedicine_status,
      enabledAt: appointment.telemedicine_enabled_at,
    },
  });
}));

router.post('/appointments/:id/activate', authorizeAdmin, asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  await assertAppointmentAccess(req.user, req.params.id);
  const appointment = await getAppointment(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
  if (['cancelled', 'no_show'].includes(appointment.status)) {
    return res.status(400).json({ success: false, message: 'A cancelled or no-show appointment cannot use video consultation.' });
  }
  const roomId = appointment.telemedicine_room_id || roomIdFor(appointment.id);
  await db.query(
    `UPDATE appointments
     SET consultation_type='telemedicine', telemedicine_status='ready',
         telemedicine_room_id=?, telemedicine_enabled_at=COALESCE(telemedicine_enabled_at, NOW())
     WHERE id=?`,
    [roomId, appointment.id]
  );
  notificationService.createNotification(req.app.get('io'), {
    user_id: appointment.user_id,
    title: 'Video consultation is ready',
    message: `Your video room for ${appointment.center_name} has been enabled. It opens shortly before your appointment time.`,
    type: 'appointment',
    appointment_id: appointment.id,
  }).catch(() => {});
  res.json({
    success: true,
    room: { appointmentId: appointment.id, roomId, consultationType: 'telemedicine', status: 'ready' },
  });
}));

module.exports = router;
