import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import AddUserModal from './AddUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import BulkImportModal from './BulkImportModal';
import {
  LayoutDashboard, Briefcase, Users, Plus, Search, Grid3X3, List,
  UserPlus, Trash2, Filter, ListTodo, CheckCircle,
  MessageSquare, X, FileSpreadsheet, Shield, Edit2, FolderGit2, Repeat, ShieldCheck
} from 'lucide-react';
import ProjectsList from './ProjectsList';
import ProjectDetail from './ProjectDetail';
import RepeatedTasksList from './RepeatedTasksList';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'repeated_tasks', label: 'Repeated Tasks', icon: Repeat },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'admin', label: 'Admin', icon: Shield },
];
const getPrioritySelectClass = (val) => {
  const base = "text-[10px] sm:text-xs border rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold transition-all ";
  switch(val) {
    case 'low': return base + 'text-slate-700 border-slate-300 bg-slate-100';
    case 'medium': return base + 'text-blue-700 border-blue-300 bg-blue-50';
    case 'high': return base + 'text-orange-700 border-orange-300 bg-orange-50';
    case 'urgent': return base + 'text-red-700 border-red-300 bg-red-50';
    default: return base + 'text-gray-500 border-gray-200 bg-white';
  }
};

const getStatusSelectClass = (val) => {
  const base = "text-[10px] sm:text-xs border rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold transition-all ";
  switch(val) {
    case 'todo': return base + 'text-gray-600 border-gray-300 bg-gray-50';
    case 'in_progress': return base + 'text-blue-600 border-blue-300 bg-blue-50';
    case 'under_review': return base + 'text-purple-600 border-purple-300 bg-purple-50';
    case 'completed': return base + 'text-emerald-600 border-emerald-300 bg-emerald-50';
    default: return base + 'text-gray-500 border-gray-200 bg-white hover:text-gray-700';
  }
};

const getCategorySelectClass = (val) => {
  const base = "text-[10px] sm:text-xs border rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold transition-all ";
  if (val) {
    return base + 'text-indigo-700 border-indigo-300 bg-indigo-50';
  }
  return base + 'text-gray-500 border-gray-200 bg-white hover:text-gray-700';
};

