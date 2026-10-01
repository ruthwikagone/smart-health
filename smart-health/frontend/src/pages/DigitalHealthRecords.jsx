import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDoctorName, parseAppointmentIssue, safeDate } from '../utils/helpers';
import { fetchPrescriptions, fetchReports, getPrescriptionsForUser, getReportsForUser } from '../services/healthRecords';

export default function DigitalHealthRecords() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(user || {});
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState(getReportsForUser(user));
  const [prescriptions, setPrescriptions] = useState(getPrescriptionsForUser(user));

  useEffect(() => {
    api.get('/profile').then((res) => setProfile(res.data.user)).catch(() => {});
    api.get('/appointments/me').then((res) => setAppointments(res.data.appointments || [])).catch(() => {});
    fetchReports().then(setReports).catch(() => setReports(getReportsForUser(user)));
    fetchPrescriptions().then(setPrescriptions).catch(() => setPrescriptions(getPrescriptionsForUser(user)));
  }, []);

  const age = useMemo(() => {
    if (!profile?.date_of_birth) return 'Not specified';
    const birth = new Date(profile.date_of_birth);
    return Number.isNaN(birth.getTime()) ? 'Not specified' : Math.floor((Date.now() - birth.getTime()) / 31557600000);
  }, [profile]);

  const timeline = [
    ...appointments.map((appointment) => ({ type: 'Appointment', date: safeDate(appointment.appointment_date), title: appointment.center_name, text: parseAppointmentIssue(appointment.issue).summary || appointment.issue })),
    ...reports.map((report) => ({ type: 'Report', date: report.date, title: report.name, text: `${report.type} from ${report.hospital}` })),
    ...prescriptions.map((prescription) => ({ type: 'Prescription', date: prescription.date, title: prescription.diagnosis, text: prescription.doctorName })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Digital Health Records</h1>
        <p className="mt-1 text-sm text-gray-500">A centralized view of patient information, medical history, visits, prescriptions, and reports.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <h2 className="mb-4 font-semibold">Patient Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Name', profile?.name || user?.name],
              ['Age', age],
              ['Gender', profile?.gender || 'Not specified'],
              ['Blood group', profile?.blood_group || 'Not specified'],
              ['Contact', profile?.phone || profile?.email || 'Not specified'],
              ['Emergency contact', profile?.emergency_contact || 'Not specified'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-4 font-semibold">Medical History</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Previous illnesses', 'Seasonal fever, migraine history'],
              ['Surgeries', 'None recorded'],
              ['Allergies', 'Update in profile if any'],
              ['Existing conditions', 'No active conditions recorded'],
              ['Family history', 'Diabetes screening recommended if family history applies'],
              ['Previous hospitalizations', 'No hospitalizations recorded'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                <p className="font-medium">{label}</p>
                <p className="mt-1 text-gray-500">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-6">
        <h2 className="mb-4 font-semibold">Visit History</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {appointments.slice(0, 6).map((appointment) => {
            const issue = parseAppointmentIssue(appointment.issue);
            return (
              <div key={appointment.id} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <p className="font-semibold">{formatDoctorName(appointment.doctor_name)}</p>
                <p className="text-sm text-gray-500">{appointment.center_name} - {formatDate(appointment.appointment_date)}</p>
                <p className="mt-2 text-sm">Reason: {issue.summary || issue.raw}</p>
                <p className="mt-1 text-sm text-gray-500">Doctor notes: Available after consultation. Follow-up date appears when assigned.</p>
              </div>
            );
          })}
          {!appointments.length && <p className="text-sm text-gray-500">No visits recorded yet.</p>}
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="mb-4 font-semibold">Medical Timeline</h2>
        <div className="space-y-3">
          {timeline.map((item, index) => (
            <div key={`${item.type}-${item.date}-${index}`} className="grid gap-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800 md:grid-cols-[140px_150px_1fr]">
              <span className="text-sm font-semibold text-blue-600">{item.date}</span>
              <span className="badge w-fit bg-gray-100 text-gray-700">{item.type}</span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-gray-500">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
