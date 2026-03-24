import { createContext, useContext } from 'react'

export const DemoContext = createContext({
  demoData: null,
  personalized: null,
  spotsRemaining: null,
  slug: null,
  trackSection: () => {},
})

export const useDemoData = () => useContext(DemoContext)
