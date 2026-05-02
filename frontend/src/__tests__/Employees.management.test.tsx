import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Employees from '../pages/Employees'
import Sidebar from '../components/Sidebar'
import ProtectedRoute from '../components/ProtectedRoute'
import * as api from '../lib/api'

let mockedUser: any = null

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    getCurrentUser: vi.fn(() => mockedUser),
  }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
  }
})

const makeToken = (payload: Record<string, unknown>) => `header.${btoa(JSON.stringify(payload))}.signature`
const setAuthToken = (payload: Record<string, unknown>) => {
  const token = makeToken(payload)
  ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
  return token
}

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
    consentCount: 1,
  },
]

const users = [
  {
    id: 10,
    email: 'sarah@6soft.co.uk',
    name: 'Sarah Patel',
    role: 'DIRECTOR',
    employeeId: 1,
    employee: { id: 1, firstName: 'Sarah', lastName: 'Patel', jobTitle: 'Operations Director' },
  },
]

function mockApiLists() {
  ;(api.apiGet as any).mockImplementation((endpoint: string) => {
    if (endpoint === '/employees') return Promise.resolve(employees)
    if (endpoint === '/auth/users') return Promise.resolve(users)
    return Promise.resolve([])
  })
}

describe('Unified user and employee management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUser = null
    localStorage.clear()
    ;(localStorage.getItem as any).mockReturnValue(null)
    mockApiLists()
  })

  it('normalizes legacy manager role for protected routes', () => {
    mockedUser = { role: 'MANAGER', email: 'manager@6soft.co.uk' }
    setAuthToken({ role: 'MANAGER', email: 'manager@6soft.co.uk' })

    render(
      <ProtectedRoute allowedRoles={['DIRECTOR']}>
        <div>Director area</div>
      </ProtectedRoute>,
    )

    expect(screen.getByText('Director area')).toBeInTheDocument()
  })

  it('shows one user employee management nav item and no users route link for directors', () => {
    mockedUser = { role: 'MANAGER', email: 'director@6soft.co.uk' }

    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    )

    expect(screen.getByText('User/Employee Management')).toBeInTheDocument()
    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /user management/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /user\/employee management/i })).toHaveAttribute('href', '/employees')
  })

  it('loads employees and user accounts together for admins', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' }

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'User/Employee Management' })

    expect(api.apiGet).toHaveBeenCalledWith('/employees')
    expect(api.apiGet).toHaveBeenCalledWith('/auth/users')
    expect(screen.getAllByText('Sarah Patel').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DIRECTOR').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /create account for Owen Reed/i })).toBeInTheDocument()
  })

  it('creates and links an employee account from the unified screen', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@6soft.co.uk' }
    ;(api.apiPost as any).mockResolvedValue({ ok: true })
    ;(api.apiPut as any).mockResolvedValue({ ok: true })
    let usersRequestCount = 0
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/employees') return Promise.resolve(employees)
      if (endpoint === '/auth/users') {
        usersRequestCount += 1
        if (usersRequestCount === 1) return Promise.resolve(users)
        return Promise.resolve([...users, { id: 11, email: 'owen@6soft.co.uk', name: 'Owen Reed', role: 'EMPLOYEE' }])
      }
      return Promise.resolve([])
    })
    vi.spyOn(window, 'prompt').mockReturnValue('Temp-123abc!456')

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /create account for Owen Reed/i }))

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
        email: 'owen@6soft.co.uk',
        name: 'Owen Reed',
        password: 'Temp-123abc!456',
        role: 'EMPLOYEE',
      }))
      expect(api.apiPut).toHaveBeenCalledWith('/auth/users/11', expect.objectContaining({
        employeeId: 2,
        role: 'EMPLOYEE',
      }))
    })
  })

  it('limits director role assignment to non-admin roles', async () => {
    mockedUser = { role: 'DIRECTOR', email: 'director@6soft.co.uk' }

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /edit account for Sarah Patel/i }))

    const roleSelect = await screen.findByLabelText(/Access Role/i)
    expect(within(roleSelect).queryByRole('option', { name: /Administrator/i })).not.toBeInTheDocument()
    expect(within(roleSelect).getByRole('option', { name: /Director/i })).toBeInTheDocument()
    expect(within(roleSelect).getByRole('option', { name: /Office Assistant/i })).toBeInTheDocument()
    expect(within(roleSelect).getByRole('option', { name: /Employee/i })).toBeInTheDocument()
  })

  it('keeps office assistant view read-only and hides sensitive fields', async () => {
    mockedUser = { role: 'OFFICE_ASSISTANT', email: 'assistant@6soft.co.uk' }

    render(
      <MemoryRouter>
        <Employees />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Patel').length).toBeGreaterThan(0)
    })

    expect(screen.queryByText(/QQ123456C/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Example Bank/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
  })
})
