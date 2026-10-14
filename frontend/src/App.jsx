import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Evaluations from "./pages/Evaluations";
import AdminRubric from "./pages/AdminRubric";
import AdminCourses from "./pages/AdminCourses";
import AdminSessions from "./pages/AdminSessions";
import AdminStudents from "./pages/AdminStudents";
import AdminUsers from "./pages/AdminUsers";
import AccountSettings from "./pages/AccountSettings";
import MainLayout from "./components/MainLayout";
import EvaluationsLayout from "./components/EvaluationsLayout";
import ClassesLayout from "./components/ClassesLayout";
import { getToken } from "./lib/api";

function PrivateShell() {
  return getToken() ? <MainLayout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateShell />}>
        <Route path="/evaluations" element={<EvaluationsLayout />}>
          <Route index element={<Evaluations />} />
          <Route path="grilles" element={<AdminRubric />} />
          <Route path="cours" element={<Navigate to="/classes/cours" replace />} />
          <Route path="sessions" element={<Navigate to="/classes/sessions" replace />} />
        </Route>
        <Route path="/classes" element={<ClassesLayout />}>
          <Route index element={<Navigate to="/classes/cours" replace />} />
          <Route path="cours" element={<AdminCourses />} />
          <Route path="groupes" element={<AdminStudents />} />
          <Route path="sessions" element={<AdminSessions view="sessions" />} />
          <Route path="archives" element={<AdminSessions view="archives" />} />
        </Route>
        <Route path="/admin/rubrics" element={<Navigate to="/evaluations/grilles" replace />} />
        <Route path="/admin/students" element={<Navigate to="/classes/groupes" replace />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/admin/smtp" element={<Navigate to="/admin/users" replace />} />
        <Route path="*" element={<Navigate to="/evaluations" replace />} />
      </Route>
    </Routes>
  );
}
