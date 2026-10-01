import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { LocationProvider } from './context/LocationContext';
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/layout/ProtectedRoute';
import PortalRedirect from './components/layout/PortalRedirect';
import UserPortalLayout from './components/layout/UserPortalLayout';
import AdminPortalLayout from './components/layout/AdminPortalLayout';
import EmergencyButton from './components/ui/EmergencyButton';

import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Centers from './pages/Centers';
import CenterDetail from './pages/CenterDetail';
import BookAppointment from './pages/BookAppointment';
import AppointmentStatus from './pages/AppointmentStatus';
import Profile from './pages/Profile';
import MedicalHistory from './pages/MedicalHistory';
import HealthReports from './pages/HealthReports';
import DigitalHealthRecords from './pages/DigitalHealthRecords';
import Prescriptions from './pages/Prescriptions';
import Telemedicine from './pages/Telemedicine';
import AIHealthAssistant from './pages/AIHealthAssistant';
import Feedback from './pages/Feedback';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCenters from './pages/admin/AdminCenters';
import AdminDoctors from './pages/admin/AdminDoctors';
import AdminAmbulances from './pages/admin/AdminAmbulances';
import AdminAppointments from './pages/admin/AdminAppointments';
import AdminQueue from './pages/admin/AdminQueue';
import AdminUsers from './pages/admin/AdminUsers';
import AdminHospitalControl from './pages/admin/AdminHospitalControl';
import AdminSystemControl from './pages/admin/AdminSystemControl';
import AdminTelemedicine from './pages/admin/AdminTelemedicine';
import AdminFeedback from './pages/admin/AdminFeedback';

export default function App() {
  const location = useLocation();
  const usesStandaloneShell =
    location.pathname.startsWith('/hospital-admin')
    || location.pathname.startsWith('/main-admin')
    || location.pathname === '/dashboard'
    || location.pathname === '/profile'
    || location.pathname === '/history'
    || location.pathname === '/health-reports'
    || location.pathname === '/digital-health-records'
    || location.pathname === '/prescriptions'
    || location.pathname === '/telemedicine'
    || location.pathname === '/ai-assistant'
    || location.pathname === '/feedback'
    || (location.pathname.startsWith('/centers/') && location.pathname.endsWith('/book'))
    || location.pathname.startsWith('/appointments/');

  return (
    <AuthProvider>
      <LanguageProvider>
        <LocationProvider>
          <NotificationProvider>
            <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
              {!usesStandaloneShell && <Navbar />}
              <main className="flex-1">
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/hospital-admin/login" element={<AdminLogin portal="hospital" />} />
                  <Route path="/main-admin/login" element={<AdminLogin portal="main" />} />
                  <Route path="/admin/login" element={<PortalRedirect target="hospital-login" />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/centers" element={<Centers />} />
                  <Route path="/centers/:id" element={<CenterDetail />} />

                  {/* Protected - User */}
                  <Route path="/dashboard" element={<ProtectedRoute role="user"><UserPortalLayout><Dashboard /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute role="user"><UserPortalLayout><Profile /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute role="user"><UserPortalLayout><MedicalHistory /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/health-reports" element={<ProtectedRoute role="user"><UserPortalLayout><HealthReports /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/digital-health-records" element={<ProtectedRoute role="user"><UserPortalLayout><DigitalHealthRecords /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/prescriptions" element={<ProtectedRoute role="user"><UserPortalLayout><Prescriptions /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/telemedicine" element={<ProtectedRoute role="user"><UserPortalLayout><Telemedicine /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/ai-assistant" element={<ProtectedRoute role="user"><UserPortalLayout><AIHealthAssistant /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/feedback" element={<ProtectedRoute role="user"><UserPortalLayout><Feedback /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/centers/:centerId/book" element={<ProtectedRoute role="user"><UserPortalLayout><BookAppointment /></UserPortalLayout></ProtectedRoute>} />
                  <Route path="/appointments/:id" element={<ProtectedRoute role="user"><UserPortalLayout><AppointmentStatus /></UserPortalLayout></ProtectedRoute>} />

                  {/* Protected - Hospital Admin */}
                  <Route path="/hospital-admin" element={<ProtectedRoute role="hospital_admin"><Navigate to="/hospital-admin/dashboard" replace /></ProtectedRoute>} />
                  <Route path="/hospital-admin/dashboard" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminDashboard /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/hospital-control" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminHospitalControl /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/doctors" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminDoctors /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/ambulances" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminAmbulances /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/appointments" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminAppointments /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/telemedicine/:id" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminTelemedicine /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/feedback" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminFeedback /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/hospital-admin/queue" element={<ProtectedRoute role="hospital_admin"><AdminPortalLayout portal="hospital"><AdminQueue /></AdminPortalLayout></ProtectedRoute>} />

                  {/* Protected - Main Admin */}
                  <Route path="/main-admin" element={<ProtectedRoute role="main_admin"><Navigate to="/main-admin/dashboard" replace /></ProtectedRoute>} />
                  <Route path="/main-admin/dashboard" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminDashboard /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/hospital-control" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminHospitalControl /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/system-control" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminSystemControl /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/centers" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminCenters /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/doctors" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminDoctors /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/ambulances" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminAmbulances /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/appointments" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminAppointments /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/telemedicine/:id" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminTelemedicine /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/feedback" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminFeedback /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/queue" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminQueue /></AdminPortalLayout></ProtectedRoute>} />
                  <Route path="/main-admin/users" element={<ProtectedRoute role="main_admin"><AdminPortalLayout portal="main"><AdminUsers /></AdminPortalLayout></ProtectedRoute>} />

                  {/* Legacy admin redirects */}
                  <Route path="/admin" element={<PortalRedirect />} />
                  <Route path="/admin/hospital-control" element={<PortalRedirect />} />
                  <Route path="/admin/system-control" element={<PortalRedirect />} />
                  <Route path="/admin/centers" element={<PortalRedirect />} />
                  <Route path="/admin/doctors" element={<PortalRedirect />} />
                  <Route path="/admin/ambulances" element={<PortalRedirect />} />
                  <Route path="/admin/appointments" element={<PortalRedirect />} />
                  <Route path="/admin/queue" element={<PortalRedirect />} />
                  <Route path="/admin/users" element={<PortalRedirect />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              {!usesStandaloneShell && <EmergencyButton />}
              {!usesStandaloneShell && (
                <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 dark:border-gray-800">
                  Copyright {new Date().getFullYear()} SmartHealth. All rights reserved.
                </footer>
              )}
            </div>
          </NotificationProvider>
        </LocationProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
