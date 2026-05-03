import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DataExport from '../pages/DataExport'
import * as api from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

describe('Data Export page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(localStorage.getItem as any).mockReturnValue('token')
  })

  it('loads employees through the shared API helper and shows export actions', async () => {
    ;(api.apiGet as any).mockResolvedValue({
      data: [
        {
          id: 12,
          firstName: 'Jack',
          lastName: 'Johnson',
          email: 'jack.johnson@6soft.co.uk',
        },
      ],
    })

    render(<DataExport />)

    expect(await screen.findByText('Jack Johnson')).toBeInTheDocument()
    expect(screen.getByText('jack.johnson@6soft.co.uk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledWith('/employees')
    })
  })
})
