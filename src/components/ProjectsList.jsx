import { useState, useEffect } from 'react';
import { Plus, FolderGit2, Users, LayoutList, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { api } from '../lib/api';
import ProjectFormModal from './ProjectFormModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export default function ProjectsList({ user, onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [showDelete, setShowDelete] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleEdit = (project, e) => {
    e.stopPropagation();
    setSelectedProject(project);
    setShowForm(true);
  };

  const handleDelete = (project, e) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    try {
      await api.deleteProject(projectToDelete.id);
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
      setShowDelete(false);
    } catch (err) {
      console.error(err);
      alert('Failed to delete project: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-amber-600 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center justify-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-6 h-6 text-amber-600" />
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
        </div>
        
        {user.role === 'admin' && (
          <button
            onClick={() => {
              setSelectedProject(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FolderGit2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {user.role === 'admin' 
              ? 'Get started by creating your first project to organize tasks and team members.' 
              : 'You have not been assigned to any projects yet.'}
          </p>
          {user.role === 'admin' && (
            <button
              onClick={() => {
                setSelectedProject(null);
                setShowForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group relative"
            >
              {user.role === 'admin' && (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleEdit(project, e)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                    title="Edit Project"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(project, e)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="pr-16">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-amber-700 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-6 line-clamp-2 h-10">
                {project.description || <span className="italic opacity-50">No description provided.</span>}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600" title="Team Members">
                    <Users className="w-4 h-4 text-gray-400" />
                    {project.member_count}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600" title="Tasks">
                    <LayoutList className="w-4 h-4 text-gray-400" />
                    {project.task_count}
                  </div>
                </div>
                
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                  project.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  project.status === 'completed' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                  'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {project.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ProjectFormModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          project={selectedProject}
          onProjectSaved={loadProjects}
        />
      )}

      {showDelete && projectToDelete && (
        <ConfirmDeleteModal
          isOpen={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={confirmDelete}
          title="Delete Project"
          message={`Are you sure you want to delete "${projectToDelete.name}"? This action cannot be undone.`}
        />
      )}
    </div>
  );
}
