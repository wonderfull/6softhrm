import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
  // Timesheet fixtures must fall in the current month: the dashboard's
  // overtime card only counts "this month", so fixed dates rot as time passes.
  const isoInCurrentMonth = (day: number) => {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), day)).toISOString()
  }

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
      if (endpoint === '/leave/balance') return Promise.resolve({
        leaveYear: { start: '2026-04-06', end: '2027-04-05', label: '6 Apr 2026 to 5 Apr 2027' },
        allowance: 28,
        prorated: 26,
        carriedOver: 2,
        used: 9.5,
        pending: 1,
        remaining: 18.5,
      })
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
        { id: 1, employeeId: 42, date: isoInCurrentMonth(1), hours: 9.5 },
        { id: 2, employeeId: 42, date: isoInCurrentMonth(2), hours: 8 },
      ])
      return Promise.resolve([])
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('My summary')).toBeInTheDocument()
    expect(await screen.findByText('18.5 days remaining')).toBeInTheDocument()
    expect(screen.getByText('9.5 days approved')).toBeInTheDocument()
    expect(screen.getByText('28 days allowance · 2 carried over · 6 Apr 2026 to 5 Apr 2027')).toBeInTheDocument()
    expect(screen.getByText('1 pending request')).toBeInTheDocument()
    expect(screen.getByText(/Next up/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Overtime' }))
    expect(screen.getByText('1.5 overtime hours this month')).toBeInTheDocument()
    expect(screen.getByText('17.5 total hours recorded')).toBeInTheDocument()
  })

  it('shows a linked director their own employee summary without counting other employees', async () => {
    const token = makeToken({ role: 'DIRECTOR', email: 'director@example.com', employeeId: 42 })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/leave/balance') return Promise.resolve({
        leaveYear: { start: '2026-04-06', end: '2027-04-05', label: '6 Apr 2026 to 5 Apr 2027' },
        allowance: 28,
        prorated: 28,
        carriedOver: 0,
        used: 2,
        pending: 0,
        remaining: 26,
      })
      if (endpoint === '/reports/summary') return Promise.resolve({
        headcount: { active: 7, starters30d: 0, leavers30d: 0, byDepartment: [] },
        leave: { pending: 1 },
        timesheets: { monthStart: '2026-09-01', hours: 22, entries: 3, byProject: [] },
        readiness: null,
      })
      if (endpoint === '/employees') return Promise.resolve([{ id: 42 }, { id: 99 }])
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
          endDate: '2026-05-11T00:00:00.000Z',
          status: 'APPROVED',
        },
        {
          id: 2,
          employeeId: 99,
          type: 'Annual Leave',
          startDate: '2026-05-12T00:00:00.000Z',
          endDate: '2026-05-16T00:00:00.000Z',
          status: 'APPROVED',
        },
      ])
      if (endpoint === '/timesheets') return Promise.resolve([
        { id: 1, employeeId: 42, date: isoInCurrentMonth(1), hours: 10 },
        { id: 2, employeeId: 99, date: isoInCurrentMonth(1), hours: 12 },
      ])
      return Promise.resolve([])
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('My summary')).toBeInTheDocument()
    const headcountTile = screen.getByText('Active Headcount').closest('a') as HTMLElement
    expect(within(headcountTile).getByText('7')).toBeInTheDocument()
    expect(await screen.findByText('26 days remaining')).toBeInTheDocument()
    expect(screen.getByText('2 days approved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Overtime' }))
    expect(screen.getByText('2 overtime hours this month')).toBeInTheDocument()
    expect(screen.getByText('10 total hours recorded')).toBeInTheDocument()
  })
  it('says the balance is unavailable when the leave balance cannot be read', async () => {
    const token = makeToken({ role: 'EMPLOYEE', email: 'employee@example.com', employeeId: 42 })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((endpoint: string) =>
      endpoint === '/leave/balance' ? Promise.reject(new Error('nope')) : Promise.resolve([]),
    )

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('Balance unavailable')).toBeInTheDocument()
  })

  it('shows the audit readiness tile and its penalty breakdown', async () => {
    const token = makeToken({ role: 'ADMIN', email: 'admin@example.com' })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((path: string) =>
      path === '/sponsorships/audit-readiness'
        ? Promise.resolve({
            score: 62,
            band: 'AT_RISK',
            evidenceCompleteness: 80,
            activeSponsorships: 3,
            components: [
              { key: 'salaryFailures', label: 'Pay periods below the CoS salary', count: 2, penalty: 20 },
            ],
            guidance: { sponsorGuidancePart3: '05/26', appendixD: '08/26' },
          })
        : Promise.resolve([]),
    )

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('62')).toBeInTheDocument()
    expect(screen.getByText(/AT RISK/)).toBeInTheDocument()
    expect(screen.getByText('Pay periods below the CoS salary')).toBeInTheDocument()
    expect(screen.getByText(/3 sponsored workers/)).toBeInTheDocument()
  })

  it('takes the admin statistics from the reporting summary and links them to /reports', async () => {
    const token = makeToken({ role: 'ADMIN', email: 'admin@example.com' })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/reports/summary') return Promise.resolve({
        generatedAt: '2026-09-04T09:00:00.000Z',
        headcount: { active: 42, starters30d: 3, leavers30d: 1, byDepartment: [] },
        leave: {
          leaveYear: { start: '2026-04-06', end: '2027-04-05', label: '6 Apr 2026 to 5 Apr 2027' },
          pending: 5,
          annualUsed: 0,
          sickUsed: 0,
          sickByDepartment: [],
        },
        expiries: { buckets: [30, 60, 90], total: 0, overdue: 0, byKind: [] },
        timesheets: { monthStart: '2026-09-01', hours: 320.5, entries: 48, byProject: [] },
        readiness: null,
      })
      return Promise.resolve([])
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('3 / 1')).toBeInTheDocument()
    expect(screen.getByText('320.5')).toBeInTheDocument()

    const pendingTile = screen.getByText('Pending Leave').closest('a') as HTMLElement
    expect(pendingTile).toHaveAttribute('href', '/reports')
    expect(within(pendingTile).getByText('5')).toBeInTheDocument()

    // The four-collection fan-out is what the summary replaced.
    expect(api.apiGet).not.toHaveBeenCalledWith('/employees')
    expect(api.apiGet).not.toHaveBeenCalledWith('/projects')
    expect(api.apiGet).not.toHaveBeenCalledWith('/documents')
  })

  // A tenant without the compliance feature gets a 403; the rest of the
  // dashboard must still render.
  it('hides the readiness tile when the compliance feature is off', async () => {
    const token = makeToken({ role: 'ADMIN', email: 'admin@example.com' })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(api.apiGet as any).mockImplementation((path: string) =>
      path === '/sponsorships/audit-readiness'
        ? Promise.reject(new Error('FEATURE_NOT_AVAILABLE'))
        : Promise.resolve([]),
    )

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(await screen.findByText('Active Headcount')).toBeInTheDocument()
    expect(screen.queryByText(/audit readiness/i)).not.toBeInTheDocument()
  })

})
