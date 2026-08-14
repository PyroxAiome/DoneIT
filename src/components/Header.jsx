import { useState, useEffect, useRef } from 'react';
import { LogOut, User, Shield, Users, Key, Bell, X, Video, GitMerge } from 'lucide-react';
import { api } from '../lib/api';
import StandupModal from './StandupModal';

const roleIcons = { admin: Shield, manager: Users, site_manager: Users, employee: User };

export default function Header({ user, onLogout, onChangePassword, onViewTask }) {
  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : user.role === 'site_manager' ? 'Site Manager' : 'Employee';
  const RoleIcon = roleIcons[user.role] || User;

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [showStandup, setShowStandup] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [pendingDeps, setPendingDeps] = useState([]);
  const [depTab, setDepTab] = useState('my');

  const getFilteredNotifications = () => {
    if (user.role !== 'admin' || dateFilter === 'all') return notifications;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;

    return notifications.filter(n => {
      if (!n.created_at) return true;
      // Convert SQLite datetime string or standard ISO string to timestamp
      // e.g. "2026-08-01 12:00:00" -> replace space with 'T' for iOS/Safari compatibility and append 'Z' to treat as UTC
      const nTime = new Date(n.created_at).getTime();
      if (dateFilter === 'today') {
        return nTime >= todayStart;
      } else if (dateFilter === 'yesterday') {
        return nTime >= yesterdayStart && nTime < todayStart;
      } else if (dateFilter === 'week') {
        return nTime >= sevenDaysAgo;
      } else if (dateFilter === 'custom') {
        if (!customDate) return true;
        const nDateStr = new Date(nTime).toISOString().slice(0, 10);
        return nDateStr === customDate;
      }
      return true;
    });
  };

  const displayedNotifications = getFilteredNotifications();

  const depsRef = useRef(null);

  const loadPendingDeps = () => {
    api.getPendingDependencies()
      .then(setPendingDeps)
      .catch(() => {});
  };

  useEffect(() => {
    loadPendingDeps();
    window.addEventListener('dependency-updated', loadPendingDeps);
    return () => window.removeEventListener('dependency-updated', loadPendingDeps);
  }, [user.id]);

  useEffect(() => {
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
        loadPendingDeps();
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [user.id]);

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

  useEffect(() => {
    if (!showDeps) return;
    const handleClickOutside = (event) => {
      if (depsRef.current && !depsRef.current.contains(event.target)) {
        setShowDeps(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDeps]);

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

  const handleConfirmDependency = async (taskId, depId) => {
    try {
      await api.confirmDependency(taskId, depId);
      loadPendingDeps();
      window.dispatchEvent(new CustomEvent('dependency-updated'));
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await api.clearNotifications();
      setNotifications([]);
    } catch {}
  };

  const myPendingDeps = pendingDeps.filter(d => Number(d.tagee_id) === Number(user.id));
  const otherPendingDeps = ['admin', 'manager'].includes(user.role) 
    ? pendingDeps.filter(d => Number(d.tagee_id) !== Number(user.id)) 
    : [];

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 h-12 sm:h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-[10px] sm:text-xs font-bold text-amber-600">DI</span>
          </div>
          <h1 className="text-xs sm:text-sm font-semibold text-gray-900 tracking-tight">
            DoneIt
          </h1>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-400 hidden md:block">
            Task Portal
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div
            onClick={() => {
              if (user.role === 'manager') {
                window.dispatchEvent(new CustomEvent('toggle-my-tasks'));
              }
            }}
            className={`flex items-center gap-1.5 text-xs sm:text-sm ${user.role === 'manager' ? 'cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors select-none' : ''}`}
            title={user.role === 'manager' ? "View My Tasks & Creations" : ""}
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <RoleIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500" />
            </div>
            <span className="text-gray-700 hidden sm:block text-xs sm:text-sm">{user.name}</span>
            <span className="text-[8px] sm:text-[10px] uppercase px-1 sm:px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              {roleLabel}
            </span>
          </div>

          {user && (
            <div className="relative" ref={depsRef}>
              <button
                onClick={() => { setShowDeps(!showDeps); setShowNotifications(false); }}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors relative flex items-center justify-center ${
                  pendingDeps.length > 0 
                    ? 'bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700' 
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title="Dependency Blocker Notifications"
              >
                <GitMerge className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {pendingDeps.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-purple-600 rounded-full text-[8px] font-bold text-white flex items-center justify-center animate-pulse">
                    {pendingDeps.length}
                  </span>
                )}
              </button>

              {showDeps && (
                <div className="fixed right-4 left-4 top-14 sm:absolute sm:right-0 sm:left-auto sm:top-10 sm:w-80 w-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[1000] max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0 bg-purple-50/50">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                      Dependencies Blockers
                    </span>
                    <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.2 rounded-full">
                      {pendingDeps.length} pending
                    </span>
                  </div>

                  {/* Tabs layout for Admin and Manager */}
                  {['admin', 'manager'].includes(user.role) && (
                    <div className="flex border-b border-gray-100 bg-gray-50 shrink-0">
                      <button
                        onClick={() => setDepTab('my')}
                        className={`flex-1 text-center py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                          depTab === 'my' 
                            ? 'border-purple-600 text-purple-600 bg-white' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        My Dependency ({myPendingDeps.length})
                      </button>
                      <button
                        onClick={() => setDepTab('others')}
                        className={`flex-1 text-center py-2 text-[11px] font-semibold transition-colors border-b-2 ${
                          depTab === 'others' 
                            ? 'border-purple-600 text-purple-600 bg-white' 
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Other Dependency ({otherPendingDeps.length})
                      </button>
                    </div>
                  )}

                  <div className="overflow-y-auto divide-y divide-gray-100 max-h-[350px]">
                    {/* Render Tab My Dependency (or for employee who doesn't have tabs) */}
                    {(!['admin', 'manager'].includes(user.role) || depTab === 'my') && (
                      <div>
                        {myPendingDeps.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-gray-400">
                            No pending blockers tagging you.
                          </div>
                        ) : (
                          myPendingDeps.map((dep) => (
                            <div key={dep.id} className="p-3 hover:bg-gray-50 transition-colors flex flex-col gap-2">
                              <div>
                                <p className="text-xs text-gray-700">
                                  <span className="font-bold text-gray-950">{dep.requester_name}</span> requested your help on task: 
                                  <span className="font-semibold text-purple-700 ml-1">"{dep.task_title}"</span>
                                </p>
                                <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded p-1.5 mt-1 whitespace-pre-wrap italic">
                                  "{dep.dependency_text}"
                                </p>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => {
                                    setShowDeps(false);
                                    if (onViewTask) {
                                      onViewTask({ id: dep.task_id, defaultTab: 'dependencies' });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200/50 transition-all"
                                >
                                  Resolve Blocker
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Render Tab Other Dependency */}
                    {['admin', 'manager'].includes(user.role) && depTab === 'others' && (
                      <div>
                        {otherPendingDeps.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-gray-400">
                            No other active dependency blockers.
                          </div>
                        ) : (
                          otherPendingDeps.map((dep) => (
                            <div key={dep.id} className="p-3 hover:bg-gray-50 transition-colors flex flex-col gap-2">
                              <div>
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <p className="text-xs text-gray-700">
                                    <span className="font-bold text-gray-950">{dep.requester_name}</span> &rarr; <span className="font-semibold text-purple-700">{dep.tagee_name}</span>
                                  </p>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                    dep.status === 'resolved' 
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {dep.status}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-gray-900 mt-1">
                                  Task: <span className="text-purple-700">"{dep.task_title}"</span>
                                </p>
                                <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded p-1.5 mt-1 whitespace-pre-wrap italic">
                                  "{dep.dependency_text}"
                                </p>
                                {dep.reply_text && (
                                  <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100/50 rounded p-1.5 mt-1 whitespace-pre-wrap italic">
                                    <span className="font-bold">Reply:</span> "{dep.reply_text}"
                                  </p>
                                )}
                              </div>
                              <div className="flex justify-end gap-1.5">
                                {dep.status === 'resolved' && (
                                  <button
                                    onClick={() => handleConfirmDependency(dep.task_id, dep.id)}
                                    className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-md transition-all shadow-sm"
                                  >
                                    Confirm
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setShowDeps(false);
                                    if (onViewTask) {
                                      onViewTask({ id: dep.task_id, defaultTab: 'dependencies' });
                                    }
                                  }}
                                  className="text-[10px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md border border-gray-200 transition-all"
                                >
                                  View Blocker
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {user && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors relative"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full text-[7px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed right-4 left-4 top-14 sm:absolute sm:right-0 sm:left-auto sm:top-10 sm:w-80 w-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-[1000] max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                      <span className="text-xs font-semibold text-gray-700">Notifications</span>
                      <div className="flex items-center gap-1.5">
                        {unreadCount > 0 && (
                          <button onClick={handleClearAll} className="text-[10px] text-amber-600 hover:text-amber-500 font-semibold transition-colors">Clear all</button>
                        )}
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-50 border-b border-gray-100 shrink-0 flex-wrap">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Filter:</span>
                        {['all', 'today', 'yesterday', 'week', 'custom'].map(f => (
                          <button
                            key={f}
                            onClick={() => setDateFilter(f)}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize border transition-all ${
                              dateFilter === f
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                        {dateFilter === 'custom' && (
                          <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="text-[9px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        )}
                      </div>
                    )}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                      {displayedNotifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400">No notifications</div>
                      ) : (
                        displayedNotifications.map((n) => (
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
            onClick={() => setShowStandup(true)}
            className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-[10px] sm:text-xs font-semibold shadow-sm transition-all"
            title="Daily Standup Meeting"
          >
            <Video className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            <span className="hidden sm:inline">StandUp</span>
          </button>

          <button
            onClick={onChangePassword}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Change Password"
          >
            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
      <StandupModal isOpen={showStandup} onClose={() => setShowStandup(false)} />
    </header>
  );
}
