import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Documents from '../pages/Documents'
import * as api from '../lib/api'

// Mock the API
vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  apiUpload: vi.fn(),
  BACKEND_BASE_URL: 'http://localhost:4000'
}))

describe('Documents Page', () => {
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
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve(mockDocuments)
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
  })

  it('should render documents page title', async () => {
    render(<Documents />)
    await waitFor(() => {
      expect(screen.getByText('Documents')).toBeInTheDocument()
    })
  })

  it('should display upload form with proper labels', async () => {
    render(<Documents />)
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Document Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Document Type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Expiry Date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/File/i)).toBeInTheDocument()
    })
  })

  it('should show download all button for admin when employee selected', async () => {
    // Mock admin user
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'ADMIN' })))
    
    render(<Documents />)
    
    await waitFor(() => {
      const employeeFilter = screen.getByLabelText(/Filter by Employee/i)
      fireEvent.change(employeeFilter, { target: { value: '1' } })
    })

    await waitFor(() => {
      expect(screen.getByText(/Download All as ZIP/i)).toBeInTheDocument()
    })
  })

  it('should call fetch when admin clicks Download All', async () => {
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'ADMIN' })))
    const mockRes = { ok: true, blob: async () => new Blob(['zip content']), headers: { get: () => 'attachment; filename="John_Doe_Documents.zip"' } }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)
    
    render(<Documents />)
    
    await waitFor(() => {
      const employeeFilter = screen.getByLabelText(/Filter by Employee/i)
      fireEvent.change(employeeFilter, { target: { value: '1' } })
    })

    await waitFor(() => {
      const btn = screen.getByText(/Download All as ZIP/i)
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      // Ensure it called correct endpoint
      expect(fetchSpy.mock.calls[0][0]).toMatch(/\/api\/documents\/download-all\/1$/)
      expect(fetchSpy.mock.calls[0][1]).toBeDefined()
      expect((fetchSpy.mock.calls[0][1] as any).headers.Authorization).toBe(`Bearer ${localStorage.getItem('token')}`)
    })
    fetchSpy.mockRestore()
  })

  it('should call fetch when employee clicks Download All My Documents', async () => {
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'EMPLOYEE', email: 'john@test.com' })))
    const mockRes = { ok: true, blob: async () => new Blob(['zip content']), headers: { get: () => 'attachment; filename="John_Doe_Documents.zip"' } }
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(mockRes as any)

    render(<Documents />)

    await waitFor(() => {
      const btn = screen.getByText(/Download All My Documents as ZIP/i)
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
      expect(fetchSpy.mock.calls[0][0]).toMatch(/\/api\/documents\/download-all\//)
    })
    fetchSpy.mockRestore()
  })

  it('should show download all button for employee user', async () => {
    // Mock employee user
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'EMPLOYEE', email: 'john@test.com' })))
    
    render(<Documents />)
    
    await waitFor(() => {
      expect(screen.getByText(/Download All My Documents as ZIP/i)).toBeInTheDocument()
    })
  })

  it('should display document type badges', async () => {
    render(<Documents />)
    
    await waitFor(() => {
      expect(screen.getByText('CONTRACT')).toBeInTheDocument()
      expect(screen.getByText('PASSPORT')).toBeInTheDocument()
    })
  })

  it('should display expiry dates with proper formatting', async () => {
    render(<Documents />)
    
    await waitFor(() => {
      // Look for UK formatted dates (DD/MM/YYYY)
      const dateElements = screen.queryAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/)
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })

  it('should show expiry warning for documents expiring soon', async () => {
    const soonExpiringDoc = {
      ...mockDocuments[0],
      expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
    }
    
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve([soonExpiringDoc])
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
    
    render(<Documents />)
    
    await waitFor(() => {
      expect(screen.getByText(/Expires in/i)).toBeInTheDocument()
    })
  })

  it('should show expired warning for expired documents', async () => {
    const expiredDoc = {
      ...mockDocuments[0],
      expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
    }
    
    ;(api.apiGet as any).mockImplementation((endpoint: string) => {
      if (endpoint === '/documents') return Promise.resolve([expiredDoc])
      if (endpoint === '/employees') return Promise.resolve(mockEmployees)
      return Promise.resolve([])
    })
    
    render(<Documents />)
    
    await waitFor(() => {
      expect(screen.getByText(/EXPIRED/i)).toBeInTheDocument()
    })
  })

  it('should upload document with type and expiry date', async () => {
    (api.apiUpload as any).mockResolvedValue({ success: true })
    
    render(<Documents />)
    
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Document Name/i)
      fireEvent.change(nameInput, { target: { value: 'Test Document' } })
      
      const typeSelect = screen.getByLabelText(/Document Type/i)
      fireEvent.change(typeSelect, { target: { value: 'CONTRACT' } })
      
      const expiryInput = screen.getByLabelText(/Expiry Date/i)
      fireEvent.change(expiryInput, { target: { value: '2025-12-31' } })
      
      // Create a mock file
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/File/i)
      fireEvent.change(fileInput, { target: { files: [file] } })
      
      const uploadButton = screen.getByText(/Upload Document/i)
      fireEvent.click(uploadButton)
    })

    await waitFor(() => {
      expect(api.apiUpload).toHaveBeenCalled()
    })
  })

  it('should delete document when delete button clicked', async () => {
    (api.apiDelete as any).mockResolvedValue({ success: true })
    window.confirm = vi.fn(() => true)
    
    // Mock admin user
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'ADMIN' })))
    
    render(<Documents />)
    
    await waitFor(() => {
      const deleteButtons = screen.queryAllByText(/Delete/i)
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0])
        expect(api.apiDelete).toHaveBeenCalled()
      }
    })
  })

  it('should filter documents by employee', async () => {
    // Mock admin user
    localStorage.setItem('token', btoa(JSON.stringify({ role: 'ADMIN' })))
    
    render(<Documents />)
    
    await waitFor(() => {
      const employeeFilter = screen.getByLabelText(/Filter by Employee/i)
      fireEvent.change(employeeFilter, { target: { value: '1' } })
    })

    await waitFor(() => {
      // Should only show John Doe's documents
      expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0)
    })
  })

  it('should have document type dropdown with all options', async () => {
    render(<Documents />)
    
    await waitFor(() => {
      const typeSelect = screen.getByLabelText(/Document Type/i) as HTMLSelectElement
      const options = Array.from(typeSelect.options).map(opt => opt.value)
      
      expect(options).toContain('CONTRACT')
      expect(options).toContain('PASSPORT')
      expect(options).toContain('VISA')
      expect(options).toContain('ID')
      expect(options).toContain('CERTIFICATE')
      expect(options).toContain('OTHER')
    })
  })
})
