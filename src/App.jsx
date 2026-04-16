import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, isAdmin, hasManagerAccess } from './services/auth';
import Layout from './components/Layout';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import ClockIn from './pages/ClockIn';
import Login from './pages/Login';
import CollaboratorDashboard from './pages/collaborator/Dashboard';
import TimeRegistration from './pages/collaborator/TimeRegistration';
import MonthlyStatement from './pages/collaborator/MonthlyStatement';
import Receipts from './pages/collaborator/Receipts';
import Justifications from './pages/collaborator/Justifications';
import VacationRequest from './pages/collaborator/VacationRequest';
import ManagerDashboard from './pages/manager/Dashboard';
import Homologation from './pages/manager/Homologation';
import EmployeeManagement from './pages/manager/EmployeeManagement';
import MonthlyReport from './pages/manager/MonthlyReport';
import AuditLog from './pages/manager/AuditLog';
import VacationManagement from './pages/manager/VacationManagement';
import AdminPanel from './pages/admin/AdminPanel';
import UserProfile from './pages/collaborator/UserProfile';
import HourBank from './pages/collaborator/HourBank';
import OvertimeManagement from './pages/manager/OvertimeManagement';

function ProtectedRoute({ children, requireManager = false, requireAdmin = false }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin()) return <Navigate to="/login" replace />;
  if (requireManager && !hasManagerAccess()) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <PWAInstallPrompt />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<ClockIn />} />
        <Route path="/login" element={<Login />} />

        {/* Collaborator routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<CollaboratorDashboard />} />
          <Route path="/registrar" element={<TimeRegistration />} />
          <Route path="/extrato" element={<MonthlyStatement />} />
          <Route path="/comprovantes" element={<Receipts />} />
          <Route path="/justificativas" element={<Justifications />} />
          <Route path="/ferias" element={<VacationRequest />} />
          <Route path="/perfil" element={<UserProfile />} />
          <Route path="/banco-horas" element={<HourBank />} />
        </Route>

        {/* Manager routes (accessible by both manager AND admin) */}
        <Route element={<ProtectedRoute requireManager><Layout /></ProtectedRoute>}>
          <Route path="/gestor" element={<ManagerDashboard />} />
          <Route path="/gestor/homologacao" element={<Homologation />} />
          <Route path="/gestor/colaboradores" element={<EmployeeManagement />} />
          <Route path="/gestor/relatorios" element={<MonthlyReport />} />
          <Route path="/gestor/auditoria" element={<AuditLog />} />
          <Route path="/gestor/ferias" element={<VacationManagement />} />
          <Route path="/gestor/banco-horas" element={<OvertimeManagement />} />
        </Route>

        {/* Admin-only routes */}
        <Route element={<ProtectedRoute requireAdmin><Layout /></ProtectedRoute>}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
