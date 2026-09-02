import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import TaskVerificationModal from './TaskVerificationModal';
import {
  BarChart3, Users, CheckCircle, Plus, Search, Filter,
  ListTodo, User, LayoutGrid, X, FolderGit2, Repeat, ShieldCheck
} from 'lucide-react';
import ProjectsList from './ProjectsList';
import ProjectDetail from './ProjectDetail';
import RepeatedTasksList from './RepeatedTasksList';

const tabs = [
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'work', label: 'Work', icon: ListTodo },
  { id: 'to_verify', label: 'To Verify', icon: ShieldCheck },
  { id: 'repeated_tasks', label: 'Repeated Tasks', icon: Repeat },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'team', label: 'Team', icon: Users },
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
    default: return base + 'text-gray-500 border-gray-200 bg-white';
  }
};

export default function ManagerDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('work');
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [verificationTask, setVerificationTask] = useState(null);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [repeatedTasksCount, setRepeatedTasksCount] = useState(0);

  const fetchTasksOnly = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (search) params.search = search;
    if (employeeFilter) params.assignee_id = employeeFilter;
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
    Promise.allSettled([
      api.getDashboardStats(),
      api.getTasks(params),
      api.getEmployees(),
      api.getRepeatedTasks().catch(() => [])
    ]).then(([sRes, tRes, eRes, rtRes]) => {
      if (sRes.status === 'fulfilled') setStats(sRes.value);
      if (tRes.status === 'fulfilled') setTasks(tRes.value);
      if (eRes.status === 'fulfilled') {
        const e = eRes.value || [];
        setEmployees(e);
        if (employeeFilter) {
          setSelectedEmp(e.find(emp => emp.id === Number(employeeFilter)) || null);
        } else {
          setSelectedEmp(null);
        }
      }
      if (rtRes.status === 'fulfilled') {
        const rt = rtRes.value;
        const myRt = Array.isArray(rt) ? rt.filter(item => {
          if (user?.role === 'admin') return true;
          if (Number(item.creator_id) === Number(user?.id)) return true;
          if (Array.isArray(item.members)) {
            return item.members.some(m => Number(m.user_id || m.id) === Number(user?.id));
          }
          return false;
        }) : [];
        setRepeatedTasksCount(myRt.length);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash || hash === '#' || hash === '#work') {
        setActiveTab('work');
        setEmployeeFilter(null);
        setSelectedEmp(null);
        return;
      }
      const parts = hash.substring(1).split('/');
      const tabId = parts[0];

      if (['projects', 'work', 'to_verify', 'repeated_tasks', 'completed', 'verified', 'team'].includes(tabId)) {
        setActiveTab(tabId);
        if (tabId !== 'projects') setSelectedProject(null);
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
    const timer = setTimeout(() => {
      setSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    fetchAll();
    window.addEventListener('task-updated', fetchAll);
    return () => window.removeEventListener('task-updated', fetchAll);
  }, []);

  useEffect(() => {
    fetchTasksOnly();
  }, [statusFilter, categoryFilter, search, employeeFilter, priorityFilter]);

  useEffect(() => {
    const handleToggle = () => setMyTasksOnly(prev => !prev);
    window.addEventListener('toggle-my-tasks', handleToggle);
    return () => window.removeEventListener('toggle-my-tasks', handleToggle);
  }, []);

  const clearEmployeeFilter = () => {
    window.location.hash = 'team';
    setEmployeeFilter(null);
    setSelectedEmp(null);
    setStatusFilter('');
    setPriorityFilter('');
  };

  const handleViewEmployeeTasks = (emp) => {
    window.location.hash = `work/employee/${emp.id}`;
  };

  const handleViewEmployeeTasksByStatus = (emp, status) => {
    window.location.hash = `work/employee/${emp.id}`;
    if (status !== 'completed') {
      setStatusFilter(status);
    }
  };

  const handleDeleteTask = async () => {
    if (deleteTask) {
      try { await api.deleteTask(deleteTask.id); fetchAll(); } catch {}
      setDeleteTask(null);
    }
  };

  const allVerifierTasks = tasks.filter(t => 
    (Number(t.verifier_id) === Number(user.id) || Number(t.completed_by) === Number(user.id)) && 
    Number(t.assignee_id) !== Number(user.id)
  );
  const pendingVerifyCount = allVerifierTasks.filter(t => t.status === 'under_review').length;
  const inProgressVerifyCount = allVerifierTasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
  const verifiedByMeCount = allVerifierTasks.filter(t => t.status === 'completed' && (Number(t.completed_by) === Number(user.id) || Number(t.verifier_id) === Number(user.id))).length;

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
    if (activeTab === 'to_verify') {
      const isVerifierTask = (Number(t.verifier_id) === Number(user.id) || Number(t.completed_by) === Number(user.id)) && Number(t.assignee_id) !== Number(user.id);
      if (!isVerifierTask) return false;
      if (statusFilter) return t.status === statusFilter;
      return true;
    }
    if (myTasksOnly && t.creator_id !== user.id && t.assignee_id !== user.id) {
      return false;
    }
    if (statusFilter) return true;
    if (activeTab === 'completed') {
      return t.status === 'completed';
    } else {
      return t.status !== 'completed';
    }
  }).sort((a, b) => {
    if (activeTab === 'to_verify') {
      if (a.status === 'under_review' && b.status !== 'under_review') return -1;
      if (a.status !== 'under_review' && b.status === 'under_review') return 1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
    } else if (activeTab === 'work') {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    }
    return 0;
  });

  const metricCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ListTodo, color: 'text-gray-500' },
    { label: 'Team Members', value: stats.totalEmployees, icon: Users, color: 'text-blue-500' },
    { label: 'Avg Completion', value: `${stats.avgCompletion}%`, icon: CheckCircle, color: 'text-emerald-500' },
  ] : [];

  const statusOptions = ['', 'todo', 'in_progress', 'under_review'];
  const priorityOptions = ['', 'low', 'medium', 'high', 'urgent'];

  return (
    <div className="space-y-6">
      {selectedEmp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">{selectedEmp.name}'s Profile / Work</h2>
              <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 uppercase font-semibold">{selectedEmp.role ? selectedEmp.role.replace('_', ' ') : ''} &middot; {selectedEmp.department} &middot; {selectedEmp.email}</p>
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
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manager Dashboard</h2>
            <p className="text-sm text-gray-500">Team overview & task management</p>
          </div>

          <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-full overflow-x-auto scrollbar-none shrink-0">
            {tabs
              .filter(tab => {
                if (tab.id === 'to_verify' && allVerifierTasks.length === 0) return false;
                if (tab.id === 'repeated_tasks' && !(user?.role === 'admin' || repeatedTasksCount > 0)) return false;
                return true;
              })
              .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { 
                    window.location.hash = tab.id;
                    setActiveTab(tab.id); 
                    setStatusFilter(''); 
                    setPriorityFilter('');
                    if (tab.id !== 'projects') setSelectedProject(null);
                  }}
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
        </div>
      )}

      {activeTab === 'projects' && !selectedEmp && (
        <div className="space-y-6 mt-4">
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

      {activeTab === 'repeated_tasks' && !selectedEmp && (
        <div className="mt-4">
          <RepeatedTasksList user={user} projects={[]} />
        </div>
      )}

      {activeTab === 'team' && !selectedEmp && (
        <div className="space-y-4">
          {/* Mentored Interns Widget for Assigned Supervisors/Managers */}
          {employees.filter(e => Number(e.mentor_id) === Number(user.id)).length > 0 && (
            <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    Assigned Interns Under You ({employees.filter(e => Number(e.mentor_id) === Number(user.id)).length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Track your mentored interns' tasks, progress, daily logs, and work updates.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employees.filter(e => Number(e.mentor_id) === Number(user.id)).map(intern => (
                  <div
                    key={intern.id}
                    onClick={() => handleViewEmployeeTasks(intern)}
                    className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                        {intern.name ? intern.name.charAt(0) : 'I'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-xs truncate group-hover:text-amber-600 transition-colors">{intern.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{intern.task_count} tasks &middot; {intern.avg_progress}% avg</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-amber-600 flex-shrink-0 pl-2">
                      View Work →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => e.role !== 'admin').map((emp) => {
              const isSelf = emp.id === user.id;
              return (
                <div key={emp.id} className={`bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer ${isSelf ? 'ring-1 ring-amber-500/30' : ''}`}
                  onClick={() => handleViewEmployeeTasks(emp)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-500">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{emp.name} {isSelf && <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded ml-1 font-semibold">You</span>}</p>
                        <p className="text-[10px] text-amber-700 font-semibold uppercase">{emp.role ? emp.role.replace('_', ' ') : ''}</p>
                        {emp.role === 'intern' && (
                          <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
                            Mentor: {emp.mentor_name || <span className="text-gray-400 italic">Not Assigned</span>}
                          </p>
                        )}
                      </div>
                    </div>
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
                      Active Tasks
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
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === 'work' || activeTab === 'to_verify' || activeTab === 'completed' || selectedEmp) && activeTab !== 'projects' && activeTab !== 'repeated_tasks' && (
        <>
          {activeTab === 'to_verify' && !selectedEmp && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl">
                <p className="text-xs text-amber-800 font-medium">Pending My Review</p>
                <p className="text-xl font-bold text-amber-950 mt-0.5">{pendingVerifyCount}</p>
                <p className="text-[10px] text-amber-700 mt-0.5">Tasks submitted & waiting for your sign-off</p>
              </div>
              <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl">
                <p className="text-xs text-blue-800 font-medium">In Progress</p>
                <p className="text-xl font-bold text-blue-950 mt-0.5">{inProgressVerifyCount}</p>
                <p className="text-[10px] text-blue-700 mt-0.5">Assigned to you to verify once completed</p>
              </div>
              <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl">
                <p className="text-xs text-emerald-800 font-medium">Verified by Me</p>
                <p className="text-xl font-bold text-emerald-950 mt-0.5">{verifiedByMeCount}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5">Total tasks successfully verified & approved</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
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

            {activeTab === 'to_verify' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => setStatusFilter('')}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${
                    statusFilter === ''
                      ? 'bg-gray-800 text-white border-gray-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All ({allVerifierTasks.length})
                </button>
                <button
                  onClick={() => setStatusFilter('under_review')}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${
                    statusFilter === 'under_review'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  ⏳ Under Review ({pendingVerifyCount})
                </button>
                <button
                  onClick={() => setStatusFilter('in_progress')}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${
                    statusFilter === 'in_progress'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  ⚙️ In Progress ({inProgressVerifyCount})
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded-lg border font-semibold transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  ✅ Verified by Me ({verifiedByMeCount})
                </button>
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
                className="text-[10px] sm:text-xs bg-white border border-gray-200 rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
              >
                <option value="">All Categories</option>
                <option value="General">General</option>
                <option value="Software">Software</option>
                <option value="Electronics">Electronics</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Production">Production</option>
              </select>
            </div>
            {employeeFilter && (
              <span className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 animate-fade-in">
                {selectedEmp?.name}
                <button onClick={clearEmployeeFilter} className="hover:bg-amber-100 rounded p-0.5"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {myTasksOnly && (
              <span className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 animate-fade-in">
                My Tasks & Creations
                <button onClick={() => setMyTasksOnly(false)} className="hover:bg-amber-100 rounded p-0.5"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {activeTab === 'work' && (
              <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="btn-amber text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Task
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="card text-center py-12">
              <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No tasks found</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayedTasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={fetchAll} onDelete={setDeleteTask} onSelect={(t) => { setEditTask(t); setShowTaskModal(true); }} onViewDetail={setDetailTask} onVerificationNeeded={setVerificationTask} />
              ))}
            </div>
          )}
        </>
      )}

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} onSaved={fetchAll} task={editTask} employees={employees} onVerificationNeeded={setVerificationTask} />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchAll} />
      <TaskVerificationModal isOpen={!!verificationTask} onClose={() => setVerificationTask(null)} task={verificationTask} />
      <ConfirmDeleteModal isOpen={!!deleteTask} onClose={() => setDeleteTask(null)} onConfirm={handleDeleteTask}
        title="Delete Task" message={`Delete "${deleteTask?.title}"?`} />
    </div>
  );
}
