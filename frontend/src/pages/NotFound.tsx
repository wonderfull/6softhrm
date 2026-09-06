import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
 return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="font-display text-7xl font-semibold text-ink-3 mb-4">
 404
      </div>
      <h1 className="font-display text-[26px] font-semibold tracking-[-0.015em] mb-2 text-ink">
 Page not found
      </h1>
      <p className="text-ink-2 max-w-md mb-6">
 The page you were looking for does not exist or has been moved.
      </p>
      <Link
 to="/dashboard"
 className="btn-primary h-10"
      >
 Back to dashboard
      </Link>
    </div>
  );
}
