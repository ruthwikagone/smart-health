import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { StatusBadge, PriorityBadge } from '../../components/ui/StatusBadge';
import { formatDate, formatTime, formatDoctorName, getAdminBasePath, getAuthorizedCenters, isHospitalAdmin, parseAppointmentIssue } from '../../utils/helpers';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  buildReportText,
  buildTelemedicineRoom,
  fetchAppointmentRecords,
  getAppointmentAttachments,
  getConsultationType,
  getPrescriptions,
  getReports,
  sendDoctorPrescription,
  sendDoctorReport,
  saveAppointmentAttachments,
  savePrescription,
  saveReport,
} from '../../services/healthRecords';

const STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

export default function AdminAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', date: '', center_id: '' });
  const [manualReportFor, setManualReportFor] = useState(null);
  const [manualReport, setManualReport] = useState({ name: '', type: 'Doctor Consultation', findings: '', recommendation: '' });
  const [appointmentRecords, setAppointmentRecords] = useState({});
  const centers = useMemo(() => getAuthorizedCenters(user), [user]);

  const fetchAppointments = () => {
    setLoading(true);
    api.get('/admin/appointments', { params: filters })
      .then((r) => {
        const list = r.data.appointments || [];
        setAppointments(list);
        Promise.all(list.map((appointment) => refreshAppointmentRecords(appointment.id))).catch(() => {});
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
  }, [filters]);

  const handleStatus = async (id, status) => {
    try {
      await api.patch(`/admin/appointments/${id}/status`, { status });
      toast.success('Status updated');
      fetchAppointments();
    } catch {
      toast.error('Failed to update');
    }
  };

  const refreshAppointmentRecords = async (appointmentId) => {
    try {
      const records = await fetchAppointmentRecords(appointmentId);
      setAppointmentRecords((current) => ({ ...current, [appointmentId]: records }));
    } catch {
      setAppointmentRecords((current) => ({ ...current, [appointmentId]: { reports: [], prescriptions: [] } }));
    }
  };

  const handleCreatePrescription = async (appointment) => {
    const prescriptionId = crypto.randomUUID();
    const payload = {
      id: prescriptionId,
      appointmentId: appointment.id,
      patientId: appointment.user_id,
      patientName: appointment.user_name,
      patientEmail: appointment.user_email,
      doctorName: formatDoctorName(appointment.doctor_name),
      date: new Date().toISOString().slice(0, 10),
      diagnosis: parseAppointmentIssue(appointment.issue).summary || 'Consultation prescription',
      medicines: [
        { name: 'Medicine name', dosage: 'As prescribed', frequency: 'As advised', duration: 'As advised', instructions: 'Update with doctor instructions.' },
      ],
      notes: 'Draft prescription created from doctor appointment actions.',
    };
    try {
      await sendDoctorPrescription(appointment.id, payload);
      await refreshAppointmentRecords(appointment.id);
      toast.success('E-prescription sent to patient profile');
    } catch {
      savePrescription(payload);
      const attachments = getAppointmentAttachments(appointment.id);
      saveAppointmentAttachments(appointment.id, {
        ...attachments,
        prescriptions: [...new Set([...attachments.prescriptions, prescriptionId])],
      });
      toast.error('Backend unavailable, saved e-prescription in this browser only.');
    }
  };

  const handleGenerateReport = async (appointment, override = {}) => {
    const issue = parseAppointmentIssue(appointment.issue);
    const report = {
      id: crypto.randomUUID(),
      appointmentId: appointment.id,
      patientId: appointment.user_id,
      patientName: appointment.user_name,
      patientEmail: appointment.user_email,
      name: override.name || `${issue.summary || 'Consultation'} Report`,
      type: override.type || 'Doctor Consultation',
      hospital: appointment.center_name,
      doctor: formatDoctorName(appointment.doctor_name),
      date: new Date().toISOString().slice(0, 10),
      description: override.description || `Generated after appointment #${appointment.queue_number}.`,
      findings: override.findings || `Reason: ${issue.summary || issue.raw || 'Consultation'}\nSymptoms: ${issue.symptoms.join(', ') || 'Not recorded'}\nNotes: ${issue.notes || 'No extra notes recorded.'}`,
      recommendation: override.recommendation || 'Follow the doctor advice and review the e-prescription if issued.',
      fileName: `Report-${appointment.id}.txt`,
      fileType: 'TXT',
      fileSize: 0,
      status: override.status || 'Doctor Sent',
    };
    try {
      await sendDoctorReport(appointment.id, { ...report, content: buildReportText(report) });
      await refreshAppointmentRecords(appointment.id);
      toast.success('Report sent to patient downloads');
    } catch {
      saveReport({ ...report, content: buildReportText(report) });
      const attachments = getAppointmentAttachments(appointment.id);
      saveAppointmentAttachments(appointment.id, {
        ...attachments,
        reports: [...new Set([...attachments.reports, report.id])],
      });
      toast.error('Backend unavailable, saved report in this browser only.');
    }
  };

  const handleManualReportSubmit = async (appointment) => {
    if (!manualReport.findings.trim()) {
      toast.error('Enter report findings before sending.');
      return;
    }
    await handleGenerateReport(appointment, {
      name: manualReport.name.trim() || 'Doctor Manual Report',
      type: manualReport.type.trim() || 'Doctor Consultation',
      description: `Manual doctor report for appointment #${appointment.queue_number}.`,
      findings: manualReport.findings.trim(),
      recommendation: manualReport.recommendation.trim() || 'Follow the doctor advice.',
      status: 'Doctor Manual Report',
    });
    setManualReportFor(null);
    setManualReport({ name: '', type: 'Doctor Consultation', findings: '', recommendation: '' });
  };

  const handleAcceptTelemedicine = async (appointment) => {
    const room = buildTelemedicineRoom(appointment);
    const attachments = getAppointmentAttachments(appointment.id);
    saveAppointmentAttachments(appointment.id, {
      ...attachments,
      consultationType: 'telemedicine',
      roomId: room.roomId,
      meetingUrl: room.meetingUrl,
      acceptedAt: new Date().toISOString(),
    });
    await handleStatus(appointment.id, appointment.status === 'confirmed' ? 'in_progress' : appointment.status);
    toast.success('Telemedicine room accepted and ready');
  };

  const handleEnableTelemedicine = (appointment) => {
    const room = buildTelemedicineRoom(appointment);
    const attachments = getAppointmentAttachments(appointment.id);
    saveAppointmentAttachments(appointment.id, {
      ...attachments,
      consultationType: 'telemedicine',
      roomId: room.roomId,
      meetingUrl: room.meetingUrl,
    });
    toast.success('Video consultation enabled. You can now accept and join it.');
    fetchAppointments();
  };

  return (
    <div className="portal-page">
      <h1 className="text-2xl font-bold mb-2">All Appointments</h1>
      {isHospitalAdmin(user) && (
        <p className="text-sm text-gray-500 mb-6">
          You can view and manage only these hospitals: {centers.map((c) => c.name).join(', ') || 'assigned hospitals'}.
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {isHospitalAdmin(user) && (
          <select className="input max-w-xs" value={filters.center_id} onChange={(e) => setFilters({ ...filters, center_id: e.target.value })}>
            <option value="">All Authorized Hospitals</option>
            {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
          </select>
        )}
        <select className="input max-w-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
        <input type="date" className="input max-w-xs" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <button onClick={() => setFilters({ status: '', date: '', center_id: '' })} className="btn-secondary text-sm">Clear</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div>
        : appointments.length === 0 ? <EmptyState icon="Appointments" title="No appointments found" />
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b dark:border-gray-700">
                  {['#', 'Patient', 'Center', 'Doctor', 'Date & Time', 'Status', 'Priority', 'Actions'].map((heading) => (
                    <th key={heading} className="pb-3 pr-4 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {appointments.map((appointment) => {
                  const issue = parseAppointmentIssue(appointment.issue);
                  const attachments = getAppointmentAttachments(appointment.id);
                  const syncedRecords = appointmentRecords[appointment.id] || {};
                  const attachedReports = syncedRecords.reports || getReports().filter((report) => attachments.reports.includes(report.id));
                  const attachedPrescriptions = syncedRecords.prescriptions || getPrescriptions().filter((prescription) => attachments.prescriptions.includes(prescription.id));
                  const isTelemedicine = getConsultationType(appointment) === 'telemedicine';
                  return (
                  <tr key={appointment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 pr-4 font-bold text-blue-600">#{appointment.queue_number}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{appointment.user_name}</p>
                      <p className="text-xs text-gray-400">{appointment.user_email}</p>
                      <p className="text-xs text-gray-500 mt-1">Profile: basic details, allergies, and conditions from patient record.</p>
                      {issue.symptoms.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">Symptoms: {issue.symptoms.join(', ')}</p>
                      )}
                      {(issue.summary || issue.notes) && (
                        <p className="text-xs text-gray-500 mt-1">{issue.summary || issue.notes}</p>
                      )}
                      {isTelemedicine ? (
                        <p className="mt-1 text-xs font-semibold text-purple-600">Telemedicine appointment</p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold text-gray-500">Hospital visit appointment</p>
                      )}
                      {(attachedReports.length > 0 || attachedPrescriptions.length > 0) && (
                        <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
                          <p>Reports: {attachedReports.map((report) => report.name).join(', ') || 'None'}</p>
                          <p>Previous prescriptions: {attachedPrescriptions.map((prescription) => prescription.diagnosis).join(', ') || 'None'}</p>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">{appointment.center_name}</td>
                    <td className="py-3 pr-4">{formatDoctorName(appointment.doctor_name)}</td>
                    <td className="py-3 pr-4">
                      <p>{formatDate(appointment.appointment_date)}</p>
                      <p className="text-xs text-gray-400">{formatTime(appointment.appointment_time)}</p>
                    </td>
                    <td className="py-3 pr-4"><StatusBadge status={appointment.status} /></td>
                    <td className="py-3 pr-4"><PriorityBadge priority={appointment.priority} /></td>
                    <td className="py-3">
                      <select className="input text-xs py-1 w-32" value={appointment.status} onChange={(e) => handleStatus(appointment.id, e.target.value)}>
                        {STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                      </select>
                      <div className="mt-2 flex flex-col gap-1">
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => toast.success('Consultation notes panel ready for backend integration')}>Add Notes</button>
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => handleCreatePrescription(appointment)}>Create E-Rx</button>
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => handleGenerateReport(appointment)}>Generate Report</button>
                        <button
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => {
                            setManualReportFor(manualReportFor === appointment.id ? null : appointment.id);
                            setManualReport({
                              name: `${issue.summary || 'Consultation'} Report`,
                              type: 'Doctor Consultation',
                              findings: issue.notes || issue.summary || '',
                              recommendation: '',
                            });
                          }}
                        >
                          Manual Report
                        </button>
                        {manualReportFor === appointment.id && (
                          <div className="mt-2 w-72 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-900/20">
                            <input
                              className="input mb-2 text-xs"
                              value={manualReport.name}
                              onChange={(event) => setManualReport({ ...manualReport, name: event.target.value })}
                              placeholder="Report title"
                            />
                            <input
                              className="input mb-2 text-xs"
                              value={manualReport.type}
                              onChange={(event) => setManualReport({ ...manualReport, type: event.target.value })}
                              placeholder="Report type"
                            />
                            <textarea
                              className="input mb-2 text-xs"
                              rows={3}
                              value={manualReport.findings}
                              onChange={(event) => setManualReport({ ...manualReport, findings: event.target.value })}
                              placeholder="Findings / diagnosis / clinical notes"
                            />
                            <textarea
                              className="input mb-2 text-xs"
                              rows={2}
                              value={manualReport.recommendation}
                              onChange={(event) => setManualReport({ ...manualReport, recommendation: event.target.value })}
                              placeholder="Recommendation / follow-up"
                            />
                            <div className="flex gap-2">
                              <button className="btn-primary flex-1 px-2 py-1 text-xs" onClick={() => handleManualReportSubmit(appointment)}>Send to Patient</button>
                              <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setManualReportFor(null)}>Close</button>
                            </div>
                          </div>
                        )}
                        {isTelemedicine ? (
                          <>
                            <button className="btn-primary px-2 py-1 text-xs" onClick={() => handleAcceptTelemedicine(appointment)}>Accept & Start Video</button>
                            <button className="btn-secondary px-2 py-1 text-xs" onClick={() => window.open(`${getAdminBasePath(user)}/telemedicine/${appointment.id}`, '_self')}>Join Video Room</button>
                          </>
                        ) : (
                          <button className="btn-secondary px-2 py-1 text-xs" onClick={() => handleEnableTelemedicine(appointment)}>Enable Video</button>
                        )}
                        <button className="btn-secondary px-2 py-1 text-xs" onClick={() => toast.success('Follow-up date action ready')}>Follow-up</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
