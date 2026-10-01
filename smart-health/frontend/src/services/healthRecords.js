import api from '../api/axios';

const REPORTS_KEY = 'smarthealth:reports';
const PRESCRIPTIONS_KEY = 'smarthealth:prescriptions';
const ATTACHMENTS_KEY = 'smarthealth:appointment-attachments';
const TELEMEDICINE_OPEN_BEFORE_MINUTES = 10;
const TELEMEDICINE_OPEN_AFTER_MINUTES = 60;

export const REPORT_CATEGORIES = [
  'Blood Test',
  'Urine Test',
  'X-Ray',
  'MRI',
  'CT Scan',
  'ECG',
  'Prescription',
  'Medical Certificate',
  'Lab Report',
  'Other',
];

const defaultReports = [
  {
    id: 'report-blood-aug-2026',
    name: 'Annual Blood Panel',
    type: 'Blood Test',
    hospital: 'SmartHealth Diagnostics',
    doctor: 'Dr. Meera Shah',
    date: '2026-08-20',
    description: 'CBC, Hb, glucose, and cholesterol values from routine screening.',
    fileName: 'Annual-Blood-Panel.pdf',
    fileType: 'PDF',
    fileSize: 184000,
    status: 'Uploaded',
    content: 'Sample blood panel: Hb, WBC, platelet count, fasting glucose, HDL, LDL.',
    createdAt: '2026-08-20T09:30:00.000Z',
  },
  {
    id: 'report-xray-aug-2026',
    name: 'Chest X-Ray',
    type: 'X-Ray',
    hospital: 'City Care Hospital',
    doctor: 'Dr. Arjun Rao',
    date: '2026-08-12',
    description: 'Follow-up imaging after cough consultation.',
    fileName: 'Chest-X-Ray.png',
    fileType: 'PNG',
    fileSize: 920000,
    status: 'Uploaded',
    content: 'Sample radiology note: image reviewed by clinician; follow doctor instructions.',
    createdAt: '2026-08-12T11:15:00.000Z',
  },
];

const defaultPrescriptions = [
  {
    id: 'rx-aug-2026',
    doctorName: 'Dr. Meera Shah',
    patientName: 'Patient',
    date: '2026-08-21',
    diagnosis: 'Follow-up care after routine blood test',
    medicines: [
      { name: 'Vitamin D3', dosage: '60,000 IU', frequency: 'Once weekly', duration: '6 weeks', instructions: 'Take after food unless your doctor advised otherwise.' },
      { name: 'Pantoprazole', dosage: '40 mg', frequency: 'Once daily', duration: '5 days', instructions: 'Usually taken before breakfast.' },
    ],
    notes: 'Review symptoms and repeat labs if advised during follow-up.',
  },
];

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function getReports() {
  return read(REPORTS_KEY, defaultReports);
}

export function getReportsForUser(user) {
  const reports = getReports();
  if (!user?.email && !user?.id) return reports;
  return reports.filter((report) => {
    if (!report.patientEmail && !report.patientId) return true;
    return report.patientEmail === user.email || String(report.patientId) === String(user.id);
  });
}

export function saveReport(report) {
  const reports = getReports();
  const nextReport = {
    ...report,
    id: report.id || crypto.randomUUID(),
    status: report.status || 'Uploaded',
    fileName: report.fileName || `${String(report.name || 'Health-Report').replace(/\s+/g, '-')}.txt`,
    fileType: report.fileType || 'TXT',
    createdAt: report.createdAt || new Date().toISOString(),
  };
  const next = [nextReport, ...reports.filter((item) => item.id !== nextReport.id)];
  return write(REPORTS_KEY, next);
}

export function deleteReport(id) {
  return write(REPORTS_KEY, getReports().filter((report) => report.id !== id));
}

export async function fetchReports() {
  const res = await api.get('/health-records/reports');
  return res.data.reports || [];
}

export async function uploadReport(report) {
  const res = await api.post('/health-records/reports', report);
  return res.data.report;
}

export async function removeReport(id) {
  await api.delete(`/health-records/reports/${id}`);
}

export async function fetchPrescriptions() {
  const res = await api.get('/health-records/prescriptions');
  return res.data.prescriptions || [];
}

export async function fetchAppointmentRecords(appointmentId) {
  const res = await api.get(`/health-records/appointments/${appointmentId}/records`);
  return {
    reports: res.data.reports || [],
    prescriptions: res.data.prescriptions || [],
  };
}

export async function sendDoctorReport(appointmentId, report) {
  const res = await api.post(`/health-records/appointments/${appointmentId}/reports`, report);
  return res.data.report;
}

export async function sendDoctorPrescription(appointmentId, prescription) {
  const res = await api.post(`/health-records/appointments/${appointmentId}/prescriptions`, prescription);
  return res.data.prescription;
}

export function getPrescriptions() {
  return read(PRESCRIPTIONS_KEY, defaultPrescriptions);
}

export function getPrescriptionsForUser(user) {
  const prescriptions = getPrescriptions();
  if (!user?.email && !user?.id) return prescriptions;
  return prescriptions.filter((prescription) => {
    if (!prescription.patientEmail && !prescription.patientId) return true;
    return prescription.patientEmail === user.email || String(prescription.patientId) === String(user.id);
  });
}

export function savePrescription(prescription) {
  const nextPrescription = {
    ...prescription,
    id: prescription.id || crypto.randomUUID(),
    createdAt: prescription.createdAt || new Date().toISOString(),
  };
  return write(PRESCRIPTIONS_KEY, [nextPrescription, ...getPrescriptions().filter((item) => item.id !== nextPrescription.id)]);
}

