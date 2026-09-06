import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'
import { apiPost } from '../lib/api'

vi.mock('../lib/api', () => ({ apiPost: vi.fn() }))

const mockPost = apiPost as unknown as ReturnType<typeof vi.fn>

// The landing page is the only thing a prospect sees before a demo. These pin
// the links it promises: legal pages must be public, the CTA must go somewhere,
// and a signed-in user must be routed back into the app.

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

describe('Home page', () => {
  // setup.ts replaces localStorage with vi.fn() stubs; drive getItem directly.
  beforeEach(() => {
    ;(localStorage.getItem as any).mockReturnValue(null)
    mockPost.mockReset()
    mockPost.mockResolvedValue({ ok: true })
  })

  it('leads with the HR-portal proposition', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { level: 1, name: /hr portal/i }),
    ).toBeInTheDocument()
  })

  it('every demo CTA leads to the request form on the page', () => {
    renderHome()
    const ctas = screen.getAllByRole('link', { name: /book a demo|talk to us/i })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '#demo')
    }
  })

  it('sends a demo request and confirms it', async () => {
    renderHome()
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'ops@northgate-care.co.uk' },
    })
    fireEvent.change(screen.getByLabelText(/headcount/i), {
      target: { value: '42' },
    })
    fireEvent.click(screen.getByRole('button', { name: /book a demo/i }))

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/public/demo-request', {
        email: 'ops@northgate-care.co.uk',
        headcount: 42,
        website: '',
      }),
    )
    expect(await screen.findByText(/request received/i)).toBeInTheDocument()
  })

  it('falls back to the email address when the request fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('offline'))
    renderHome()
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: 'ops@northgate-care.co.uk' },
    })
    fireEvent.change(screen.getByLabelText(/headcount/i), {
      target: { value: '42' },
    })
    fireEvent.click(screen.getByRole('button', { name: /book a demo/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('hello@onsidehr.co.uk')
    expect(alert).toHaveTextContent('07990 501431')
  })

  it('keeps the phone number reachable from the header', () => {
    renderHome()
    const phone = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === 'tel:+447990501431')
    expect(phone.length).toBeGreaterThan(0)
  })

  it('links to every legal document from the footer', () => {
    renderHome()
    for (const path of ['/privacy', '/terms', '/dpa', '/gdpr']) {
      const matches = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === path)
      expect(matches.length, path).toBeGreaterThan(0)
    }
  })

  it('offers sign-in when logged out and the app when logged in', () => {
    const { unmount } = renderHome()
    expect(screen.getAllByRole('link', { name: /^sign in$/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /open app/i })).toBeNull()
    unmount()

    ;(localStorage.getItem as any).mockImplementation((k: string) =>
      k === 'token' ? 'x.y.z' : null,
    )
    renderHome()
    expect(screen.getAllByRole('link', { name: /open app/i }).length).toBeGreaterThan(0)
  })
})
