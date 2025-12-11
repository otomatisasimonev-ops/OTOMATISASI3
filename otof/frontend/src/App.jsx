import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BadanPublik from './pages/BadanPublik';
import HistoryLog from './pages/HistoryLog';
import TemplateEditor from './pages/TemplateEditor';
import Settings from './pages/Settings';
import AddUser from './pages/AddUser';
import Penugasan from './pages/Penugasan';
import Tentang from './pages/Tentang';
import HolidayCalendar from './pages/HolidayCalendar';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/badan-publik" element={<BadanPublik />} />
            <Route path="/history" element={<HistoryLog />} />
            <Route path="/templates" element={<TemplateEditor />} />
            <Route path="/penugasan" element={<Penugasan />} />
            <Route path="/users" element={<AddUser />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tentang" element={<Tentang />} />
            <Route path="/kalender" element={<HolidayCalendar />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
