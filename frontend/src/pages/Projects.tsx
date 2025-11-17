import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'

export default function Projects() {
  const [items, setItems] = React.useState<any[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [formData, setFormData] = React.useState({
    code: '',
    name: '',
    description: '',
    active: true
  })

  const loadProjects = () => {
    apiGet('/projects')
      .then(setItems)
      .catch(() => setItems([]))
  }

  React.useEffect(() => {
    loadProjects()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await apiPut(`/projects/${editingId}`, formData)
        alert('Project updated successfully!')
      } else {
        await apiPost('/projects', formData)
        alert('Project added successfully!')
      }
      
      setShowForm(false)
      setEditingId(null)
      setFormData({ code: '', name: '', description: '', active: true })
      loadProjects()
    } catch (err: any) {
      console.error('Error saving project:', err)
      alert('Failed to save project: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleEdit = (project: any) => {
    setEditingId(project.id)
    setFormData({
      code: project.code,
      name: project.name,
      description: project.description || '',
      active: project.active !== false
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return
    
    try {
      await apiDelete(`/projects/${id}`)
      alert('Project deleted successfully!')
      loadProjects()
    } catch (err: any) {
      console.error('Error deleting project:', err)
      alert('Failed to delete project: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ code: '', name: '', description: '', active: true })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Projects</h2>
        <button
          onClick={() => { setEditingId(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-yellow-400 dark:bg-yellow-600 rounded hover:bg-yellow-500"
        >
          {showForm ? 'Cancel' : '+ Add Project'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-3">{editingId ? 'Edit Project' : 'New Project'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Project Code * (e.g., PROJ001)"
              required
              className="px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-yellow-400 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:focus:border-yellow-500 transition-colors"
            />
            
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Project Name *"
              required
              className="px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-yellow-400 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:focus:border-yellow-500 transition-colors"
            />
            
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description"
              rows={3}
              className="col-span-2 px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-yellow-400 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:focus:border-yellow-500 transition-colors"
            />
            
            <label className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span>Active Project</span>
            </label>

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {editingId ? 'Update Project' : 'Add Project'}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-3">
        {items.map((project) => (
          <div key={project.id} className="p-4 border rounded bg-white dark:bg-slate-800">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{project.code}</span>
                  <span className="font-semibold">{project.name}</span>
                  {project.active && (
                    <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">Active</span>
                  )}
                </div>
                {project.description && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{project.description}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(project)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-slate-500 p-8">
            No projects yet. Add a project to track time against it.
          </div>
        )}
      </div>
    </div>
  )
}
