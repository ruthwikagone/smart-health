import { useEffect, useState } from 'react';
import HealthAIChatbot from '../components/health/HealthAIChatbot';
import { useAuth } from '../context/AuthContext';
import { buildPrescriptionText, downloadTextFile, fetchPrescriptions, getPrescriptionsForUser } from '../services/healthRecords';

export default function Prescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState(getPrescriptionsForUser(user));
  const [aiContext, setAiContext] = useState(null);

  useEffect(() => {
    fetchPrescriptions().then(setPrescriptions).catch(() => setPrescriptions(getPrescriptionsForUser(user)));
  }, [user?.id]);

  return (
    <div className="portal-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">E-Prescriptions</h1>
        <p className="mt-1 text-sm text-gray-500">View prescriptions, download patient copies, print, and ask AI for plain-language explanations.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
        <div className="space-y-4">
          {prescriptions.map((prescription) => (
            <article key={prescription.id} className="card">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-800 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-bold">{prescription.diagnosis}</h2>
                  <p className="text-sm text-gray-500">{prescription.doctorName} to {prescription.patientName} on {prescription.date}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-2 text-xs">View Prescription</button>
                  <button className="btn-secondary px-3 py-2 text-xs" onClick={() => downloadTextFile(`Prescription-${prescription.date}.txt`, buildPrescriptionText(prescription))}>Download PDF</button>
                  <button className="btn-secondary px-3 py-2 text-xs" onClick={() => window.print()}>Print</button>
                  <button className="btn-primary px-3 py-2 text-xs" onClick={() => setAiContext({ ...prescription, kind: 'prescription' })}>Ask AI</button>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      {['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions'].map((heading) => <th key={heading} className="pb-2 pr-4 font-medium">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {prescription.medicines.map((medicine) => (
                      <tr key={medicine.name}>
                        <td className="py-3 pr-4 font-medium">{medicine.name}</td>
                        <td className="py-3 pr-4">{medicine.dosage}</td>
                        <td className="py-3 pr-4">{medicine.frequency}</td>
                        <td className="py-3 pr-4">{medicine.duration}</td>
                        <td className="py-3 pr-4">{medicine.instructions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">Doctor notes: {prescription.notes}</p>
            </article>
          ))}
        </div>

        <HealthAIChatbot context={aiContext} onClearContext={() => setAiContext(null)} />
      </div>
    </div>
  );
}
