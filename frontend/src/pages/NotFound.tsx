import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-7xl font-bold text-slate-300 dark:text-slate-600 mb-4">
        404
      </div>
      <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">
        The page you were looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-lg shadow"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
