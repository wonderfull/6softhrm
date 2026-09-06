import React from 'react';
import { RectangleStackIcon } from '@heroicons/react/24/outline';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import Dialog from '../components/Dialog';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';

export default function Projects() {
  const [items, setItems] = React.useState<any[]>([]);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const [formData, setFormData] = React.useState({
    code: '',
    name: '',
    description: '',
    active: true,
  });

  const loadProjects = () => {
    apiGet('/projects')
      .then(setItems)
      .catch(() => setItems([]));
  };

  React.useEffect(() => {
    loadProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiPut(`/projects/${editingId}`, formData);
        alert('Project updated successfully!');
      } else {
        await apiPost('/projects', formData);
        alert('Project added successfully!');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ code: '', name: '', description: '', active: true });
      loadProjects();
    } catch (err: any) {
      console.error('Error saving project:', err);
      alert('Failed to save project: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleEdit = (project: any) => {
    setEditingId(project.id);
    setFormData({
      code: project.code,
      name: project.name,
      description: project.description || '',
      active: project.active !== false,
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    try {
      await apiDelete(`/projects/${id}`);
      alert('Project deleted successfully!');
      loadProjects();
    } catch (err: any) {
      console.error('Error deleting project:', err);
      alert(
        'Failed to delete project: ' + (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ code: '', name: '', description: '', active: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subline="Codes that hours can be booked against on a timesheet."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancel' : 'New project'}
          </Button>
        }
      />

      {showForm && (
        <Card
          title={editingId ? 'Edit project' : 'New project'}
          description="The code appears on timesheets, so keep it short and stable."
        >
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Project code"
              id="project-code"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value.toUpperCase() })
              }
              placeholder="PROJ001"
              help="Uppercase, unique to this company."
              required
              className="font-mono"
            />

            <Input
              label="Project name"
              id="project-name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Night shift cover"
              required
            />

            <Textarea
              label="Description"
              id="project-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              wrapperClassName="sm:col-span-2"
            />

            <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
                className="h-4 w-4 rounded-sm border-line-2 accent-accent"
              />
              <span>Active project</span>
            </label>

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">
                {editingId ? 'Save changes' : 'Add project'}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<RectangleStackIcon />}
          title="No projects yet"
          body="Add a project and hours can be booked against it on a timesheet."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingId(null);
                setShowForm(true);
              }}
            >
              New project
            </Button>
          }
        />
      ) : (
        <Card
          flush
          title="All projects"
          description={`${items.length} ${items.length === 1 ? 'project' : 'projects'}. Select a row to edit it.`}
        >
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((project) => (
                <Tr
                  key={project.id}
                  clickable
                  selected={editingId === project.id}
                  onClick={() => handleEdit(project)}
                >
                  <Td>
                    <button
                      type="button"
                      className="font-mono text-[13px] text-link hover:underline"
                      aria-label={`Edit ${project.code}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(project);
                      }}
                    >
                      {project.code}
                    </button>
                  </Td>
                  <Td className="font-medium text-ink">{project.name}</Td>
                  <Td className="max-w-[360px] truncate text-ink-2">
                    {project.description}
                  </Td>
                  <Td>
                    {project.active !== false ? (
                      <Badge tone="ok">Active</Badge>
                    ) : (
                      <Badge tone="warn">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(project);
                      }}
                    >
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Dialog
        open={!!deleting}
        title="Delete project"
        description={
          deleting
            ? `Delete ${deleting.code} (${deleting.name})? Timesheet entries already booked to it keep their hours.`
            : undefined
        }
        onClose={() => setDeleting(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete project
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
