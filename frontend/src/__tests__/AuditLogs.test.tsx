import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AuditLogs from '../pages/AuditLogs'
import * as api from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    apiGet: vi.fn(),
  }
})

describe('AuditLogs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window.alert as any).mockClear()
  })

  it('loads audit logs through the shared API helper', async () => {
    ;(api.apiGet as any).mockResolvedValue({
      logs: [
        {
          id: 1,
          userId: 10,
          userEmail: 'admin@example.com',
          action: 'LOGIN_SUCCESS',
          entity: 'User',
          entityId: 10,
          details: { source: 'test' },
          ipAddress: '127.0.0.1',
          userAgent: 'Vitest',
          timestamp: '2026-05-03T10:00:00.000Z',
        },
      ],
      total: 1,
    })

    render(<AuditLogs />)

    expect(await screen.findByRole('heading', { name: 'Audit Logs' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('LOGIN_SUCCESS').length).toBeGreaterThan(1)
    })
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()

    await waitFor(() => {
      expect(api.apiGet).toHaveBeenCalledWith('/gdpr/audit-logs', {
        limit: 50,
        offset: 0,
      })
    })
  })

  it('does not blank the page when audit log response is malformed', async () => {
    ;(api.apiGet as any).mockResolvedValue({})

    render(<AuditLogs />)

    expect(await screen.findByRole('heading', { name: 'Audit Logs' })).toBeInTheDocument()
    expect(await screen.findByText('No audit logs found')).toBeInTheDocument()
  })
})
