import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import AddUserModal from './AddUserModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskDetailModal from './TaskDetailModal';
import {
  LayoutDashboard, Briefcase, Users, Plus, Search, Grid3X3, List,
  UserPlus, Trash2, Filter, ListTodo, CheckCircle,
  MessageSquare, X, Shield, Edit2, FolderGit2, ShieldCheck, TrendingUp,
  User, AlertTriangle, ExternalLink, ShieldAlert, Building2, ArrowLeft
} from 'lucide-react';
import ProjectsList from './ProjectsList';
import ProjectDetail from './ProjectDetail';
import SalesDashboard from './SalesDashboard';
import SalesLeadDetailModal from './SalesLeadDetailModal';
import TaskKanbanBoard from './TaskKanbanBoard';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'sales', label: 'Sales', icon: TrendingUp },
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
  const [pillarFilter, setPillarFilter] = useState('general');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [compact, setCompact] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [salesPersonFilter, setSalesPersonFilter] = useState('');
  const [targetLeadId, setTargetLeadId] = useState(null);
  const [salesLeads, setSalesLeads] = useState([]);
  const [selectedLeadIdForModal, setSelectedLeadIdForModal] = useState(null);

  // Admin Feedback & Comments state
  const [empFeedbackList, setEmpFeedbackList] = useState([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [editFeedbackText, setEditFeedbackText] = useState('');
  const [editFeedbackCategory, setEditFeedbackCategory] = useState('general');
  const [savingEditFeedback, setSavingEditFeedback] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  const fetchEmployeeFeedback = async (empId) => {
    if (!empId) return;
    setLoadingFeedback(true);
    setFeedbackError('');
    try {
      const data = await api.getEmployeeAdminNotes(empId);
      setEmpFeedbackList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching employee feedback:', err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleCreateFeedback = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!feedbackText.trim() || !selectedEmp) return;
    setSubmittingFeedback(true);
    setFeedbackError('');
    setFeedbackSuccess('');
    try {
      const newNote = await api.createEmployeeAdminNote(selectedEmp.id, {
        note_text: feedbackText.trim(),
        category: feedbackCategory
      });
      setEmpFeedbackList(prev => [newNote, ...prev]);
      setFeedbackText('');
      setFeedbackCategory('general');
      setFeedbackSuccess(`Feedback sent successfully to ${selectedEmp.name || 'employee'}.`);
      setTimeout(() => setFeedbackSuccess(''), 4000);
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleUpdateFeedback = async (noteId) => {
    if (!editFeedbackText.trim() || !selectedEmp) return;
    setSavingEditFeedback(true);
    setFeedbackError('');
    try {
      const updatedNote = await api.updateEmployeeAdminNote(selectedEmp.id, noteId, {
        note_text: editFeedbackText.trim(),
        category: editFeedbackCategory
      });
      setEmpFeedbackList(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      setEditingFeedbackId(null);
      setEditFeedbackText('');
    } catch (err) {
      setFeedbackError(err.message || 'Failed to update feedback');
    } finally {
      setSavingEditFeedback(false);
    }
  };

  const handleDeleteFeedback = async (noteId) => {
    if (!selectedEmp) return;
    if (!window.confirm('Are you sure you want to delete this feedback note? This action cannot be undone.')) {
      return;
    }
    setFeedbackError('');
    try {
      await api.deleteEmployeeAdminNote(selectedEmp.id, noteId);
      setEmpFeedbackList(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      setFeedbackError(err.message || 'Failed to delete feedback note');
    }
  };

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
    setPillarFilter('general');
    setDateRangeFilter('');
    setCustomFromDate('');
    setCustomToDate('');
    if (tabId !== 'projects') {
      setSelectedProject(null);
    }
    if (tabId !== 'sales') {
      setSalesPersonFilter('');
    }
  };

  const fetchTasksOnly = (isSilent = false) => {
    if (!isSilent) setLoading(true);
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
      .finally(() => {
        if (!isSilent) setLoading(false);
      });
  };

  const fetchAll = (isSilent = false) => {
    if (!isSilent) setLoading(true);
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
      api.getSalesLeads({ category: 'general' }),
    ]).then(([sRes, tRes, eRes, slRes]) => {
      if (sRes.status === 'fulfilled') setStats(sRes.value);
      if (tRes.status === 'fulfilled') setTasks(tRes.value);
      if (slRes.status === 'fulfilled') setSalesLeads(slRes.value || []);
      if (eRes.status === 'fulfilled') {
        const e = eRes.value;
        setEmployees(e);
        if (employeeFilter) {
          setSelectedEmp(e.find(emp => emp.id === Number(employeeFilter)) || null);
        } else {
          setSelectedEmp(null);
        }
      }
    }).finally(() => {
      if (!isSilent) setLoading(false);
    });
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setStatusFilter('');
      setPillarFilter('general');
      if (!hash) {
        setActiveTab('overview');
        setEmployeeFilter(null);
        setSelectedEmp(null);
        return;
      }
      const parts = hash.substring(1).split('/');
      const tabId = parts[0];
      if (['overview', 'projects', 'all', 'work', 'sales', 'to_verify', 'completed', 'assigned_by_me', 'verified', 'team', 'admin', 'missed-pipelines', 'feedback'].includes(tabId)) {
        setActiveTab(tabId);
        if (tabId !== 'projects') {
          setSelectedProject(null);
        }
        if (tabId !== 'sales') {
          setSalesPersonFilter('');
        }
      }
      if (parts[1] === 'employee' && parts[2]) {
        const empId = Number(parts[2]);
        setEmployeeFilter(empId);
        if (employees && employees.length > 0) {
          const emp = employees.find(e => e.id === empId);
          if (emp) {
            setSelectedEmp(emp);
            fetchEmployeeFeedback(emp.id);
          }
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
    window.addEventListener('sales-updated', fetchAll);
    const handleOpenLead = (e) => {
      if (e.detail && e.detail.leadId) {
        setTargetLeadId(e.detail.leadId);
        setActiveTab('sales');
        window.location.hash = '#sales';
      }
    };
    window.addEventListener('open-sales-lead', handleOpenLead);
    return () => {
      window.removeEventListener('task-updated', fetchAll);
      window.removeEventListener('sales-updated', fetchAll);
      window.removeEventListener('open-sales-lead', handleOpenLead);
    };
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
    setStatusFilter('');
    setEmployeeFilter(emp.id);
    setSelectedEmp(emp);
    window.location.hash = `work/employee/${emp.id}`;
  };

  const handleViewEmployeeTasksByStatus = (emp, status) => {
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
    setEmployeeFilter(emp.id);
    setSelectedEmp(emp);
    const targetTab = status === 'completed' ? 'completed' : 'work';
    window.location.hash = `${targetTab}/employee/${emp.id}`;
    if (status !== 'completed') {
      setStatusFilter(status);
    }
  };

  const handleViewEmployeeTasksByDate = (emp, dateRange) => {
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
    setDateRangeFilter(dateRange);
    setCustomFromDate('');
    setCustomToDate('');
    setEmployeeFilter(emp.id);
    setSelectedEmp(emp);
    const targetTab = (activeTab === 'team' || activeTab === 'admin') ? activeTab : 'work';
    window.location.hash = `${targetTab}/employee/${emp.id}`;
  };

  const clearEmployeeFilter = () => {
    const defaultTab = activeTab === 'admin' ? 'admin' : 'team';
    window.location.hash = defaultTab;
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setPillarFilter('general');
    setDateRangeFilter('');
    setCustomFromDate('');
    setCustomToDate('');
  };

  const isAssignedToEmp = (t, empId) => {
    if (!empId) return false;
    const id = Number(empId);
    if (Number(t.assignee_id) === id) return true;
    if (Number(t.hiring_lead_id) === id) return true;
    if (t.group_assignee_ids && Array.isArray(t.group_assignee_ids) && t.group_assignee_ids.map(Number).includes(id)) return true;
    if (!t.assignee_id && Number(t.creator_id) === id) return true;
    return false;
  };

  const workBaseTasks = tasks.filter(t => {
    // Main workspace views strictly exclude project tasks (managed in Projects tab)
    if (t.project_id) return false;

    if (selectedEmp) {
      const isMine = isAssignedToEmp(t, selectedEmp.id);

      // If a date activity range filter is active (today, yesterday, week, etc.), show ALL tasks (active & completed) for this employee
      if (dateRangeFilter) {
        if (statusFilter && t.status !== statusFilter) return false;
        return isMine;
      }

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
      // activeTab === 'all' or 'admin' or 'team' or default
      if (statusFilter && t.status !== statusFilter) return false;
      return isMine;
    }

    // Main workspace views strictly exclude project tasks (managed in Projects tab)
    if (t.project_id) return false;

    if (activeTab === 'to_verify') {
      const isVerifierTask = user?.role === 'admin' || 
        Number(t.verifier_id) === Number(user?.id) || 
        Number(t.completed_by) === Number(user?.id) ||
        (t.assignee_mentor_id && Number(t.assignee_mentor_id) === Number(user?.id)) ||
        t.status === 'under_review';
      if (!isVerifierTask) return false;
      if (t.parent_id && t.id !== t.parent_id) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    } else if (activeTab === 'admin') {
      const adminUserIds = employees.filter(e => e.role === 'admin').map(e => Number(e.id));
      const isAdminTask = adminUserIds.includes(Number(t.assignee_id)) || adminUserIds.includes(Number(t.hiring_lead_id));
      if (!isAdminTask) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    } else if (activeTab === 'completed') {
      if (t.status !== 'completed') return false;
      if (statusFilter && statusFilter !== 'completed') return false;
      return true;
    } else if (activeTab === 'work') {
      if (t.status === 'completed') return false;
      if (statusFilter && t.status !== statusFilter) return false;
      return true;
    } else {
      // activeTab === 'all' or others
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
    if (dateRangeFilter || pillarFilter === 'all' || !pillarFilter) return true;
    if (pillarFilter === 'general' && t.pillar && t.pillar !== 'general') return false;
    if (pillarFilter === 'vishwas' && t.pillar !== 'vishwas') return false;
    if (pillarFilter === 'avishkar' && t.pillar !== 'avishkar') return false;
    if (pillarFilter === 'nirantar' && t.pillar !== 'nirantar') return false;
    if (pillarFilter === 'saksham' && t.pillar !== 'saksham') return false;
    if (pillarFilter === 'upakaram' && t.pillar !== 'upakaram') return false;
    return true;
  }).sort((a, b) => {
    if (activeTab === 'work' || activeTab === 'all') {
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

  const ORDER_STAGE_KEYS = [
    'suspect',
    'prospect',
    'presentation',
    'demo',
    'spec_tender',
    'enquiry',
    'quotation',
    'design_optimisation',
    'negotiation',
    'pending_order_receipts'
  ];

  const STAGE_LABELS = {
    suspect: 'Suspect',
    prospect: 'Prospect',
    presentation: 'Presentation',
    demo: 'Demo',
    spec_tender: 'Spec of Tender',
    enquiry: 'Enquiry',
    quotation: 'Quotation',
    design_optimisation: 'Design Optimisation',
    negotiation: 'Negotiation',
    pending_order_receipts: 'Pending Order Receipts'
  };

  const formatLeadValue = (val) => {
    if (!val || isNaN(val)) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const missedDemoAndSpecLeads = salesLeads.filter(lead => {
    if (lead.category && lead.category !== 'general') return false;
    if ((lead.priority || '').toLowerCase() === 'lost') return false;

    const currentIdx = ORDER_STAGE_KEYS.indexOf(lead.current_stage);
    let skipped = [];
    try {
      skipped = typeof lead.skipped_stages === 'string'
        ? JSON.parse(lead.skipped_stages || '[]')
        : (lead.skipped_stages || []);
    } catch (e) {
      skipped = [];
    }

    const missedDemo = skipped.includes('demo') || (currentIdx > ORDER_STAGE_KEYS.indexOf('demo') && !lead.had_demo_stage);
    const missedSpecTender = skipped.includes('spec_tender') || (currentIdx > ORDER_STAGE_KEYS.indexOf('spec_tender') && !lead.had_spec_tender_stage);

    return missedDemo || missedSpecTender;
  }).map(lead => {
    const currentIdx = ORDER_STAGE_KEYS.indexOf(lead.current_stage);
    let skipped = [];
    try {
      skipped = typeof lead.skipped_stages === 'string'
        ? JSON.parse(lead.skipped_stages || '[]')
        : (lead.skipped_stages || []);
    } catch (e) {
      skipped = [];
    }

    const missedDemo = skipped.includes('demo') || (currentIdx > ORDER_STAGE_KEYS.indexOf('demo') && !lead.had_demo_stage);
    const missedSpecTender = skipped.includes('spec_tender') || (currentIdx > ORDER_STAGE_KEYS.indexOf('spec_tender') && !lead.had_spec_tender_stage);

    return {
      ...lead,
      missedDemo,
      missedSpecTender
    };
  });

  const metricCards = stats ? [
    { label: 'Total Tasks', value: stats.totalTasks, icon: ListTodo, color: 'text-gray-500' },
    { label: 'Team Members', value: stats.totalTeamMembers ?? (Number(stats.totalEmployees) + Number(stats.totalManagers)), icon: Users, color: 'text-blue-500' },
    {
      label: 'Missed Demo and Spec of Tender Pipelines',
      value: missedDemoAndSpecLeads.length,
      icon: AlertTriangle,
      color: missedDemoAndSpecLeads.length > 0 ? 'text-amber-500' : 'text-gray-400',
      onClick: () => {
        window.location.hash = 'missed-pipelines';
      }
    },
  ] : [];

  return (
    <div className="space-y-6">
      {selectedEmp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm flex-wrap gap-2">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">{selectedEmp.name}'s Profile / Work</h2>
              <p className="text-[9px] sm:text-[11px] text-gray-400 mt-0.5 uppercase font-semibold">{selectedEmp.role} &middot; {selectedEmp.department} &middot; {selectedEmp.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditTask(null); setDefaultAssigneeId(selectedEmp.id); setShowTaskModal(true); }}
                className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Task to {selectedEmp.name ? selectedEmp.name.split(' ')[0] : 'Employee'}
              </button>
              {(selectedEmp.role === 'sales_manager' || selectedEmp.role === 'sales_executive' || selectedEmp.can_access_sales) && (
                <button
                  onClick={() => {
                    setSalesPersonFilter(String(selectedEmp.id));
                    setActiveTab('sales');
                    setSelectedEmp(null);
                    window.location.hash = 'sales';
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1.5"
                >
                  💼 View {selectedEmp.name}'s Sales Pipeline
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
            <button
              onClick={() => { window.location.hash = `feedback/employee/${selectedEmp.id}`; }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'feedback' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-amber-500" />
              Admin Feedback
              {empFeedbackList.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'feedback' ? 'bg-amber-100 text-amber-800' : 'bg-gray-300 text-gray-700'}`}>
                  {empFeedbackList.length}
                </span>
              )}
            </button>
            {(selectedEmp.role === 'sales_manager' || selectedEmp.role === 'sales_executive' || selectedEmp.can_access_sales) && (
              <button
                onClick={() => {
                  setSalesPersonFilter(String(selectedEmp.id));
                  setActiveTab('sales');
                  setSelectedEmp(null);
                  window.location.hash = 'sales';
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              >
                💼 Sales Pipeline
              </button>
            )}
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {metricCards.map((m) => (
                <div
                  key={m.label}
                  onClick={m.onClick}
                  className={`bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs flex items-center justify-between gap-4 transition-all ${
                    m.onClick ? 'cursor-pointer hover:shadow-md hover:border-amber-400 hover:-translate-y-0.5 ring-1 ring-transparent hover:ring-amber-200 group' : ''
                  }`}
                  title={m.onClick ? 'Click to view full list' : undefined}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                      m.color === 'text-amber-500' ? 'bg-amber-50 border border-amber-200 text-amber-600' :
                      m.color === 'text-blue-500' ? 'bg-blue-50 border border-blue-200 text-blue-600' :
                      'bg-gray-50 border border-gray-200 text-gray-600'
                    }`}>
                      <m.icon className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-500 truncate" title={m.label}>{m.label}</p>
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{m.value}</p>
                    </div>
                  </div>
                  {m.onClick && (
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 group-hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl shrink-0 transition-colors flex items-center gap-1">
                      View All →
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'missed-pipelines' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top navigation / Back link */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={() => { window.location.hash = 'overview'; }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
              {missedDemoAndSpecLeads.length} Flagged Prospects
            </span>
          </div>

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white p-5 sm:p-6 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Missed Demo and Spec of Tender Pipelines</h2>
                <p className="text-xs text-gray-600 mt-1">
                  General Inquiries sales prospects that bypassed mandatory Demo or Spec of Tender steps on the pipeline board.
                </p>
              </div>
            </div>
          </div>

          {/* Prospects List */}
          {missedDemoAndSpecLeads.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl shadow-xs space-y-2">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto opacity-80" />
              <h3 className="text-sm font-bold text-gray-900">All Pipelines on Track</h3>
              <p className="text-xs text-gray-500">No General Inquiries prospects currently have missed Demo or Spec of Tender steps.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-gray-100">
              {missedDemoAndSpecLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 sm:p-5 hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <h4
                      onClick={() => setSelectedLeadIdForModal(lead.id)}
                      className="font-bold text-gray-900 text-sm sm:text-base hover:text-amber-600 transition-colors cursor-pointer"
                      title="Click to view details"
                    >
                      {lead.title}
                    </h4>

                    {lead.missedDemo && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Missed Demo
                      </span>
                    )}
                    {lead.missedSpecTender && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                        <ShieldAlert className="w-3 h-3 text-purple-600" />
                        Missed Spec of Tender
                      </span>
                    )}

                    <span className="text-xs text-gray-500 flex items-center gap-1.5 sm:ml-2">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      Sales Person: <strong className="font-semibold text-gray-800">{lead.assignee_name || 'Unassigned'}</strong>
                    </span>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => setSelectedLeadIdForModal(lead.id)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-amber-50 hover:text-amber-900 border border-gray-300 hover:border-amber-300 rounded-xl shadow-2xs transition-all cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
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

      {activeTab === 'sales' && (
        <SalesDashboard
          user={user}
          initialAssigneeId={salesPersonFilter}
          initialLeadId={targetLeadId}
          onClearLeadId={() => setTargetLeadId(null)}
        />
      )}

      {(activeTab === 'work' || activeTab === 'all' || activeTab === 'to_verify' || activeTab === 'completed' || activeTab === 'assigned_by_me' || activeTab === 'verified' || selectedEmp) && activeTab !== 'sales' && activeTab !== 'projects' && activeTab !== 'overview' && activeTab !== 'team' && activeTab !== 'admin' && activeTab !== 'missed-pipelines' && activeTab !== 'feedback' && (
        <div className="space-y-4">



          {/* Work Pillars: General Tasks, Vishwas, Avishkar, Nirantar, Saksham */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-100/90 rounded-xl border border-gray-200/80 w-fit flex-wrap shadow-xs">
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
            <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-900 w-fit">
              <span>🔁 Total Open Vacancies:</span>
              <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {displayedTasks.reduce((acc, t) => acc + (Number(t.vacancies_count) || 0), 0)}
              </span>
            </div>
          )}

          {pillarFilter === 'saksham' && (
            <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-900 w-fit">
              <span>⚡ Saksham Training Modules:</span>
              <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {displayedTasks.length} Modules / Lessons
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input-field pl-9" placeholder="Search tasks..." />
              </div>
              
              {(activeTab === 'work' || activeTab === 'all' || selectedEmp) && (
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

              {(activeTab === 'work' || activeTab === 'all' || selectedEmp) && (
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
                  <option value="Commercial">Commercial</option>
                  <option value="Legal">Legal</option>
                  <option value="Sales & Marketing">Sales & Marketing</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap bg-gray-50 border border-gray-200/80 px-2.5 py-1.5 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-gray-500 mr-1">Activity Filter:</span>
                {[
                  { id: '', label: 'All' },
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'week', label: 'Week' },
                  { id: 'custom', label: 'Custom' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setDateRangeFilter(f.id);
                      if (f.id !== 'custom') {
                        setCustomFromDate('');
                        setCustomToDate('');
                      }
                    }}
                    className={`text-xs px-2 py-0.5 rounded font-semibold capitalize border transition-all cursor-pointer ${
                      dateRangeFilter === f.id
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                {dateRangeFilter === 'custom' && (
                  <div className="flex items-center gap-1 ml-1">
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
              {(activeTab === 'work' || activeTab === 'all' || selectedEmp) && (
                <button onClick={() => { setEditTask(null); setShowTaskModal(true); }} className="bg-amber-500 hover:bg-amber-400 text-white p-2 rounded-lg border border-amber-400/40 shadow-lg shadow-amber-200/40 transition-all" title="Create Task">
                  <Plus className="w-4 h-4" />
                </button>
              )}
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
              onEditTask={handleEditTask}
              onDeleteTask={setDeleteTask}
              selectedEmp={selectedEmp}
            />
          )}
        </div>
      )}

      {/* ── SELECTED EMPLOYEE: ADMIN FEEDBACK TAB ── */}
      {selectedEmp && activeTab === 'feedback' && (
        <div className="space-y-6">
          {/* Information & Privacy Alert */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                Personal Leadership Feedback for {selectedEmp.name}
              </h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                One-way private performance guidance and notes. Visible exclusively to Admins and {selectedEmp.name}. 
                When you post a note, a private notification is sent directly to this team member.
              </p>
            </div>
          </div>

          {/* Feedback Form Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-500" />
              Add Performance Note / Comment
            </h4>

            {feedbackSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                {feedbackSuccess}
              </div>
            )}

            {feedbackError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {feedbackError}
              </div>
            )}

            <form onSubmit={handleCreateFeedback} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFeedbackCategory('general')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      feedbackCategory === 'general'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-400/20'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    📌 General Guidance
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackCategory('appreciation')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      feedbackCategory === 'appreciation'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/20'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    🌟 Appreciation / Good Work
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackCategory('improvement')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      feedbackCategory === 'improvement'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-400/20'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    ⚠️ Needs Improvement / Delay
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Feedback Note
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={`Write constructive guidance, appreciation, or areas of focus for ${selectedEmp.name}...`}
                  rows={3}
                  className="input-field text-xs sm:text-sm resize-y min-h-[90px]"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-400 italic">
                  Pressing Send will deliver this note to {selectedEmp.name ? selectedEmp.name.split(' ')[0] : 'the employee'}'s private dashboard.
                </span>
                <button
                  type="submit"
                  disabled={submittingFeedback || !feedbackText.trim()}
                  className="btn-amber text-xs py-2 px-4 flex items-center gap-1.5 font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingFeedback ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {submittingFeedback ? 'Sending...' : `Send Feedback to ${selectedEmp.name ? selectedEmp.name.split(' ')[0] : 'Employee'}`}
                </button>
              </div>
            </form>
          </div>

          {/* Feedback History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <span>Feedback History</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {empFeedbackList.length}
                </span>
              </h4>

              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setFeedbackFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    feedbackFilter === 'all' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All ({empFeedbackList.length})
                </button>
                <button
                  onClick={() => setFeedbackFilter('appreciation')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    feedbackFilter === 'appreciation' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Appreciation ({empFeedbackList.filter(n => n.category === 'appreciation').length})
                </button>
                <button
                  onClick={() => setFeedbackFilter('improvement')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    feedbackFilter === 'improvement' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Improvement ({empFeedbackList.filter(n => n.category === 'improvement').length})
                </button>
                <button
                  onClick={() => setFeedbackFilter('general')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    feedbackFilter === 'general' ? 'bg-white text-blue-800 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  General ({empFeedbackList.filter(n => n.category === 'general').length})
                </button>
              </div>
            </div>

            {loadingFeedback ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-gray-200">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading feedback notes...</p>
              </div>
            ) : empFeedbackList.filter(n => feedbackFilter === 'all' || n.category === feedbackFilter).length === 0 ? (
              <div className="p-10 text-center bg-white rounded-2xl border border-gray-200 space-y-2">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">No feedback notes found</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  {feedbackFilter === 'all'
                    ? `No feedback has been recorded for ${selectedEmp.name} yet. Use the form above to share performance comments.`
                    : `No ${feedbackFilter} notes found for ${selectedEmp.name}.`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {empFeedbackList
                  .filter(n => feedbackFilter === 'all' || n.category === feedbackFilter)
                  .map((note) => {
                    const isEditing = editingFeedbackId === note.id;

                    const categoryBadge = {
                      appreciation: {
                        label: '🌟 Appreciation',
                        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      },
                      improvement: {
                        label: '⚠️ Needs Improvement',
                        cls: 'bg-rose-50 text-rose-800 border-rose-200'
                      },
                      general: {
                        label: '📌 General',
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

                          {/* Action Buttons: Edit (all admins), Delete (ONLY Main Admin is_super_admin) */}
                          <div className="flex items-center gap-1">
                            {!isEditing && (
                              <button
                                onClick={() => {
                                  setEditingFeedbackId(note.id);
                                  setEditFeedbackText(note.note_text);
                                  setEditFeedbackCategory(note.category || 'general');
                                }}
                                className="p-1.5 text-gray-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit feedback"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Only Main Admin can delete feedback */}
                            {user?.is_super_admin && !isEditing && (
                              <button
                                onClick={() => handleDeleteFeedback(note.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete feedback (Main Admin only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Note Body or Edit Mode */}
                        {isEditing ? (
                          <div className="space-y-3 pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Category:</span>
                              {['general', 'appreciation', 'improvement'].map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setEditFeedbackCategory(cat)}
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                    editFeedbackCategory === cat
                                      ? 'bg-amber-500 text-white border-amber-600'
                                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  {cat === 'general' ? '📌 General' : cat === 'appreciation' ? '🌟 Appreciation' : '⚠️ Improvement'}
                                </button>
                              ))}
                            </div>

                            <textarea
                              value={editFeedbackText}
                              onChange={(e) => setEditFeedbackText(e.target.value)}
                              rows={3}
                              className="input-field text-xs sm:text-sm"
                            />

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFeedbackId(null);
                                  setEditFeedbackText('');
                                }}
                                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingEditFeedback || !editFeedbackText.trim()}
                                onClick={() => handleUpdateFeedback(note.id)}
                                className="btn-amber text-xs py-1.5 px-3 flex items-center gap-1 font-semibold disabled:opacity-50 cursor-pointer"
                              >
                                {savingEditFeedback ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-1">
                            {note.note_text}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {(activeTab === 'team' && !selectedEmp) && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowUserModal(true)} className="btn-amber text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {employees.filter(e => e.role !== 'admin').map((emp) => {
              const isSalesUser = emp.role === 'sales_manager' || emp.role === 'sales_executive' || emp.can_access_sales;
              return (
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

                  {isSalesUser ? (
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

                  {/* Activity Filter Buttons */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Activity Filter:</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEmployeeTasksByDate(emp, 'today');
                        }}
                        className="flex-1 text-center py-1 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg transition-colors border border-amber-200/60"
                        title="View today's activity"
                      >
                        Today
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEmployeeTasksByDate(emp, 'yesterday');
                        }}
                        className="flex-1 text-center py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-bold rounded-lg transition-colors border border-blue-200/60"
                        title="View yesterday's activity"
                      >
                        Yesterday
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewEmployeeTasksByDate(emp, 'week');
                        }}
                        className="flex-1 text-center py-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-lg transition-colors border border-indigo-200/60"
                        title="View last 7 days activity"
                      >
                        Week
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(activeTab === 'admin' && !selectedEmp) && (
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
                  <span className="text-[11px] font-bold text-emerald-700">{emp.avg_progress}%</span>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1.5">{emp.completed_task_count || 0} of {emp.task_count || 0} tasks completed</p>
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

      <TaskModal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); setDefaultAssigneeId(null); }} onSaved={fetchAll} task={editTask} employees={employees} initialPillar={pillarFilter} defaultAssigneeId={defaultAssigneeId} />
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



      {selectedLeadIdForModal && (
        <SalesLeadDetailModal
          leadId={selectedLeadIdForModal}
          isOpen={!!selectedLeadIdForModal}
          onClose={() => setSelectedLeadIdForModal(null)}
          user={user}
          onUpdated={() => {
            fetchAll(true);
          }}
          canEditSales={true}
        />
      )}
    </div>
  );
}
