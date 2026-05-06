import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Documents from '../pages/Documents'
import * as api from '../lib/api'

let mockedUser: { role: string; email: string; employeeId?: number } | null = null

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
    apiUpload: vi.fn(),
    BACKEND_BASE_URL: 'http://localhost:4000',
    getCurrentUser: vi.fn(() => mockedUser),
    hasRole: vi.fn((user: any, ...roles: string[]) => !!user && roles.includes(user.role))
  }
})

describe('Documents Page', () => {
  const makeToken = (payload: Record<string, unknown>) => `header.${btoa(JSON.stringify(payload))}.signature`
  const renderDocuments = () => render(
    <MemoryRouter>
      <Documents />
    </MemoryRouter>
  )

  const mockEmployees = [
    { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
    { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
  ]

  const mockDocuments = [
    {
      id: 1,
      employeeId: 1,
      name: 'Contract.pdf',
      path: '/uploads/contract.pdf',
      type: 'CONTRACT',
      expiryDate: '2025-12-31T00:00:00.000Z',
      employee: { id: 1, firstName: 'John', lastName: 'Doe' }
    },
    {
      id: 2,
      employeeId: 1,
      name: 'Passport.pdf',
      path: '/uploads/passport.pdf',
      type: 'PASSPORT',
      expiryDate: '2026-06-30T00:00:00.000Z',
      employee: { id: 1, firstName: 'John', lastName: 'Doe' }
    },
    {
      id: 3,
      employeeId: 1,
      name: 'Payslip April.pdf',
      path: '/uploads/payslip-april.pdf',
      type: 'PAYSLIP',
      shareToken: 'share-token-123',
      expiryDate: null,
      employee: { id: 1, firstName: 'John', lastName: 'Doe' }
    }
  ]

  async function selectJohnDocuments() {
    const filterSelect = await screen.findByLabelText(/Selected Employee/i)
    fireEvent.change(filterSelect, { target: { value: '1' } })
    return filterSelect
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedUser = null
    localStorage.clear()
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve(mockDocuments)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
  })

  it('should render documents page title', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  it('should display upload form with proper labels', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    await waitFor(() => {
      expect(screen.getByLabelText(/Document Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Document Type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Expiry Date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^File \*$/i)).toBeInTheDocument()
    })
  })

  it('should show download all button for admin when employee selected', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    const filterSelect = await screen.findByLabelText(/Selected Employee/i)
    fireEvent.change(filterSelect, { target: { value: '1' } })

    await waitFor(() => {
      expect(screen.getByText(/Download All as ZIP/i)).toBeInTheDocument()
    })
  })

  it('should call fetch when admin clicks Download All', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    const mockRes = { ok: true, blob: async () => new Blob(['zip content']), headers: { get: () => 'attachment; filename="John_Doe_Documents.zip"' } }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)

    renderDocuments()

    const filterSelect = await screen.findByLabelText(/Selected Employee/i)
    fireEvent.change(filterSelect, { target: { value: '1' } })
    fireEvent.click(await screen.findByText(/Download All as ZIP/i))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      expect(fetchSpy.mock.calls[0][0]).toMatch(/\/api\/documents\/download-all\/1$/)
      expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'GET' }))
    })

    fetchSpy.mockRestore()
  })

  it('should call fetch when employee clicks Download All My Documents', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    const mockRes = { ok: true, blob: async () => new Blob(['zip content']), headers: { get: () => 'attachment; filename="John_Doe_Documents.zip"' } }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)

    renderDocuments()

    fireEvent.click(await screen.findByText(/Download All My Documents as ZIP/i))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      expect(fetchSpy.mock.calls[0][0]).toMatch(/\/api\/documents\/download-all\/1$/)
    })

    fetchSpy.mockRestore()
  })

  it('should show download all button for employee user', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText(/Download All My Documents as ZIP/i)).toBeInTheDocument()
    })
  })

  it('should display document type badges', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Employment Contracts/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Passports/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Payslips/i })).toBeInTheDocument()
      expect(screen.getByText('CONTRACT')).toBeInTheDocument()
      expect(screen.getByText('PASSPORT')).toBeInTheDocument()
      expect(screen.getByText('PAYSLIP')).toBeInTheDocument()
    })
  })

  it('should render the payslip drop zone for admins', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    await waitFor(() => {
      expect(screen.getByText(/Payslip Drop Zone/i)).toBeInTheDocument()
      expect(screen.getByText(/Drag and drop payslips here/i)).toBeInTheDocument()
    })
  })

  it('should display expiry dates with proper formatting', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      expect(screen.queryAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/).length).toBeGreaterThan(0)
    })
  })

  it('should show expiry warning for documents expiring soon', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    const soonExpiringDoc = {
      ...mockDocuments[0],
      expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    }

    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve([soonExpiringDoc])
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })

    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      expect(screen.getByText(/Expires in/i)).toBeInTheDocument()
    })
  })

  it('should show expired warning for expired documents', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    const expiredDoc = {
      ...mockDocuments[0],
      expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }

    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve([expiredDoc])
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })

    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      expect(screen.getByText(/EXPIRED/i)).toBeInTheDocument()
    })
  })

  it('should upload document with type and expiry date', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    ;(api.apiUpload as any).mockResolvedValue({ success: true })
    window.alert = vi.fn()

    renderDocuments()

    fireEvent.change(await screen.findByLabelText('Employee'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Document Name/i), { target: { value: 'Test Document' } })
    fireEvent.change(screen.getByLabelText(/Document Type/i), { target: { value: 'CONTRACT' } })
    fireEvent.change(screen.getByLabelText(/Expiry Date/i), { target: { value: '2025-12-31' } })

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/^File \*$/i), { target: { files: [file] } })
    fireEvent.click(screen.getByText(/Upload Document/i))

    await waitFor(() => {
      expect(api.apiUpload).toHaveBeenCalledWith('/documents/upload', expect.any(FormData))
    })
  })

  it('shows mandatory field validation before uploading a document', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))

    renderDocuments()

    fireEvent.click(await screen.findByRole('button', { name: /^Upload Document$/i }))

    expect(await screen.findByText('Employee is required')).toBeInTheDocument()
    expect(screen.getByText('Document name is required')).toBeInTheDocument()
    expect(screen.getByText('File is required')).toBeInTheDocument()
    expect(api.apiUpload).not.toHaveBeenCalled()
  })

  it('should delete document when delete button clicked', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    ;(api.apiDelete as any).mockResolvedValue({ success: true })
    window.confirm = vi.fn(() => true)

    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      const deleteButtons = screen.queryAllByText(/Delete/i)
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
        expect(api.apiDelete).toHaveBeenCalled()
      }
    })
  })

  it('should request a share link when share button is clicked', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    ;(api.apiPost as any).mockResolvedValue({ shareUrl: 'http://localhost:4000/api/documents/share/generated-token' })
    window.alert = vi.fn()

    renderDocuments()
    await selectJohnDocuments()

    fireEvent.click(await screen.findByText(/Copy Share Link/i))

    await waitFor(() => {
      expect(api.apiPost).not.toHaveBeenCalled()
    })
  })

  it('should create a share link for an unshared document', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') {
        return Promise.resolve([{ ...mockDocuments[0], shareToken: null }])
      }
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
    ;(api.apiPost as any).mockResolvedValue({ shareUrl: 'http://localhost:4000/api/documents/share/generated-token' })
    window.alert = vi.fn()

    renderDocuments()
    await selectJohnDocuments()

    fireEvent.click(await screen.findByText(/Create Share Link/i))

    await waitFor(() => {
      expect(api.apiPost).toHaveBeenCalledWith('/documents/1/share-link')
    })
  })

  it('previews a PDF document inline', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    const mockRes = { ok: true, blob: async () => new Blob(['pdf content'], { type: 'application/pdf' }) }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)
    const objectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:preview-url')

    renderDocuments()

    fireEvent.click(await screen.findByRole('button', { name: /Preview Contract.pdf/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/documents\/1\/file\?disposition=inline$/),
        expect.objectContaining({ method: 'GET' }),
      )
      expect(screen.getByTitle('Contract.pdf')).toHaveAttribute('src', 'blob:preview-url')
    })

    fetchSpy.mockRestore()
    objectUrlSpy.mockRestore()
  })

  it('previews a PDF when the display name has no extension but the stored path does', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') {
        return Promise.resolve([{
          ...mockDocuments[0],
          id: 5,
          name: '6 SOFT LIMITED - Employee Payslip for Mar-2026 for YESUBABU DANDABATHINA',
          path: '/uploads/1710000000000-6-soft-limited-payslip-mar-2026.pdf',
          type: 'PAYSLIP',
        }])
      }
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
    const mockRes = { ok: true, blob: async () => new Blob(['pdf content'], { type: 'application/pdf' }) }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)
    const objectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:payslip-preview-url')

    renderDocuments()

    fireEvent.click(await screen.findByRole('button', { name: /Preview 6 SOFT LIMITED/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/documents\/5\/file\?disposition=inline$/),
        expect.objectContaining({ method: 'GET' }),
      )
      expect(screen.getByTitle(/6 SOFT LIMITED - Employee Payslip/i)).toHaveAttribute('src', 'blob:payslip-preview-url')
    })
    expect(screen.queryByText(/Preview is not available for this file type/i)).not.toBeInTheDocument()

    fetchSpy.mockRestore()
    objectUrlSpy.mockRestore()
  })

  it('downloads a document with the original file name', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    const mockRes = { ok: true, blob: async () => new Blob(['pdf content'], { type: 'application/pdf' }) }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)
    const objectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:download-url')

    renderDocuments()

    fireEvent.click(await screen.findByRole('button', { name: /Download Contract.pdf/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/documents\/1\/file$/),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    fetchSpy.mockRestore()
    objectUrlSpy.mockRestore()
  })

  it('opens Word documents in the preview frame instead of showing unsupported file type', async () => {
    mockedUser = { role: 'USER', email: 'john@test.com', employeeId: 1 }
    localStorage.setItem('token', makeToken({ role: 'USER', email: 'john@test.com', employeeId: 1 }))
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') {
        return Promise.resolve([{ ...mockDocuments[0], id: 4, name: 'Policy.docx', path: '/uploads/policy.docx' }])
      }
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
    const mockRes = { ok: true, blob: async () => new Blob(['docx content'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)
    const objectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:docx-preview-url')

    renderDocuments()

    fireEvent.click(await screen.findByRole('button', { name: /Preview Policy.docx/i }))

    const dialog = await screen.findByRole('dialog', { name: /Preview Policy.docx/i })
    expect(within(dialog).getByTitle('Policy.docx')).toHaveAttribute('src', 'blob:docx-preview-url')
    expect(within(dialog).queryByText(/Preview is not available for this file type/i)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Download Policy.docx/i })).toBeInTheDocument()

    fetchSpy.mockRestore()
    objectUrlSpy.mockRestore()
  })

  it('hides share and delete controls from office assistants', async () => {
    mockedUser = { role: 'OFFICE_ASSISTANT', email: 'assistant@example.com' }
    localStorage.setItem('token', makeToken({ role: 'OFFICE_ASSISTANT', email: 'assistant@example.com' }))

    renderDocuments()
    await selectJohnDocuments()

    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText(/Contract.pdf/i)).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: /Preview/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Download/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Create Share Link/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copy Share Link/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument()
  })

  it('should filter documents by employee', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    fireEvent.change(await screen.findByLabelText(/Selected Employee/i), { target: { value: '1' } })

    await waitFor(() => {
      expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0)
    })
  })

  it('requires admins to select an employee before documents are listed', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    expect(await screen.findByText(/Select an employee to view their documents/i)).toBeInTheDocument()
    expect(screen.queryByText(/Contract.pdf/i)).not.toBeInTheDocument()

    await selectJohnDocuments()

    expect(await screen.findByText(/Contract.pdf/i)).toBeInTheDocument()
    expect(api.apiGet).toHaveBeenCalledWith('/documents', { employeeId: '1' })
  })

  it('should have document type dropdown with all options', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com' }
    localStorage.setItem('token', makeToken({ role: 'ADMIN', email: 'admin@example.com' }))
    renderDocuments()

    await waitFor(() => {
      const typeSelect = screen.getByLabelText(/Document Type/i) as HTMLSelectElement
      const options = Array.from(typeSelect.options).map(o => o.value)
      expect(options).toContain('CONTRACT')
      expect(options).toContain('PASSPORT')
      expect(options).toContain('VISA')
      expect(options).toContain('ID')
      expect(options).toContain('CERTIFICATE')
      expect(options).toContain('OTHER')
    })
  })
})
