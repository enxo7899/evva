import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export const IconUpload = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 16V4" />
    <path d="M6 10l6-6 6 6" />
    <path d="M4 20h16" />
  </svg>
);

export const IconPlay = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPause = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <rect x="6.5" y="5" width="3.5" height="14" rx="0.6" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="3.5" height="14" rx="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconDownload = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 4v12" />
    <path d="M6 10l6 6 6-6" />
    <path d="M4 20h16" />
  </svg>
);

export const IconSparkle = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M3 12h4" />
    <path d="M17 12h4" />
    <path d="M6 6l2.2 2.2" />
    <path d="M15.8 15.8L18 18" />
    <path d="M6 18l2.2-2.2" />
    <path d="M15.8 8.2L18 6" />
  </svg>
);

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M5 12l4.5 4.5L19 7" />
  </svg>
);

export const IconX = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);

export const IconRefresh = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M4 12a8 8 0 0114-5.3L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M20 12a8 8 0 01-14 5.3L4 16" />
    <path d="M4 20v-4h4" />
  </svg>
);

export const IconWaveform = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M3 12h2" />
    <path d="M7 8v8" />
    <path d="M10 5v14" />
    <path d="M13 9v6" />
    <path d="M16 6v12" />
    <path d="M19 10v4" />
    <path d="M22 12h-1" />
  </svg>
);

export const IconInfo = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.6" fill="currentColor" />
  </svg>
);

export const IconAlert = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5" />
    <circle cx="12" cy="18" r="0.6" fill="currentColor" />
  </svg>
);