export function getAppointmentAttachments(appointmentId) {
  const all = read(ATTACHMENTS_KEY, {});
  return all[appointmentId] || { reports: [], prescriptions: [] };
}

export function saveAppointmentAttachments(appointmentId, attachments) {
  const all = read(ATTACHMENTS_KEY, {});
  all[appointmentId] = {
    reports: attachments.reports || [],
    prescriptions: attachments.prescriptions || [],
    consultationType: attachments.consultationType || all[appointmentId]?.consultationType || 'in_person',
    meetingUrl: attachments.meetingUrl || all[appointmentId]?.meetingUrl || '',
    roomId: attachments.roomId || all[appointmentId]?.roomId || '',
    acceptedAt: attachments.acceptedAt || all[appointmentId]?.acceptedAt || '',
  };
  write(ATTACHMENTS_KEY, all);
  return all[appointmentId];
}

export function downloadTextFile(fileName, content) {
  const safeContent = String(content || '').trim() || 'No content is available for this record yet.';
  const blob = new Blob([safeContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReport(report) {
  if (report.id && !String(report.id).startsWith('report-')) {
    const res = await api.get(`/health-records/reports/${report.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.fileName || `${report.name || 'Health-Report'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  downloadTextFile(report.fileName, report.content || buildReportText(report));
}

export function buildReportText(report) {
  return [
    'SmartHealth Medical Report',
    `Report: ${report.name || 'Health Report'}`,
    `Type: ${report.type || 'General'}`,
    `Patient: ${report.patientName || 'Patient'}`,
    `Doctor: ${report.doctor || 'Not specified'}`,
    `Hospital/Lab: ${report.hospital || 'Not specified'}`,
    `Date: ${report.date || new Date().toISOString().slice(0, 10)}`,
    '',
    'Summary',
    report.description || 'No summary provided.',
    '',
    'Findings',
    report.findings || report.content || 'No detailed findings were entered.',
    '',
    'Recommendation',
    report.recommendation || 'Please review this report with your doctor.',
  ].join('\n');
}

export function buildPrescriptionText(prescription) {
  const meds = prescription.medicines
    .map((med) => `${med.name} - ${med.dosage}, ${med.frequency}, ${med.duration}. ${med.instructions}`)
    .join('\n');
  return [
    'SmartHealth E-Prescription',
    `Doctor: ${prescription.doctorName}`,
    `Patient: ${prescription.patientName}`,
    `Date: ${prescription.date}`,
    `Reason: ${prescription.diagnosis}`,
    '',
    meds,
    '',
    `Notes: ${prescription.notes || 'None'}`,
    '',
    'This file is a patient copy. Consult your doctor before changing medicines.',
  ].join('\n');
}

export function getConsultationType(appointment) {
  const issue = String(appointment?.issue || '').toLowerCase();
  const attachments = appointment?.id ? getAppointmentAttachments(appointment.id) : {};
  const consultationType = String(appointment?.consultation_type || '').toLowerCase();
  const telemedicineStatus = String(appointment?.telemedicine_status || '').toLowerCase();

  if (consultationType === 'telemedicine') return 'telemedicine';
  if (telemedicineStatus && telemedicineStatus !== 'not_requested') return 'telemedicine';
  if (appointment?.telemedicine_room_id) return 'telemedicine';
  if (attachments.consultationType === 'telemedicine' || issue.includes('consultation type: telemedicine')) return 'telemedicine';
  return 'in_person';
}

export function buildTelemedicineRoom(appointment) {
  const roomId = `smarthealth-${appointment.id}`;
  return {
    roomId,
    meetingUrl: `/telemedicine?appointment=${appointment.id}`,
  };
}

export function getTelemedicineAccess(appointment, now = new Date()) {
  const isTelemedicineAppointment =
    String(appointment?.consultation_type || '').toLowerCase() === 'telemedicine'
    || String(appointment?.telemedicine_status || '').toLowerCase() !== 'not_requested'
    || Boolean(appointment?.telemedicine_room_id);

  if (isTelemedicineAppointment) {
    return {
      canJoin: true,
      state: 'open',
      label: 'Video room is ready. You can join the consultation now.',
      opensAt: null,
      closesAt: null,
    };
  }

  if (!appointment?.appointment_date || !appointment?.appointment_time) {
    return {
      canJoin: false,
      state: 'missing_time',
      label: 'Appointment time is missing.',
      opensAt: null,
      closesAt: null,
    };
  }

  const dateStr = String(appointment.appointment_date).split('T')[0];
  const timeStr = String(appointment.appointment_time).slice(0, 5);
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const startsAt = new Date(year, month - 1, day, hour, minute);
  const opensAt = new Date(startsAt.getTime() - TELEMEDICINE_OPEN_BEFORE_MINUTES * 60000);
  const closesAt = new Date(startsAt.getTime() + TELEMEDICINE_OPEN_AFTER_MINUTES * 60000);

  if (Number.isNaN(startsAt.getTime())) {
    return {
      canJoin: false,
      state: 'invalid_time',
      label: 'Appointment time is invalid.',
      opensAt: null,
      closesAt: null,
    };
  }

  if (now < opensAt) {
    return {
      canJoin: false,
      state: 'too_early',
      label: `Video room opens 10 minutes before the booked time (${startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}).`,
      opensAt,
      closesAt,
    };
  }

  if (now > closesAt) {
    return {
      canJoin: false,
      state: 'expired',
      label: 'Video room expired 60 minutes after the booked time.',
      opensAt,
      closesAt,
    };
  }

  return {
    canJoin: true,
    state: 'open',
    label: 'Video room is open now.',
    opensAt,
    closesAt,
  };
}
