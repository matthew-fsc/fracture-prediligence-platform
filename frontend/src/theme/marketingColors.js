/**
 * Marketing + Clerk auth surfaces — neutral charcoal (aligned with index.css `.dark`, no blue cast).
 * Text: off-white primary; muted steps down for hierarchy while staying readable on #0C0E12.
 */
export const marketingColors = {
  bg: '#0C0E12',
  surface: '#15181E',
  /** Same as surface — used by landing sections */
  card: '#15181E',
  surfaceElevated: '#1C2128',
  inputBg: '#12151A',
  gold: '#C9973A',
  lightGold: '#E8B96A',
  offWhite: '#E8EAED',
  /** Secondary body — lighter gray for stronger contrast on #0C0E12 */
  muted: '#C8CED6',
  /** Tertiary / captions — still subdued but readable */
  mutedDim: '#B0B8C4',
  border: '#2A3038',
}

/**
 * Clerk embedded UI only — extra-light grays because Clerk layers opacity on secondary text;
 * values must stay bright on #15181E / #12151A.
 */
export const clerkEmbedText = {
  primary: '#F2F4F7',
  secondary: '#E8ECF1',
  tertiary: '#D4DAE3',
  label: '#E4E8EE',
}

/**
 * Clerk `<SignIn />` / `<SignUp />` appearance — card matches app surfaces; inputs sit on darker inset.
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
      fontSize: '15px',
    },
    elements: {
      rootBox: {
        color: text.secondary,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
      },
      card: {
        backgroundColor: c.surface,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        border: `1px solid ${c.border}`,
        color: text.secondary,
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
      },
      headerTitle: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 24,
        color: text.primary,
      },
      headerSubtitle: { color: text.secondary, fontSize: '14px' },
      socialButtonsBlockButton: {
        backgroundColor: c.surfaceElevated,
        borderColor: c.border,
        color: text.primary,
        fontSize: '14px',
      },
      socialButtonsBlockButtonText: { color: text.primary, fontSize: '14px' },
      formFieldLabel: { color: text.label, fontSize: '13px', fontWeight: '500' },
      formFieldInput: {
        backgroundColor: c.inputBg,
        borderColor: c.border,
        color: text.primary,
        fontSize: '15px',
      },
      formFieldHintText: { color: text.tertiary, fontSize: '13px' },
      formFieldErrorText: { color: '#F87171', fontSize: '13px' },
      identityPreviewText: { color: text.primary, fontSize: '14px' },
      identityPreviewEditButtonIcon: { color: text.secondary },
      footer: { color: text.secondary },
      footerAction: { color: text.secondary },
      footerActionText: { color: text.secondary, fontSize: '14px' },
      dividerText: { color: text.tertiary },
      dividerLine: { background: c.border },
      footerActionLink: { color: c.gold, fontWeight: '600' },
      alternativeMethodsBlockButton: {
        color: text.primary,
        borderColor: c.border,
        backgroundColor: c.surfaceElevated,
        fontSize: '14px',
      },
      formResendCodeLink: { color: c.gold, fontSize: '14px' },
      otpCodeFieldInput: {
        backgroundColor: c.surfaceElevated,
        borderColor: c.gold,
        borderWidth: '2px',
        color: text.primary,
        fontSize: '24px',
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: '0.05em',
        minWidth: '46px',
        height: '54px',
        borderRadius: '8px',
      },
    },
  }
}
