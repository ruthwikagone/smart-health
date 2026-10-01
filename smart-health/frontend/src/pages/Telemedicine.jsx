import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatDate, formatDoctorName, formatTime, safeDate, safeTime } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import TelemedicineRoom from '../components/health/TelemedicineRoom';
import { fetchPrescriptions, fetchReports, getConsultationType, getTelemedicineAccess } from '../services/healthRecords';

export default function Telemedicine() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reports, setReports] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    api.get('/appointments/me').then((res) => {
      const list = res.data.appointments || [];
      const telemedicineAppointments = list.filter((appointment) => getConsultationType(appointment) === 'telemedicine');
      setAppointments(telemedicineAppointments);
      setSelected(telemedicineAppointments[0] || null);
    }).catch(() => {});
    fetchReports().then(setReports).catch(() => setReports([]));
    fetchPrescriptions().then(setPrescriptions).catch(() => setPrescriptions([]));
  }, []);

  const access = selected ? getTelemedicineAccess(selected) : { canJoin: false, label: 'Select a telemedicine appointment.' };

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Telemedicine</h1>
        <p className="mt-1 text-sm text-gray-500">Frontend consultation room structure ready for a WebRTC or video API provider.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TelemedicineRoom
          appointment={selected}
          user={user}
          role="patient"
          locked={!selected || !access.canJoin}
          lockedMessage={access.label}
        />

        <aside className="space-y-4">
          <div className="card">
            <h2 className="mb-3 font-semibold">Appointments</h2>
            <div className="space-y-2">
              {appointments.slice(0, 5).map((appointment) => (
                <button type="button" key={appointment.id} onClick={() => setSelected(appointment)} className={`w-full rounded-lg border p-3 text-left text-sm ${selected?.id === appointment.id ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100' : 'border-gray-100 dark:border-gray-800'}`}>
                  <span className="font-medium">{formatDate(safeDate(appointment.appointment_date))}</span>
                  <span className="block text-xs text-gray-500">{formatTime(safeTime(appointment.appointment_time))} with {formatDoctorName(appointment.doctor_name)}</span>
                  <span className="mt-1 block text-xs font-semibold text-purple-600">{getTelemedicineAccess(appointment).label}</span>
                </button>
              ))}
              {!appointments.length && <p className="text-sm text-gray-500">No telemedicine appointments yet. Choose Telemedicine while booking an appointment.</p>}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold">Patient Information</h2>
            <p className="mt-2 text-sm text-gray-500">Reports and prescriptions are available to review during the call.</p>
          </div>
          <div className="card">
            <h2 className="mb-3 font-semibold">Reports</h2>
            {reports.slice(0, 3).map((report) => <p key={report.id} className="mb-2 text-sm">{report.name} <span className="text-gray-400">({report.type})</span></p>)}
          </div>
          <div className="card">
            <h2 className="mb-3 font-semibold">Prescriptions</h2>
            {prescriptions.slice(0, 3).map((rx) => <p key={rx.id} className="mb-2 text-sm">{rx.diagnosis}</p>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
