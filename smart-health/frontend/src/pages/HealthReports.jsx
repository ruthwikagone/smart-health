import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import HealthAIChatbot from '../components/health/HealthAIChatbot';
import { useAuth } from '../context/AuthContext';
import { REPORT_CATEGORIES, buildReportText, deleteReport, downloadReport, fetchReports, getReportsForUser, removeReport, saveReport, uploadReport } from '../services/healthRecords';

const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export default function HealthReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState(getReportsForUser(user));
  const [loading, setLoading] = useState(true);
  const [aiContext, setAiContext] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'Blood Test', hospital: '', doctor: '', date: '', description: '', file: null });
  const recentReports = useMemo(() => [...reports].sort((a, b) => String(b.date).localeCompare(String(a.date))), [reports]);

  const loadReports = () => {
    fetchReports()
      .then(setReports)
      .catch(() => setReports(getReportsForUser(user)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, [user?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const file = form.file;
    if (!form.name.trim() || !form.hospital.trim() || !form.date || !file) {
      toast.error('Please complete report details and select a file.');
      return;
    }
    const extension = file.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      toast.error('Supported files: PDF, JPG, PNG, DOC, and DOCX.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Report file must be under 8 MB.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      hospital: form.hospital.trim(),
      doctor: form.doctor.trim() || 'Not specified',
      date: form.date,
      description: form.description.trim(),
      fileName: file.name,
      fileType: extension.toUpperCase(),
      fileSize: file.size,
      patientName: user?.name,
      patientEmail: user?.email,
      patientId: user?.id,
      content: buildReportText({
        ...form,
        patientName: user?.name,
        doctor: form.doctor || 'Not specified',
        hospital: form.hospital,
        findings: form.description || 'Patient uploaded this report for doctor review.',
      }),
    };

    try {
      const created = await uploadReport(payload);
      setReports((current) => [created, ...current]);
    } catch {
      const next = saveReport(payload);
      setReports(next.filter((report) => !report.patientEmail || report.patientEmail === user?.email || String(report.patientId) === String(user?.id)));
      toast.error('Backend unavailable, saved this report in this browser only.');
    }
    setForm({ name: '', type: 'Blood Test', hospital: '', doctor: '', date: '', description: '', file: null });
    event.target.reset();
    toast.success('Health report uploaded.');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return;
    try {
      await removeReport(id);
      setReports((current) => current.filter((report) => report.id !== id));
    } catch {
      const next = deleteReport(id);
      setReports(next.filter((report) => !report.patientEmail || report.patientEmail === user?.email || String(report.patientId) === String(user?.id)));
    }
    if (aiContext?.id === id) setAiContext(null);
    toast.success('Report deleted.');
  };

  return (
    <div className="portal-page">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Reports</h1>
          <p className="mt-1 text-sm text-gray-500">Upload, view, download, and ask AI about medical reports.</p>
        </div>
        <button type="button" onClick={() => document.getElementById('health-report-file')?.click()} className="btn-primary">
          Upload Health Report
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="card">
            <h2 className="mb-4 font-semibold">Report Details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" placeholder="Report name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {REPORT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
              <input className="input" placeholder="Hospital/Lab name" value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} />
              <input className="input" placeholder="Doctor name" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} />
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input id="health-report-file" className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
              <textarea className="input md:col-span-2" rows={3} placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary mt-4">Upload Report</button>
          </form>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Recent Health Reports</h2>
              <span className="badge bg-blue-100 text-blue-700">{loading ? 'Loading' : `${reports.length} reports`}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500 dark:border-gray-800">
                    {['Report', 'Type', 'Date', 'Doctor/Lab', 'File', 'Status', 'Actions'].map((heading) => <th key={heading} className="pb-3 pr-4 font-medium">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentReports.map((report) => (
                    <tr key={report.id}>
                      <td className="py-3 pr-4 font-medium">{report.name}</td>
                      <td className="py-3 pr-4">{report.type}</td>
                      <td className="py-3 pr-4">{report.date}</td>
                      <td className="py-3 pr-4">{report.doctor}<br /><span className="text-xs text-gray-400">{report.hospital}</span></td>
                      <td className="py-3 pr-4">{report.fileType}</td>
                      <td className="py-3 pr-4"><span className="badge bg-green-100 text-green-700">{report.status}</span></td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => toast.success(`${report.fileName} is ready to view.`)}>View</button>
                          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => downloadReport(report)}>Download</button>
                          <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => setAiContext({ ...report, kind: 'report' })}>Ask AI</button>
                          <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => handleDelete(report.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <HealthAIChatbot context={aiContext} onClearContext={() => setAiContext(null)} />
      </div>
    </div>
  );
}
