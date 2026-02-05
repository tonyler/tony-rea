import { useState, useEffect } from 'react';
import type { Project } from '../shared/types';
import { projectsApi } from '../services/api';
import Button from './Button';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  allowNone?: boolean;
}

export default function ProjectSelector({ value, onChange, allowNone = false }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { projects } = await projectsApi.list();
      setProjects(projects);

      // Auto-select sphinx-protocol if no project is selected
      if (!value && projects.length > 0) {
        const sphinxProject = projects.find(p => p.id === 'sphinx-protocol');
        if (sphinxProject) {
          onChange(sphinxProject.id);
        } else {
          // Fallback to first project if sphinx-protocol doesn't exist
          onChange(projects[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      const { project } = await projectsApi.create(newProjectName.trim());
      setProjects([project, ...projects]);
      onChange(project.id);
      setNewProjectName('');
      setShowCreate(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project. It may already exist.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-smoke-100">
        <div className="w-4 h-4 border-2 border-smoke-400/50 border-t-amber-300 rounded-full animate-spin" />
        Loading projects...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="input flex-1"
        >
          {allowNone && <option value="">None</option>}
          <option value="" disabled>
            Select a project
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New'}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-2 animate-slide-down">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            className="input flex-1"
            disabled={creating}
            autoFocus
          />
          <Button type="submit" disabled={creating || !newProjectName.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </form>
      )}
    </div>
  );
}
