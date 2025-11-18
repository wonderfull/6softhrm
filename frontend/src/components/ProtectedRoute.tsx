import React from 'react'
import { Navigate } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp
    if (!exp) return false
    
    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    return Date.now() >= exp * 1000
  } catch {
    return true // If we can't parse the token, treat it as expired
  }
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem('token')
  
  // Check if token exists and is not expired
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token')
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}
