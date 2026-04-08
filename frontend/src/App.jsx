import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Evaluations from "./pages/Evaluations";
import AdminRubric from "./pages/AdminRubric";
import AdminStudents from "./pages/AdminStudents";
import AdminUsers from "./pages/AdminUsers";
import { getToken } from "./lib/api";

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/evaluations" element={<PrivateRoute><Evaluations /></PrivateRoute>} />
      <Route path="/admin/rubrics" element={<PrivateRoute><AdminRubric /></PrivateRoute>} />
      <Route path="/admin/students" element={<PrivateRoute><AdminStudents /></PrivateRoute>} />
      <Route path="/admin/users" element={<PrivateRoute><AdminUsers /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/evaluations" replace />} />
    </Routes>
  );
}
