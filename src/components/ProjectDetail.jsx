import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Users, UserPlus, X, Shield, User, FolderGit2, CheckCircle2, Package, ListTodo, FileCheck } from 'lucide-react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import TaskDetailModal from './TaskDetailModal';
import TaskVerificationModal from './TaskVerificationModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ProjectInventory from './ProjectInventory';
import ProjectSiteDocuments from './ProjectSiteDocuments';

export default function ProjectDetail({ project, user, onBack, onUpdate }) {
  const [projectTab, setProjectTab] = useState('tasks'); // 'tasks' | 'inventory' | 'documents'
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [pendingManagerReceipts, setPendingManagerReceipts] = useState([]);
  const [pendingAdminReceipts, setPendingAdminReceipts] = useState([]);
  const [pendingInventoryCount, setPendingInventoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [verificationTask, setVerificationTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addMemberPermissions, setAddMemberPermissions] = useState({ can_access_inventory: false, can_access_documents: false });

  const [pendingManagerDocs, setPendingManagerDocs] = useState([]);
  const [pendingAdminDocs, setPendingAdminDocs] = useState([]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [tasksData, membersData, invData, docsData] = await Promise.all([
        api.getProjectTasks(project.id),
        api.getProjectMembers(project.id),
        api.getProjectInventory(project.id),
        api.getProjectDocuments(project.id)
      ]);
      setTasks(tasksData);
      setMembers(membersData);
      if (invData) {
        setPendingManagerReceipts(invData.pendingManagerReceipts || []);
        setPendingAdminReceipts(invData.pendingAdminReceipts || []);

        let invCount = 0;
        if (user.role === 'admin') {
          const inward = (invData.pendingAdminReceipts?.length || 0) + (invData.pendingManagerReceipts?.length || 0);
          const usage = (invData.pendingAdminUsage?.length || 0) + (invData.pendingManagerUsage?.length || 0);
          const scrap = (invData.pendingAdminScrap?.length || 0) + (invData.pendingManagerScrap?.length || 0);
          const audits = invData.pendingAudits?.length || 0;
          invCount = inward + usage + scrap + audits;
        } else if (user.role === 'manager') {
          const inward = invData.pendingManagerReceipts?.length || 0;
          const usage = invData.pendingManagerUsage?.length || 0;
          const scrap = invData.pendingManagerScrap?.length || 0;
          const audits = invData.pendingAudits?.length || 0;
          invCount = inward + usage + scrap + audits;
        } else {
          const subs = invData.mySubmissions || {};
          const inward = subs.receipts?.length || 0;
          const usage = subs.usage?.length || 0;
          const scrap = subs.scrap?.length || 0;
          const audits = subs.audits?.length || 0;
          invCount = inward + usage + scrap + audits;
        }
        setPendingInventoryCount(invCount);
      }
      if (docsData) {
        setPendingManagerDocs(docsData.pendingManagerDocs || []);
        setPendingAdminDocs(docsData.pendingAdminDocs || []);
      }
      
      if (user.role === 'admin') {
        const empData = await api.getEmployees(true); // all users
        setAllEmployees(empData);
      }
    } catch (err) {
      console.error('Failed to load project data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [project.id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await api.addProjectMember(project.id, {
        user_id: selectedUserId,
        can_access_inventory: addMemberPermissions.can_access_inventory,
        can_access_documents: addMemberPermissions.can_access_documents
      });
      setSelectedUserId('');
      setAddMemberPermissions({ can_access_inventory: false, can_access_documents: false });
      setShowAddMember(false);
      loadProjectData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleMemberPermission = async (member, field) => {
    try {
      const updated = {
        can_access_inventory: field === 'inventory' ? !member.can_access_inventory : member.can_access_inventory,
        can_access_documents: field === 'documents' ? !member.can_access_documents : member.can_access_documents,
      };
      await api.updateProjectMemberPermissions(project.id, member.id, updated);
      loadProjectData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove member from project?')) return;
    try {
      await api.removeProjectMember(project.id, userId);
      loadProjectData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTaskSaved = () => {
    loadProjectData();
    setShowTaskModal(false);
    setDetailTask(null);
    setVerificationTask(null);
  };

  const handleDeleteTask = async () => {
    if (deleteTarget) {
      try {
        await api.deleteTask(deleteTarget.id);
        loadProjectData();
      } catch (err) {
        alert(err.message);
      }
      setDeleteTarget(null);
    }
  };

  const nonMembers = allEmployees.filter(emp => !members.some(m => m.id === emp.id));
  const currentMember = members.find(m => Number(m.id) === Number(user.id));
  
  // Tab visibility permissions
  const canSeeInventory = ['admin', 'manager'].includes(user.role) || Boolean(currentMember?.can_access_inventory);
  const canSeeDocuments = ['admin', 'manager'].includes(user.role) || Boolean(currentMember?.can_access_documents);

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                project.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-gray-500 mt-0.5">{project.description}</p>
            )}
          </div>
        </div>

        {['admin', 'manager'].includes(user.role) && (
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Project Task
          </button>
        )}
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex flex-wrap gap-1 bg-gray-200/80 p-1.5 rounded-xl w-fit">
        <div className="relative group/tip">
          <button
            onClick={() => setProjectTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              projectTab === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ListTodo className="w-4 h-4 text-emerald-600" />
            Project Tasks ({tasks.filter(t => !t.parent_id || t.id === t.parent_id).length})
          </button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-64 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
            Task management board with status tracking, daily logs, and verifications.
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
          </div>
        </div>

        {canSeeInventory && (
          <div className="relative group/tip">
            <button
              onClick={() => setProjectTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                projectTab === 'inventory' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Package className="w-4 h-4 text-amber-600" />
              Site Inventory & Audit {pendingInventoryCount > 0 && (
                <span className={`text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse ${
                  user.role === 'admin' ? 'bg-blue-600' : 'bg-amber-500'
                }`}>
                  {pendingInventoryCount}
                </span>
              )}
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-72 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
              Material ledger, stock arrivals, installation logs, store stock audits, and duplicate DC protection.
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
            </div>
          </div>
        )}

        {canSeeDocuments && (
          <div className="relative group/tip">
            <button
              onClick={() => setProjectTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                projectTab === 'documents' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileCheck className="w-4 h-4 text-blue-600" />
              Site Documents & DC {user.role === 'manager' && pendingManagerDocs.length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                  {pendingManagerDocs.length}
                </span>
              )}
              {user.role === 'admin' && pendingAdminDocs.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                  {pendingAdminDocs.length}
                </span>
              )}
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/tip:block w-72 p-2 bg-gray-900 text-white text-[11px] leading-snug rounded-lg shadow-xl z-50 pointer-events-none text-center">
              Secure document vault for Delivery Challans, Quality Test Reports, Safety Permits, and Handover files.
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1 border-4 border-transparent border-b-gray-900" />
            </div>
          </div>
        )}
      </div>

      {projectTab === 'inventory' ? (
        <ProjectInventory project={project} user={user} tasks={tasks} onInventoryChanged={loadProjectData} />
      ) : projectTab === 'documents' ? (
        <ProjectSiteDocuments 
          project={project} 
          user={user} 
          pendingManagerReceipts={pendingManagerReceipts}
          pendingAdminReceipts={pendingAdminReceipts}
          onVerificationDone={loadProjectData} 
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Tasks Area */}
          <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Project Tasks
              </h2>
              <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                {tasks.filter(t => !t.parent_id || t.id === t.parent_id).length} {tasks.filter(t => !t.parent_id || t.id === t.parent_id).length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
                </div>
              ) : tasks.filter(t => !t.parent_id || t.id === t.parent_id).length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">No tasks in this project yet.</p>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => {
                        setSelectedTask(null);
                        setShowTaskModal(true);
                      }}
                      className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700"
                    >
                      + Create the first task
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {tasks.filter(t => !t.parent_id || t.id === t.parent_id).map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleTaskSaved}
                      onSelect={(t) => {
                        if (['admin', 'manager'].includes(user.role)) {
                          setSelectedTask(t);
                          setShowTaskModal(true);
                        }
                      }}
                      onDelete={user.role === 'admin' ? setDeleteTarget : undefined}
                      onViewDetail={setDetailTask}
                      onVerificationNeeded={setVerificationTask}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Members */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-blue-500" />
                Team Members
              </h2>
              <span className="text-xs font-medium text-gray-500">
                {members.length}
              </span>
            </div>

            {showAddMember && user.role === 'admin' ? (
              <form onSubmit={handleAddMember} className="p-4 bg-blue-50/50 border-b border-gray-100 space-y-2">
                <label className="block text-xs font-medium text-gray-700">Add Member</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user...</option>
                  {nonMembers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>

                <div className="space-y-1 pt-1 text-[11px] text-gray-700 bg-white p-2 rounded border border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">Grant Tab Access:</p>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={addMemberPermissions.can_access_inventory}
                      onChange={e => setAddMemberPermissions({ ...addMemberPermissions, can_access_inventory: e.target.checked })}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>📦 Site Inventory & Anti-Theft</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={addMemberPermissions.can_access_documents}
                      onChange={e => setAddMemberPermissions({ ...addMemberPermissions, can_access_documents: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>📜 Site Documents & DC</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={!selectedUserId} className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                    Add Member
                  </button>
                  <button type="button" onClick={() => setShowAddMember(false)} className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs py-1.5 rounded font-medium hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              user.role === 'admin' && (
                <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex justify-center">
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors w-full justify-center border border-blue-100"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Member
                  </button>
                </div>
              )
            )}

            <div className="divide-y divide-gray-100 max-h-[65vh] overflow-y-auto divide-solid">
              {members.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 italic">
                  No members added yet.
                </div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="p-3 space-y-1.5 group hover:bg-blue-50/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 shrink-0">
                          {member.role === 'admin' ? <Shield className="w-3.5 h-3.5 text-amber-600" /> : <User className="w-3.5 h-3.5 text-gray-500" />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900 leading-tight">{member.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{member.role ? member.role.replace('_', ' ') : ''}</p>
                        </div>
                      </div>
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove member"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Admin Permission Toggles for non-admin/non-manager members */}
                    {user.role === 'admin' && !['admin', 'manager'].includes(member.role) && (
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-gray-600">
                        <button
                          onClick={() => handleToggleMemberPermission(member, 'inventory')}
                          className={`px-1.5 py-0.5 rounded font-medium border transition-colors ${
                            member.can_access_inventory ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          📦 Inventory: {member.can_access_inventory ? 'ON' : 'OFF'}
                        </button>
                        <button
                          onClick={() => handleToggleMemberPermission(member, 'documents')}
                          className={`px-1.5 py-0.5 rounded font-medium border transition-colors ${
                            member.can_access_documents ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold' : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}
                        >
                          📜 Docs: {member.can_access_documents ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {showTaskModal && (
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          task={selectedTask}
          user={user}
          employees={members}
          onSaved={handleTaskSaved}
          projectId={project.id} // Custom prop to inject project_id
        />
      )}

      <TaskDetailModal 
        isOpen={!!detailTask} 
        onClose={() => setDetailTask(null)} 
        task={detailTask} 
        onTaskUpdated={handleTaskSaved} 
      />

      <TaskVerificationModal 
        isOpen={!!verificationTask} 
        onClose={() => setVerificationTask(null)} 
        task={verificationTask} 
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTarget?.title}"?`}
      />
    </div>
  );
}
