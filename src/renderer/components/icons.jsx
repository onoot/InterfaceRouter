// Иконки: один SVG-набор на currentColor, обводка 2px (под semibold-текст).

const S = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
);

export const IconRoutes = (p) => (
  <S {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M6 8.5v2.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.5" />
    <path d="M8.5 6h7" />
  </S>
);

export const IconNetwork = (p) => (
  <S {...p}>
    <rect x="2" y="9" width="8" height="6" rx="1.5" />
    <rect x="14" y="9" width="8" height="6" rx="1.5" />
    <path d="M6 15v3M18 15v3M6 18h12" />
    <circle cx="6" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="7" r="1.2" fill="currentColor" stroke="none" />
  </S>
);

export const IconTerminal = (p) => (
  <S {...p}>
    <path d="M4 5l6 7-6 7" />
    <path d="M13 19h7" />
  </S>
);

export const IconSettings = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.09a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
  </S>
);

export const IconRoute = (p) => (
  <S {...p}>
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="5" r="2" />
    <path d="M5 17V7a2 2 0 0 1 2-2h6" />
    <path d="M11 8l3-3 3 3" />
  </S>
);

export const IconPlus = (p) => (
  <S {...p}><path d="M12 5v14M5 12h14" /></S>
);

export const IconTrash = (p) => (
  <S {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </S>
);

export const IconRefresh = (p) => (
  <S {...p}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </S>
);

export const IconShield = (p) => (
  <S {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </S>
);

export const IconGlobe = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
  </S>
);

export const IconApp = (p) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M4 9h16" />
    <path d="M9 4v5" />
  </S>
);

export const IconFile = (p) => (
  <S {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </S>
);

export const IconChevronDown = (p) => (
  <S {...p}><path d="M6 9l6 6 6-6" /></S>
);

export const IconClose = (p) => (
  <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>
);

export const IconEdit = (p) => (
  <S {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </S>
);

export const IconPlay = (p) => (
  <S {...p}><path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" /></S>
);

export const IconPause = (p) => (
  <S {...p}><path d="M8 5v14M16 5v14" /></S>
);

export const IconScan = (p) => (
  <S {...p}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
  </S>
);

export const IconPulse = (p) => (
  <S {...p}>
    <path d="M3 12h3l2.5-6 4 12 2.5-6H21" />
  </S>
);

export const IconMinimize = (p) => (
  <S {...p}><path d="M5 12h14" /></S>
);

export const IconMaximize = (p) => (
  <S {...p}><rect x="5" y="5" width="14" height="14" rx="1.5" /></S>
);

export const IconRestore = (p) => (
  <S {...p}>
    <rect x="4" y="8" width="12" height="12" rx="1.5" />
    <path d="M8 4.5h9a2.5 2.5 0 0 1 2.5 2.5v9" />
  </S>
);
