import "./i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StaffGuard, ParticipantGuard } from "@/components/guards/PortalGuards";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Portal from "./pages/Portal";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/projects/Projects";
import ProjectDetail from "./pages/projects/ProjectDetail";
import Tasks from "./pages/projects/Tasks";
import Calendar from "./pages/projects/Calendar";
import Users from "./pages/staff/Users";
import Permissions from "./pages/settings/Permissions";
import StaffRequests from "./pages/staff/StaffRequests";
import AuditLog from "./pages/logs/AuditLog";
import SystemErrors from "./pages/logs/SystemErrors";
import Profile from "./pages/Profile";
import Participants from "./pages/participants/Participants";
import ParticipantDetail from "./pages/participants/ParticipantDetail";
import ProfileEditRequests from "./pages/participants/ProfileEditRequests";
import Attendance from "./pages/participants/Attendance";
import AttendanceLayout from "./pages/participants/AttendanceLayout";
import AttendanceReport from "./pages/participants/AttendanceReport";
import Notifications from "./pages/settings/Notifications";
import WhatsAppCenter from "./pages/settings/WhatsAppCenter";
import WhatsAppAutomations from "./pages/settings/WhatsAppAutomations";
import WhatsAppTemplates from "./pages/settings/WhatsAppTemplates";
import Messages from "./pages/settings/Messages";
import SupportTickets from "./pages/settings/SupportTickets";
import Finance from "./pages/finance/Finance";
import Reports from "./pages/reports/Reports";
import SiteContent from "./pages/settings/SiteContent";
import Settings from "./pages/settings/Settings";
import Preferences from "./pages/settings/Preferences";
import RegistrationStructureSettings from "./pages/participants/RegistrationStructureSettings";
import TrainingLibrary from "./pages/operations/TrainingLibrary";
import SetupAccount from "./pages/SetupAccount";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DataDeletion from "./pages/DataDeletion";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:slug" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/data-deletion" element={<DataDeletion />} />
            <Route path="/portal" element={<ParticipantGuard><Portal /></ParticipantGuard>} />
            <Route path="/setup-account" element={<ProtectedRoute><SetupAccount /></ProtectedRoute>} />
            <Route element={<StaffGuard><AppShell /></StaffGuard>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/participants" element={<Participants />} />
              <Route path="/participants/edit-requests" element={<ProfileEditRequests />} />
              <Route path="/participants/:id" element={<ParticipantDetail />} />
              <Route path="/attendance" element={<AttendanceLayout />}>
                <Route index element={<Attendance />} />
                <Route path="report" element={<AttendanceReport />} />
              </Route>
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/whatsapp-center" element={<WhatsAppCenter />} />
              <Route path="/whatsapp-automations" element={<WhatsAppAutomations />} />
              <Route path="/whatsapp-templates" element={<WhatsAppTemplates />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/support" element={<SupportTickets />} />
              <Route path="/training-library" element={<TrainingLibrary />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/staff-requests" element={<StaffRequests />} />
              <Route path="/site-content" element={<SiteContent />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/registration-structure" element={<RegistrationStructureSettings />} />
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/system-errors" element={<SystemErrors />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
