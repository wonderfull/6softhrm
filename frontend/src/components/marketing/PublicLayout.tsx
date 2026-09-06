import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

// Shell for pages reachable without signing in: the landing page and the
// legal documents it links to. The app shell (NavBar + Sidebar) stays behind
// ProtectedRoute.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-bg text-ink">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
