# Smart Health Appointment System

Full-stack healthcare appointment booking platform with real-time queue tracking.

## Stack
- Frontend: React + Vite + Tailwind CSS + Axios + Socket.io-client
- Backend: Node.js + Express.js + Socket.io
- Database: MySQL
- Auth: JWT + bcrypt

---

## Quick Start

### 1. Database Setup

Create a MySQL database and run the schema:

```bash
mysql -u root -p -e "CREATE DATABASE smart_health;"
mysql -u root -p smart_health < backend/src/config/schema.sql
mysql -u root -p smart_health < backend/src/config/seed.sql
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL or DB_* values and JWT_SECRET
npm install
npm run dev
```

Backend runs on http://localhost:5000

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

---

## Seed Credentials

| Role  | Email                    | Password  |
|-------|--------------------------|-----------|
| Admin | admin@smarthealth.com    | admin123  |
| User  | john@example.com         | user1234  |

---

## API Overview

| Method | Endpoint                          | Auth     |
|--------|-----------------------------------|----------|
| POST   | /api/auth/signup                  | Public   |
| POST   | /api/auth/login                   | Public   |
| GET    | /api/auth/me                      | User     |
| GET    | /api/centers                      | Public   |
| GET    | /api/centers/nearby?lat=&lng=     | Public   |
| GET    | /api/doctors?center_id=           | Public   |
| GET    | /api/doctors/:id/slots?date=      | Public   |
| POST   | /api/appointments                 | User     |
| GET    | /api/appointments/me              | User     |
| PATCH  | /api/appointments/:id/cancel      | User     |
| PATCH  | /api/appointments/:id/reschedule  | User     |
| GET    | /api/admin/appointments           | Admin    |
| PATCH  | /api/admin/appointments/:id/status| Admin    |
| GET    | /api/admin/queue-status           | Admin    |
| POST   | /api/admin/centers                | Admin    |
| POST   | /api/admin/doctors                | Admin    |

---

## Added Features Report

Updated on August 24, 2026.

### Patient Portal Enhancements

- Added a dedicated user portal shell with sidebar navigation for dashboard, appointments, health reports, digital records, prescriptions, telemedicine, AI assistant, and profile.
- Added Health Reports, where users can upload report metadata and files, validate supported formats, view report history, download patient copies, delete reports, and ask the AI assistant about a selected report.
- Added Digital Health Records, a centralized patient record view combining profile information, appointment visits, uploaded reports, prescriptions, and a chronological medical timeline.
- Added E-Prescriptions, including prescription tables, doctor notes, patient-copy download, print support, and AI explanations for prescription wording.
- Added Telemedicine, a frontend consultation room layout with appointment selection, video room placeholder, mic/camera controls, chat, consultation notes, and access to related reports and prescriptions.
- Added an AI Health Assistant page and reusable chatbot component for plain-language educational explanations about reports, prescriptions, lab terms, and appointment instructions.

### Appointment Flow Enhancements

- Expanded booking into a multi-step flow covering reason, symptoms, priority, doctor selection, date/time selection, and final confirmation.
- Added emergency-priority guidance, nearby hospital lookup, map links, and ambulance booking entry point.
- Added attachment selection so patients can connect existing reports and prescriptions to a new appointment.
- Updated appointment status screens to show attached reports and prescriptions and provide a path into telemedicine for online visits.

### Admin Portal Enhancements

- Split admin access into Hospital Admin and Main Admin portals with role-aware routes and redirects.
- Added admin portal sidebar layouts for hospital-scoped operations and platform-wide operations.
- Added dashboard statistics for appointments, queue state, visible centers, and visible doctors.
- Added User Management for main admins, including admin creation, hospital authorization assignment, role changes, search, and deletion.
- Added hospital/system control entry points and updated admin appointment workflows to reference patient reports and previous prescriptions.

### New Frontend Routes

| Route | Purpose |
|-------|---------|
| `/health-reports` | Upload and manage health reports |
| `/digital-health-records` | View combined patient records and medical timeline |
| `/prescriptions` | View, print, download, and ask AI about prescriptions |
| `/telemedicine` | Open the consultation room interface |
| `/ai-assistant` | Ask educational questions about medical records |
| `/hospital-admin/*` | Hospital-scoped admin portal |
| `/main-admin/*` | Platform-wide admin portal |

### Verification

- Frontend production build completed successfully with `npm.cmd run build`.
- Backend started successfully on `http://localhost:5000` and connected to MySQL.
- Frontend dev server started successfully on `http://127.0.0.1:5175/` because ports `5173` and `5174` were already in use.

### Latest Care Workflow Updates

- Fixed report downloads so every downloaded report contains a complete SmartHealth report body instead of an empty file.
- Users can now get reports in two ways: upload their own reports from Health Reports, or receive hospital-generated reports after a booked appointment.
- Hospital admins can generate a report from an appointment. The generated report is tagged to the patient and appears in that user's Health Reports, Dashboard, Digital Health Records, and appointment details.
- Users can book Telemedicine by choosing the Telemedicine consultation type during appointment booking.
- Hospital admins can identify telemedicine appointments, accept/start them, and join the admin telemedicine room from the appointment management screen.
- Patients can join their matching telemedicine room from Telemedicine or from the appointment status page.
- E-prescriptions are issued by hospital admins from appointment actions. They are attached to the appointment and appear in the patient's E-Prescriptions and Digital Health Records pages.
- Report and prescription storage is currently implemented in browser storage for the demo flow. For production, move these records into backend MySQL tables and file storage so they sync across different devices and browsers.

---

## Deployment

- **Frontend** -> Vercel/Netlify: `npm run build`, deploy `dist/`
- **Backend** -> Render/Railway: set env vars, `npm start`
- **Database** -> Supabase or Neon (set `DATABASE_URL` in backend env)

Set `CLIENT_URL` in backend `.env` to your deployed frontend URL for CORS.
