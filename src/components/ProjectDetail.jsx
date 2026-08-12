import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Users, UserPlus, X, Shield, User, FolderGit2, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import TaskDetailModal from './TaskDetailModal';
import TaskVerificationModal from './TaskVerificationModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export default function ProjectDetail({ project, user, onBack, onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [verificationTask, setVerificationTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [tasksData, membersData] = await Promise.all([
        api.getProjectTasks(project.id),
        api.getProjectMembers(project.id)
      ]);
      setTasks(tasksData);
      setMembers(membersData);
      
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
    const handleUpdate = () => loadProjectData();
    window.addEventListener('task-updated', handleUpdate);
    return () => window.removeEventListener('task-updated', handleUpdate);
  }, [project.id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await api.addProjectMember(project.id, selectedUserId);
      setShowAddMember(false);
      setSelectedUserId('');
      loadProjectData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member from the project?')) return;
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

  const nonMembers = allEmployees.filter(emp => !members.find(m => m.id === emp.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg transition-colors shadow-sm bg-gray-50 border border-gray-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                project.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                project.status === 'completed' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                {project.status}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
            )}
          </div>
        </div>

        {user.role === 'admin' && (
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Project Task
          </button>
        )}
      </div>

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
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>
            
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
                </div>
              ) : tasks.length === 0 ? (
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
                  {tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleTaskSaved}
                      onSelect={(t) => {
                        if (user.role === 'admin') {
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
              <form onSubmit={handleAddMember} className="p-4 bg-blue-50/50 border-b border-gray-100">
                <label className="block text-xs font-medium text-gray-700 mb-1">Add Member</label>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mb-2"
                >
                  <option value="">Select user...</option>
                  {nonMembers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button type="submit" disabled={!selectedUserId} className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded font-medium hover:bg-blue-700 disabled:opacity-50">
                    Add
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

            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {members.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 italic">
                  No members added yet.
                </div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="p-3 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        {member.role === 'admin' ? <Shield className="w-3.5 h-3.5 text-amber-600" /> : <User className="w-3.5 h-3.5 text-gray-500" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{member.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{member.role}</p>
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

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
