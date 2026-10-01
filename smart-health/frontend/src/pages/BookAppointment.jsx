import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { COMMON_SYMPTOMS, getErrorMessage, formatDoctorName, formatTime, serializeAppointmentIssue, buildMapsLink } from '../utils/helpers';
import Spinner from '../components/ui/Spinner';
import { useLocation } from '../context/LocationContext';
import { getPrescriptions, getReports, saveAppointmentAttachments } from '../services/healthRecords';

const STEPS = ['Reason', 'Doctor', 'Date & Time', 'Confirm'];

function groupSlotsByPeriod(slots) {
  const groups = { Morning: [], Afternoon: [], Evening: [], Night: [] };
  slots.forEach((s) => {
    const h = parseInt(s.time.split(':')[0]);
    if (h >= 0 && h < 12) groups.Morning.push(s);
    else if (h >= 12 && h < 17) groups.Afternoon.push(s);
    else if (h >= 17 && h < 21) groups.Evening.push(s);
    else groups.Night.push(s);
  });
  return groups;
}

const PERIOD_ICONS = { Morning: '🌅', Afternoon: '☀️', Evening: '🌆', Night: '🌙' };

export default function BookAppointment() {
  const { centerId } = useParams();
  const navigate = useNavigate();
  const { location, locationName, detectLocation, locating } = useLocation();
  const [step, setStep] = useState(0);
  const [center, setCenter] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReports, setSelectedReports] = useState([]);
  const [selectedPrescriptions, setSelectedPrescriptions] = useState([]);
  const [form, setForm] = useState({
    doctor_id: '', issue: '', symptoms: [], notes: '', appointment_date: '', appointment_time: '', priority: 'normal', consultationType: 'in_person',
  });

  useEffect(() => {
    api.get(`/centers/${centerId}`).then((r) => setCenter(r.data.center)).catch(() => toast.error('Center not found'));
    api.get('/doctors', { params: { center_id: centerId } }).then((r) => setDoctors(r.data.doctors));
  }, [centerId]);

  useEffect(() => {
    if (form.appointment_date && (form.doctor_id || centerId)) {
      setLoading(true);
      // Fallback to the first doctor when the user chooses "first available".
      const docId = form.doctor_id || (doctors[0]?.id);
      if (!docId) { setLoading(false); return; }
      api.get(`/doctors/${docId}/slots`, { params: { date: form.appointment_date } })
        .then((r) => setSlots(r.data.slots))
        .catch(() => toast.error('Failed to load slots'))
        .finally(() => setLoading(false));
    }
  }, [form.doctor_id, form.appointment_date, centerId, doctors]);

  useEffect(() => {
    if (form.priority !== 'emergency' || !location) return;

    setLoadingNearby(true);
    api.get('/centers/nearby', {
      params: { lat: location.lat, lng: location.lng, radius: 40, sector: 'hospital' },
    })
      .then((r) => setNearbyHospitals(r.data.centers || []))
      .catch(() => setNearbyHospitals([]))
      .finally(() => setLoadingNearby(false));
  }, [form.priority, location]);

  const toggleSymptom = (symptom) => {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/appointments', {
        center_id: centerId,
        doctor_id: form.doctor_id,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        priority: form.priority,
        consultation_type: form.consultationType,
        issue: serializeAppointmentIssue({
          reason: form.issue || 'General consultation',
          symptoms: form.symptoms,
          notes: `${form.notes}\nConsultation Type: ${form.consultationType === 'telemedicine' ? 'Telemedicine' : 'In-person'}`.trim(),
        }),
      });
      saveAppointmentAttachments(res.data.appointment.id, {
        reports: selectedReports,
        prescriptions: selectedPrescriptions,
        consultationType: form.consultationType,
      });
      toast.success('Appointment booked successfully!');
      navigate(`/appointments/${res.data.appointment.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!center) return <div className="flex justify-center py-16"><Spinner /></div>;

  const grouped = groupSlotsByPeriod(slots);
  const selectedDoctor = doctors.find(d => d.id === form.doctor_id);
  const availableReports = getReports();
  const availablePrescriptions = getPrescriptions();
  const availableCount = slots.filter(s => s.available).length;
  const currentCenterIsEmergencyReady = center?.sector === 'hospital';
  const canContinueFromStepZero = Boolean(form.issue.trim() || form.symptoms.length || form.notes.trim());

  const openEmergencyAmbulance = () => {
    window.dispatchEvent(new CustomEvent('smarthealth:open-emergency', { detail: { tab: 'ambulance' } }));
  };

  return (
    <div className="portal-page">
      <button onClick={() => navigate(`/centers/${centerId}`)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
        ← Back to Center
      </button>

      {/* Center info bar */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
        <span className="text-2xl">🏥</span>
        <div>
          <p className="font-semibold text-sm">{center.name}</p>
          <p className="text-xs text-gray-500">{center.address}, {center.city}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < step ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="card space-y-5">

        {/* Step 0: Reason */}
        {step === 0 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">What brings you in? *</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {['Routine Checkup', 'Follow-up Visit', 'New Symptoms', 'Test Results', 'Vaccination', 'Other'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm({ ...form, issue: r })}
                    className={`text-sm py-2 px-3 rounded-lg border text-left transition-colors ${
                      form.issue === r ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >{r}</button>
                ))}
              </div>
              <textarea
                className="input resize-none" rows={2}
                placeholder="Add extra details about the visit..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Symptoms</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((symptom) => {
                  const active = form.symptoms.includes(symptom);
                  return (
                    <button
                      key={symptom}
                      type="button"
                      onClick={() => toggleSymptom(symptom)}
                      className={`px-3 py-2 rounded-full border text-sm transition-colors ${
                        active ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {symptom}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">Selected symptoms will be shown in the admin and queue view for faster triage.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Priority Level</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'normal', label: 'Normal', icon: '🟢', desc: 'Regular appointment' },
                  { value: 'urgent', label: 'Urgent', icon: '🟡', desc: 'Needs attention soon' },
                  { value: 'emergency', label: 'Emergency', icon: '🔴', desc: 'Immediate care needed' },
                ].map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm({ ...form, priority: p.value })}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      form.priority === p.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{p.icon}</div>
                    <p className="text-xs font-semibold">{p.label}</p>
                    <p className="text-xs text-gray-400 hidden sm:block">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Consultation Type</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: 'in_person', label: 'Visit Hospital', desc: 'Come to the hospital and track the live queue.' },
                  { value: 'telemedicine', label: 'Telemedicine', desc: 'Book an online video consultation room.' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setForm({ ...form, consultationType: option.value })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      form.consultationType === option.value ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs text-gray-500">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {form.priority === 'emergency' && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-4 space-y-3">
                <div>
                  <p className="font-semibold text-red-700">Emergency bookings should go to the nearest hospital first.</p>
                  <p className="text-sm text-red-600 mt-1">
                    {currentCenterIsEmergencyReady
                      ? 'This center is a hospital, and nearby hospitals are also shown below in case one is closer.'
                      : 'This center is not a hospital. Please switch to one of the nearby hospitals below.'}
                  </p>
                </div>

                {!location && (
                  <button type="button" onClick={detectLocation} className="btn-secondary text-sm">
                    {locating ? 'Detecting location...' : 'Use my location to find nearby hospitals'}
                  </button>
                )}

                {location && (
                  <p className="text-xs text-gray-600">
                    Nearby hospitals {locationName ? `around ${locationName}` : 'from your location'}.
                  </p>
                )}

                <button
                  type="button"
                  onClick={openEmergencyAmbulance}
                  className="btn-secondary text-sm"
                >
                  Book nearby ambulance
                </button>

                {loadingNearby ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner size="sm" /> Loading nearby hospitals...
                  </div>
                ) : nearbyHospitals.length > 0 ? (
                  <div className="space-y-2">
                    {nearbyHospitals.slice(0, 3).map((hospital) => (
                      <div key={hospital.id} className="rounded-lg border border-red-100 bg-white dark:bg-gray-900 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{hospital.name}</p>
                          <p className="text-xs text-gray-500">{hospital.address}, {hospital.city}</p>
                          {hospital.distance_km != null && (
                            <p className="text-xs text-red-600 mt-1">{parseFloat(hospital.distance_km).toFixed(1)} km away</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={buildMapsLink(hospital)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs py-2 px-3"
                          >
                            Maps
                          </a>
                          <button
                            type="button"
                            onClick={() => navigate(`/centers/${hospital.id}/book`)}
                            className="btn-primary text-xs py-2 px-3"
                          >
                            Choose Hospital
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : location ? (
                  <p className="text-sm text-gray-500">No nearby hospitals were found in the current search radius.</p>
                ) : null}
              </div>
            )}
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">Attach Medical Reports</p>
                  <p className="text-xs text-gray-500">Select existing reports or upload a new one from Health Reports.</p>
                </div>
                <button type="button" onClick={() => navigate('/health-reports')} className="btn-secondary px-3 py-2 text-xs">+ Add Report</button>
              </div>
              <div className="space-y-2">
                {availableReports.slice(0, 4).map((report) => (
                  <label key={report.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                    <span>{report.name} - {report.date}.{String(report.fileType || '').toLowerCase()}</span>
                    <input
                      type="checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={(event) => setSelectedReports((current) => event.target.checked ? [...current, report.id] : current.filter((reportId) => reportId !== report.id))}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="mb-3 font-semibold text-sm">Attach Prescription</p>
              <div className="space-y-2">
                {availablePrescriptions.slice(0, 3).map((prescription) => (
                  <label key={prescription.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                    <span>{prescription.diagnosis} - {prescription.date}</span>
                    <input
                      type="checkbox"
                      checked={selectedPrescriptions.includes(prescription.id)}
                      onChange={(event) => setSelectedPrescriptions((current) => event.target.checked ? [...current, prescription.id] : current.filter((prescriptionId) => prescriptionId !== prescription.id))}
                    />
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary w-full" disabled={!canContinueFromStepZero || (form.priority === 'emergency' && !currentCenterIsEmergencyReady)} onClick={() => setStep(1)}>
              Continue →
            </button>
          </>
        )}

        {/* Step 1: Doctor */}
        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-3">Select a Doctor</label>
              <div className="space-y-2">
                <div
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${!form.doctor_id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setForm({ ...form, doctor_id: '' })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xl">👨‍⚕️</div>
                    <div>
                      <p className="font-medium text-sm">First Available Doctor</p>
                      <p className="text-xs text-gray-500">Assigned automatically — shortest wait time</p>
                    </div>
                    {!form.doctor_id && <span className="ml-auto text-blue-600 text-lg">✓</span>}
                  </div>
                </div>
                {doctors.map((d) => (
                  <div
                    key={d.id}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${form.doctor_id === d.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => setForm({ ...form, doctor_id: d.id })}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center font-bold text-green-700">
                        {d.name.split(' ').pop()[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{formatDoctorName(d.name)}</p>
                        <p className="text-xs text-gray-500">{d.specialization}</p>
                        <p className="text-xs text-gray-400">{d.qualification} · ~{d.average_consultation_minutes} min/session</p>
                      </div>
                      {form.doctor_id === d.id && <span className="text-blue-600 text-lg">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep(0)}>← Back</button>
              <button className="btn-primary flex-1" onClick={() => setStep(2)}>Continue →</button>
            </div>
          </>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Select Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
                {[...Array(14)].map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  // Use local date parts to avoid UTC shift
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const val = `${year}-${month}-${day}`;
                  const isToday = i === 0;
                  const isTomorrow = i === 1;
                  const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow'
                    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                  const isSelected = form.appointment_date === val;
                  return (
                    <button
                      key={val}
                      onClick={() => { setForm({ ...form, appointment_date: val, appointment_time: '' }); setSlots([]); }}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl border text-center transition-colors min-w-[70px] ${
                        isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'border-gray-200 hover:border-blue-400 text-sm'
                      }`}
                    >
                      <p className="text-xs font-medium">{isToday ? 'Today' : isTomorrow ? 'Tmrw' : label.split(' ')[0]}</p>
                      <p className="text-sm font-bold">{d.getDate()}</p>
                      <p className="text-xs opacity-70">{d.toLocaleDateString('en-IN', { month: 'short' })}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.appointment_date && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Available Time Slots</label>
                  {!loading && slots.length > 0 && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      {availableCount} slots available
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="flex justify-center py-6"><Spinner /></div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No slots available for this date.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([period, periodSlots]) => {
                      if (periodSlots.length === 0) return null;
                      return (
                        <div key={period}>
                          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                            {PERIOD_ICONS[period]} {period}
                          </p>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {periodSlots.map((s) => (
                              <button
                                key={s.time}
                                disabled={!s.available}
                                onClick={() => s.available && setForm({ ...form, appointment_time: s.time })}
                                className={`py-2 text-xs rounded-lg border transition-colors font-medium ${
                                  !s.available
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                                    : form.appointment_time === s.time
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                                title={s.isPast ? 'Past time' : s.isBooked ? 'Already booked' : 'Available'}
                              >
                                {formatTime(s.time)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn-primary flex-1"
                disabled={!form.appointment_date || !form.appointment_time}
                onClick={() => setStep(3)}
              >Continue →</button>
            </div>
          </>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <>
            <div className="text-center mb-2">
              <span className="text-4xl">✅</span>
              <h3 className="font-bold text-lg mt-2">Review Your Booking</h3>
              <p className="text-sm text-gray-500">Please confirm the details below</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 text-sm">
              {[
                { label: '🏥 Center', value: center.name },
                { label: '👨‍⚕️ Doctor', value: selectedDoctor ? `${formatDoctorName(selectedDoctor.name)} (${selectedDoctor.specialization})` : 'First Available Doctor' },
                { label: '📅 Date', value: (() => { const [y,m,d] = form.appointment_date.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); })() },
                { label: '🕐 Time', value: formatTime(form.appointment_time) },
                { label: '🚨 Priority', value: form.priority.charAt(0).toUpperCase() + form.priority.slice(1) },
                { label: 'Consultation', value: form.consultationType === 'telemedicine' ? 'Telemedicine' : 'Hospital visit' },
                { label: '📋 Reason', value: form.issue },
                { label: '🩺 Symptoms', value: form.symptoms.length ? form.symptoms.join(', ') : 'Not specified' },
                { label: '📝 Notes', value: form.notes || 'None' },
                { label: 'Attached reports', value: selectedReports.length ? `${selectedReports.length} selected` : 'None' },
                { label: 'Attached prescriptions', value: selectedPrescriptions.length ? `${selectedPrescriptions.length} selected` : 'None' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">
              A confirmation will be sent to your registered email
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setStep(2)}>← Back</button>
              <button
                className="btn-primary flex-1 flex justify-center items-center gap-2"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? <><Spinner size="sm" /> Booking...</> : '✓ Confirm Booking'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
