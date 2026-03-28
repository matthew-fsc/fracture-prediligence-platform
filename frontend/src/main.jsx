import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import ClerkAuthBridge from './components/auth/ClerkAuthBridge.jsx'
import App from './App.jsx'
import './index.css'
import { ApiError } from './lib/apiClient'
import { toast } from './lib/notify'

/** Trimmed � stray whitespace in .env breaks Clerk JS load. */
const PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim()

function toastQueryError(err, query) {
  if (query?.meta?.suppressErrorToast) return
  if (err instanceof ApiError && err.status === 404) return
  const msg = err?.message || 'Something went wrong'
  toast.error(msg.length > 180 ? `${msg.slice(0, 180)}�` : msg)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      onError: toastQueryError,
    },
    mutations: { onError: toastQueryError },
  },
})

const appTree = (
  <QueryClientProvider client={queryClient}>
    <App />
    <Toaster position="top-right" theme="dark" richColors closeButton />
  </QueryClientProvider>
)

// ---------------------------------------------------------------------------
// Render � wraps app in ClerkProvider when key is configured, otherwise
// renders without Clerk so the demo and landing page still work during setup.
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById('root'))

if (PUBLISHABLE_KEY) {
  root.render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignInUrl="/Home"
        afterSignUpUrl="/dashboard/onboarding"
        afterSignOutUrl="/"
      >
        <ClerkAuthBridge>
          {appTree}
        </ClerkAuthBridge>
      </ClerkProvider>
    </React.StrictMode>,
  )
} else {
  // No Clerk key configured � render without auth wrapper.
  // Protected routes will redirect to /sign-in which will show a config notice.
  root.render(
    <React.StrictMode>
      {appTree}
    </React.StrictMode>,
  )
}
