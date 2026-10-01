const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

let ensured = false;

async function ensureTables() {
  if (ensured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS medical_reports (
      id VARCHAR(36) PRIMARY KEY,
      patient_id VARCHAR(36) NOT NULL,
      appointment_id VARCHAR(36),
      name VARCHAR(180) NOT NULL,
      type VARCHAR(80) NOT NULL,
      hospital VARCHAR(180),
      doctor VARCHAR(120),
      report_date DATE NOT NULL,
      description TEXT,
      findings TEXT,
      recommendation TEXT,
      file_name VARCHAR(220),
      file_type VARCHAR(40),
      file_size INT DEFAULT 0,
      status VARCHAR(60) DEFAULT 'Uploaded',
      content LONGTEXT NOT NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id VARCHAR(36) PRIMARY KEY,
      patient_id VARCHAR(36) NOT NULL,
      appointment_id VARCHAR(36),
      doctor_name VARCHAR(120),
      patient_name VARCHAR(120),
      prescription_date DATE NOT NULL,
      diagnosis TEXT NOT NULL,
      medicines JSON NOT NULL,
      notes TEXT,
      content LONGTEXT NOT NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_record_links (
      id VARCHAR(36) PRIMARY KEY,
      appointment_id VARCHAR(36) NOT NULL,
      record_type ENUM('report','prescription') NOT NULL,
      record_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_appointment_record (appointment_id, record_type, record_id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);
  ensured = true;
}

function buildReportText(report) {
  return [
    'SmartHealth Medical Report',
    `Report: ${report.name || 'Health Report'}`,
    `Type: ${report.type || 'General'}`,
    `Patient: ${report.patient_name || report.patientName || 'Patient'}`,
    `Doctor: ${report.doctor || 'Not specified'}`,
    `Hospital/Lab: ${report.hospital || 'Not specified'}`,
    `Date: ${report.report_date || report.date || new Date().toISOString().slice(0, 10)}`,
    '',
    'Summary',
    report.description || 'No summary provided.',
    '',
    'Findings',
    report.findings || 'No detailed findings were entered.',
    '',
    'Recommendation',
    report.recommendation || 'Please review this report with your doctor.',
  ].join('\n');
}

function buildPrescriptionText(prescription) {
  const medicines = Array.isArray(prescription.medicines) ? prescription.medicines : [];
  return [
    'SmartHealth E-Prescription',
    `Doctor: ${prescription.doctor_name || prescription.doctorName || 'Doctor'}`,
    `Patient: ${prescription.patient_name || prescription.patientName || 'Patient'}`,
    `Date: ${prescription.prescription_date || prescription.date || new Date().toISOString().slice(0, 10)}`,
    `Reason: ${prescription.diagnosis || 'Consultation'}`,
    '',
    ...medicines.map((med) => `${med.name || 'Medicine'} - ${med.dosage || 'As prescribed'}, ${med.frequency || 'As advised'}, ${med.duration || 'As advised'}. ${med.instructions || ''}`),
    '',
    `Notes: ${prescription.notes || 'None'}`,
    '',
    'This file is a patient copy. Consult your doctor before changing medicines.',
  ].join('\n');
}

function normalizeReport(row) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    name: row.name,
    type: row.type,
    hospital: row.hospital,
    doctor: row.doctor,
    date: row.report_date,
    description: row.description,
    findings: row.findings,
    recommendation: row.recommendation,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    status: row.status,
    content: row.content,
    createdAt: row.created_at,
  };
}

function normalizePrescription(row) {
  let medicines = [];
  try {
    medicines = typeof row.medicines === 'string' ? JSON.parse(row.medicines) : row.medicines;
  } catch {
    medicines = [];
  }
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientId: row.patient_id,
    doctorName: row.doctor_name,
    patientName: row.patient_name,
    date: row.prescription_date,
    diagnosis: row.diagnosis,
    medicines,
    notes: row.notes,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function getAppointmentForAdmin(appointmentId, admin) {
  const result = await db.query(
    `SELECT a.*, u.name AS patient_name, u.email AS patient_email, c.name AS center_name, d.name AS doctor_name
     FROM appointments a
     JOIN users u ON u.id=a.user_id
     JOIN centers c ON c.id=a.center_id
     LEFT JOIN doctors d ON d.id=a.doctor_id
     WHERE a.id=?`,
    [appointmentId]
  );
  const appt = result.rows[0];
  if (!appt) return null;
  if (admin.admin_scope === 'hospital' && !admin.authorized_center_ids?.includes(appt.center_id)) {
    const error = new Error('Forbidden');
    error.status = 403;
    throw error;
  }
  return appt;
}

router.use(authenticate);

router.get('/reports', asyncHandler(async (req, res) => {
  await ensureTables();
  const patientId = req.user.role === 'admin' && req.query.patient_id ? req.query.patient_id : req.user.id;
  const result = await db.query(
    `SELECT r.*, u.name AS patient_name
     FROM medical_reports r
     JOIN users u ON u.id=r.patient_id
     WHERE r.patient_id=?
     ORDER BY r.report_date DESC, r.created_at DESC`,
    [patientId]
  );
  res.json({ success: true, reports: result.rows.map(normalizeReport) });
}));

router.post('/reports', asyncHandler(async (req, res) => {
  await ensureTables();
  const id = uuidv4();
  const report = {
    ...req.body,
    id,
    patient_id: req.user.id,
    patient_name: req.user.name,
    report_date: req.body.date || new Date().toISOString().slice(0, 10),
    status: 'Patient Uploaded',
  };
  const content = req.body.content || buildReportText(report);
  await db.query(
    `INSERT INTO medical_reports
     (id, patient_id, appointment_id, name, type, hospital, doctor, report_date, description, findings, recommendation, file_name, file_type, file_size, status, content, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      req.user.id,
      req.body.appointmentId || null,
      req.body.name || 'Health Report',
      req.body.type || 'General',
      req.body.hospital || 'Patient Upload',
      req.body.doctor || 'Not specified',
      report.report_date,
      req.body.description || '',
      req.body.findings || req.body.description || '',
      req.body.recommendation || 'Please review this report with your doctor.',
      req.body.fileName || `Report-${id}.txt`,
      req.body.fileType || 'TXT',
      Number(req.body.fileSize || 0),
      report.status,
      content,
      req.user.id,
    ]
  );
  res.status(201).json({ success: true, report: normalizeReport({ ...report, file_name: req.body.fileName || `Report-${id}.txt`, file_type: req.body.fileType || 'TXT', file_size: Number(req.body.fileSize || 0), content, created_at: new Date().toISOString() }) });
}));

router.get('/reports/:id/download', asyncHandler(async (req, res) => {
  await ensureTables();
  const result = await db.query('SELECT * FROM medical_reports WHERE id=?', [req.params.id]);
  const report = result.rows[0];
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
  if (req.user.role !== 'admin' && report.patient_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const fileName = report.file_name || `Report-${report.id}.txt`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
  res.send(report.content || buildReportText(report));
}));

router.delete('/reports/:id', asyncHandler(async (req, res) => {
  await ensureTables();
  const result = await db.query('SELECT * FROM medical_reports WHERE id=?', [req.params.id]);
  const report = result.rows[0];
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
  if (req.user.role !== 'admin' && report.patient_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  await db.query('DELETE FROM appointment_record_links WHERE record_type=? AND record_id=?', ['report', req.params.id]);
  await db.query('DELETE FROM medical_reports WHERE id=?', [req.params.id]);
  res.json({ success: true, message: 'Report deleted' });
}));

router.get('/prescriptions', asyncHandler(async (req, res) => {
  await ensureTables();
  const patientId = req.user.role === 'admin' && req.query.patient_id ? req.query.patient_id : req.user.id;
  const result = await db.query(
    `SELECT p.*, u.name AS patient_name
     FROM prescriptions p
     JOIN users u ON u.id=p.patient_id
     WHERE p.patient_id=?
     ORDER BY p.prescription_date DESC, p.created_at DESC`,
    [patientId]
  );
  res.json({ success: true, prescriptions: result.rows.map(normalizePrescription) });
}));

router.get('/appointments/:id/records', asyncHandler(async (req, res) => {
  await ensureTables();
  const apptResult = await db.query('SELECT * FROM appointments WHERE id=?', [req.params.id]);
  const appt = apptResult.rows[0];
  if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
  if (req.user.role !== 'admin' && appt.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const reportResult = await db.query(
    `SELECT r.*, u.name AS patient_name
     FROM medical_reports r
     JOIN users u ON u.id=r.patient_id
     WHERE r.patient_id=? AND (r.appointment_id=? OR r.id IN (
       SELECT record_id FROM appointment_record_links WHERE appointment_id=? AND record_type='report'
     ))
     ORDER BY r.report_date DESC`,
    [appt.user_id, req.params.id, req.params.id]
  );
  const rxResult = await db.query(
    `SELECT p.*, u.name AS patient_name
     FROM prescriptions p
     JOIN users u ON u.id=p.patient_id
     WHERE p.patient_id=? AND (p.appointment_id=? OR p.id IN (
       SELECT record_id FROM appointment_record_links WHERE appointment_id=? AND record_type='prescription'
     ))
     ORDER BY p.prescription_date DESC`,
    [appt.user_id, req.params.id, req.params.id]
  );
  res.json({
    success: true,
    reports: reportResult.rows.map(normalizeReport),
    prescriptions: rxResult.rows.map(normalizePrescription),
  });
}));

router.post('/appointments/:id/reports', authorizeAdmin, asyncHandler(async (req, res) => {
  await ensureTables();
  const appt = await getAppointmentForAdmin(req.params.id, req.user);
  if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
  const id = uuidv4();
  const report = {
    ...req.body,
    id,
    patient_id: appt.user_id,
    patient_name: appt.patient_name,
    appointment_id: appt.id,
    report_date: req.body.date || new Date().toISOString().slice(0, 10),
  };
  const content = req.body.content || buildReportText(report);
  await db.query(
    `INSERT INTO medical_reports
     (id, patient_id, appointment_id, name, type, hospital, doctor, report_date, description, findings, recommendation, file_name, file_type, file_size, status, content, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      appt.user_id,
      appt.id,
      req.body.name || 'Doctor Consultation Report',
      req.body.type || 'Doctor Consultation',
      req.body.hospital || appt.center_name,
      req.body.doctor || appt.doctor_name || req.user.name,
      report.report_date,
      req.body.description || '',
      req.body.findings || '',
      req.body.recommendation || 'Follow the doctor advice and prescribed care plan.',
      req.body.fileName || `Report-${appt.id}.txt`,
      req.body.fileType || 'TXT',
      Number(req.body.fileSize || 0),
      req.body.status || 'Doctor Sent',
      content,
      req.user.id,
    ]
  );
  await db.query(
    'INSERT IGNORE INTO appointment_record_links (id, appointment_id, record_type, record_id) VALUES (?,?,?,?)',
    [uuidv4(), appt.id, 'report', id]
  );
  req.app.get('io')?.to(`user:${appt.user_id}`).emit('records:updated', { type: 'report', appointmentId: appt.id });
  res.status(201).json({ success: true, report: normalizeReport({ ...report, name: req.body.name || 'Doctor Consultation Report', type: req.body.type || 'Doctor Consultation', hospital: req.body.hospital || appt.center_name, doctor: req.body.doctor || appt.doctor_name || req.user.name, file_name: req.body.fileName || `Report-${appt.id}.txt`, file_type: req.body.fileType || 'TXT', file_size: Number(req.body.fileSize || 0), status: req.body.status || 'Doctor Sent', content, created_at: new Date().toISOString() }) });
}));

router.post('/appointments/:id/prescriptions', authorizeAdmin, asyncHandler(async (req, res) => {
  await ensureTables();
  const appt = await getAppointmentForAdmin(req.params.id, req.user);
  if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
  const id = uuidv4();
  const medicines = Array.isArray(req.body.medicines) && req.body.medicines.length
    ? req.body.medicines
    : [{ name: 'Medicine name', dosage: 'As prescribed', frequency: 'As advised', duration: 'As advised', instructions: 'Update with doctor instructions.' }];
  const prescription = {
    id,
    patient_id: appt.user_id,
    patient_name: appt.patient_name,
    appointment_id: appt.id,
    doctor_name: req.body.doctorName || appt.doctor_name || req.user.name,
    prescription_date: req.body.date || new Date().toISOString().slice(0, 10),
    diagnosis: req.body.diagnosis || 'Consultation prescription',
    medicines,
    notes: req.body.notes || 'Follow doctor instructions.',
  };
  const content = req.body.content || buildPrescriptionText(prescription);
  await db.query(
    `INSERT INTO prescriptions
     (id, patient_id, appointment_id, doctor_name, patient_name, prescription_date, diagnosis, medicines, notes, content, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, appt.user_id, appt.id, prescription.doctor_name, appt.patient_name, prescription.prescription_date, prescription.diagnosis, JSON.stringify(medicines), prescription.notes, content, req.user.id]
  );
  await db.query(
    'INSERT IGNORE INTO appointment_record_links (id, appointment_id, record_type, record_id) VALUES (?,?,?,?)',
    [uuidv4(), appt.id, 'prescription', id]
  );
  req.app.get('io')?.to(`user:${appt.user_id}`).emit('records:updated', { type: 'prescription', appointmentId: appt.id });
  res.status(201).json({ success: true, prescription: normalizePrescription({ ...prescription, medicines: JSON.stringify(medicines), content, created_at: new Date().toISOString() }) });
}));

module.exports = router;
