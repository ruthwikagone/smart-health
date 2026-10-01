const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

const recentMessages = new Map();

function contains(text, terms) {
  return terms.some((term) => text.includes(term));
}

function buildHealthAnswer(question, context = {}) {
  const text = question.toLowerCase();
  const recordName = context?.name || context?.diagnosis || context?.type || '';
  const contextLine = recordName
    ? ` I will keep ${recordName} in mind, but the exact interpretation still depends on the full clinical record and reference ranges.`
    : '';

  if (contains(text, ['chest pain', 'trouble breathing', 'difficulty breathing', 'stroke', 'fainting', 'unconscious', 'severe bleeding', 'suicid', 'overdose'])) {
    return {
      answer: `Your question may describe an emergency. Please contact your local emergency service or go to the nearest emergency department now—especially for sudden chest pain, breathing difficulty, fainting, severe bleeding, stroke symptoms, overdose, or thoughts of self-harm. This chat cannot safely assess an emergency.${contextLine}`,
      urgent: true,
    };
  }

  if (contains(text, ['medicine', 'medication', 'tablet', 'capsule', 'dose', 'dosage', 'antibiotic', 'side effect'])) {
    return {
      answer: `For medication questions, the safest rule is to use the medicine exactly as written on your prescription. Check the medicine name, dose, frequency, duration, and food instructions; do not double a missed dose or stop a prescribed medicine without asking the prescribing clinician or pharmacist. If you have rash, swelling, wheezing, or severe vomiting after a medicine, seek urgent medical help.${contextLine}`,
      urgent: false,
    };
  }

  if (contains(text, ['blood pressure', 'bp', 'hypertension'])) {
    return {
      answer: `Blood-pressure readings are most useful when measured correctly: rest quietly for five minutes, keep both feet on the floor, support the arm at heart level, and take more than one reading. A single value does not diagnose a condition. If a reading is very high and comes with chest pain, breathlessness, weakness, confusion, or vision changes, seek urgent care.${contextLine}`,
      urgent: false,
    };
  }

  if (contains(text, ['sugar', 'glucose', 'diabetes', 'hba1c'])) {
    return {
      answer: `Glucose and HbA1c results should be interpreted with the test type, timing of meals, medicines, and your clinician's target range. HbA1c estimates average glucose over roughly the previous two to three months. Keep a record of symptoms and readings, and ask your doctor whether the result needs repeat testing or a treatment change.${contextLine}`,
      urgent: false,
    };
  }

  if (contains(text, ['fever', 'cold', 'cough', 'sore throat', 'flu'])) {
    return {
      answer: `For a mild fever, cold, cough, or sore throat, rest, fluids, and monitoring symptoms can help while you arrange appropriate clinical advice. Seek prompt care if there is trouble breathing, dehydration, a persistent high fever, chest pain, confusion, symptoms that rapidly worsen, or if the affected person is very young, elderly, pregnant, or immunocompromised.${contextLine}`,
      urgent: false,
    };
  }

  if (contains(text, ['report', 'test', 'lab', 'hb', 'hemoglobin', 'x-ray', 'mri', 'ct scan', 'scan'])) {
    return {
      answer: `To understand a report, first identify the test, its result, the laboratory reference range, and any clinician comments. A high or low flag is not a diagnosis by itself; age, symptoms, medicines, and other tests matter. I can explain common terms in plain language, but a clinician who can see the full report should confirm what it means for you.${contextLine}`,
      urgent: false,
    };
  }

  if (contains(text, ['diet', 'food', 'exercise', 'sleep', 'weight', 'stress', 'anxiety'])) {
    return {
      answer: `A practical health plan usually starts with small, repeatable changes: regular meals with vegetables and protein, enough water, gradual activity suited to your ability, consistent sleep, and stress support. The right plan depends on your conditions, medicines, pregnancy status, and mobility, so use your clinician's advice for anything condition-specific.${contextLine}`,
      urgent: false,
    };
  }

  return {
    answer: `I received your question: “${question}”. I can provide general, evidence-informed health education and help you prepare for a doctor visit, but I cannot diagnose or replace a clinician who examines you. Please share the symptom, report term, prescription wording, duration, and anything that makes it better or worse; I will explain the next useful steps in plain language.${contextLine}`,
    urgent: false,
  };
}

router.use(authenticate);

router.post('/chat', (req, res) => {
  const question = String(req.body?.message || '').trim();
  if (!question) return res.status(400).json({ success: false, message: 'Enter a question before sending.' });
  if (question.length > 2000) return res.status(400).json({ success: false, message: 'Keep questions under 2,000 characters.' });

  const now = Date.now();
  const key = req.user.id;
  const messages = (recentMessages.get(key) || []).filter((time) => now - time < 60_000);
  if (messages.length >= 25) {
    return res.status(429).json({ success: false, message: 'Please wait a minute before sending more questions.' });
  }
  messages.push(now);
  recentMessages.set(key, messages);

  const result = buildHealthAnswer(question, req.body?.context || {});
  res.json({
    success: true,
    answer: result.answer,
    urgent: result.urgent,
    suggestedQuestions: [
      'What information should I share with my doctor?',
      'Can you explain this in simpler words?',
      'Which symptoms mean I should seek urgent care?',
    ],
  });
});

module.exports = router;
