// Shared CSS applies to semantic controls, including custom screen controls.
export function WebEffects() {
  return <style>{`
    [role="button"], [role="link"], a, input, textarea {
      transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, filter 160ms ease;
    }
    [role="button"]:focus-visible, [role="link"]:focus-visible, a:focus-visible {
      outline: 2px solid #635bff !important; outline-offset: 3px !important;
    }
    input:focus-visible, textarea:focus-visible {
      outline: 2px solid #635bff !important; outline-offset: 2px !important;
      border-color: #635bff !important;
    }
    [data-testid="sidebar"] {
      overflow: hidden; flex-shrink: 0;
      transition: width 240ms cubic-bezier(.2,.8,.2,1);
    }
    @media (hover: hover) and (pointer: fine) {
      [role="button"]:not([aria-disabled="true"]):hover, [role="link"]:hover, a:hover { filter: brightness(.96); }
      [data-testid="sidebar"] [role="link"]:hover { background-color: #263449 !important; }
      [data-testid="sidebar"] [role="link"][aria-selected="true"]:hover { background-color: #34416f !important; }
      [data-testid="interactive-card"]:hover { border-color: #c7c3ff !important; box-shadow: 0 4px 16px rgba(16,24,40,.07); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; scroll-behavior: auto !important; }
    }
  `}</style>;
}
