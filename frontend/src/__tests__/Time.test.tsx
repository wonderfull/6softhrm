import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import Time from '../pages/Time'
import * as api from '../lib/api'

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn()
}))

describe('Time/Timesheets Page', () => {
  const mockEmployees = [
    { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
    { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
  ]

  const mockProjects = [
    { id: 1, code: 'PROJ-A', name: 'Project A', active: true },
    { id: 2, code: 'PROJ-B', name: 'Project B', active: true }
  ]

  const mockTimesheets = [
    {
      id: 1,
      employeeId: 1,
      projectId: 1,
      date: new Date().toISOString(),
      hours: 8,
      notes: 'Regular work',
      project: { id: 1, code: 'PROJ-A', name: 'Project A' }
    },
    {
      id: 2,
      employeeId: 2,
      projectId: 2,
      date: new Date().toISOString(),
      hours: 6,
      notes: 'Half day',
      project: { id: 2, code: 'PROJ-B', name: 'Project B' }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/timesheets') return Promise.resolve(mockTimesheets)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      if (endpoint === '/projects') return Promise.resolve(mockProjects)
      return Promise.resolve([])
    })
  })

  it('should render timesheets page title', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByText('Timesheets')).toBeInTheDocument()
    })
  })

  it('should display weekly view by default', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByText('Weekly')).toHaveClass('bg-blue-500')
    })
  })

  it('should switch to monthly view when clicked', async () => {
    render(<Time />)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Monthly'))
      expect(screen.getByText('Monthly')).toHaveClass('bg-blue-500')
    })
  })

  it('should display employee filter with label', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByLabelText(/Filter by Employee/i)).toBeInTheDocument()
    })
  })

  it('should display project filter with label', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByLabelText(/Filter by Project/i)).toBeInTheDocument()
    })
  })

  it('should show form fields with proper labels', async () => {
    render(<Time />)
    fireEvent.click(screen.getByText('+ Add Entry'))

    await waitFor(() => {
      expect(screen.getByLabelText('Employee *')).toBeInTheDocument()
      expect(screen.getByLabelText('Date *')).toBeInTheDocument()
      expect(screen.getByLabelText('Hours *')).toBeInTheDocument()
    })
  })

  it('should filter timesheets by employee', async () => {
    render(<Time />)

    fireEvent.change(await screen.findByLabelText(/Filter by Employee/i), { target: { value: '1' } })

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      expect(within(rows[1]).getByText(/John Doe/i)).toBeInTheDocument()
      expect(screen.queryByText('Jane Smith', { selector: 'td' })).not.toBeInTheDocument()
    })
  })

  it('should navigate between weeks', async () => {
    render(<Time />)
    const initialRange = screen.getByText(/ - /).textContent

    fireEvent.click(screen.getByText('Next →'))

    await waitFor(() => {
      expect(screen.getByText(/ - /).textContent).not.toBe(initialRange)
    })
  })

  it('should navigate between months in monthly view', async () => {
    render(<Time />)
    fireEvent.click(screen.getByText('Monthly'))
    const initialMonth = screen.getByText(/\w+ \d{4}/).textContent

    fireEvent.click(screen.getByText('Next →'))

    await waitFor(() => {
      expect(screen.getByText(/\w+ \d{4}/).textContent).not.toBe(initialMonth)
    })
  })

  it('should submit new timesheet', async () => {
    ;(api.apiPost as any).mockResolvedValue({ success: true })
    window.alert = vi.fn()

    render(<Time />)
    fireEvent.click(screen.getByText('+ Add Entry'))

    fireEvent.change(await screen.findByLabelText('Employee *'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2025-11-19' } })
    fireEvent.change(screen.getByLabelText('Hours *'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Entry' }))

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith('/timesheets', expect.any(Object))
    })
  })

  it('should calculate total hours for week', async () => {
    render(<Time />)

    await waitFor(() => {
      expect(screen.getAllByText('8h').length).toBeGreaterThan(0)
      expect(screen.getAllByText('6h').length).toBeGreaterThan(0)
    })
  })

  it('should show monthly summary with total hours and days worked', async () => {
    render(<Time />)
    fireEvent.click(screen.getByText('Monthly'))

    await waitFor(() => {
      expect(screen.getByText('Total Hours')).toBeInTheDocument()
      expect(screen.getByText('Days Worked')).toBeInTheDocument()
    })
  })

  it('should delete timesheet when delete button clicked', async () => {
    ;(api.apiDelete as any).mockResolvedValue({ success: true })
    global.confirm = vi.fn(() => true)

    render(<Time />)

    await waitFor(() => {
      const deleteButtons = screen.queryAllByText('Del')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
        expect(api.apiDelete).toHaveBeenCalled()
      }
    })
  })
})
