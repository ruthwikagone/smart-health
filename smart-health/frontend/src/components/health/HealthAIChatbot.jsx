import { useMemo, useState } from 'react';

const SUGGESTIONS = [
  'Explain this report in simple terms.',
  'What is this medicine generally used for?',
  'What does Hb mean?',
  'How should I prepare questions for my doctor?',
];

function buildReply(message, context) {
  const text = message.toLowerCase();
  const scope = context?.name || context?.diagnosis || 'your health record';

  if (text.includes('emergency') || text.includes('chest pain') || text.includes('breathing')) {
    return 'If symptoms are severe, sudden, or worsening, contact emergency services or a qualified healthcare professional now. I can help explain records, but urgent symptoms need real clinical care.';
  }

  if (text.includes('dose') || text.includes('dosage') || text.includes('take') || text.includes('medicine')) {
    return `For ${scope}, I can explain common wording on prescriptions: dosage is the amount, frequency is how often it is taken, and duration is how long. Follow the doctor's written instructions and ask the doctor or pharmacist before changing timing, stopping, or combining medicines.`;
  }

  if (text.includes('hb') || text.includes('blood') || text.includes('lab') || text.includes('value')) {
    return `For ${scope}, lab terms usually describe measured body markers. Hb means hemoglobin, a protein in red blood cells that carries oxygen. Values can vary by age, sex, lab method, and medical history, so use this as a plain-language explanation and review abnormal results with your doctor.`;
  }

  if (text.includes('report') || text.includes('explain') || context) {
    return `Here is a simple way to read ${scope}: identify the test or medicine names, compare any lab values with the reference range printed by the lab, note flagged high or low values, and connect them with your doctor's notes. I cannot diagnose from this, but I can help translate medical terms and prepare questions for your appointment.`;
  }

  return 'I can help explain prescriptions, report terminology, appointment notes, and health-record wording in plain language. I cannot diagnose disease or replace your doctor, but I can help you understand what to ask next.';
}

export default function HealthAIChatbot({ context, onClearContext }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi, I am your AI Health Assistant. Ask me to explain a prescription, report term, or appointment note in simple language.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const contextLabel = useMemo(() => {
    if (!context) return '';
    if (context.kind === 'prescription') return `Prescription: ${context.diagnosis}`;
    return `Report: ${context.name}`;
  }, [context]);

  const sendMessage = (text = input) => {
    const clean = text.trim();
    if (!clean) return;
    setMessages((current) => [...current, { role: 'user', text: clean }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages((current) => [...current, { role: 'assistant', text: buildReply(clean, context) }]);
      setTyping(false);
    }, 450);
  };

  return (
    <section className="card h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-lg font-bold">AI Health Assistant</h2>
          <p className="mt-1 text-xs text-gray-500">
            General educational explanations only. Consult your doctor for diagnosis or treatment decisions.
          </p>
          {contextLabel && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              {contextLabel}
              <button type="button" onClick={onClearContext} className="text-blue-500 hover:text-blue-800">Clear</button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setMessages([])} className="btn-secondary text-xs px-3 py-2">
          Clear chat
        </button>
      </div>

      <div className="min-h-[280px] flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`}>
              {message.text}
            </div>
          </div>
        ))}
        {typing && <p className="text-sm text-gray-500">AI is typing...</p>}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300">
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
      >
        <input className="input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a report, prescription, or appointment..." />
        <button type="submit" className="btn-primary">Send</button>
      </form>
    </section>
  );
}
