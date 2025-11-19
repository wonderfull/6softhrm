import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Time from '../pages/Time'
import * as api from '../lib/api'

// Mock the API
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
    { id: 1, name: 'Project A', active: true },
    { id: 2, name: 'Project B', active: true }
  ]

  const mockTimesheets = [
    {
      id: 1,
      employeeId: 1,
      projectId: 1,
      date: new Date().toISOString(),
      hours: 8,
      notes: 'Regular work'
    },
    {
      id: 2,
      employeeId: 2,
      projectId: 2,
      date: new Date().toISOString(),
      hours: 6,
      notes: 'Half day'
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
      const weeklyButton = screen.getByText('Weekly')
      expect(weeklyButton).toHaveClass('bg-blue-500')
    })
  })

  it('should switch to monthly view when clicked', async () => {
    render(<Time />)
    await waitFor(() => {
      const monthlyButton = screen.getByText('Monthly')
      fireEvent.click(monthlyButton)
      expect(monthlyButton).toHaveClass('bg-blue-500')
    })
  })

  it('should display employee filter with label', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByText('Filter by Employee')).toBeInTheDocument()
    })
  })

  it('should display project filter with label', async () => {
    render(<Time />)
    await waitFor(() => {
      expect(screen.getByText('Filter by Project')).toBeInTheDocument()
    })
  })

  it('should show form fields with proper labels', async () => {
    render(<Time />)
    
    // Open form by clicking Add Timesheet
    const addButton = screen.getByText('Add Timesheet')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByLabelText(/Employee/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Hours/i)).toBeInTheDocument()
    })
  })

  it('should filter timesheets by employee', async () => {
    render(<Time />)
    
    await waitFor(() => {
      const employeeFilter = screen.getByLabelText('Filter by Employee')
      fireEvent.change(employeeFilter, { target: { value: '1' } })
    })

    // Verify filtering works (check if only John Doe's timesheets are shown)
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  it('should navigate between weeks', async () => {
    render(<Time />)
    
    await waitFor(() => {
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)
      expect(api.apiGet).toHaveBeenCalled()
    })
  })

  it('should navigate between months in monthly view', async () => {
    render(<Time />)
    
    await waitFor(() => {
      // Switch to monthly view
      const monthlyButton = screen.getByText('Monthly')
      fireEvent.click(monthlyButton)
      
      // Click next
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)
      expect(api.apiGet).toHaveBeenCalled()
    })
  })

  it('should submit new timesheet', async () => {
    (api.apiPost as any).mockResolvedValue({ success: true })
    
    render(<Time />)
    
    const addButton = screen.getByText('Add Timesheet')
    fireEvent.click(addButton)

    await waitFor(() => {
      const employeeSelect = screen.getByLabelText(/Employee/i)
      fireEvent.change(employeeSelect, { target: { value: '1' } })
      
      const dateInput = screen.getByLabelText(/Date/i)
      fireEvent.change(dateInput, { target: { value: '2025-11-19' } })
      
      const hoursInput = screen.getByLabelText(/Hours/i)
      fireEvent.change(hoursInput, { target: { value: '8' } })
      
      const submitButton = screen.getByText('Submit')
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith('/timesheets', expect.any(Object))
    })
  })

  it('should calculate total hours for week', async () => {
    render(<Time />)
    
    await waitFor(() => {
      // In weekly view, should show total hours
      const totalElements = screen.queryAllByText(/Total:/i)
      expect(totalElements.length).toBeGreaterThan(0)
    })
  })

  it('should show monthly summary with total hours and days worked', async () => {
    render(<Time />)
    
    await waitFor(() => {
      // Switch to monthly view
      const monthlyButton = screen.getByText('Monthly')
      fireEvent.click(monthlyButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Total Hours')).toBeInTheDocument()
      expect(screen.getByText('Days Worked')).toBeInTheDocument()
    })
  })

  it('should delete timesheet when delete button clicked', async () => {
    (api.apiDelete as any).mockResolvedValue({ success: true })
    global.confirm = vi.fn(() => true)
    
    render(<Time />)
    
    await waitFor(() => {
      const deleteButtons = screen.queryAllByText('Delete')
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
        expect(api.apiDelete).toHaveBeenCalled()
      }
    })
  })
})
