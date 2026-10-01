import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useQueue } from '../hooks/useQueue';
import { StatusBadge, PriorityBadge } from '../components/ui/StatusBadge';
import { buildMapsLink, formatDate, formatDoctorName, formatTime, parseAppointmentIssue } from '../utils/helpers';
import Spinner from '../components/ui/Spinner';
import toast from 'react-hot-toast';
import CallButton from '../components/ui/CallButton';
import { downloadReport, fetchAppointmentRecords, getAppointmentAttachments, getConsultationType, getPrescriptions, getReports } from '../services/healthRecords';

function getAppointmentTiming(appt) {
  if (!appt) return null;
  const now = new Date();
  const apptDate = String(appt.appointment_date).split('T')[0];
  const timeStr = String(appt.appointment_time).slice(0, 5);
  const [year, month, day] = apptDate.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  const apptDateTime = new Date(year, month - 1, day, h, m);
  const diffMs = now - apptDateTime;
  const diffMin = Math.floor(diffMs / 60000);

  if (appt.status === 'completed') return { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50', icon: '✅' };
  if (appt.status === 'cancelled') return { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50', icon: '❌' };
  if (appt.status === 'no_show') return { label: 'No Show', color: 'text-gray-600', bg: 'bg-gray-50', icon: '👻' };
  if (appt.status === 'in_progress') return { label: 'In Progress', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '⏳' };

  if (diffMin < -60) {
    const hrs = Math.abs(Math.floor(diffMin / 60));
    const mins = Math.abs(diffMin % 60);
    return { label: `In ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`, color: 'text-blue-600', bg: 'bg-blue-50', icon: '🕐' };
  }
  if (diffMin < 0) return { label: `Starting in ${Math.abs(diffMin)} min`, color: 'text-green-600', bg: 'bg-green-50', icon: '🟢' };
  if (diffMin === 0) return { label: 'Starting Now', color: 'text-green-700', bg: 'bg-green-50', icon: '🟢' };
  if (diffMin <= 15) return { label: `${diffMin} min late`, color: 'text-orange-600', bg: 'bg-orange-50', icon: '⚠️' };
  if (diffMin <= 60) return { label: `Delayed by ${diffMin} min`, color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' };
  return { label: `Significantly delayed (${Math.floor(diffMin / 60)}h ${diffMin % 60}m)`, color: 'text-red-700', bg: 'bg-red-50', icon: '🚨' };
}

export default function AppointmentStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [records, setRecords] = useState({ reports: [], prescriptions: [] });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const timerRef = useRef(null);

  const queueData = useQueue(appt?.center_id, appt?.doctor_id, appt?.appointment_date);

  const fetchAppt = () => {
    api.get(`/appointments/${id}`)
      .then((r) => setAppt(r.data.appointment))
      .catch(() => toast.error('Appointment not found'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppt();
    fetchAppointmentRecords(id).then(setRecords).catch(() => {});
    // Refresh appointment every 30 seconds
    const interval = setInterval(fetchAppt, 30000);
    // Update clock every minute
    timerRef.current = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(interval); clearInterval(timerRef.current); };
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      toast.success('Appointment cancelled');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!appt) return <div className="text-center py-16 text-gray-500">Appointment not found.</div>;

  const timing = getAppointmentTiming(appt);
  const activeQueue = queueData?.active ?? appt.patients_before;
  const avgMin = appt.average_consultation_minutes || 15;
  const estimatedWait = activeQueue * avgMin;
  const issue = parseAppointmentIssue(appt.issue);
  const attachments = getAppointmentAttachments(appt.id);
  const localReports = getReports().filter((report) => attachments.reports.includes(report.id));
  const localPrescriptions = getPrescriptions().filter((prescription) => attachments.prescriptions.includes(prescription.id));
  const attachedReports = records.reports.length ? records.reports : localReports;
  const attachedPrescriptions = records.prescriptions.length ? records.prescriptions : localPrescriptions;
  const isTelemedicine = getConsultationType(appt) === 'telemedicine';

  const apptDateStr = String(appt.appointment_date).split('T')[0];
  const timeStr = String(appt.appointment_time).slice(0, 5);

  return (
    <div className="portal-page">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-blue-600 hover:underline mb-6 flex items-center gap-1">
        ← Back to Dashboard
      </button>

      {/* Timing Status Banner */}
      {timing && (
        <div className={`${timing.bg} rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border border-opacity-30`}>
          <span className="text-2xl">{timing.icon}</span>
          <div>
            <p className={`font-semibold ${timing.color}`}>{timing.label}</p>
            <p className="text-xs text-gray-500">
              Scheduled: {formatDate(apptDateStr)} at {formatTime(timeStr)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400">Current time</p>
            <p className="text-sm font-mono font-medium">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      )}

      {/* Main Info Card */}
      <div className="card mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{appt.center_name}</h1>
            <p className="text-sm text-gray-500">📌 {appt.address}</p>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        <div className="space-y-2 text-sm">
          {appt.doctor_name && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-20 shrink-0">Doctor</span>
              <span className="font-medium">{formatDoctorName(appt.doctor_name)}</span>
              <span className="text-gray-400">· {appt.specialization}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-20 shrink-0">Date</span>
            <span className="font-medium">{formatDate(apptDateStr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-20 shrink-0">Time</span>
            <span className="font-medium">{formatTime(timeStr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-20 shrink-0">Reason</span>
            <span className="font-medium">{issue.summary || issue.raw}</span>
          </div>
          {issue.symptoms.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-20 shrink-0">Symptoms</span>
              <span className="font-medium">{issue.symptoms.join(', ')}</span>
            </div>
          )}
          {issue.notes && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 w-20 shrink-0">Notes</span>
              <span className="font-medium">{issue.notes}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-20 shrink-0">Priority</span>
            <PriorityBadge priority={appt.priority} />
          </div>
        </div>

        {appt.contact_details && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-500">📞 {appt.contact_details}</span>
            <CallButton contactDetails={appt.contact_details} centerName={appt.center_name} size="sm" />
          </div>
        )}
      </div>

      {/* Live Queue Card */}
      {(appt.status === 'confirmed' || appt.status === 'in_progress') && (
        <div className="card mb-5 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <h2 className="font-semibold">Live Queue Status</h2>
            </div>
            <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <p className="text-3xl font-bold text-blue-600">#{appt.queue_number}</p>
              <p className="text-xs text-gray-500 mt-1">Your Token</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <p className="text-3xl font-bold text-orange-500">{activeQueue}</p>
              <p className="text-xs text-gray-500 mt-1">Ahead of You</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
              <p className="text-3xl font-bold text-green-600">{estimatedWait}</p>
              <p className="text-xs text-gray-500 mt-1">Est. Wait (min)</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Queue Progress</span>
              <span>{activeQueue === 0 ? "You're next!" : `${activeQueue} patient${activeQueue > 1 ? 's' : ''} ahead`}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, 100 - (activeQueue / Math.max(appt.queue_number, 1)) * 100)}%` }}
              />
            </div>
          </div>

          {activeQueue === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-green-700 dark:text-green-400 font-semibold text-sm">🎉 You're next! Please proceed to the counter.</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-3">
            Auto-refreshes every 30 seconds · Last updated {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}

      {/* Map / Directions */}
      {(attachedReports.length > 0 || attachedPrescriptions.length > 0) && (
        <div className="card mb-5">
          <h2 className="mb-4 font-semibold">Attached Medical Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Reports</p>
              {attachedReports.length ? attachedReports.map((report) => (
                <div key={report.id} className="mb-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
                  <p className="font-medium">{report.name}</p>
                  <p className="text-xs text-gray-500">{report.type} - {report.date}</p>
                  <button className="mt-2 text-xs font-semibold text-blue-600" onClick={() => downloadReport(report)}>Download Report</button>
                </div>
              )) : <p className="text-sm text-gray-500">No reports attached.</p>}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Prescriptions</p>
              {attachedPrescriptions.length ? attachedPrescriptions.map((prescription) => (
                <div key={prescription.id} className="mb-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
                  <p className="font-medium">{prescription.diagnosis}</p>
                  <p className="text-xs text-gray-500">{prescription.doctorName} - {prescription.date}</p>
                </div>
              )) : <p className="text-sm text-gray-500">No prescriptions attached.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="card mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-sm">Video Consultation</p>
            <p className="text-xs text-gray-500">
              {isTelemedicine ? 'Your online consultation room is available from Telemedicine.' : 'This appointment is booked as a hospital visit. Reschedule as Telemedicine for a video room.'}
            </p>
          </div>
          <button onClick={() => navigate('/telemedicine')} disabled={!isTelemedicine} className="btn-primary text-sm">Join Video Consultation</button>
        </div>
      </div>

      {/* Map / Directions */}
      <div className="card mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">📍 Get Directions</p>
            <p className="text-xs text-gray-500 mt-0.5">{appt.address}, {appt.center_name}</p>
          </div>
          <div className="flex gap-2">
            {appt.latitude && appt.longitude ? (
              <a
                href={buildMapsLink(appt)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm py-1.5 px-4"
              >
                🗺️ Navigate
              </a>
            ) : (
              <a
                href={buildMapsLink(appt)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm py-1.5 px-4"
              >
                🗺️ Search on Maps
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {appt.status === 'confirmed' && (
        <div className="flex gap-3">
          <button onClick={() => navigate(`/centers/${appt.center_id}/book`)} className="btn-secondary flex-1">
            🔄 Reschedule
          </button>
          <button onClick={handleCancel} className="btn-danger flex-1">
            ✕ Cancel
          </button>
        </div>
      )}
    </div>
  );
}
