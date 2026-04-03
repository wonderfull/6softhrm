# Frontend — React + Vite + TypeScript + Tailwind

## Commands
```bash
npm run dev          # Vite dev server (port 5173, proxies /api → localhost:4000)
npm run build        # production build to dist/
npm run preview      # preview production build locally
npm run test         # Vitest
npm run test:ui      # Vitest with browser UI dashboard
npm run test:coverage # Vitest coverage report
```

## Architecture
```
src/main.tsx        → React entry, wraps App with BrowserRouter
src/App.tsx         → route definitions with React Router v6
src/pages/          → full page components (one per route)
src/components/
  NavBar.tsx        → top navigation
  Sidebar.tsx       → admin sidebar with nav links
  ProtectedRoute.tsx → redirects unauthenticated users to /login
  Card.tsx          → reusable card container
  Footer.tsx        → footer
src/lib/            → shared utilities
src/styles/         → global CSS
```

## Key Patterns
```typescript
// API calls — axios hits /api/* (Vite proxies to backend)
import axios from 'axios';
const { data } = await axios.get('/api/employees', {
  headers: { Authorization: `Bearer ${token}` }
});

// Protected route usage in App.tsx
<Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
```

## Styling
- Tailwind CSS only (no CSS modules, no styled-components)
- Dark mode: `dark:` variant classes, toggled via root class
- Icons: `react-icons` (general) + `@heroicons/react` (UI icons)
- Responsive: mobile-first with Tailwind breakpoints

## Testing
- Vitest + React Testing Library + jsdom
- Test files in `src/__tests__/`
- Named `[filename].test.tsx`
