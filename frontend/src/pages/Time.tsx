import React from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { apiGet, apiPost, apiPut, apiDelete, getCurrentUser } from '../lib/api';
import { normalizeRole } from '../lib/roles';
import Dialog from '../components/Dialog';
import {
  Button,
  Card,
  EmptyState,
  Input,
  KpiTile,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Time() {
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser?.role);
  const isElevated = currentRole !== 'EMPLOYEE';
  const ownEmployeeId = currentUser?.employeeId
    ? String(currentUser.employeeId)
    : '';
  const [items, setItems] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = React.useState<string>('');
  const [selectedProject, setSelectedProject] = React.useState<string>('');
  const [currentWeek, setCurrentWeek] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<'week' | 'month'>('week');
  const [showForm, setShowForm] = React.useState(false);
  const [showQuickAdd, setShowQuickAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState({
    employeeId: '',
    projectId: '',
    date: '',
    hours: '8',
    notes: '',
  });

  const loadTimesheets = () => {
    apiGet('/timesheets')
      .then(setItems)
      .catch(() => setItems([]));
  };

  const loadEmployees = () => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]));
  };

  const loadProjects = () => {
    apiGet('/projects')
      .then(setProjects)
      .catch(() => setProjects([]));
  };

  React.useEffect(() => {
    loadTimesheets();
    loadEmployees();
    loadProjects();
  }, []);

  const getWeekDays = (date: Date) => {
    const week = [];
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // Start from Sunday

    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return week;
  };

  const weekDays = getWeekDays(currentWeek);

  const getTimesheetsForDate = (employeeId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    let timesheets = items.filter(
      (t) => t.employeeId === employeeId && t.date.split('T')[0] === dateStr,
    );

    // Filter by project if selected
    if (selectedProject) {
      timesheets = timesheets.filter(
        (t) => t.projectId && t.projectId.toString() === selectedProject,
      );
    }

    return timesheets;
  };

  const getTotalHoursForDate = (employeeId: number, date: Date) => {
    const timesheets = getTimesheetsForDate(employeeId, date);
    return timesheets.reduce((sum, ts) => sum + ts.hours, 0);
  };

  const getTotalHours = (employeeId: number) => {
    return weekDays.reduce((total, day) => {
      return total + getTotalHoursForDate(employeeId, day);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // For non-elevated users we lock employeeId to the signed-in user;
      // backend still enforces this, but matching it client-side avoids a
      // bad-request round-trip.
      const effectiveEmployeeId = isElevated
        ? formData.employeeId
        : ownEmployeeId || formData.employeeId;
      const data: any = {
        ...formData,
        employeeId: parseInt(effectiveEmployeeId),
        hours: parseFloat(formData.hours),
      };
      if (formData.projectId) {
        data.projectId = parseInt(formData.projectId);
      }

      if (editingId) {
        await apiPut(`/timesheets/${editingId}`, data);
        alert('Timesheet updated successfully!');
      } else {
        await apiPost('/timesheets', data);
        alert('Timesheet added successfully!');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({
        employeeId: '',
        projectId: '',
        date: '',
        hours: '8',
        notes: '',
      });
      loadTimesheets();
    } catch (err: any) {
      console.error('Error saving timesheet:', err);
      alert(
        'Failed to save timesheet: ' + (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleQuickAdd = (employeeId: number, date: Date) => {
    const existingTotal = getTotalHoursForDate(employeeId, date);
    const defaultHours =
      existingTotal >= 8 ? 1 : Math.max(1, 8 - existingTotal);
    const defaultProject =
      selectedProject || (projects.length ? projects[0].id.toString() : '');
    setFormData({
      employeeId: employeeId.toString(),
      projectId: defaultProject,
      date: date.toISOString().split('T')[0],
      hours: defaultHours.toString(),
      notes: '',
    });
    setShowQuickAdd(true);
  };

  const submitQuickAdd = async () => {
    try {
      const data: any = {
        employeeId: parseInt(formData.employeeId),
        hours: parseFloat(formData.hours),
        date: formData.date,
        notes: formData.notes,
      };
      if (formData.projectId) {
        data.projectId = parseInt(formData.projectId);
      }

      await apiPost('/timesheets', data);
      setShowQuickAdd(false);
      setFormData({
        employeeId: '',
        projectId: '',
        date: '',
        hours: '8',
        notes: '',
      });
      loadTimesheets();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const confirmDelete = async () => {
    if (deletingId === null) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      await apiDelete(`/timesheets/${id}`);
      setShowForm(false);
      setEditingId(null);
      loadTimesheets();
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleEdit = (timesheet: any) => {
    setEditingId(timesheet.id);
    setFormData({
      employeeId: timesheet.employeeId.toString(),
      projectId: timesheet.projectId ? timesheet.projectId.toString() : '',
      date: timesheet.date.split('T')[0],
      hours: timesheet.hours.toString(),
      notes: timesheet.notes || '',
    });
    setShowForm(true);
  };

  const previousWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  const thisWeek = () => {
    setCurrentWeek(new Date());
  };

  const formatDate = (date: Date) => {
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const day = date.getDate();
    return `${day} ${month}`;
  };

  // Monthly view functions
  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  };

  const previousMonth = () => {
    const d = new Date(currentWeek);
    d.setMonth(d.getMonth() - 1);
    setCurrentWeek(d);
  };

  const nextMonth = () => {
    const d = new Date(currentWeek);
    d.setMonth(d.getMonth() + 1);
    setCurrentWeek(d);
  };

  const thisMonth = () => {
    setCurrentWeek(new Date());
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
  };

  const getTotalHoursForMonth = (employeeId: number) => {
    const monthDays = getMonthDays(currentWeek);
    return monthDays.reduce((total, day) => {
      return total + getTotalHoursForDate(employeeId, day);
    }, 0);
  };

  // Filter employees based on selection
  const filteredEmployees = React.useMemo(() => {
    if (selectedEmployee) {
      return employees.filter((emp) => emp.id.toString() === selectedEmployee);
    }
    return employees;
  }, [employees, selectedEmployee]);

  const monthSummary = React.useMemo(() => {
    if (viewMode !== 'month') return null;

    const monthDays = getMonthDays(currentWeek);
    let totalHours = 0;
    let daysWorked = 0;

    for (const emp of filteredEmployees) {
      for (const day of monthDays) {
        const hours = getTotalHoursForDate(emp.id, day);
        totalHours += hours;
        if (hours > 0) daysWorked += 1;
      }
    }

    return { totalHours, daysWorked };
  }, [currentWeek, filteredEmployees, items, selectedProject, viewMode]);

  const employeeName = (emp: any) => `${emp.firstName} ${emp.lastName}`;

  const rangeLabel =
    viewMode === 'week'
      ? `${formatDate(weekDays[0])} - ${formatDate(weekDays[6])}`
      : formatMonth(currentWeek);

  const projectOptions = (
    <>
      <option value="">No project</option>
      {projects.map((proj) => (
        <option key={proj.id} value={proj.id}>
          {proj.code} - {proj.name}
        </option>
      ))}
    </>
  );

  const renderDayCell = (emp: any, day: Date, key: React.Key) => {
    const timesheets = getTimesheetsForDate(emp.id, day);
    const totalHours = getTotalHoursForDate(emp.id, day);
    const label = `${employeeName(emp)} on ${formatDate(day)}`;

    return (
      <Td
        key={key}
        className="cursor-pointer text-center"
        onClick={() => handleQuickAdd(emp.id, day)}
      >
        {timesheets.length > 0 ? (
          <div className="flex flex-col items-stretch gap-1">
            {timesheets.map((ts) => (
              <button
                key={ts.id}
                type="button"
                aria-label={`Edit ${ts.hours}h entry for ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(ts);
                }}
                className="rounded-md border border-line bg-surface-2 px-2 py-1 text-left transition-colors duration-hover ease-out hover:bg-surface-3"
              >
                <span className="block text-[13px] font-semibold tabular-nums text-ink">
                  {ts.hours}h
                </span>
                {ts.project && (
                  <span className="block font-mono text-[11px] text-ink-2">
                    {ts.project.code}
                  </span>
                )}
                {ts.notes && (
                  <span className="block truncate text-[11px] text-ink-3">
                    {ts.notes}
                  </span>
                )}
              </button>
            ))}
            {timesheets.length > 1 && (
              <span className="text-[11px] font-medium tabular-nums text-ink-2">
                {totalHours}h total
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Add hours for ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdd(emp.id, day);
            }}
            className="mx-auto flex h-6 w-6 items-center justify-center rounded-md text-ink-3 transition-colors duration-hover ease-out hover:bg-surface-2 hover:text-ink"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        )}
      </Td>
    );
  };

  const monthDays = getMonthDays(currentWeek);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        subline="Hours booked against employees and projects. Select a day to log time."
        actions={
          <>
            <div
              role="group"
              aria-label="View mode"
              className="inline-flex rounded-md border border-line-2 bg-surface p-0.5"
            >
              {(['week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewMode === mode}
                  onClick={() => setViewMode(mode)}
                  className={`h-7 rounded-sm px-3 text-[13px] font-medium transition-colors duration-hover ease-out ${
                    viewMode === mode
                      ? 'bg-surface-3 text-ink'
                      : 'text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {mode === 'week' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingId(null);
                setShowForm(!showForm);
              }}
            >
              {showForm ? 'Cancel' : 'New entry'}
            </Button>
          </>
        }
      />

      {showForm && (
        <Card
          title={editingId ? 'Edit entry' : 'New entry'}
          description="Hours are recorded per person, per day, against an optional project."
        >
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {isElevated ? (
              <Select
                label="Employee"
                id="timesheet-employee"
                value={formData.employeeId}
                onChange={(e) =>
                  setFormData({ ...formData, employeeId: e.target.value })
                }
                required
              >
                <option value="">Select employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {employeeName(emp)}
                  </option>
                ))}
              </Select>
            ) : (
              // Self-only: employee field is locked to the signed-in user.
              <input type="hidden" value={ownEmployeeId} readOnly />
            )}

            <Select
              label="Project"
              id="timesheet-project"
              value={formData.projectId}
              onChange={(e) =>
                setFormData({ ...formData, projectId: e.target.value })
              }
              help="Optional. Leave as no project for general time."
            >
              {projectOptions}
            </Select>

            <Input
              label="Date"
              id="timesheet-date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              type="date"
              required
            />

            <Input
              label="Hours"
              id="timesheet-hours"
              value={formData.hours}
              onChange={(e) =>
                setFormData({ ...formData, hours: e.target.value })
              }
              type="number"
              step="0.5"
              placeholder="8"
              required
            />

            <Input
              label="Notes"
              id="timesheet-notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="What the time was spent on"
              wrapperClassName="sm:col-span-2"
            />

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit">
                {editingId ? 'Save changes' : 'Add entry'}
              </Button>
              {editingId && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="ml-auto"
                    onClick={() => setDeletingId(editingId)}
                  >
                    Delete entry
                  </Button>
                </>
              )}
            </div>
          </form>
        </Card>
      )}

      {viewMode === 'month' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-[520px]">
          <KpiTile
            label="Total hours"
            value={`${monthSummary?.totalHours ?? 0}h`}
            footnote={formatMonth(currentWeek)}
          />
          <KpiTile
            label="Days worked"
            value={monthSummary?.daysWorked ?? 0}
            footnote="Days with at least one entry"
          />
        </div>
      )}

      <Card
        flush
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold leading-snug text-ink">
            {rangeLabel}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={viewMode === 'week' ? previousWeek : previousMonth}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={viewMode === 'week' ? thisWeek : thisMonth}
            >
              {viewMode === 'week' ? 'This week' : 'This month'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={viewMode === 'week' ? nextWeek : nextMonth}
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-line px-5 py-4 sm:grid-cols-2">
          <Select
            label="Filter by employee"
            id="timesheet-filter-employee"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {employeeName(emp)}
              </option>
            ))}
          </Select>

          <Select
            label="Filter by project"
            id="timesheet-filter-project"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.code} - {proj.name}
              </option>
            ))}
          </Select>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<UsersIcon />}
              title="No employees found"
              body="Add employees before hours can be booked against them."
            />
          </div>
        ) : viewMode === 'week' ? (
          <Table className="min-w-[860px]">
            <thead>
              <tr>
                <Th>Employee</Th>
                {weekDays.map((day, i) => (
                  <Th key={i} className="min-w-[104px] text-center">
                    <span className="block">{WEEKDAYS[i]}</span>
                    <span className="mt-0.5 block font-mono font-normal normal-case tracking-normal text-ink-2">
                      {formatDate(day)}
                    </span>
                  </Th>
                ))}
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <Tr key={emp.id}>
                  <Td className="whitespace-nowrap font-medium text-ink">
                    {emp.firstName} {emp.lastName}
                  </Td>
                  {weekDays.map((day, i) => renderDayCell(emp, day, i))}
                  <Td className="text-right font-semibold tabular-nums text-ink">
                    {getTotalHours(emp.id)}h
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="sticky left-0 z-10 bg-surface">Employee</Th>
                {monthDays.map((day, i) => (
                  <Th key={i} className="min-w-[76px] text-center">
                    <span className="block font-normal text-ink-3">
                      {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <span className="mt-0.5 block text-[13px] tabular-nums text-ink-2">
                      {day.getDate()}
                    </span>
                  </Th>
                ))}
                <Th className="sticky right-0 z-10 bg-surface text-right">
                  Total
                </Th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <Tr key={emp.id}>
                  <Td className="sticky left-0 z-10 whitespace-nowrap bg-surface font-medium text-ink">
                    {emp.firstName} {emp.lastName}
                  </Td>
                  {monthDays.map((day, i) =>
                    renderDayCell(emp, day, `${emp.id}-${i}`),
                  )}
                  <Td className="sticky right-0 z-10 bg-surface text-right font-semibold tabular-nums text-ink">
                    {getTotalHoursForMonth(emp.id)}h
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog
        open={showQuickAdd}
        title="Add time entry"
        description={
          formData.date
            ? `Logging hours for ${new Date(formData.date).toLocaleDateString('en-GB')}.`
            : undefined
        }
        onClose={() => setShowQuickAdd(false)}
      >
        <div className="space-y-4">
          <Select
            label="Project"
            id="quick-add-project"
            value={formData.projectId}
            onChange={(e) =>
              setFormData({ ...formData, projectId: e.target.value })
            }
            help="Optional."
          >
            {projectOptions}
          </Select>

          <Input
            label="Hours"
            id="quick-add-hours"
            value={formData.hours}
            onChange={(e) =>
              setFormData({ ...formData, hours: e.target.value })
            }
            type="number"
            step="0.5"
            placeholder="8"
          />

          <Input
            label="Notes"
            id="quick-add-notes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Optional"
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowQuickAdd(false)}>
              Cancel
            </Button>
            <Button onClick={submitQuickAdd}>Add entry</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={deletingId !== null}
        title="Delete entry"
        description="This removes the hours from the timesheet. It cannot be undone."
        onClose={() => setDeletingId(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeletingId(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete entry
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
