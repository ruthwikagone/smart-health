import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api/axios';
import { formatDoctorName, getAdminBasePath } from '../utils/helpers';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import HealthAIChatbot from '../components/health/HealthAIChatbot';
import { downloadReport, fetchPrescriptions, fetchReports, getPrescriptionsForUser, getReportsForUser } from '../services/healthRecords';

const DASHBOARD_COPY = {
  en: {
    hello: 'Hello',
    bookAppointment: 'Book Appointment',
    nextAppointment: 'Next Appointment',
    queue: 'Queue',
    wait: 'wait',
    at: 'at',
    doctor: 'Doctor',
    status: {
      confirmed: 'confirmed',
      in_progress: 'in progress',
      completed: 'completed',
      cancelled: 'cancelled',
      no_show: 'no show',
    },
    alerts: {
      'Appointment in 1 Hour': 'Appointment in 1 Hour',
      'Time to Head Out': 'Time to Head Out',
      'Appointment in 10 Minutes': 'Appointment in 10 Minutes',
      '5 Minutes to Appointment': '5 Minutes to Appointment',
      'Appointment Starting Now': 'Appointment Starting Now',
      'Appointment May Be Missed': 'Appointment May Be Missed',
      'Consultation Completed': 'Consultation Completed',
      'Marked as No-Show': 'Marked as No-Show',
      "You're Next": "You're Next",
      'Almost Your Turn': 'Almost Your Turn',
      'Queue Update': 'Queue Update',
    },
    untilAppointment: 'until appt',
    viewDetails: 'View Details',
    cancel: 'Cancel',
    totalBookings: 'Total Bookings',
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled',
    recentAlerts: 'Recent Alerts',
    new: 'new',
    markAllRead: 'Mark all read',
    view: 'View',
    past: 'Past',
    noUpcomingAppointments: 'No upcoming appointments',
    noPastAppointments: 'No past appointments',
    noCancelledAppointments: 'No cancelled appointments',
    noUpcomingMessage: 'Book your first appointment to get started.',
    failedToLoadAppointments: 'Failed to load appointments',
    cancelAppointmentConfirm: 'Cancel this appointment?',
    appointmentCancelled: 'Appointment cancelled',
    failedToCancel: 'Failed to cancel',
    language: 'Language',
    token: 'Token',
    minWait: 'min wait',
  },
  hi: {
    hello: 'नमस्ते',
    bookAppointment: 'अपॉइंटमेंट बुक करें',
    nextAppointment: 'अगला अपॉइंटमेंट',
    queue: 'क्यू',
    wait: 'प्रतीक्षा',
    at: 'पर',
    doctor: 'डॉक्टर',
    status: {
      confirmed: 'पुष्ट',
      in_progress: 'चालू',
      completed: 'पूर्ण',
      cancelled: 'रद्द',
      no_show: 'अनुपस्थित',
    },
    alerts: {
      'Appointment in 1 Hour': '1 घंटे में अपॉइंटमेंट',
      'Time to Head Out': 'निकलने का समय',
      'Appointment in 10 Minutes': '10 मिनट में अपॉइंटमेंट',
      '5 Minutes to Appointment': 'अपॉइंटमेंट में 5 मिनट',
      'Appointment Starting Now': 'अपॉइंटमेंट अभी शुरू हो रहा है',
      'Appointment May Be Missed': 'अपॉइंटमेंट छूट सकता है',
      'Consultation Completed': 'परामर्श पूरा हुआ',
      'Marked as No-Show': 'अनुपस्थित चिह्नित',
      "You're Next": 'अब आपकी बारी',
      'Almost Your Turn': 'लगभग आपकी बारी',
      'Queue Update': 'क्यू अपडेट',
    },
    untilAppointment: 'अपॉइंटमेंट तक',
    viewDetails: 'विवरण देखें',
    cancel: 'रद्द करें',
    totalBookings: 'कुल बुकिंग',
    upcoming: 'आने वाले',
    completed: 'पूर्ण',
    cancelled: 'रद्द',
    recentAlerts: 'हाल की सूचनाएँ',
    new: 'नया',
    markAllRead: 'सभी पढ़े हुए चिह्नित करें',
    view: 'देखें',
    past: 'पिछले',
    noUpcomingAppointments: 'कोई आने वाला अपॉइंटमेंट नहीं',
    noPastAppointments: 'कोई पिछला अपॉइंटमेंट नहीं',
    noCancelledAppointments: 'कोई रद्द अपॉइंटमेंट नहीं',
    noUpcomingMessage: 'शुरू करने के लिए अपना पहला अपॉइंटमेंट बुक करें।',
    failedToLoadAppointments: 'अपॉइंटमेंट लोड नहीं हुए',
    cancelAppointmentConfirm: 'क्या इस अपॉइंटमेंट को रद्द करना है?',
    appointmentCancelled: 'अपॉइंटमेंट रद्द कर दिया गया',
    failedToCancel: 'रद्द नहीं हो सका',
    language: 'भाषा',
    token: 'टोकन',
    minWait: 'मिनट प्रतीक्षा',
  },
  te: {
    hello: 'నమస్తే',
    bookAppointment: 'అపాయింట్మెంట్ బుక్ చేయండి',
    nextAppointment: 'తదుపరి అపాయింట్మెంట్',
    queue: 'క్యూ',
    wait: 'వేచి ఉండాలి',
    at: 'కు',
    doctor: 'డాక్టర్',
    status: {
      confirmed: 'నిర్ధారించబడింది',
      in_progress: 'కొనసాగుతోంది',
      completed: 'పూర్తైంది',
      cancelled: 'రద్దైంది',
      no_show: 'రాలేదు',
    },
    alerts: {
      'Appointment in 1 Hour': '1 గంటలో అపాయింట్మెంట్',
      'Time to Head Out': 'వెళ్లాల్సిన సమయం',
      'Appointment in 10 Minutes': '10 నిమిషాల్లో అపాయింట్మెంట్',
      '5 Minutes to Appointment': 'అపాయింట్మెంట్‌కు 5 నిమిషాలు',
      'Appointment Starting Now': 'అపాయింట్మెంట్ ఇప్పుడు ప్రారంభమవుతోంది',
      'Appointment May Be Missed': 'అపాయింట్మెంట్ మిస్సవచ్చు',
      'Consultation Completed': 'కన్సల్టేషన్ పూర్తైంది',
      'Marked as No-Show': 'రాలేదిగా గుర్తించారు',
      "You're Next": 'తరువాత మీరు',
      'Almost Your Turn': 'దాదాపు మీ వంతు',
      'Queue Update': 'క్యూ అప్డేట్',
    },
    untilAppointment: 'అపాయింట్మెంట్ వరకు',
    viewDetails: 'వివరాలు చూడండి',
    cancel: 'రద్దు చేయండి',
    totalBookings: 'మొత్తం బుకింగ్స్',
    upcoming: 'రాబోయేవి',
    completed: 'పూర్తయ్యినవి',
    cancelled: 'రద్దైనవి',
    recentAlerts: 'ఇటీవలి అలర్ట్లు',
    new: 'కొత్తవి',
    markAllRead: 'అన్నీ చదివినట్లుగా చేయండి',
    view: 'చూడండి',
    past: 'గతవి',
    noUpcomingAppointments: 'రాబోయే అపాయింట్మెంట్లు లేవు',
    noPastAppointments: 'గత అపాయింట్మెంట్లు లేవు',
    noCancelledAppointments: 'రద్దైన అపాయింట్మెంట్లు లేవు',
    noUpcomingMessage: 'ప్రారంభించడానికి మీ మొదటి అపాయింట్మెంట్ బుక్ చేయండి.',
    failedToLoadAppointments: 'అపాయింట్మెంట్లు లోడ్ కాలేదు',
    cancelAppointmentConfirm: 'ఈ అపాయింట్మెంట్‌ను రద్దు చేయాలా?',
    appointmentCancelled: 'అపాయింట్మెంట్ రద్దు అయింది',
    failedToCancel: 'రద్దు కాలేదు',
    language: 'భాష',
    token: 'టోకెన్',
    minWait: 'ని. వేచి ఉండాలి',
  },
};

