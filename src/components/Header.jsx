import { useState, useEffect, useRef } from 'react';
import { LogOut, User, Shield, Users, Key, Bell, X } from 'lucide-react';
import { api } from '../lib/api';

const roleIcons = { admin: Shield, manager: Users, employee: User };

export default function Header({ user, onLogout, onChangePassword, onViewTask }) {
  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'Employee';
  const RoleIcon = roleIcons[user.role] || User;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user.role !== 'admin') return;

    const loadNotifications = () => {
      api.getNotifications()
        .then(setNotifications)
        .catch(() => {});
    };

    loadNotifications();

    const token = localStorage.getItem('km_token');
    const eventSource = new EventSource(`/api/notifications/sse?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const newNotification = JSON.parse(event.data);
        setNotifications(prev => [newNotification, ...prev]);
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user.role]);

  const notificationsRef = useRef(null);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = async (n) => {
    setShowNotifications(false);
    if (!n.is_read) {
      try {
        await api.markNotificationRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: 1 } : item));
      } catch {}
    }
    if (n.task_id && onViewTask) {
      onViewTask({ id: n.task_id });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(item => ({ ...item, is_read: 1 })));
    } catch {}
  };

  const handleDeleteNotification = async (id) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await api.clearNotifications();
      setNotifications([]);
    } catch {}
  };

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-600">DI</span>
          </div>
          <h1 className="text-sm font-semibold text-gray-900 tracking-tight">
            DoneIt
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-gray-400 hidden sm:block">
            Task Portal
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div
            onClick={() => {
              if (user.role === 'manager') {
                window.dispatchEvent(new CustomEvent('toggle-my-tasks'));
              }
            }}
            className={`flex items-center gap-2 text-sm ${user.role === 'manager' ? 'cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors select-none' : ''}`}
            title={user.role === 'manager' ? "View My Tasks & Creations" : ""}
          >
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <RoleIcon className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <span className="text-gray-700 hidden sm:block">{user.name}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              {roleLabel}
            </span>
          </div>

          {user.role === 'admin' && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[1000] max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                      <span className="text-xs font-semibold text-gray-700">Notifications</span>
                      <div className="flex items-center gap-1.5">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] text-amber-600 hover:underline font-medium animate-fade-in"
                          >
                            Mark all read
                          </button>
                        )}
                        {unreadCount > 0 && notifications.length > 0 && (
                          <span className="text-gray-300 text-[10px] select-none">|</span>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={handleClearAll}
                            className="text-[10px] text-gray-500 hover:text-red-500 font-medium"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
                      {notifications.length === 0 ? (
                        <div className="text-xs text-gray-400 py-6 text-center">No notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`px-4 py-2.5 text-left cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-2 relative group/item ${
                              !n.is_read ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />}
                            <div className="flex-1 min-w-0 pr-6">
                              <p className="text-xs text-gray-700 leading-normal">{n.message}</p>
                              <span className="text-[9px] text-gray-400 mt-1 block">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(n.id);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-red-500 hover:bg-gray-100 rounded opacity-0 group-hover/item:opacity-100 transition-opacity"
                              title="Delete notification"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
              )}
            </div>
          )}

          <button
            onClick={onChangePassword}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Change Password"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
