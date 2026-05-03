import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'
import * as api from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

describe('Dashboard Page', () => {
  const makeToken = (payload: Record<string, unknown>) => `header.${btoa(JSON.stringify(payload))}.signature`

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows today date on the logged-in dashboard', async () => {
    const token = makeToken({ role: 'ADMIN', email: 'admin@example.com' })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockResolvedValue([])

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    const today = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    expect(await screen.findByText(today)).toBeInTheDocument()
  })

  it('shows employee leave and overtime summary', async () => {
    const token = makeToken({ role: 'EMPLOYEE', email: 'employee@example.com', employeeId: 42 })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/employees') return Promise.resolve([{ id: 42, firstName: 'Employee', lastName: 'User' }])
      if (endpoint === '/projects') return Promise.resolve([])
      if (endpoint === '/documents') return Promise.resolve([])
      if (endpoint === '/documents/expiring') return Promise.resolve([])
      if (endpoint === '/sponsorships/expiring') return Promise.resolve([])
      if (endpoint === '/leave') return Promise.resolve([
        {
          id: 1,
          employeeId: 42,
          type: 'Annual Leave',
          startDate: '2026-05-10T00:00:00.000Z',
          endDate: '2026-05-12T00:00:00.000Z',
          status: 'APPROVED',
        },
        {
          id: 2,
          employeeId: 42,
          type: 'Annual Leave',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-01T00:00:00.000Z',
          status: 'PENDING',
        },
      ])
      if (endpoint === '/timesheets') return Promise.resolve([
        { id: 1, employeeId: 42, date: '2026-05-01T00:00:00.000Z', hours: 9.5 },
        { id: 2, employeeId: 42, date: '2026-05-02T00:00:00.000Z', hours: 8 },
      ])
      return Promise.resolve([])
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('My summary')).toBeInTheDocument()
    expect(screen.getByText('25 days remaining')).toBeInTheDocument()
    expect(screen.getByText('3 days approved')).toBeInTheDocument()
    expect(screen.getByText('1 pending request')).toBeInTheDocument()
    expect(screen.getByText(/Next up/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Overtime' }))
    expect(screen.getByText('1.5 overtime hours this month')).toBeInTheDocument()
    expect(screen.getByText('17.5 total hours recorded')).toBeInTheDocument()
  })
})
