import { createContext, useContext } from 'react'

export const DemoContext = createContext({
  demoData: null,
  personalized: null,
  spotsRemaining: null,
  slug: null,
  demoLocked: true,
  trackSection: () => {},
  openConversionModal: () => {},
})

export const useDemoData = () => useContext(DemoContext)

/** Returns true when the demo is locked (inputs should be read-only for visitors). */
export const useDemoLocked = () => useContext(DemoContext).demoLocked
