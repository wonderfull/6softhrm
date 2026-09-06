import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Employees from '../pages/Employees';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../components/ProtectedRoute';
import * as api from '../lib/api';

let mockedUser: any = null;

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    getCurrentUser: vi.fn(() => mockedUser),
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate">{to}</div>
    ),
  };
});

const makeToken = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;
const setAuthToken = (payload: Record<string, unknown>) => {
  const token = makeToken(payload);
  (localStorage.getItem as any).mockImplementation((key: string) =>
    key === 'token' ? token : null,
  );
  return token;
};

const employees = [
  {
    id: 1,
    firstName: 'Sarah',
    lastName: 'Patel',
    email: 'sarah@6soft.co.uk',
    department: 'Operations',
    jobTitle: 'Operations Director',
    employeeType: 'DIRECTOR',
    niNumber: 'QQ123456C',
    bankName: 'Example Bank',
    sortCode: '12-34-56',
    startDate: '2024-02-01T00:00:00.000Z',
    consentCount: 4,
  },
  {
    id: 2,
    firstName: 'Owen',
    lastName: 'Reed',
    email: 'owen@6soft.co.uk',
    department: 'Support',
    jobTitle: 'Office Assistant',
    employeeType: 'EMPLOYEE',
    managerId: 1,
    consentCount: 1,
  },
];

const users = [
  {
    id: 10,
    email: 'sarah@6soft.co.uk',
    name: 'Sarah Patel',
    role: 'DIRECTOR',
    employeeId: 1,
    employee: {
      id: 1,
      firstName: 'Sarah',
      lastName: 'Patel',
      jobTitle: 'Operations Director',
    },
  },
];

function mockApiLists() {
  (api.apiGet as any).mockImplementation((endpoint: string) => {
    if (endpoint === '/employees') return Promise.resolve(employees);
    if (endpoint === '/auth/users') return Promise.resolve(users);
    return Promise.resolve([]);
  });
}

/** Row select, then "Open full record", where the record's actions now live. */
async function openFullRecord(name: RegExp) {
  fireEvent.click(await screen.findByRole('row', { name }));
  fireEvent.click(
    await screen.findByRole('button', { name: /open full record/i }),
  );
}

