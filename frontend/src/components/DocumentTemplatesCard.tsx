import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import Card from './Card';

// Contract and policy templates. The body is HTML with {{placeholder}} merge
// fields; generating one files an ordinary document against the employee, so
// it downloads and deletes like anything else in their file.

type Template = {
 id: number;
 name: string;
 body: string;
 documentType: string;
 requiresAcknowledgement: boolean;
};

type EmployeeOption = {
 id: number;
 firstName: string;
 lastName: string;
};

const DOCUMENT_TYPES = [
  { value: 'CONTRACT', label: 'Employment Contract' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'ID', label: 'ID Document' },
  { value: 'OTHER', label: 'Other' },
];

const PLACEHOLDERS = [
 'firstName',
 'lastName',
 'fullName',
 'jobTitle',
 'department',
 'employeeType',
 'email',
 'startDate',
 'endDate',
 'probationEndDate',
 'today',
];

const inputClass =
 'form-input mt-1';

const emptyForm = {
 id: null as number | null,
 name: '',
 documentType: 'CONTRACT',
 body: '',
 requiresAcknowledgement: true,
};

export default function DocumentTemplatesCard({
 canEdit,
}: {
 canEdit: boolean;
}) {
 const [templates, setTemplates] = React.useState<Template[]>([]);
 const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
 const [form, setForm] = React.useState(emptyForm);
 const [editing, setEditing] = React.useState(false);
 const [generateTemplateId, setGenerateTemplateId] = React.useState('');
 const [generateEmployeeId, setGenerateEmployeeId] = React.useState('');
 const [generating, setGenerating] = React.useState(false);
 const [message, setMessage] = React.useState('');
 const [error, setError] = React.useState('');

 React.useEffect(() => {
 apiGet('/document-templates')
      .then(setTemplates)
      .catch((e: any) => setError(e.message || 'Could not load templates.'));
 apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

 function startNew() {
 setForm(emptyForm);
 setEditing(true);
 setMessage('');
 setError('');
  }

 function startEdit(template: Template) {
 setForm({
 id: template.id,
 name: template.name,
 documentType: template.documentType,
 body: template.body,
 requiresAcknowledgement: template.requiresAcknowledgement,
    });
 setEditing(true);
 setMessage('');
 setError('');
  }

 async function save(e: React.FormEvent) {
 e.preventDefault();
 setError('');
 setMessage('');
 try {
 const payload = {
 name: form.name,
 body: form.body,
 documentType: form.documentType,
 requiresAcknowledgement: form.requiresAcknowledgement,
      };
 if (form.id) {
 const updated = await apiPut(`/document-templates/${form.id}`, payload);
 setTemplates((list) =>
 list.map((t) => (t.id === updated.id ? updated : t)),
        );
 setMessage('Template saved.');
      } else {
 const created = await apiPost('/document-templates', payload);
 setTemplates((list) => [...list, created]);
 setMessage('Template created.');
      }
 setForm(emptyForm);
 setEditing(false);
    } catch (e: any) {
 setError(e.message || 'Failed to save the template.');
    }
  }

 async function remove(template: Template) {
 if (!confirm(`Delete the "${template.name}" template?`)) return;
 setError('');
 setMessage('');
 try {
 await apiDelete(`/document-templates/${template.id}`);
 setTemplates((list) => list.filter((t) => t.id !== template.id));
 if (generateTemplateId === String(template.id)) setGenerateTemplateId('');
    } catch (e: any) {
 setError(e.message || 'Failed to delete the template.');
    }
  }

 async function generate(e: React.FormEvent) {
 e.preventDefault();
 setError('');
 setMessage('');
 try {
 setGenerating(true);
 const document = await apiPost(
 `/document-templates/${generateTemplateId}/generate`,
        { employeeId: Number(generateEmployeeId) },
      );
 setMessage(`Filed "${document.name}" in their documents.`);
 setGenerateEmployeeId('');
    } catch (e: any) {
 setError(e.message || 'Failed to generate the document.');
    } finally {
 setGenerating(false);
    }
  }

 return (
    <Card className="p-6">
      <h3 className="mb-1 text-base font-semibold text-ink">
        Document templates
      </h3>
      <p className="mb-4 text-sm text-ink-2">
 Write a contract or policy once as HTML, then generate it for an
 employee. The merge fields are filled from their record and the result
 is filed in their documents.
      </p>

      {message && (
        <div className="mb-3 rounded-md border border-ok bg-ok-tint px-3 py-2 text-sm text-ok ">
          {message}
        </div>
      )}
      {error && (
        <div
 role="alert"
 className="mb-3 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad "
        >
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-ink-2">
 No templates yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((template) => (
            <li
 key={template.id}
 className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm "
            >
              <div>
                <span className="font-semibold text-ink">
                  {template.name}
                </span>
                <span className="ml-2 text-ink-2">
                  {template.documentType}
                  {template.requiresAcknowledgement
                    ? ' · needs acknowledgement'
                    : ''}
                </span>
              </div>
              {canEdit && (
                <div className="flex gap-3">
                  <button
 type="button"
 onClick={() => startEdit(template)}
 className="font-semibold text-ink-2 hover:underline dark:text-ink-2"
                  >
 Edit
                  </button>
                  <button
 type="button"
 onClick={() => remove(template)}
 className="font-semibold text-bad hover:underline"
                  >
 Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !editing && (
        <button
 type="button"
 onClick={startNew}
 className="mt-3 text-sm font-semibold text-ink-2 hover:underline dark:text-ink-2"
        >
          + New template
        </button>
      )}

      {canEdit && editing && (
        <form onSubmit={save} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input
 required
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="e.g. Statement of main terms"
 className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Document type</span>
            <select
 value={form.documentType}
 onChange={(e) =>
 setForm({ ...form, documentType: e.target.value })
              }
 className={inputClass}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="font-medium">Body (HTML)</span>
            <textarea
 required
 rows={10}
 value={form.body}
 onChange={(e) => setForm({ ...form, body: e.target.value })}
 placeholder="<h1>Statement of main terms</h1><p>Dear {{firstName}},</p>"
 className={`${inputClass} font-mono text-xs`}
            />
          </label>
          <div className="rounded-md border border-line bg-surface-2 p-3 text-xs text-ink-2 md:col-span-2 dark:text-ink-3">
            <p className="font-semibold text-ink-2">
 Available placeholders
            </p>
            <p className="mt-1 flex flex-wrap gap-1">
              {PLACEHOLDERS.map((placeholder) => (
                <code
 key={placeholder}
 className="rounded bg-white px-1 py-0.5 "
                >
                  {`{{${placeholder}}}`}
                </code>
              ))}
            </p>
            <p className="mt-2">
 Anything else is left in the finished document exactly as typed,
 so a misspelt placeholder is visible rather than quietly blank.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
 type="checkbox"
 checked={form.requiresAcknowledgement}
 onChange={(e) =>
 setForm({ ...form, requiresAcknowledgement: e.target.checked })
              }
 className="mt-1 h-4 w-4 rounded border-line-2 text-link focus:ring-accent-tint"
            />
            <span>
 Ask the employee to acknowledge it
              <span className="mt-1 block text-xs text-ink-3">
 They type their name to record that they have read it.
              </span>
            </span>
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-primary">
              {form.id ? 'Save template' : 'Create template'}
            </button>
            <button
 type="button"
 onClick={() => {
 setEditing(false);
 setForm(emptyForm);
              }}
 className="btn-ghost"
            >
 Cancel
            </button>
          </div>
        </form>
      )}

      {templates.length > 0 && (
        <form
 onSubmit={generate}
 className="mt-6 grid gap-4 border-t border-line pt-4 md:grid-cols-2 "
        >
          <div className="md:col-span-2 text-sm font-semibold">
 Generate for employee
          </div>
          <label className="block text-sm">
            <span className="font-medium">Template</span>
            <select
 required
 value={generateTemplateId}
 onChange={(e) => setGenerateTemplateId(e.target.value)}
 className={inputClass}
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Employee</span>
            <select
 required
 value={generateEmployeeId}
 onChange={(e) => setGenerateEmployeeId(e.target.value)}
 className={inputClass}
            >
              <option value="">Select an employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button
 type="submit"
 className="btn-primary"
 disabled={
 generating || !generateTemplateId || !generateEmployeeId
              }
            >
              {generating ? 'Generating…' : 'Generate document'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
