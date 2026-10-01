const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');
const mailService = require('../services/mailService');
const adminMailService = require('../services/adminMailService');
const notifService = require('../services/notificationService');
const { calculateQueue, getPriorityRank, recalculateQueueState } = require('../utils/queueUtils');
const { getAdminNotificationRecipients } = require('../utils/adminAccess');
const { ensureFeatureSchema } = require('../services/featureSchema');

async function notifyPriorityDelayImpacts(io, triggerAppt, previousById, updatedAppointments) {
  const delayedAppointments = updatedAppointments.filter((appt) => {
    if (appt.id === triggerAppt.id) return false;

    const previous = previousById.get(appt.id);
    if (!previous) return false;

    return (
      appt.queue_number > (previous.queue_number || 0) ||
      appt.patients_before > (previous.patients_before || 0) ||
      appt.estimated_wait_minutes > (previous.estimated_wait_minutes || 0)
    );
  });

  for (const appt of delayedAppointments) {
    const userResult = await db.query('SELECT name, email FROM users WHERE id=?', [appt.user_id]);
    const user = userResult.rows[0];
    if (!user) continue;

    await notifService.createNotification(io, {
      user_id: appt.user_id,
      title: 'Queue Delayed by Higher-Priority Case',
      message: `A higher-priority patient was moved ahead of you at ${triggerAppt.center_name}. Your new token is #${appt.queue_number} with an estimated wait of ~${appt.estimated_wait_minutes} minutes.`,
      type: 'queue',
      appointment_id: appt.id,
    });

    mailService.sendPriorityDelayAlert(user, appt, triggerAppt).catch(console.error);
  }
}

exports.createAppointment = asyncHandler(async (req, res) => {
  await ensureFeatureSchema();
  const { center_id, doctor_id, issue, appointment_date, appointment_time, priority } = req.body;
  const consultationType = req.body.consultation_type === 'telemedicine' ? 'telemedicine' : 'in_person';
  const user_id = req.user.id;

  const apptDateTime = new Date(`${appointment_date}T${appointment_time}`);
  if (apptDateTime < new Date() && priority !== 'emergency') {
    return res.status(400).json({ success: false, message: 'Cannot book in the past' });
  }

  const conflict = await db.query(
    `SELECT id FROM appointments
     WHERE doctor_id=? AND appointment_date=? AND appointment_time=? AND status != 'cancelled'`,
    [doctor_id || null, appointment_date, appointment_time]
  );
  if (conflict.rows.length) {
    return res.status(409).json({ success: false, message: 'Slot already booked' });
  }

  const centerCheck = await db.query('SELECT name, sector FROM centers WHERE id=?', [center_id]);
  if (!centerCheck.rows.length) {
    return res.status(404).json({ success: false, message: 'Center not found' });
  }
  if (priority === 'emergency' && centerCheck.rows[0].sector !== 'hospital') {
    return res.status(400).json({ success: false, message: 'Emergency appointments can only be booked at hospitals' });
  }

  const { queue_number, patients_before, estimated_wait_minutes } = priority === 'emergency'
    ? { queue_number: 1, patients_before: 0, estimated_wait_minutes: 0 }
    : await calculateQueue(db, doctor_id, center_id, appointment_date, appointment_time, priority);

  const id = uuidv4();
  await db.query(
    `INSERT INTO appointments
     (id, user_id, center_id, doctor_id, issue, appointment_date, appointment_time,
      queue_number, patients_before, estimated_wait_minutes, status, priority, consultation_type, telemedicine_status, telemedicine_room_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed',?,?,?,?)`,
    [
      id,
      user_id,
      center_id,
      doctor_id || null,
      issue,
      appointment_date,
      appointment_time,
      queue_number,
      patients_before,
      estimated_wait_minutes,
      priority || 'normal',
      consultationType,
      consultationType === 'telemedicine' ? 'requested' : 'not_requested',
      consultationType === 'telemedicine' ? `smarthealth-${id}` : null,
    ]
  );

  const io = req.app.get('io');
  const { appointments: recalculatedAppointments, previousById } = await recalculateQueueState(
    db,
    doctor_id,
    center_id,
    appointment_date
  );
  const appt = recalculatedAppointments.find((item) => item.id === id) || {
    id,
    user_id,
    center_id,
    doctor_id,
    issue,
    appointment_date,
    appointment_time,
    queue_number,
    patients_before,
    estimated_wait_minutes,
    status: 'confirmed',
    priority: priority || 'normal',
  };

  const userResult = await db.query('SELECT name, email FROM users WHERE id=?', [user_id]);
  const user = userResult.rows[0];
  const docResult = doctor_id ? await db.query('SELECT name FROM doctors WHERE id=?', [doctor_id]) : { rows: [] };
  const fullAppt = {
    ...appt,
    center_name: centerCheck.rows[0]?.name,
    doctor_name: docResult.rows[0]?.name,
  };

  mailService.sendConfirmation(user, fullAppt).catch(console.error);

  getAdminNotificationRecipients(center_id).then((admins) => {
    admins.forEach((admin) => {
      adminMailService.notifyNewAppointment(admin.email, fullAppt, user).catch(console.error);
      notifService.createNotification(io, {
        user_id: admin.id,
        title: 'New Appointment Booked',
        message: `${user.name} booked ${fullAppt.center_name} on ${appointment_date} at ${appointment_time}. Token #${appt.queue_number}`,
        type: 'appointment',
        appointment_id: id,
      }).catch(console.error);
    });
  });

  await notifService.createNotification(io, {
    user_id,
    title: 'Appointment Confirmed',
    message: `Your appointment at ${fullAppt.center_name} on ${appointment_date} at ${appointment_time} is confirmed. Token #${appt.queue_number}`,
    type: 'appointment',
    appointment_id: id,
  });

  if (getPriorityRank(appt.priority) < getPriorityRank('normal')) {
    await notifyPriorityDelayImpacts(io, fullAppt, previousById, recalculatedAppointments);
  }

  io?.emit('queue:update', { center_id, doctor_id, appointment_date });
  res.status(201).json({ success: true, appointment: appt });
});

