import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';
import TelemedicineRoom from '../../components/health/TelemedicineRoom';
import { useAuth } from '../../context/AuthContext';
import { getTelemedicineAccess } from '../../services/healthRecords';
import { formatDate, formatDoctorName, formatTime, parseAppointmentIssue, safeDate, safeTime } from '../../utils/helpers';

export default function AdminTelemedicine() {
  const { id } = useParams();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/appointments')
      .then((res) => setAppointment((res.data.appointments || []).find((item) => String(item.id) === String(id))))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!appointment) return <div className="portal-page"><div className="card text-center">Telemedicine appointment not found.</div></div>;

  const issue = parseAppointmentIssue(appointment.issue);
  const access = getTelemedicineAccess(appointment);

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Telemedicine Room</h1>
        <p className="mt-1 text-sm text-gray-500">Hospital admin video consultation workspace for accepted online appointments.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TelemedicineRoom
          appointment={appointment}
          user={user}
          role="doctor"
          locked={!access.canJoin}
          lockedMessage={access.label}
        />

        <aside className="space-y-4">
          <div className="card">
            <h2 className="font-semibold">Appointment</h2>
            <p className="mt-2 text-sm font-medium">{appointment.user_name}</p>
            <p className="text-sm text-gray-500">{formatDate(safeDate(appointment.appointment_date))} at {formatTime(safeTime(appointment.appointment_time))}</p>
            <p className="mt-2 text-sm text-gray-500">{appointment.center_name}</p>
            <p className={`mt-3 text-sm font-semibold ${access.canJoin ? 'text-green-600' : 'text-amber-600'}`}>{access.label}</p>
          </div>
          <div className="card">
            <h2 className="font-semibold">Reason</h2>
            <p className="mt-2 text-sm">{issue.summary || issue.raw}</p>
            {issue.symptoms.length > 0 && <p className="mt-2 text-xs text-red-600">Symptoms: {issue.symptoms.join(', ')}</p>}
          </div>
          <div className="card">
            <h2 className="font-semibold">Next Steps</h2>
            <p className="mt-2 text-sm text-gray-500">After the call, return to Appointments to generate the patient report and e-prescription.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
