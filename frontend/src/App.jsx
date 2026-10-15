import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Evaluations from "./pages/Evaluations";
import AdminRubric from "./pages/AdminRubric";
import AdminCourses from "./pages/AdminCourses";
import AdminSessions from "./pages/AdminSessions";
import AdminStudents from "./pages/AdminStudents";
import SessionCourses from "./pages/SessionCourses";
import SessionGroups from "./pages/SessionGroups";
import AdminUsers from "./pages/AdminUsers";
import AccountSettings from "./pages/AccountSettings";
import MainLayout from "./components/MainLayout";
import SessionLayout from "./components/SessionLayout";
import ResourcesLayout from "./components/ResourcesLayout";
import SessionsLayout from "./components/SessionsLayout";
import { getToken } from "./lib/api";

function RedirectKeepSearch({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

function PrivateShell() {
  return getToken() ? <MainLayout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateShell />}>
        <Route path="/session" element={<SessionLayout />}>
          <Route index element={<Evaluations />} />
          <Route path="cours" element={<SessionCourses />} />
          <Route path="groupes" element={<SessionGroups />} />
        </Route>
        <Route path="/ressources" element={<ResourcesLayout />}>
          <Route index element={<Navigate to="/ressources/cours" replace />} />
          <Route path="cours" element={<AdminCourses />} />
          <Route path="grilles" element={<AdminRubric />} />
          <Route path="groupes" element={<AdminStudents />} />
          <Route path="sessions" element={<SessionsLayout />}>
            <Route index element={<AdminSessions view="sessions" />} />
            <Route path="archives" element={<AdminSessions view="archives" />} />
          </Route>
        </Route>
        <Route path="/sessions" element={<Navigate to="/ressources/sessions" replace />} />
        <Route path="/sessions/archives" element={<Navigate to="/ressources/sessions/archives" replace />} />
        <Route path="/evaluations" element={<RedirectKeepSearch to="/session" />} />
        <Route path="/evaluations/grilles" element={<Navigate to="/ressources/grilles" replace />} />
        <Route path="/evaluations/cours" element={<Navigate to="/ressources/cours" replace />} />
        <Route path="/evaluations/sessions" element={<Navigate to="/ressources/sessions" replace />} />
        <Route path="/classes" element={<Navigate to="/ressources/cours" replace />} />
        <Route path="/classes/cours" element={<Navigate to="/ressources/cours" replace />} />
        <Route path="/classes/groupes" element={<Navigate to="/ressources/groupes" replace />} />
        <Route path="/classes/sessions" element={<Navigate to="/ressources/sessions" replace />} />
        <Route path="/classes/archives" element={<Navigate to="/ressources/sessions/archives" replace />} />
        <Route path="/admin/rubrics" element={<Navigate to="/ressources/grilles" replace />} />
        <Route path="/admin/students" element={<Navigate to="/ressources/groupes" replace />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/admin/smtp" element={<Navigate to="/admin/users" replace />} />
        <Route path="*" element={<Navigate to="/session" replace />} />
      </Route>
    </Routes>
  );
}
