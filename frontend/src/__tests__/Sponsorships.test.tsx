import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Sponsorships from '../pages/Sponsorships'
import * as api from '../lib/api'
import * as XLSX from 'xlsx'

let mockedUser: any = { id: 7, role: 'ADMIN', email: 'admin@test.com' }

vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  apiUpload: vi.fn(),
  getCurrentUser: vi.fn(() => mockedUser)
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
    mockedUser = { id: 7, role: 'ADMIN', email: 'admin@test.com' }
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/sponsorships') return Promise.resolve(mockSponsorships)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      if (endpoint === '/sponsorships/reportable-events/open') return Promise.resolve([
        {
          id: 77,
          sponsorshipId: 1,
          eventType: 'DELAYED_START',
          eventDate: '2026-04-30T00:00:00.000Z',
          dueDate: '2026-05-15T00:00:00.000Z',
          status: 'OPEN',
          sponsorship: {
            id: 1,
            employee: mockEmployees[0]
          }
        }
      ])
      if (endpoint === '/sponsorships/1/compliance') return Promise.resolve({
        sponsorship: { id: 1 },
        employee: mockEmployees[0],
        missingCount: 4,
        requiredEvidence: [
          { key: 'RIGHT_TO_WORK_CHECK', label: 'Right-to-work check', status: 'COMPLETE' },
          { key: 'EMPLOYMENT_RIGHTS_NOTIFICATION', label: 'Employment rights notification', status: 'MISSING' },
          { key: 'RECRUITMENT_EVIDENCE', label: 'Recruitment evidence', status: 'MISSING' },
          { key: 'SALARY_EVIDENCE', label: 'Salary evidence', status: 'MISSING' },
          { key: 'SKILL_LEVEL_EVIDENCE', label: 'Skill-level evidence', status: 'MISSING' }
        ],
        existingEvidence: []
      })
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
    await screen.findAllByText(/Skilled Worker/i)
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
    await screen.findAllByText(/Skilled Worker/i)
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

  it('shows compliance evidence status and open reportable events', async () => {
    render(<Sponsorships />)

    await screen.findAllByText(/John Doe/i)

    await waitFor(() => {
      expect(screen.getAllByText(/4 missing/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Delayed start/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/Right-to-work check/i)).toBeInTheDocument()
    })
  })

  it('uploads and links missing compliance evidence for the sponsored employee', async () => {
    ;(api.apiUpload as any).mockResolvedValue({ id: 88 })
    ;(api.apiPost as any).mockResolvedValue({ id: 99 })
    window.alert = vi.fn()

    render(<Sponsorships />)

    await screen.findByText(/Recruitment evidence/i)
    expect(screen.getByText(/Sponsor licence evidence/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Add evidence for Recruitment evidence/i }))

    fireEvent.change(screen.getByLabelText(/Evidence file/i), {
      target: {
        files: [new File(['evidence'], 'recruitment.pdf', { type: 'application/pdf' })],
      },
    })
    fireEvent.change(screen.getByLabelText(/Evidence notes/i), {
      target: { value: 'Recruitment advert and selection record retained.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Upload and link evidence/i }))

    await waitFor(() => {
      expect(api.apiUpload).toHaveBeenCalledWith('/documents/upload', expect.any(FormData))
      expect(api.apiPost).toHaveBeenCalledWith('/sponsorships/1/compliance/evidence', {
        evidenceType: 'RECRUITMENT_EVIDENCE',
        documentId: 88,
        notes: 'Recruitment advert and selection record retained.',
      })
    })
  })

  it('hides core export and edit actions from office assistants', async () => {
    mockedUser = { id: 8, role: 'OFFICE_ASSISTANT', email: 'assistant@test.com' }

    render(<Sponsorships />)

    await screen.findAllByText(/John Doe/i)

    expect(screen.queryByRole('button', { name: /Export to Excel/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Sponsorship/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add reportable event/i })).toBeInTheDocument()
  })

  it('does not mark synthetic reportable alerts as reported', async () => {
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/sponsorships') return Promise.resolve(mockSponsorships)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      if (endpoint === '/sponsorships/reportable-events/open') return Promise.resolve([
        {
          id: null,
          sponsorshipId: 1,
          eventType: 'DELAYED_START',
          eventDate: '2026-04-30T00:00:00.000Z',
          dueDate: '2026-05-15T00:00:00.000Z',
          status: 'OPEN',
          alertSource: 'AUTO',
          sponsorship: {
            id: 1,
            employee: mockEmployees[0]
          }
        }
      ])
      if (endpoint === '/sponsorships/1/compliance') return Promise.resolve({
        sponsorship: { id: 1 },
        employee: mockEmployees[0],
        missingCount: 4,
        requiredEvidence: [
          { key: 'RIGHT_TO_WORK_CHECK', label: 'Right-to-work check', status: 'COMPLETE' }
        ],
        existingEvidence: []
      })
      return Promise.resolve([])
    })

    render(<Sponsorships />)

    await screen.findAllByText(/Delayed start/i)

    expect(screen.queryByRole('button', { name: /Mark reported/i })).not.toBeInTheDocument()
  })
})
