import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './lib/api';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import TaskDetailModal from './components/TaskDetailModal';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('km_token');
    if (token) {
      api.me()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('km_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('km_token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('km_token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AuthContext.Provider value={user}>
      <div className="min-h-screen bg-gray-100">
        <Header user={user} onLogout={handleLogout} onChangePassword={() => setShowChangePassword(true)} onViewTask={(task) => setDetailTask(task)} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {user.role === 'admin' && <AdminDashboard user={user} />}
          {user.role === 'manager' && <ManagerDashboard user={user} />}
          {(user.role === 'employee' || user.role === 'site_manager') && <EmployeeDashboard user={user} />}
        </main>
      </div>
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      {detailTask && (
        <TaskDetailModal
          isOpen={!!detailTask}
          onClose={() => setDetailTask(null)}
          task={detailTask}
          onTaskUpdated={() => {
            window.dispatchEvent(new CustomEvent('task-updated'));
          }}
        />
      )}
    </AuthContext.Provider>
  );
}
