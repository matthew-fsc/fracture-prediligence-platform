/**
 * Marketing + Clerk auth surfaces � neutral charcoal (aligned with index.css `.dark`, no blue cast).
 * Text: off-white primary; muted steps down for hierarchy while staying readable on #0C0E12.
 */
export const marketingColors = {
  bg: '#0C0E12',
  surface: '#15181E',
  /** Same as surface � used by landing sections */
  card: '#15181E',
  surfaceElevated: '#1C2128',
  inputBg: '#12151A',
  gold: '#C9973A',
  lightGold: '#E8B96A',
  offWhite: '#E8EAED',
  /** Secondary body � lighter gray for stronger contrast on #0C0E12 */
  muted: '#C8CED6',
  /** Tertiary / captions � still subdued but readable */
  mutedDim: '#B0B8C4',
  border: '#2A3038',
}

/**
 * Clerk embedded UI only � extra-light grays because Clerk layers opacity on secondary text;
 * values must stay bright on #15181E / #12151A.
 */
export const clerkEmbedText = {
  primary: '#F2F4F7',
  secondary: '#E8ECF1',
  tertiary: '#D4DAE3',
  label: '#E4E8EE',
}

/**
 * Clerk `<SignIn />` / `<SignUp />` appearance � card matches app surfaces; inputs sit on darker inset.
 */
export function clerkMarketingAppearance(c = marketingColors, text = clerkEmbedText) {
  return {
    variables: {
      colorPrimary: c.gold,
      colorBackground: c.surface,
      colorText: text.primary,
      colorTextSecondary: text.secondary,
      colorInputBackground: c.inputBg,
      colorInputText: text.primary,
      colorNeutral: c.border,
      borderRadius: '8px',
    },
    elements: {
      rootBox: { color: text.secondary },
      card: {
        backgroundColor: c.surface,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        border: `1px solid ${c.border}`,
        color: text.secondary,
      },
      headerTitle: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 24,
        color: text.primary,
      },
      headerSubtitle: { color: text.tertiary },
      socialButtonsBlockButton: {
        backgroundColor: c.surfaceElevated,
        borderColor: c.border,
        color: text.primary,
      },
      socialButtonsBlockButtonText: { color: text.primary },
      formFieldLabel: { color: text.label },
      formFieldInput: {
        backgroundColor: c.inputBg,
        borderColor: c.border,
        color: text.primary,
      },
      formFieldHintText: { color: text.tertiary },
      formFieldErrorText: { color: '#F87171' },
      identityPreviewText: { color: text.secondary },
      footer: { color: text.secondary },
      footerAction: { color: text.secondary },
      footerActionText: { color: text.secondary },
      dividerText: { color: text.tertiary },
      dividerLine: { background: c.border },
      footerActionLink: { color: c.gold },
      alternativeMethodsBlockButton: {
        color: text.primary,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
      },
      formResendCodeLink: { color: c.gold },
    },
  }
}
