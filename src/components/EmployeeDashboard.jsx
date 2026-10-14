import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import TaskVerificationModal from './TaskVerificationModal';
import { Search, ListTodo, Plus, CheckCircle, Users, X, FolderGit2, ShieldCheck, TrendingUp, Clock, MessageSquare } from 'lucide-react';
import ProjectsList from './ProjectsList';
import ProjectDetail from './ProjectDetail';
import TaskKanbanBoard from './TaskKanbanBoard';
import SalesDashboard from './SalesDashboard';

const tabs = [
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'work', label: 'Work', icon: ListTodo },
  { id: 'to_verify', label: 'To Verify', icon: Clock },
  { id: 'sales', label: 'Sales', icon: TrendingUp },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
  { id: 'feedback', label: 'Admin Feedback', icon: MessageSquare },
  { id: 'team', label: 'Team', icon: Users },
];

const getTrainingLevelStyle = (level) => {
  switch (level) {
    case 'Expert':
      return { text: 'Expert 👑', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
    case 'Advanced':
      return { text: 'Advanced 🥇', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
    case 'Intermediate':
      return { text: 'Intermediate 🥈', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'Beginner':
    default:
      return { text: 'Beginner 🥉', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
};

export default function EmployeeDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('work');
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('general');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [verificationTask, setVerificationTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(null);
  const [salesPersonFilter, setSalesPersonFilter] = useState('');
  const [salesLeadFilter, setSalesLeadFilter] = useState(null);
  const userHasSales = user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'sales_executive' || !!user?.can_access_sales;

  // Admin Feedback state
  const [feedbackNotes, setFeedbackNotes] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState('all');

  const fetchFeedback = async () => {
    if (!user?.id) return;
    setLoadingFeedback(true);
    try {
      const data = await api.getEmployeeAdminNotes(user.id);
      setFeedbackNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching admin feedback:', err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feedback') {
      fetchFeedback();
    }
  }, [activeTab, user?.id]);

  const fetchTasksOnly = (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const params = {};
    if (employeeFilter) params.assignee_id = employeeFilter;
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (search) params.search = search;
    api.getTasks(params)
      .then(setTasks)
      .catch(() => {})
      .finally(() => {
        if (!isSilent) setLoading(false);
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    api.getEmployees(true)
      .then(setEmployees)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setStatusFilter('');
      setPillarFilter('general');
      if (!hash) {
        setActiveTab('work');
        setEmployeeFilter(null);
        setSelectedEmp(null);
        return;
      }
      const parts = hash.substring(1).split('/');
      const tabId = parts[0];

      // Interns cannot access team tab
      if (tabId === 'team' && user?.role === 'intern') {
        window.location.hash = 'work';
        setActiveTab('work');
        return;
      }

      if (['projects', 'all', 'work', 'sales', 'to_verify', 'completed', 'assigned_by_me', 'verified', 'team', 'feedback'].includes(tabId)) {
        setActiveTab(tabId);
        if (tabId !== 'projects') setSelectedProject(null);
        if (tabId !== 'sales') setSalesPersonFilter('');
      } else {
        // Unrecognized tab — default to 'work' to prevent blank screen
        setActiveTab('work');
      }
      if (parts[1] === 'employee' && parts[2]) {
        // Interns cannot view other employees
        if (user?.role === 'intern') {
          setEmployeeFilter(null);
          setSelectedEmp(null);
          return;
        }
        const empId = Number(parts[2]);
        if (employees && employees.length > 0) {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            const isSalesOnly = emp.role === 'sales_manager' || emp.role === 'sales_executive';
            const userHasSales = user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'sales_executive' || !!user?.can_access_sales;
            if (emp.id !== user?.id && isSalesOnly && !userHasSales) {
              alert("You don't have access to view Sales team member profiles.");
              window.location.hash = 'team';
              setEmployeeFilter(null);
              setSelectedEmp(null);
              return;
            }
            setSelectedEmp(emp);
          }
        }
        setEmployeeFilter(empId);
      } else {
        setEmployeeFilter(null);
        setSelectedEmp(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [employees, user]);

  useEffect(() => {
    fetchTasksOnly();
    window.addEventListener('task-updated', fetchTasksOnly);
    return () => window.removeEventListener('task-updated', fetchTasksOnly);
  }, [statusFilter, categoryFilter, search, employeeFilter]);

  const statusOptions = ['', 'todo', 'in_progress', 'under_review', 'completed'];

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      try { await api.deleteTask(deleteTarget.id); fetchTasksOnly(); } catch {}
      setDeleteTarget(null);
    }
  };

  const clearEmployeeFilter = () => {
    window.location.hash = 'team';
    setStatusFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
  };

  const checkSalesProfileAccess = (emp) => {
    if (!emp) return true;
    if (emp.id === user?.id) return true;
    const isSalesOnly = emp.role === 'sales_manager' || emp.role === 'sales_executive';
    const userHasSales = user?.role === 'admin' || user?.role === 'sales_manager' || user?.role === 'sales_executive' || !!user?.can_access_sales;
    if (isSalesOnly && !userHasSales) {
      alert("You don't have access to view Sales team member profiles.");
      return false;
    }
    return true;
  };

  const handleViewEmployeeTasks = (emp) => {
    if (!checkSalesProfileAccess(emp)) return;
    setStatusFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
    window.location.hash = `all/employee/${emp.id}`;
  };

  const handleViewEmployeeTasksByStatus = (emp, status) => {
    if (!checkSalesProfileAccess(emp)) return;
    setStatusFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
    const targetTab = status === 'completed' ? 'completed' : 'work';
    window.location.hash = `${targetTab}/employee/${emp.id}`;
    if (status !== 'completed') {
      setStatusFilter(status);
    }
  };

  const isReadOnly = employeeFilter !== null && Number(employeeFilter) !== user.id;

  const isAssignedToEmp = (t, empId) => {
    if (!empId) return false;
    const id = Number(empId);
    if (Number(t.assignee_id) === id) return true;
    if (Number(t.hiring_lead_id) === id) return true;
    if (t.group_assignee_ids && Array.isArray(t.group_assignee_ids) && t.group_assignee_ids.map(Number).includes(id)) return true;
    if (!t.assignee_id && Number(t.creator_id) === id) return true;
    return false;
  };

  const allVerifierTasks = tasks.filter(t => 
    (Number(t.verifier_id) === Number(user.id) || 
     Number(t.completed_by) === Number(user.id) || 
     (t.assignee_mentor_id && Number(t.assignee_mentor_id) === Number(user.id)) ||
     (t.assignee_role === 'intern' && (Number(t.creator_id) === Number(user.id) || Number(t.verifier_id) === Number(user.id)))) && 
    Number(t.assignee_id) !== Number(user.id) &&
    (!t.parent_id || t.id === t.parent_id)
  );
  const pendingVerifyCount = allVerifierTasks.filter(t => t.status === 'under_review').length;
  const inProgressVerifyCount = allVerifierTasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
  const verifiedByMeCount = allVerifierTasks.filter(t => t.status === 'completed' && (Number(t.completed_by) === Number(user.id) || Number(t.verifier_id) === Number(user.id))).length;

  const workBaseTasks = tasks.filter(t => {
    // Main workspace views strictly exclude project tasks
    if (t.project_id && activeTab !== 'to_verify') return false;

    if (activeTab === 'to_verify') {
      // To Verify shows BOTH project tasks and normal tasks where user is verifier or mentor
      const isVerifierTask = (
        Number(t.verifier_id) === Number(user.id) || 
        Number(t.completed_by) === Number(user.id) ||
        (t.assignee_mentor_id && Number(t.assignee_mentor_id) === Number(user.id)) ||
        (t.assignee_role === 'intern' && (Number(t.creator_id) === Number(user.id) || Number(t.verifier_id) === Number(user.id)))
      ) && Number(t.assignee_id) !== Number(user.id);
      if (!isVerifierTask) return false;
      if (t.parent_id && t.id !== t.parent_id) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    }

    if (selectedEmp) {
      const isMine = isAssignedToEmp(t, selectedEmp.id);

      if (activeTab === 'verified') {
        const isVerified = t.status === 'completed' && (Number(t.completed_by) === Number(selectedEmp.id) || Number(t.verifier_id) === Number(selectedEmp.id)) && !isMine;
        if (statusFilter && statusFilter !== 'completed') return false;
        return isVerified;
      }
      if (activeTab === 'assigned_by_me') {
        const isCreatedForOthers = Number(t.creator_id) === Number(selectedEmp.id) && !isMine;
        if (t.parent_id && t.id !== t.parent_id) return false;
        if (statusFilter && t.status !== statusFilter) return false;
        return isCreatedForOthers;
      }
      if (activeTab === 'completed') {
        const isCompleted = isMine && t.status === 'completed';
        if (statusFilter && statusFilter !== 'completed') return false;
        return isCompleted;
      }
      if (activeTab === 'work') {
        const isActive = isMine && t.status !== 'completed';
        if (statusFilter && t.status !== statusFilter) return false;
        return isActive;
      }
      // activeTab === 'all' or default (All tasks assigned to this user):
      if (statusFilter && t.status !== statusFilter) return false;
      return isMine;
    }

    // Main workspace views strictly exclude project tasks
    if (t.project_id) return false;

    const isMine = isAssignedToEmp(t, user?.id);

    if (activeTab === 'completed') {
      if (!isMine) return false;
      if (t.status !== 'completed') return false;
      if (statusFilter && statusFilter !== 'completed') return false;
      return true;
    } else if (activeTab === 'work') {
      if (!isMine) return false;
      if (t.status === 'completed') return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    } else {
      // activeTab === 'all' or others
      if (!isMine) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    }
  });

  const generalPillarCount = workBaseTasks.filter(t => !t.pillar || t.pillar === 'general').length;
  const vishwasPillarCount = workBaseTasks.filter(t => t.pillar === 'vishwas').length;
  const avishkarPillarCount = workBaseTasks.filter(t => t.pillar === 'avishkar').length;
  const nirantarPillarCount = workBaseTasks.filter(t => t.pillar === 'nirantar').length;
  const sakshamPillarCount = workBaseTasks.filter(t => t.pillar === 'saksham').length;
  const upakaramPillarCount = workBaseTasks.filter(t => t.pillar === 'upakaram').length;

  const displayedTasks = workBaseTasks.filter(t => {
    if (pillarFilter === 'all' || !pillarFilter) return true;
    if (pillarFilter === 'general' && t.pillar && t.pillar !== 'general') return false;
    if (pillarFilter === 'vishwas' && t.pillar !== 'vishwas') return false;
    if (pillarFilter === 'avishkar' && t.pillar !== 'avishkar') return false;
    if (pillarFilter === 'nirantar' && t.pillar !== 'nirantar') return false;
    if (pillarFilter === 'saksham' && t.pillar !== 'saksham') return false;
    if (pillarFilter === 'upakaram' && t.pillar !== 'upakaram') return false;
    return true;
  }).sort((a, b) => {
    if (activeTab === 'to_verify') {
      if (a.status === 'under_review' && b.status !== 'under_review') return -1;
      if (a.status !== 'under_review' && b.status === 'under_review') return 1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
    } else if (activeTab === 'work' || activeTab === 'all') {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    }
    return 0;
  });

  const empAllTasksCount = selectedEmp ? tasks.filter(t => !t.project_id && isAssignedToEmp(t, selectedEmp.id)).length : 0;
  const empActiveTasksCount = selectedEmp ? tasks.filter(t => !t.project_id && isAssignedToEmp(t, selectedEmp.id) && t.status !== 'completed').length : 0;
  const empCompletedTasksCount = selectedEmp ? tasks.filter(t => !t.project_id && isAssignedToEmp(t, selectedEmp.id) && t.status === 'completed').length : 0;
  const empCreatedForOthersCount = selectedEmp ? tasks.filter(t => !t.project_id && Number(t.creator_id) === Number(selectedEmp.id) && !isAssignedToEmp(t, selectedEmp.id) && (!t.parent_id || t.id === t.parent_id)).length : 0;
  const empVerifiedTasksCount = selectedEmp ? tasks.filter(t => !t.project_id && t.status === 'completed' && (Number(t.completed_by) === Number(selectedEmp.id) || Number(t.verifier_id) === Number(selectedEmp.id)) && !isAssignedToEmp(t, selectedEmp.id)).length : 0;

  const [quota, setQuota] = useState(null);

  const fetchQuota = () => {
    api.getTaskQuota().then(setQuota).catch(() => {});
  };

  useEffect(() => {
    fetchQuota();
  }, [tasks]);

  return (
    <div className="space-y-6">
      {selectedEmp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                {selectedEmp.name}'s Profile / Work
                {Number(selectedEmp.id) !== Number(user.id) && (
                  <span className="text-red-500 font-semibold text-xs ml-1.5 bg-red-50 px-1.5 py-0.5 rounded border border-red-200/50">Read Only</span>
                )}
              </h2>
              <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 uppercase font-semibold">{selectedEmp.role} &middot; {selectedEmp.department} &middot; {selectedEmp.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {(user?.role === 'admin' || user?.role === 'manager' || Number(selectedEmp.mentor_id) === Number(user.id) || selectedEmp.role === 'intern') && (
                <button
                  onClick={() => { setEditTask(null); setDefaultAssigneeId(selectedEmp.id); setShowTaskModal(true); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Assign Task to {selectedEmp.name.split(' ')[0]}
                </button>
              )}
              {(selectedEmp.role === 'sales_manager' || selectedEmp.role === 'sales_executive' || selectedEmp.can_access_sales) && userHasSales && (
                <button
                  onClick={() => {
                    setSalesPersonFilter(String(selectedEmp.id));
                    setActiveTab('sales');
                    window.location.hash = 'sales';
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  💼 View {selectedEmp.name ? selectedEmp.name.split(' ')[0] : 'Employee'}'s Sales Pipeline
                </button>
              )}
              <button onClick={clearEmployeeFilter} className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-sm">
                Back to Team
              </button>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-fit flex-wrap">
            <button
              onClick={() => { window.location.hash = `work/employee/${selectedEmp.id}`; }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'work' || activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Tasks
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'work' || activeTab === 'all' ? 'bg-amber-100 text-amber-800' : 'bg-gray-300 text-gray-700'}`}>
                {empActiveTasksCount}
              </span>
            </button>
            <button
              onClick={() => { window.location.hash = `completed/employee/${selectedEmp.id}`; }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed Tasks
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-300 text-gray-700'}`}>
                {empCompletedTasksCount}
              </span>
            </button>
            <button
              onClick={() => { window.location.hash = `assigned_by_me/employee/${selectedEmp.id}`; }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'assigned_by_me' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Created for Others
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'assigned_by_me' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-300 text-gray-700'}`}>
                {empCreatedForOthersCount}
              </span>
            </button>
            <button
              onClick={() => { window.location.hash = `verified/employee/${selectedEmp.id}`; }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'verified' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Verified Tasks
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'verified' ? 'bg-purple-100 text-purple-800' : 'bg-gray-300 text-gray-700'}`}>
                {empVerifiedTasksCount}
              </span>
            </button>
            {(selectedEmp.role === 'sales_manager' || selectedEmp.role === 'sales_executive' || selectedEmp.can_access_sales) && userHasSales && (
              <button
                onClick={() => {
                  setSalesPersonFilter(String(selectedEmp.id));
                  setActiveTab('sales');
                  window.location.hash = 'sales';
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/60 cursor-pointer"
              >
                💼 Sales Pipeline
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Workspace</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500">Welcome back, {user.name.split(' ')[0]}</p>
              {user?.role !== 'intern' && quota && quota.isRestricted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70" title="Weekly limit: 2 tasks, Monthly limit: 10 tasks. Managers/Admins can assign unlimited tasks to you.">
                  Creation quota: {quota.weekCount}/{quota.weekLimit} this week &middot; {quota.monthCount}/{quota.monthLimit} this month
                </span>
              )}
            </div>
          </div>
          {activeTab === 'work' && !isReadOnly && user?.role !== 'intern' && (
            <button
              onClick={() => { setEditTask(null); setShowTaskModal(true); }}
              disabled={quota?.isRestricted && !quota?.canCreate}
              className={`text-sm flex items-center gap-2 ${
                quota?.isRestricted && !quota?.canCreate
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed px-3 py-1.5 rounded-lg border border-gray-300'
                  : 'btn-amber'
              }`}
              title={quota?.isRestricted && !quota?.canCreate ? 'Weekly/Monthly task creation limit reached (max 2/week, 10/month). Please ask your Manager or Admin to assign tasks.' : ''}
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      )}

      {/* Tabs list (hidden in employee profile drilldown) */}
      {!selectedEmp && (
        <div className="flex gap-1 bg-gray-200 p-1 rounded-xl w-full overflow-x-auto scrollbar-none shrink-0">
          {tabs
            .filter(tab => {
              if (tab.id === 'sales' && !userHasSales) return false;
              if (tab.id === 'team' && user?.role === 'intern') return false;
              if (tab.id === 'to_verify' && allVerifierTasks.length === 0 && activeTab !== 'to_verify') return false;
              return true;
            })
            .map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { window.location.hash = tab.id; setStatusFilter(''); }}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {tab.label}
                {tab.id === 'to_verify' && allVerifierTasks.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] ${
                    pendingVerifyCount > 0 ? 'bg-amber-500 text-white animate-pulse' : 'bg-gray-300 text-gray-700'
                  }`}>
                    {allVerifierTasks.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'projects' && (
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

      {activeTab === 'team' && !selectedEmp && (
        <div className="space-y-4">
          {/* Mentored Interns Widget for Assigned Supervisors/Employees */}
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
                        <p className="text-[10px] text-gray-500 truncate font-medium">{intern.completed_task_count || 0}/{intern.task_count || 0} completed &middot; {intern.avg_progress}%</p>
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
            {employees.filter(e => !['admin', 'manager'].includes(e.role)).map((emp) => {
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
                      </div>
                    </div>
                  </div>
                  {emp.role === 'sales_manager' || emp.role === 'sales_executive' || emp.can_access_sales ? (
                    <div className="mt-3 flex items-center justify-between text-xs text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                      <span>💼 Sales Representative</span>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${emp.avg_progress}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700">{emp.avg_progress}%</span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-1.5">{emp.completed_task_count || 0} of {emp.task_count || 0} tasks completed</p>
                    </>
                  )}
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

      {activeTab === 'sales' && userHasSales && (
        <SalesDashboard
          user={user}
          initialAssigneeId={salesPersonFilter}
          initialLeadId={salesLeadFilter}
          onClearLeadId={() => setSalesLeadFilter(null)}
        />
      )}

      {(activeTab === 'work' || activeTab === 'to_verify' || activeTab === 'completed' || activeTab === 'all' || activeTab === 'assigned_by_me' || activeTab === 'verified' || selectedEmp) && activeTab !== 'projects' && activeTab !== 'repeated_tasks' && activeTab !== 'sales' && activeTab !== 'feedback' && (
        <>
          {/* Work Pillars: General Tasks, Vishwas, Avishkar, Nirantar, Saksham */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 rounded-xl border border-gray-200/80 w-fit flex-wrap mb-3 shadow-xs">
            <button
              onClick={() => setPillarFilter('general')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                pillarFilter === 'general'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
              }`}
            >
              <span className="flex items-center gap-1.5">📋 General Tasks</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                pillarFilter === 'general'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {generalPillarCount}
              </span>
            </button>
            <button
              onClick={() => setPillarFilter('vishwas')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                pillarFilter === 'vishwas'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
              }`}
            >
              <span className="flex items-center gap-1.5">🛡️ Vishwas (Quality & Improvement)</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                pillarFilter === 'vishwas'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {vishwasPillarCount}
              </span>
            </button>
            <button
              onClick={() => setPillarFilter('avishkar')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                pillarFilter === 'avishkar'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
              }`}
            >
              <span className="flex items-center gap-1.5">💡 Avishkar (Innovation & Optimization)</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                pillarFilter === 'avishkar'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {avishkarPillarCount}
              </span>
            </button>
            {(user?.role === 'admin' || user?.can_access_nirantar || selectedEmp?.can_access_nirantar || nirantarPillarCount > 0) && (
              <button
                onClick={() => setPillarFilter('nirantar')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  pillarFilter === 'nirantar'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
                }`}
              >
                <span className="flex items-center gap-1.5">🔁 Nirantar (Hiring & Vacancies)</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  pillarFilter === 'nirantar'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {nirantarPillarCount}
                </span>
              </button>
            )}
            {(user?.role === 'admin' || user?.can_access_saksham || selectedEmp?.can_access_saksham || sakshamPillarCount > 0) && (
              <button
                onClick={() => setPillarFilter('saksham')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  pillarFilter === 'saksham'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
                }`}
              >
                <span className="flex items-center gap-1.5">⚡ Saksham (Skill Enablement)</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  pillarFilter === 'saksham'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {sakshamPillarCount}
                </span>
              </button>
            )}
            {(user?.role === 'admin' || user?.can_access_upakaram || selectedEmp?.can_access_upakaram || upakaramPillarCount > 0) && (
              <button
                onClick={() => setPillarFilter('upakaram')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  pillarFilter === 'upakaram'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/80 shadow-xs'
                }`}
              >
                <span className="flex items-center gap-1.5">🚀 Upakaram (Internal Track)</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  pillarFilter === 'upakaram'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {upakaramPillarCount}
                </span>
              </button>
            )}
          </div>

          {pillarFilter === 'nirantar' && (
            <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-900 w-fit mb-3">
              <span>🔁 Total Open Vacancies:</span>
              <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {displayedTasks.reduce((acc, t) => acc + (Number(t.vacancies_count) || 0), 0)}
              </span>
            </div>
          )}

          {pillarFilter === 'saksham' && (
            <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-900 w-fit mb-3">
              <span>⚡ Saksham Training Modules:</span>
              <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {displayedTasks.length} Modules / Lessons
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input-field pl-9"
                placeholder="Search tasks..."
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            </div>
          ) : (
            <TaskKanbanBoard
              tasks={displayedTasks}
              activePillar={pillarFilter}
              onRefresh={() => fetchTasksOnly(true)}
              onViewDetail={setDetailTask}
              onEditTask={(t) => {
                if (user?.role === 'intern') {
                  setDetailTask(t);
                } else {
                  setEditTask(t);
                  setShowTaskModal(true);
                }
              }}
              onDeleteTask={setDeleteTarget}
            />
          )}
        </>
      )}

      {/* ── ADMIN FEEDBACK VIEW (ONE-WAY PRIVATE GUIDANCE) ── */}
      {activeTab === 'feedback' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                Feedback & Notes from Leadership
              </h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                This is a private space where company leadership (Admins, CEO, Directors) share performance feedback, appreciation, and constructive guidance directly with you.
              </p>
            </div>
          </div>

          {/* Filters & Count */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>My Leadership Notes</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                {feedbackNotes.length}
              </span>
            </h4>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setFeedbackCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  feedbackCategoryFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({feedbackNotes.length})
              </button>
              <button
                onClick={() => setFeedbackCategoryFilter('appreciation')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  feedbackCategoryFilter === 'appreciation' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Appreciation ({feedbackNotes.filter(n => n.category === 'appreciation').length})
              </button>
              <button
                onClick={() => setFeedbackCategoryFilter('improvement')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  feedbackCategoryFilter === 'improvement' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Improvement ({feedbackNotes.filter(n => n.category === 'improvement').length})
              </button>
              <button
                onClick={() => setFeedbackCategoryFilter('general')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  feedbackCategoryFilter === 'general' ? 'bg-white text-blue-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                General ({feedbackNotes.filter(n => n.category === 'general').length})
              </button>
            </div>
          </div>

          {loadingFeedback ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500">Loading your feedback notes...</p>
            </div>
          ) : feedbackNotes.filter(n => feedbackCategoryFilter === 'all' || n.category === feedbackCategoryFilter).length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 space-y-2.5">
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-1">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">No feedback notes yet</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Any performance feedback, praise, or guidance shared by company leadership will be listed here.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {feedbackNotes
                .filter(n => feedbackCategoryFilter === 'all' || n.category === feedbackCategoryFilter)
                .map((note) => {
                  const categoryBadge = {
                    appreciation: {
                      label: '🌟 Appreciation',
                      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    },
                    improvement: {
                      label: '⚠️ Areas of Focus / Improvement',
                      cls: 'bg-rose-50 text-rose-800 border-rose-200'
                    },
                    general: {
                      label: '📌 General Guidance',
                      cls: 'bg-blue-50 text-blue-800 border-blue-200'
                    }
                  }[note.category] || { label: '📌 Note', cls: 'bg-gray-100 text-gray-700 border-gray-200' };

                  return (
                    <div
                      key={note.id}
                      className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center font-bold text-xs">
                            {(note.admin_name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-gray-900">
                                {note.admin_name || 'Admin'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryBadge.cls}`}>
                                {categoryBadge.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(note.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {note.updated_at && note.updated_at !== note.created_at && (
                                <span className="italic ml-1">(edited)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-1">
                        {note.note_text}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      <TaskModal
        isOpen={showTaskModal}
        onClose={() => { setShowTaskModal(false); setEditTask(null); setDefaultAssigneeId(null); }}
        onSaved={fetchTasksOnly}
        task={editTask}
        employees={employees}
        defaultAssigneeId={defaultAssigneeId}
        onVerificationNeeded={setVerificationTask}
        initialPillar={pillarFilter}
      />
      <TaskDetailModal isOpen={!!detailTask} onClose={() => setDetailTask(null)} task={detailTask} onTaskUpdated={fetchTasksOnly} readOnly={isReadOnly} />
      <TaskVerificationModal isOpen={!!verificationTask} onClose={() => setVerificationTask(null)} task={verificationTask} />
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
