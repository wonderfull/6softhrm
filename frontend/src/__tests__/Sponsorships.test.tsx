import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Sponsorships from '../pages/Sponsorships'
import * as api from '../lib/api'
import * as XLSX from 'xlsx'

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn()
}))

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn()
  },
  writeFile: vi.fn()
}))

describe('Sponsorships Page', () => {
  const mockEmployees = [
    { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
    { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
  ]

  const mockSponsorships = [
    {
      id: 1,
      employeeId: 1,
      visaType: 'Skilled Worker',
      casNumber: 'CAS123',
      sponsorLicenseNumber: 'LIC456',
      startDate: '2025-01-01T00:00:00.000Z',
      endDate: '2027-01-01T00:00:00.000Z',
      complianceNotes: 'All compliant',
      active: true
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/sponsorships') return Promise.resolve(mockSponsorships)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
  })

  it('should render sponsorships page title', async () => {
    render(<Sponsorships />)
    await waitFor(() => {
      expect(screen.getByText('Sponsorships')).toBeInTheDocument()
    })
  })

  it('should display export button', async () => {
    render(<Sponsorships />)
    await waitFor(() => {
      expect(screen.getByText(/Export to Excel/i)).toBeInTheDocument()
    })
  })

  it('should show add sponsorship button', async () => {
    render(<Sponsorships />)
    await waitFor(() => {
      expect(screen.getByText(/Add Sponsorship/i)).toBeInTheDocument()
    })
  })

  it('should have labeled form fields for start and end dates', async () => {
    render(<Sponsorships />)
    fireEvent.click(screen.getByText(/Add Sponsorship/i))

    await waitFor(() => {
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument()
    })
  })

  it('should export sponsorships to Excel when export clicked', async () => {
    render(<Sponsorships />)
    await screen.findByText(/Skilled Worker/i)
    fireEvent.click(screen.getByText(/Export to Excel/i))

    await waitFor(() => {
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled()
      expect(XLSX.writeFile).toHaveBeenCalled()
    })
  })

  it('should submit new sponsorship with all required fields', async () => {
    ;(api.apiPost as any).mockResolvedValue({ success: true })
    window.alert = vi.fn()

    render(<Sponsorships />)
    fireEvent.click(screen.getByText(/Add Sponsorship/i))

    fireEvent.change(await screen.findByLabelText(/Employee/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Visa Type/i), { target: { value: 'Skilled Worker' } })
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2025-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^Add Sponsorship$/i }))

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith('/sponsorships', expect.any(Object))
    })
  })

  it('should clear form when cancel or add new sponsorship clicked', async () => {
    render(<Sponsorships />)
    fireEvent.click(screen.getByText(/Add Sponsorship/i))

    await waitFor(() => {
      const employeeSelect = screen.getByLabelText(/Employee/i) as HTMLSelectElement
      fireEvent.change(employeeSelect, { target: { value: '1' } })
      expect(employeeSelect.value).toBe('1')
    })

    fireEvent.click(screen.getByText(/Cancel/i))

    await waitFor(() => {
      expect(screen.queryByLabelText(/Employee/i)).not.toBeInTheDocument()
    })
  })

  it('should edit existing sponsorship', async () => {
    ;(api.apiPut as any).mockResolvedValue({ success: true })

    render(<Sponsorships />)

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Edit/i))
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/Employee/i)).toBeInTheDocument()
    })
  })

  it('should delete sponsorship when delete clicked', async () => {
    ;(api.apiDelete as any).mockResolvedValue({ success: true })
    window.confirm = vi.fn(() => true)

    render(<Sponsorships />)

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Delete/i))
      expect(api.apiDelete).toHaveBeenCalled()
    })
  })

  it('should display visa type field with label', async () => {
    render(<Sponsorships />)
    fireEvent.click(screen.getByText(/Add Sponsorship/i))

    await waitFor(() => {
      expect(screen.getByLabelText(/Visa Type/i)).toBeInTheDocument()
    })
  })

  it('should format dates in UK format in export', async () => {
    render(<Sponsorships />)
    await screen.findByText(/Skilled Worker/i)
    fireEvent.click(screen.getByText(/Export to Excel/i))

    await waitFor(() => {
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Start Date': expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/)
          })
        ])
      )
    })
  })
})
