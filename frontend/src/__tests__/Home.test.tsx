import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home'

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
  })

  it('leads with the HR-portal proposition', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { level: 1, name: /hr portal/i }),
    ).toBeInTheDocument()
  })

  it('every demo CTA points at the contact address', () => {
    renderHome()
    const ctas = screen.getAllByRole('link', { name: /book a demo|talk to us/i })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) {
      expect(cta).toHaveAttribute(
        'href',
        expect.stringMatching(/^mailto:hello@onsidehr\.co\.uk/),
      )
    }
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