describe('Unified user and employee management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser = null;
    localStorage.clear();
    (localStorage.getItem as any).mockReturnValue(null);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockApiLists();
  });

  it('normalizes legacy manager role for protected routes', () => {
    mockedUser = { role: 'MANAGER', email: 'manager@6soft.co.uk' };
    setAuthToken({ role: 'MANAGER', email: 'manager@6soft.co.uk' });

    render(
      <ProtectedRoute allowedRoles={['DIRECTOR']}>
        <div>Director area</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Director area')).toBeInTheDocument();
  });

  it('shows one user employee management nav item and no users route link for directors', () => {
    mockedUser = { role: 'MANAGER', email: 'director@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText('User/Employee Management')).toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /user management/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /user\/employee management/i }),
    ).toHaveAttribute('href', '/employees');
  });

  it('shows employee self-service consent for linked directors', () => {
    mockedUser = {
      role: 'DIRECTOR',
      email: 'director@6soft.co.uk',
      employeeId: 1,
    };

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /my consent/i })).toHaveAttribute(
      'href',
      '/consent',
    );
  });

  it('loads employees and user accounts together for admins', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'User/Employee Management' });

    expect(api.apiGet).toHaveBeenCalledWith('/employees');
    expect(api.apiGet).toHaveBeenCalledWith('/auth/users');
    expect(screen.getAllByText('Sarah Patel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DIRECTOR').length).toBeGreaterThan(0);
    // The row with no login says so, and its account column reads "Missing".
    const owenRow = await screen.findByRole('row', { name: /Owen Reed/ });
    expect(within(owenRow).getByText('NO LOGIN')).toBeInTheDocument();
    expect(within(owenRow).getByText('Missing')).toBeInTheDocument();
  });

  it('summarises the roll in the KPI row', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    const totals = await screen.findByText('Total people');
    expect(totals.parentElement).toHaveTextContent('2');
    expect(screen.getByText('Active logins').parentElement).toHaveTextContent(
      '1',
    );
    expect(screen.getByText('Missing login').parentElement).toHaveTextContent(
      '1',
    );
    // Owen has 1 of 7 consents, Sarah has 4, so one gap.
    expect(screen.getByText('Consent gaps').parentElement).toHaveTextContent(
      '1',
    );
    expect(screen.getAllByText('Action needed').length).toBe(2);
  });

  it('fills the detail panel from the selected row', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    // The first record is selected on load.
    const panel = await screen.findByRole('complementary', {
      name: /details for sarah patel/i,
    });
    expect(within(panel).getByText('sarah@6soft.co.uk')).toBeInTheDocument();
    expect(within(panel).getByText('1 Feb 2024')).toBeInTheDocument();
    expect(within(panel).getByText('Owen Reed')).toBeInTheDocument();
    expect(within(panel).getByText('4/7 consents')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /Owen Reed/ }));

    const owenPanel = await screen.findByRole('complementary', {
      name: /details for owen reed/i,
    });
    expect(within(owenPanel).getByText('owen@6soft.co.uk')).toBeInTheDocument();
    expect(within(owenPanel).getByText('Sarah Patel')).toBeInTheDocument();
    expect(within(owenPanel).getByText('1/7 consents')).toBeInTheDocument();
  });

  it('filters the list from the ?q= search term and from the search box', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };

    render(
      <MemoryRouter initialEntries={['/employees?q=owen']}>
        <Employees />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('owen')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    expect(
      screen.queryByRole('row', { name: /Sarah Patel/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search people'), {
      target: { value: 'operations' },
    });
    expect(
      await screen.findByRole('row', { name: /Sarah Patel/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search people'), {
      target: { value: 'nobody here' },
    });
    expect(await screen.findByText('No matches')).toBeInTheDocument();
  });

  it('offers to add the first person when there are none', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };
    (api.apiGet as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    expect(await screen.findByText('No people yet')).toBeInTheDocument();
    expect(screen.getByText('No employee records found.')).toBeInTheDocument();
  });

  it('lets employees update their own profile details', async () => {
    mockedUser = {
      role: 'EMPLOYEE',
      email: 'sarah@6soft.co.uk',
      employeeId: 1,
    };
    (api.apiPut as any).mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: 'My profile' }),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: /update profile/i }),
    );

    expect(
      screen.getByRole('heading', { name: 'Update profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Basic details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Address details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Emergency contact' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Bank details' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Salary details' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Sensitive details' }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Mobile number/i), {
      target: { value: '07123456789' },
    });
    fireEvent.change(screen.getByLabelText(/Address 1/i), {
      target: { value: '10 Updated Street' },
    });
    fireEvent.change(screen.getByLabelText(/Contact name/i), {
      target: { value: 'Trusted Contact' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(api.apiPut).toHaveBeenCalledWith(
        '/employees/1',
        expect.objectContaining({
          phoneNumber: '07123456789',
          address1: '10 Updated Street',
          emergencyContactName: 'Trusted Contact',
        }),
      );
    });
  });

  it('creates and links an employee account from the full record', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };
    (api.apiPost as any).mockResolvedValue({ ok: true });
    (api.apiPut as any).mockResolvedValue({ ok: true });
    let usersRequestCount = 0;
    (api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/employees') return Promise.resolve(employees);
      if (endpoint === '/auth/users') {
        usersRequestCount += 1;
        if (usersRequestCount === 1) return Promise.resolve(users);
        return Promise.resolve([
          ...users,
          {
            id: 11,
            email: 'owen@6soft.co.uk',
            name: 'Owen Reed',
            role: 'EMPLOYEE',
          },
        ]);
      }
      return Promise.resolve([]);
    });
    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await openFullRecord(/Owen Reed/);
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: /create account for Owen Reed/i,
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'New account' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/temporary password is used for their first login/i),
    ).toBeInTheDocument();
    expect(api.apiPost).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Temporary password/i), {
      target: { value: 'Temp-123abc!456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith(
        '/auth/register',
        expect.objectContaining({
          email: 'owen@6soft.co.uk',
          name: 'Owen Reed',
          password: 'Temp-123abc!456',
          role: 'EMPLOYEE',
        }),
      );
      expect(api.apiPut).toHaveBeenCalledWith(
        '/auth/users/11',
        expect.objectContaining({
          employeeId: 2,
          role: 'EMPLOYEE',
        }),
      );
    });
  });

  it('opens the account form when editing an existing login from the full record', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await openFullRecord(/Sarah Patel/);
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: /edit account for Sarah Patel/i,
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Edit account' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('sarah@6soft.co.uk')).toBeInTheDocument();
    expect(
      screen.getByText(/update login access, role, employee self-service/i),
    ).toBeInTheDocument();
  });

  it('uses the same sectioned HR details flow for adding employees', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };
    (api.apiPost as any).mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /add person/i }));

    expect(
      screen.getByRole('heading', { name: 'Add employee' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Basic details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Address details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Emergency contact' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Bank details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Salary details' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sensitive details' }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First name/i), {
      target: { value: 'Jack' },
    });
    fireEvent.change(screen.getByLabelText(/Last name/i), {
      target: { value: 'Johnson' },
    });
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: 'jack.johnson@6soft.co.uk' },
    });
    fireEvent.change(screen.getByLabelText(/^Job title/i), {
      target: { value: 'Software Engineer' },
    });
    fireEvent.change(screen.getByLabelText(/Employment start date/i), {
      target: { value: '2026-05-03' },
    });
    fireEvent.change(screen.getByLabelText(/Address 1/i), {
      target: { value: '1 High Street' },
    });
    fireEvent.change(screen.getByLabelText(/Postcode/i), {
      target: { value: 'SW1A 1AA' },
    });
    fireEvent.change(screen.getByLabelText(/Name on account/i), {
      target: { value: 'Jack Johnson' },
    });
    fireEvent.change(screen.getByLabelText(/Account number/i), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText(/^Salary/i), {
      target: { value: '45000' },
    });
    fireEvent.change(screen.getByLabelText(/NI number/i), {
      target: { value: 'QQ123456C' },
    });
    fireEvent.change(screen.getByLabelText(/Visa expiry date/i), {
      target: { value: '2027-05-03' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith(
        '/employees',
        expect.objectContaining({
          firstName: 'Jack',
          lastName: 'Johnson',
          email: 'jack.johnson@6soft.co.uk',
          jobTitle: 'Software Engineer',
          startDate: '2026-05-03',
          address1: '1 High Street',
          postcode: 'SW1A 1AA',
          accountName: 'Jack Johnson',
          accountNumber: '12345678',
          salary: '45000',
          niNumber: 'QQ123456C',
          visaExpiryDate: '2027-05-03',
        }),
      );
    });
  });

  it('limits director role assignment to non-admin roles', async () => {
    mockedUser = { role: 'DIRECTOR', email: 'director@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await openFullRecord(/Sarah Patel/);
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: /edit account for Sarah Patel/i,
      }),
    );

    const roleSelect = await screen.findByLabelText(/Access role/i);
    expect(
      within(roleSelect).queryByRole('option', { name: /Administrator/i }),
    ).not.toBeInTheDocument();
    expect(
      within(roleSelect).getByRole('option', { name: /Director \+ Employee/i }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).getByRole('option', {
        name: /Office Assistant \+ Employee/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(roleSelect).getByRole('option', { name: /^Employee$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /employee self-service/i }),
    ).toBeChecked();
    expect(
      screen.getByText(/Leave unchecked for Director access only/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: /employee self-service/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /update account/i }));

    await waitFor(() => {
      expect(api.apiPut).toHaveBeenCalledWith(
        '/auth/users/10',
        expect.objectContaining({
          role: 'DIRECTOR',
          employeeId: null,
        }),
      );
    });
  });

  it('confirms before deleting an employee record', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' };
    (api.apiDelete as any).mockResolvedValue({ ok: true });

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await openFullRecord(/Owen Reed/);
    fireEvent.click(
      await screen.findByRole('button', {
        name: /delete employee record for Owen Reed/i,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: /delete this employee record\?/i,
      }),
    ).toBeInTheDocument();
    expect(api.apiDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete record' }));
    await waitFor(() =>
      expect(api.apiDelete).toHaveBeenCalledWith('/employees/2'),
    );
  });

  it('keeps office assistant view read-only and hides sensitive fields', async () => {
    mockedUser = { role: 'OFFICE_ASSISTANT', email: 'assistant@6soft.co.uk' };

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Patel').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/QQ123456C/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Example Bank/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create account/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add person/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^edit$/i }),
    ).not.toBeInTheDocument();

    // Even in the full record, nothing sensitive and nothing to change.
    fireEvent.click(
      await screen.findByRole('button', { name: /open full record/i }),
    );
    expect(
      await screen.findByRole('dialog', {
        name: /full record for Sarah Patel/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/QQ123456C/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Example Bank/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Account' }));
    expect(await screen.findByText('No linked account.')).toBeInTheDocument();
  });
});
