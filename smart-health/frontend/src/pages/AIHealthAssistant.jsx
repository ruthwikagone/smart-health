import { useState } from 'react';
import HealthAIChatbot from '../components/health/HealthAIChatbot';
import { useAuth } from '../context/AuthContext';
import { getPrescriptionsForUser, getReportsForUser } from '../services/healthRecords';

export default function AIHealthAssistant() {
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const reports = getReportsForUser(user);
  const prescriptions = getPrescriptionsForUser(user);

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Health Assistant</h1>
        <p className="mt-1 text-sm text-gray-500">Ask educational questions about prescriptions, uploaded reports, medical terms, and appointment instructions.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]">
        <aside className="space-y-4">
          <div className="card">
            <h2 className="mb-3 font-semibold">Ask About a Report</h2>
            <div className="space-y-2">
              {reports.slice(0, 5).map((report) => (
                <button key={report.id} className="w-full rounded-lg border border-gray-100 p-3 text-left text-sm hover:border-blue-300 dark:border-gray-800" onClick={() => setContext({ ...report, kind: 'report' })}>
                  <span className="font-medium">{report.name}</span>
                  <span className="block text-xs text-gray-500">{report.type} - {report.date}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="mb-3 font-semibold">Ask About a Prescription</h2>
            <div className="space-y-2">
              {prescriptions.slice(0, 5).map((prescription) => (
                <button key={prescription.id} className="w-full rounded-lg border border-gray-100 p-3 text-left text-sm hover:border-blue-300 dark:border-gray-800" onClick={() => setContext({ ...prescription, kind: 'prescription' })}>
                  <span className="font-medium">{prescription.diagnosis}</span>
                  <span className="block text-xs text-gray-500">{prescription.doctorName} - {prescription.date}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <HealthAIChatbot context={context} onClearContext={() => setContext(null)} />
      </div>
    </div>
  );
}
