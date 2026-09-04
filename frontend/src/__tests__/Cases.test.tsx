import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Cases from '../pages/Cases';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
  };
});

const EMPLOYEES = [
  { id: 5, firstName: 'Ella', lastName: 'Ng' },
  { id: 7, firstName: 'Sam', lastName: 'Okoro' },
];

const OPEN_CASE = {
  id: 1,
  employeeId: 5,
  type: 'GRIEVANCE',
  openedAt: '2026-08-20T00:00:00.000Z',
  stage: 'INVESTIGATION',
  outcome: null,
  notes: 'Raised at a one to one',
  closedAt: null,
  employee: { id: 5, firstName: 'Ella', lastName: 'Ng', department: 'Care' },
};

function mockApi(cases: any[]) {
  (api.apiGet as any).mockImplementation((path: string) =>
    path === '/cases'
      ? Promise.resolve(cases)
      : Promise.resolve(path === '/employees' ? EMPLOYEES : []),
  );
}

const renderCases = () =>
  render(
    <MemoryRouter>
      <Cases />
    </MemoryRouter>,
  );

describe('Cases page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi([]);
  });

  it('lists open cases and says how confidential they are', async () => {
    mockApi([OPEN_CASE]);
    renderCases();

    expect(await screen.findByText('Ella Ng')).toBeInTheDocument();
    expect(
      screen.getByText(/Grievance · opened 20\/08\/2026/),
    ).toBeInTheDocument();
    expect(screen.getByText('Open · Investigation')).toBeInTheDocument();
    expect(screen.getByText(/Strictly confidential/)).toBeInTheDocument();
    expect(api.apiGet).toHaveBeenCalledWith('/cases', { open: 1 });
  });

  it('opens a case against an employee', async () => {
    (api.apiPost as any).mockResolvedValue({ ...OPEN_CASE, id: 2 });
    const user = userEvent.setup();
    renderCases();

    await user.click(
      await screen.findByRole('button', { name: /Open a case/ }),
    );
    await user.selectOptions(screen.getByLabelText(/Employee/), '7');
    await user.selectOptions(screen.getByLabelText(/Type/), 'DISCIPLINARY');
    fireEvent.change(screen.getByLabelText(/Opened/), {
      target: { value: '2026-09-01' },
    });
    await user.selectOptions(screen.getByLabelText(/Stage/), 'INVESTIGATION');
    await user.click(screen.getByRole('button', { name: 'Open case' }));

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith('/cases', {
        employeeId: 7,
        type: 'DISCIPLINARY',
        openedAt: '2026-09-01',
        stage: 'INVESTIGATION',
        outcome: undefined,
        notes: undefined,
      }),
    );
  });

  it('records an outcome and closes the case', async () => {
    mockApi([OPEN_CASE]);
    (api.apiPut as any).mockResolvedValue({
      ...OPEN_CASE,
      stage: 'CLOSED',
      outcome: 'Grievance not upheld',
      closedAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    renderCases();

    await screen.findByText('Ella Ng');
    await user.type(screen.getByLabelText('Outcome'), 'Grievance not upheld');
    await user.click(screen.getByRole('button', { name: 'Close case' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/cases/1', {
        outcome: 'Grievance not upheld',
        notes: 'Raised at a one to one',
        closed: true,
      }),
    );
    expect(await screen.findByText('Closed 04/09/2026')).toBeInTheDocument();
  });
});