exports.getMyAppointments = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT a.*, c.name AS center_name, c.address, d.name AS doctor_name, d.specialization
    FROM appointments a
    JOIN centers c ON c.id = a.center_id
    LEFT JOIN doctors d ON d.id = a.doctor_id
    WHERE a.user_id=?
  `;
  const params = [req.user.id];
  if (status) {
    query += ' AND a.status=?';
    params.push(status);
  }
  query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

  const result = await db.query(query, params);
  res.json({ success: true, appointments: result.rows });
});

exports.getAppointmentById = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT a.*, c.name AS center_name, c.address, c.contact_details,
            d.name AS doctor_name, d.specialization,
            u.name AS user_name, u.email AS user_email
     FROM appointments a
     JOIN centers c ON c.id = a.center_id
     LEFT JOIN doctors d ON d.id = a.doctor_id
     JOIN users u ON u.id = a.user_id
     WHERE a.id=?`,
    [req.params.id]
  );
  if (!result.rows.length) {
    return res.status(404).json({ success: false, message: 'Appointment not found' });
  }
  const appt = result.rows[0];
  if (appt.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  res.json({ success: true, appointment: appt });
});

exports.rescheduleAppointment = asyncHandler(async (req, res) => {
  const { appointment_date, appointment_time } = req.body;
  const { id } = req.params;

  const existing = await db.query('SELECT * FROM appointments WHERE id=?', [id]);
  if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  const appt = existing.rows[0];
  if (appt.user_id !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });
  if (appt.status === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cannot reschedule cancelled appointment' });
  }

  const originalDate = appt.appointment_date;
  const { queue_number, patients_before, estimated_wait_minutes } = await calculateQueue(
    db,
    appt.doctor_id,
    appt.center_id,
    appointment_date,
    appointment_time,
    appt.priority
  );

  await db.query(
    `UPDATE appointments SET appointment_date=?, appointment_time=?,
     queue_number=?, patients_before=?, estimated_wait_minutes=?, status='confirmed'
     WHERE id=?`,
    [appointment_date, appointment_time, queue_number, patients_before, estimated_wait_minutes, id]
  );

  const io = req.app.get('io');
  if (originalDate !== appointment_date) {
    await recalculateQueueState(db, appt.doctor_id, appt.center_id, originalDate);
  }

  const refreshedScope = await recalculateQueueState(
    db,
    appt.doctor_id,
    appt.center_id,
    appointment_date
  );
  const updatedAppt = refreshedScope.appointments.find((item) => item.id === id) || {
    ...appt,
    appointment_date,
    appointment_time,
    queue_number,
    patients_before,
    estimated_wait_minutes,
  };

  if (getPriorityRank(appt.priority) < getPriorityRank('normal')) {
    const centerResult = await db.query('SELECT name FROM centers WHERE id=?', [appt.center_id]);
    await notifyPriorityDelayImpacts(
      io,
      { ...updatedAppt, center_name: centerResult.rows[0]?.name || 'the center' },
      refreshedScope.previousById,
      refreshedScope.appointments
    );
  }

  io?.emit('queue:update', {
    center_id: appt.center_id,
    doctor_id: appt.doctor_id,
    appointment_date,
  });
  if (originalDate !== appointment_date) {
    io?.emit('queue:update', {
      center_id: appt.center_id,
      doctor_id: appt.doctor_id,
      appointment_date: originalDate,
    });
  }

  res.json({ success: true, appointment: updatedAppt });
});

exports.cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await db.query('SELECT * FROM appointments WHERE id=?', [id]);
  if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Not found' });

  const appt = existing.rows[0];
  if (appt.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  await db.query(`UPDATE appointments SET status='cancelled' WHERE id=?`, [id]);
  await recalculateQueueState(db, appt.doctor_id, appt.center_id, appt.appointment_date);

  const userResult = await db.query('SELECT name, email FROM users WHERE id=?', [appt.user_id]);
  const centerResult = await db.query('SELECT name FROM centers WHERE id=?', [appt.center_id]);
  const io = req.app.get('io');
  await notifService.createNotification(io, {
    user_id: appt.user_id,
    title: 'Appointment Cancelled',
    message: `Your appointment at ${centerResult.rows[0]?.name} on ${String(appt.appointment_date).split('T')[0]} has been cancelled.`,
    type: 'cancellation',
    appointment_id: id,
  });
  mailService.sendCancellation(userResult.rows[0], { ...appt, center_name: centerResult.rows[0]?.name }).catch(console.error);

  getAdminNotificationRecipients(appt.center_id).then((admins) => {
    admins.forEach((admin) => {
      adminMailService.notifyCancellation(admin.email, appt, userResult.rows[0]).catch(console.error);
      notifService.createNotification(io, {
        user_id: admin.id,
        title: 'Appointment Cancelled',
        message: `${userResult.rows[0]?.name || 'A patient'} cancelled an appointment at ${centerResult.rows[0]?.name} on ${String(appt.appointment_date).split('T')[0]}.`,
        type: 'cancellation',
        appointment_id: appt.id,
      }).catch(console.error);
    });
  });

  io?.emit('queue:update', {
    center_id: appt.center_id,
    doctor_id: appt.doctor_id,
    appointment_date: appt.appointment_date,
  });
  res.json({ success: true, message: 'Appointment cancelled' });
});