function getTimeUntil(dateStr, timeStr, language) {
  try {
    const d = String(dateStr).split('T')[0]; // YYYY-MM-DD
    const t = String(timeStr).slice(0, 5);   // HH:MM
    const [year, month, day] = d.split('-').map(Number);
    const [h, m] = t.split(':').map(Number);
    const apptTime = new Date(year, month - 1, day, h, m);
    const diff = apptTime - new Date();
    if (diff < 0) return null;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (language === 'hi') {
      if (hours >= 24) return `${Math.floor(hours / 24)} दिन ${hours % 24} घं`;
      if (hours > 0) return `${hours} घं ${mins} मि`;
      return `${mins} मिनट`;
    }
    if (language === 'te') {
      if (hours >= 24) return `${Math.floor(hours / 24)} రోజు ${hours % 24} గం`;
      if (hours > 0) return `${hours} గం ${mins} ని`;
      return `${mins} నిమి`;
    }
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  } catch { return null; }
}

function formatDashboardDate(dateStr, locale) {
  if (!dateStr) return '';
  const d = String(dateStr).split('T')[0];
  const [year, month, day] = d.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDashboardTime(timeStr, locale) {
  if (!timeStr) return '';
  const t = String(timeStr).slice(0, 5);
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function translateNotification(notification, copy) {
  const title = copy.alerts?.[notification.title] || notification.title;
  const message = String(notification.message || '')
    .replace(/^Your appointment at /, copy.language === 'भाषा' ? 'आपका अपॉइंटमेंट ' : copy.language === 'భాష' ? 'మీ అపాయింట్మెంట్ ' : 'Your appointment at ')
    .replace(/^Only /, copy.language === 'भाषा' ? 'केवल ' : copy.language === 'భాష' ? 'మాత్రమే ' : 'Only ');

  return { title, message };
}

function LocalizedStatusBadge({ status, labels }) {
  const colorMap = {
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-600',
  };

  return (
    <span className={`badge ${colorMap[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels?.[status] || String(status || '').replace('_', ' ')}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, options, locale } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [showAi, setShowAi] = useState(false);
  const [aiContext, setAiContext] = useState(null);
  const [reports, setReports] = useState(getReportsForUser(user));
  const [prescriptions, setPrescriptions] = useState(getPrescriptionsForUser(user));
  const t = DASHBOARD_COPY[language] || DASHBOARD_COPY.en;

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/me');
      setAppointments(res.data.appointments);
    } catch {
      toast.error(t.failedToLoadAppointments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Redirect admin to admin panel
    if (user?.role === 'admin') {
      navigate(`${getAdminBasePath(user)}/dashboard`);
      return;
    }
    fetchAppointments();
    fetchReports().then(setReports).catch(() => setReports(getReportsForUser(user)));
    fetchPrescriptions().then(setPrescriptions).catch(() => setPrescriptions(getPrescriptionsForUser(user)));
  }, [user]);

  const handleCancel = async (id) => {
    if (!confirm(t.cancelAppointmentConfirm)) return;
    try {
      await api.patch(`/appointments/${id}/cancel`);
      toast.success(t.appointmentCancelled);
      fetchAppointments();
    } catch {
      toast.error(t.failedToCancel);
    }
  };

  const { notifications, unread, markAllRead } = useNotifications();

  // Recent unread notifications for dashboard panel
  const recentNotifs = notifications.slice(0, 5);

  const NOTIF_STYLES = {
    appointment: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: '📅' },
    queue:       { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', icon: '⏱️' },
    reminder:    { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', icon: '⏰' },
    cancellation:{ bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: '❌' },
    system:      { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', icon: '🔔' },
  };

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const upcoming = appointments
    .filter(a => String(a.appointment_date).split('T')[0] >= today && ['confirmed','in_progress'].includes(a.status))
    .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)));

  const nextAppt = upcoming[0];

  const filtered = appointments.filter((a) => {
    const d = String(a.appointment_date).split('T')[0];
    if (tab === 'upcoming') return d >= today && ['confirmed','in_progress'].includes(a.status);
    if (tab === 'past') return d < today || ['completed','no_show'].includes(a.status);
    return a.status === 'cancelled';
  });

  const pastCount = appointments.filter(a => {
    const d = String(a.appointment_date).split('T')[0];
    return d < today || ['completed','no_show'].includes(a.status);
  }).length;

  const TABS = [
    { key: 'upcoming', label: t.upcoming, count: upcoming.length },
    { key: 'past', label: t.past, count: pastCount },
    { key: 'cancelled', label: t.cancelled, count: appointments.filter(a => a.status === 'cancelled').length },
  ];

  return (
    <div className="portal-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.hello}, {user?.name} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2">
            <span className="text-xs font-semibold text-gray-500">{t.language}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-sm font-medium outline-none"
            >
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setShowAi((value) => !value)} className="btn-secondary flex items-center gap-2">
            Ask Health AI
          </button>
          <Link to="/centers" className="btn-primary flex items-center gap-2">
            + {t.bookAppointment}
          </Link>
        </div>
      </div>

      {/* Next Appointment Banner */}
      {nextAppt && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-5 mb-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">{t.nextAppointment}</p>
              <h2 className="text-xl font-bold mb-1">{nextAppt.center_name}</h2>
              {nextAppt.doctor_name && (
                <p className="text-blue-100 text-sm">{formatDoctorName(nextAppt.doctor_name)} · {nextAppt.specialization}</p>
              )}
              <p className="text-blue-100 text-sm mt-1">
                📅 {formatDashboardDate(nextAppt.appointment_date, locale)} {t.at} {formatDashboardTime(nextAppt.appointment_time, locale)}
              </p>
              <p className="text-blue-200 text-xs mt-1">
                {t.queue} #{nextAppt.queue_number} · ~{nextAppt.estimated_wait_minutes} {t.minWait}
              </p>
            </div>
            {getTimeUntil(nextAppt.appointment_date, nextAppt.appointment_time, language) && (
              <div className="bg-white/20 rounded-xl px-3 py-2 text-center backdrop-blur-sm shrink-0">
                <p className="text-2xl font-bold">{getTimeUntil(nextAppt.appointment_date, nextAppt.appointment_time, language)}</p>
                <p className="text-xs text-blue-200">{t.untilAppointment}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Link
              to={`/appointments/${nextAppt.id}`}
              className="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {t.viewDetails}
            </Link>
            <button
              onClick={() => handleCancel(nextAppt.id)}
              className="bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: t.totalBookings, count: appointments.length, color: 'text-blue-600', icon: '📋' },
          { label: t.upcoming, count: appointments.filter(a => String(a.appointment_date).split('T')[0] >= today && ['confirmed','in_progress'].includes(a.status)).length, color: 'text-green-600', icon: '📅' },
          { label: t.completed, count: appointments.filter(a => a.status === 'completed').length, color: 'text-gray-600', icon: '✅' },
          { label: t.cancelled, count: appointments.filter(a => a.status === 'cancelled').length, color: 'text-red-500', icon: '❌' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 mb-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { to: '/health-reports', title: 'Health Reports', count: reports.length, text: 'Upload and manage lab reports.' },
              { to: '/digital-health-records', title: 'Digital Health Records', count: reports.length + prescriptions.length + appointments.length, text: 'Profile, history, and timeline.' },
              { to: '/prescriptions', title: 'E-Prescriptions', count: prescriptions.length, text: 'Download, print, or ask AI.' },
              { to: '/telemedicine', title: 'Telemedicine', count: upcoming.length, text: 'Join video consultation rooms.' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="card block transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{item.title}</h2>
                  <span className="badge bg-blue-100 text-blue-700">{item.count}</span>
                </div>
                <p className="mt-2 min-h-10 text-sm text-gray-500">{item.text}</p>
                <p className="mt-4 text-sm font-semibold text-blue-600">Open</p>
              </Link>
            ))}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Recent Health Reports</h2>
              <Link to="/health-reports" className="text-sm font-medium text-blue-600">View all</Link>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {reports.slice(0, 4).map((report) => (
                <div key={report.id} className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-gray-500">{report.type} - {report.date}</p>
                      <p className="text-xs text-gray-400">{report.doctor} / {report.hospital}</p>
                    </div>
                    <span className="badge bg-green-100 text-green-700">{report.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => downloadReport(report)}>Download</button>
                    <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { setAiContext({ ...report, kind: 'report' }); setShowAi(true); }}>Ask AI About This Report</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showAi ? (
          <HealthAIChatbot context={aiContext} onClearContext={() => setAiContext(null)} />
        ) : (
          <div className="card">
            <h2 className="font-semibold">AI Health Assistant</h2>
            <p className="mt-2 text-sm text-gray-500">Ask about prescriptions, medicine wording, uploaded reports, lab terms, or appointment instructions.</p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Educational only. It does not diagnose disease or replace professional medical advice.
            </p>
            <button className="btn-primary mt-4 w-full" onClick={() => setShowAi(true)}>Ask Health AI</button>
          </div>
        )}
      </div>

      {/* Notifications Panel */}
      {recentNotifs.length > 0 && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{t.recentAlerts}</h2>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{unread} {t.new}</span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">{t.markAllRead}</button>
            )}
          </div>
          <div className="space-y-2">
            {recentNotifs.map((n) => {
              const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.system;
              const localizedNotif = translateNotification(n, t);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${style.bg} ${style.border} ${!n.is_read ? 'ring-1 ring-blue-300 dark:ring-blue-700' : ''}`}
                >
                  <span className="text-xl mt-0.5">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>{localizedNotif.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{localizedNotif.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0 animate-pulse" />}
                  {n.appointment_id && (
                    <Link to={`/appointments/${n.appointment_id}`} className="text-xs text-blue-600 hover:underline shrink-0 mt-0.5">{t.view} →</Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 px-4 text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Appointment List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? '📅' : tab === 'past' ? '📂' : '🚫'}
          title={tab === 'upcoming' ? t.noUpcomingAppointments : tab === 'past' ? t.noPastAppointments : t.noCancelledAppointments}
          message={tab === 'upcoming' ? t.noUpcomingMessage : ''}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const dateStr = String(appt.appointment_date).split('T')[0];
            const timeStr = String(appt.appointment_time).slice(0, 5);
            const timeUntil = tab === 'upcoming' ? getTimeUntil(dateStr, timeStr, language) : null;
            return (
              <div key={appt.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-2xl shrink-0">
                    🏥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold truncate">{appt.center_name}</h3>
                      <LocalizedStatusBadge status={appt.status} labels={t.status} />
                    </div>
                    {appt.doctor_name && (
                      <p className="text-sm text-gray-500">👨‍⚕️ {t.doctor}: {formatDoctorName(appt.doctor_name)} · {appt.specialization}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      📅 {formatDashboardDate(dateStr, locale)} {t.at} {formatDashboardTime(timeStr, locale)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">{t.token} #{appt.queue_number}</span>
                      <span className="text-xs text-gray-400">~{appt.estimated_wait_minutes} {t.minWait}</span>
                      {timeUntil && (
                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          ⏰ {timeUntil}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link to={`/appointments/${appt.id}`} className="btn-secondary text-sm py-1.5 px-3">
                    {t.view}
                  </Link>
                  {appt.status === 'confirmed' && (
                    <button onClick={() => handleCancel(appt.id)} className="btn-danger text-sm py-1.5 px-3">
                      {t.cancel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
