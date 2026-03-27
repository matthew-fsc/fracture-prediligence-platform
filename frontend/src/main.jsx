import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

const appTree = (
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)

// ---------------------------------------------------------------------------
// Render — wraps app in ClerkProvider when key is configured, otherwise
// renders without Clerk so the demo and landing page still work during setup.
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById('root'))

if (PUBLISHABLE_KEY) {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignInUrl="/Home" afterSignUpUrl="/dashboard/onboarding">
        {appTree}
      </ClerkProvider>
    </React.StrictMode>,
  )
} else {
  // No Clerk key configured — render without auth wrapper.
  // Protected routes will redirect to /sign-in which will show a config notice.
  root.render(
    <React.StrictMode>
      {appTree}
    </React.StrictMode>,
  )
}
