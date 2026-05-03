import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Consent from '../pages/Consent'
import axios from 'axios'

vi.mock('axios')

const makeToken = (payload: Record<string, unknown>) => `header.${btoa(JSON.stringify(payload))}.signature`

describe('Consent Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(window.alert as any).mockClear()
  })

  it('loads consent records when the employees response is wrapped', async () => {
    const token = makeToken({ role: 'EMPLOYEE', email: 'employee@test.com' })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(axios.get as any)
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: 42, firstName: 'Employee', lastName: 'User', email: 'employee@test.com' },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            employeeId: 42,
            consentType: 'photo_usage',
            consentGiven: true,
            consentDate: '2026-05-01T10:00:00.000Z',
            withdrawnDate: null,
            ipAddress: null,
            version: '1.0',
            createdAt: '2026-05-01T10:00:00.000Z',
          },
        ],
      })

    render(<Consent />)

    await screen.findByRole('heading', { name: 'Data Processing Consent' })

    expect(screen.getByText('Photo and Image Usage')).toBeInTheDocument()
    expect(screen.getByText('✓ Consented')).toBeInTheDocument()
    await waitFor(() => {
      expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('Failed to load consent data'))
    })
  })

  it('finds the employee record from the JWT employee id when email is unavailable', async () => {
    const token = makeToken({ role: 'EMPLOYEE', employeeId: 42 })
    ;(localStorage.getItem as any).mockImplementation((key: string) => (key === 'token' ? token : null))
    ;(axios.get as any)
      .mockResolvedValueOnce({
        data: [
          { id: 42, firstName: 'Employee', lastName: 'User', email: 'employee@test.com' },
        ],
      })
      .mockResolvedValueOnce({ data: [] })

    render(<Consent />)

    await screen.findAllByRole('button', { name: 'Grant Consent' })

    await waitFor(() => {
      expect(axios.get).toHaveBeenLastCalledWith(
        expect.stringContaining('/gdpr/consent/42'),
        expect.any(Object),
      )
    })
    expect(window.alert).not.toHaveBeenCalledWith('Employee record not found')
  })
})