const getDateSelectClass = (val) => {
  const base = "text-[10px] sm:text-xs border rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold transition-all ";
  if (val) {
    return base + 'text-amber-700 border-amber-300 bg-amber-50';
  }
  return base + 'text-gray-500 border-gray-200 bg-white hover:text-gray-700';
};

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [compact, setCompact] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const handleTabChange = (tabId) => {
    window.location.hash = tabId;
    setActiveTab(tabId);
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDateRangeFilter('');
    setCustomFromDate('');
    setCustomToDate('');
    if (tabId !== 'projects') {
      setSelectedProject(null);
    }
  };

  const fetchTasksOnly = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (search) params.search = search;
    if (employeeFilter) params.assignee_id = employeeFilter;
    if (dateRangeFilter) {
      params.date_range = dateRangeFilter;
      if (dateRangeFilter === 'custom') {
        if (customFromDate) params.from = customFromDate;
        if (customToDate) params.to = customToDate;
      }
    }
    api.getTasks(params)
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchAll = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (search) params.search = search;
    if (employeeFilter) params.assignee_id = employeeFilter;
    if (dateRangeFilter) {
      params.date_range = dateRangeFilter;
      if (dateRangeFilter === 'custom') {
        if (customFromDate) params.from = customFromDate;
        if (customToDate) params.to = customToDate;
      }
    }

    Promise.allSettled([
      api.getDashboardStats(),
      api.getTasks(params),
      api.getEmployees(true),
    ]).then(([sRes, tRes, eRes]) => {
      if (sRes.status === 'fulfilled') setStats(sRes.value);
      if (tRes.status === 'fulfilled') setTasks(tRes.value);
      if (eRes.status === 'fulfilled') {
        const e = eRes.value;
        setEmployees(e);
        if (employeeFilter) {
          setSelectedEmp(e.find(emp => emp.id === Number(employeeFilter)) || null);
        } else {
          setSelectedEmp(null);
        }
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash) {
        setActiveTab('overview');
        setEmployeeFilter(null);
        setSelectedEmp(null);
        return;
      }
      const parts = hash.substring(1).split('/');
      const tabId = parts[0];
      if (['overview', 'projects', 'work', 'repeated_tasks', 'completed', 'verified', 'team', 'admin'].includes(tabId)) {
        setActiveTab(tabId);
        if (tabId !== 'projects') {
          setSelectedProject(null);
        }
      }
      if (parts[1] === 'employee' && parts[2]) {
        const empId = Number(parts[2]);
        setEmployeeFilter(empId);
        if (employees && employees.length > 0) {
          const emp = employees.find(e => e.id === empId);
          if (emp) setSelectedEmp(emp);
        }
      } else {
        setEmployeeFilter(null);
        setSelectedEmp(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [employees]);

  useEffect(() => {
    fetchAll();
    window.addEventListener('task-updated', fetchAll);
    return () => window.removeEventListener('task-updated', fetchAll);
  }, []);

  useEffect(() => {
    fetchTasksOnly();
  }, [statusFilter, categoryFilter, search, employeeFilter, priorityFilter, dateRangeFilter, customFromDate, customToDate]);

  const handleDeleteTask = async () => {
    if (deleteTask) {
      try { await api.deleteTask(deleteTask.id); fetchAll(); } catch {}
      setDeleteTask(null);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteUser) {
      try { await api.deleteUser(deleteUser.id); fetchAll(); } catch {}
      setDeleteUser(null);
    }
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setShowTaskModal(true);
  };

  const handleViewEmployeeTasks = (emp) => {
    window.location.hash = `work/employee/${emp.id}`;
  };

  const handleViewEmployeeTasksByStatus = (emp, status) => {
    const targetTab = status === 'completed' ? 'completed' : 'work';
    window.location.hash = `${targetTab}/employee/${emp.id}`;
    if (status !== 'completed') {
      setStatusFilter(status);
    }
  };

  const clearEmployeeFilter = () => {
    window.location.hash = 'team';
    setStatusFilter('');
    setPriorityFilter('');
  };

  const displayedTasks = tasks.filter(t => {
    if (selectedEmp) {
      if (activeTab === 'verified') {
        const isVerified = t.status === 'completed' && (Number(t.completed_by) === Number(selectedEmp.id) || Number(t.verifier_id) === Number(selectedEmp.id));
        if (statusFilter) return isVerified && t.status === statusFilter;
        return isVerified;
      }
      if (activeTab === 'completed') {
        const isCompleted = Number(t.assignee_id) === Number(selectedEmp.id) && t.status === 'completed';
        if (statusFilter) return isCompleted && t.status === statusFilter;
        return isCompleted;
      }
      // activeTab === 'work' or default:
      const isActive = Number(t.assignee_id) === Number(selectedEmp.id) && t.status !== 'completed';
      if (statusFilter) return isActive && t.status === statusFilter;
      return isActive;
    }
    if (statusFilter) return true;
    if (activeTab === 'completed') {
      return t.status === 'completed';
    } else {
      return t.status !== 'completed';
    }
  }).sort((a, b) => {
    if (activeTab === 'work') {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    }
    return 0;
  });

  const metricCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ListTodo, color: 'text-gray-500' },
    { label: 'Team Members', value: Number(stats.totalEmployees) + Number(stats.totalManagers), icon: Users, color: 'text-blue-500' },
  ] : [];

  return (
    <div className="space-y-6">
      {selectedEmp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">{selectedEmp.name}'s Profile / Work</h2>
              <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 uppercase font-semibold">{selectedEmp.role} &middot; {selectedEmp.department} &middot; {selectedEmp.email}</p>
            </div>
            <button onClick={clearEmployeeFilter} className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-sm">
              Back to Team
            </button>
          </div>

          <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit">
            <button
              onClick={() => { window.location.hash = `work/employee/${selectedEmp.id}`; }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'work' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Tasks
            </button>
            <button
              onClick={() => { window.location.hash = `completed/employee/${selectedEmp.id}`; }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed Tasks
            </button>
            <button
              onClick={() => { window.location.hash = `verified/employee/${selectedEmp.id}`; }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'verified' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Verified Tasks
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Executive Dashboard</h2>
              <p className="text-sm text-gray-500">Full company overview</p>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-full overflow-x-auto scrollbar-none shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {tab.label}
                  {tab.id === 'to_verify' && pendingVerifyCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px] animate-pulse">
                      {pendingVerifyCount}
                    </span>
                  )}
                  {tab.id === 'to_verify' && pendingVerifyCount === 0 && allVerifierTasks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-gray-300 text-gray-700 font-semibold text-[10px]">
                      {allVerifierTasks.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {metricCards.map((m) => (
                <div key={m.label} className="card flex items-center gap-3">
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <div>
                    <p className="text-xs text-gray-500">{m.label}</p>
                    <p className="text-xl font-semibold text-gray-900">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {stats?.statusBreakdown && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Status Breakdown</h3>
              <div className="flex gap-2 flex-wrap">
                {stats.statusBreakdown.map((s) => {
                  const total = stats.statusBreakdown.reduce((a, b) => a + b.cnt, 0);
                  const pct = total > 0 ? (s.cnt / total) * 100 : 0;
                  return (
                    <div key={s.status} className="flex-1 min-w-[80px]">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${s.status === 'completed' ? 'bg-emerald-500' : s.status === 'in_progress' ? 'bg-blue-500' : s.status === 'under_review' ? 'bg-purple-500' : 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 text-center">{s.status.replace('_', ' ')} ({s.cnt})</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-6">
          {selectedProject ? (
            <ProjectDetail
              project={selectedProject}
              user={user}
              onBack={() => setSelectedProject(null)}
            />
          ) : (
            <ProjectsList
              user={user}
              onProjectSelect={(p) => setSelectedProject(p)}
            />
          )}
        </div>
      )}

      {(activeTab === 'work' || activeTab === 'completed' || activeTab === 'verified') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input-field pl-9" placeholder="Search tasks..." />
              </div>
              
              {activeTab === 'work' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={getStatusSelectClass(statusFilter)}
                  >
                    <option value="" className="text-gray-500 font-normal">All Statuses</option>
                    <option value="todo" className="text-gray-600 font-semibold bg-gray-50">To Do</option>
                    <option value="in_progress" className="text-blue-600 font-semibold bg-blue-50">In Progress</option>
                    <option value="under_review" className="text-purple-600 font-semibold bg-purple-50">Under Review</option>
                    <option value="completed" className="text-emerald-600 font-semibold bg-emerald-50">Completed</option>
                  </select>
                </div>
              )}

              {activeTab === 'work' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-gray-400">Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className={getPrioritySelectClass(priorityFilter)}
                  >
                    <option value="" className="text-gray-500 font-normal">All Priorities</option>
                    <option value="low" className="text-slate-700 font-semibold bg-slate-100">Low</option>
                    <option value="medium" className="text-blue-700 font-semibold bg-blue-50">Medium</option>
                    <option value="high" className="text-orange-700 font-semibold bg-orange-50">High</option>
                    <option value="urgent" className="text-red-700 font-semibold bg-red-50">Urgent</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-semibold text-gray-400">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={getCategorySelectClass(categoryFilter)}
                >
                  <option value="">All Categories</option>
                  <option value="General">General</option>
                  <option value="Software">Software</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Production">Production</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-semibold text-gray-400">Date:</span>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => {
                    setDateRangeFilter(e.target.value);
                    if (e.target.value !== 'custom') {
                      setCustomFromDate('');
                      setCustomToDate('');
                    }
                  }}
                  className={getDateSelectClass(dateRangeFilter)}
                >
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range...</option>
                </select>

                {dateRangeFilter === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="text-[10px] sm:text-xs border border-gray-200 rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-gray-700 bg-white"
                    />
                    <span className="text-[9px] uppercase font-semibold text-gray-400">to</span>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="text-[10px] sm:text-xs border border-gray-200 rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-gray-700 bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {employeeFilter && !selectedEmp && (
                <span className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                  {selectedEmp?.name}
                  <button onClick={clearEmployeeFilter} className="hover:bg-amber-100 rounded p-0.5"><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={() => setCompact(false)} className={`p-2 rounded-lg border transition-colors ${!compact ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'}`}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setCompact(true)} className={`p-2 rounded-lg border transition-colors ${compact ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'}`}>
                <List className="w-4 h-4" />
              </button>
              {activeTab === 'work' && (
                <div className="flex gap-2">
                  <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold shadow-sm transition-all" title="Import Tasks from Excel">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Import Excel
                  </button>
                  <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="bg-amber-500 hover:bg-amber-400 text-white p-2 rounded-lg border border-amber-400/40 shadow-lg shadow-amber-200/40 transition-all" title="Create Task">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="card text-center py-12">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{employeeFilter ? 'No tasks for this team member' : 'No tasks found'}</p>
            </div>
          ) : compact ? (
            <div className="space-y-1.5">
              {displayedTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact onEdit={fetchAll} onDelete={setDeleteTask} onSelect={handleEditTask} onViewDetail={setDetailTask} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayedTasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={fetchAll} onDelete={setDeleteTask} onSelect={handleEditTask} onViewDetail={setDetailTask} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'repeated_tasks' && (
        <RepeatedTasksList user={user} />
      )}

      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowUserModal(true)} className="btn-amber text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => e.role !== 'admin').map((emp) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 group hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                onClick={() => handleViewEmployeeTasks(emp)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                      <p className="text-[10px] text-amber-700 font-semibold uppercase">{emp.role ? emp.role.replace('_', ' ') : ''}</p>
                      {emp.role === 'intern' && (
                        <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                          Mentor: {emp.mentor_name || <span className="text-gray-400 italic">Not Assigned</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  {emp.role !== 'admin' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingUser(emp);
                          setShowUserModal(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                        title="Edit profile"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteUser(emp); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500">{emp.avg_progress}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{emp.task_count} task{emp.task_count !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewEmployeeTasksByStatus(emp, 'in_progress');
                    }}
                    className="flex-1 text-center py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-lg transition-colors border border-amber-200/50"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewEmployeeTasksByStatus(emp, 'completed');
                    }}
                    className="flex-1 text-center py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-lg transition-colors border border-emerald-200/50"
                  >
                    Completed
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowUserModal(true)} className="btn-amber text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Admin
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => e.role === 'admin').map((emp) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 group hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
                onClick={() => handleViewEmployeeTasks(emp)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{emp.role} &middot; {emp.department}</p>
                    </div>
                  </div>
                  {emp.id !== user.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteUser(emp); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500">{emp.avg_progress}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{emp.task_count} task{emp.task_count !== 1 ? 's' : ''}</p>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewEmployeeTasksByStatus(emp, 'in_progress');
                    }}
                    className="flex-1 text-center py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-lg transition-colors border border-amber-200/50"
                  >
                    In Progress
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewEmployeeTasksByStatus(emp, 'completed');
                    }}
                    className="flex-1 text-center py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-lg transition-colors border border-emerald-200/50"
                  >
                    Completed
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchAll} task={editTask} employees={employees} />
      <BulkImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} employees={employees} onImportSuccess={fetchAll} />
      <AddUserModal 
        isOpen={showUserModal} 
        onClose={() => { setShowUserModal(false); setEditingUser(null); }} 
        onCreated={fetchAll} 
        onUpdated={fetchAll}
        editingUser={editingUser}
        employees={employees}
      />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchAll} />
      <ConfirmDeleteModal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDeleteTask}
        title="Delete Task" message={`Delete "${deleteTask?.title}"? This cannot be undone.`} />
      <ConfirmDeleteModal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} onConfirm={handleDeleteUser}
        title="Delete User" message={`Remove ${deleteUser?.name} and all their data? This cannot be undone.`} />
    </div>
  );
}
