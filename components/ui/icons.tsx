import { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function createIcon(children: ReactNode, viewBox = "0 0 24 24") {
  return function Icon({ className, ...rest }: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

export const ArrowRightIcon = createIcon(
  <>
    <path d="M13.5 4.5 21 12l-7.5 7.5" />
    <path d="M21 12H3" />
  </>
);

export const ArrowLeftIcon = createIcon(
  <>
    <path d="M10.5 19.5 3 12l7.5-7.5" />
    <path d="M3 12h18" />
  </>
);

export const CalendarIcon = createIcon(
  <>
    <path d="M6 2.25v3" />
    <path d="M18 2.25v3" />
    <path d="M3.75 7.5h16.5" />
    <path d="M4.5 5.25h15a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6a.75.75 0 0 1 .75-.75Z" />
  </>
);

export const SparklesIcon = createIcon(
  <>
    <path d="M12 3v3" />
    <path d="M12 18v3" />
    <path d="m16.5 7.5 2.121 2.121" />
    <path d="M5.379 16.621 7.5 14.5" />
    <path d="M3 12h3" />
    <path d="M18 12h3" />
    <circle cx="12" cy="12" r="3" fill="none" />
  </>
);

export const CheckCircleIcon = createIcon(
  <>
    <path d="m9 12 2 2 4-4" />
    <circle cx="12" cy="12" r="8.25" fill="none" />
  </>
);

export const ClipboardDocumentCheckIcon = createIcon(
  <>
    <path d="M9 2.25h6a1.5 1.5 0 0 1 1.5 1.5V6H7.5V3.75A1.5 1.5 0 0 1 9 2.25Z" fill="none" />
    <path d="M7.5 6h9a1.5 1.5 0 0 1 1.5 1.5v12.75a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5V7.5A1.5 1.5 0 0 1 7.5 6Z" fill="none" />
    <path d="m9 13.5 2.25 2.25L15 12" />
  </>
);

export const ClockIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="8.25" fill="none" />
    <path d="M12 7.5V12l3 1.5" />
  </>
);

export const ArrowDownTrayIcon = createIcon(
  <>
    <path d="M12 3v12" />
    <path d="m15 12-3 3-3-3" />
    <path d="M4.5 20.25h15" />
  </>
);

export const ChartPieIcon = createIcon(
  <>
    <path d="M11.25 3.75a.75.75 0 0 1 .75-.75A8.25 8.25 0 1 1 3.75 12a.75.75 0 0 1 .75-.75h6.75Z" fill="none" />
    <path d="M12 2.25V12h9.75" />
  </>
);

export const RectangleGroupIcon = createIcon(
  <>
    <rect x="3.75" y="3.75" width="9" height="9" rx="1.5" fill="none" />
    <rect x="11.25" y="11.25" width="9" height="9" rx="1.5" fill="none" />
  </>
);

export const Squares2X2Icon = createIcon(
  <>
    <rect x="3.75" y="3.75" width="7.5" height="7.5" rx="1.5" fill="none" />
    <rect x="12.75" y="3.75" width="7.5" height="7.5" rx="1.5" fill="none" />
    <rect x="3.75" y="12.75" width="7.5" height="7.5" rx="1.5" fill="none" />
    <rect x="12.75" y="12.75" width="7.5" height="7.5" rx="1.5" fill="none" />
  </>
);

export const ArrowDownOnSquareStackIcon = createIcon(
  <>
    <path d="m8.25 10.5 3.75 3.75 3.75-3.75" />
    <path d="M12 3v11.25" />
    <path d="M5.25 6.75V18a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V6.75" />
    <path d="M6.75 3.75h10.5" />
  </>
);

export const ChartBarIcon = createIcon(
  <>
    <path d="M3.75 20.25h16.5" />
    <path d="M6.75 9v8.25" />
    <path d="M12 5.25v12" />
    <path d="M17.25 12v5.25" />
  </>
);

export const ArrowTrendingUpIcon = createIcon(
  <>
    <path d="M3 18 9.75 11.25 13.5 15 21 7.5" />
    <path d="M21 12V7.5h-4.5" />
  </>
);

export const DocumentArrowDownIcon = createIcon(
  <>
    <path d="M13.5 2.25H6a1.5 1.5 0 0 0-1.5 1.5v16.5A1.5 1.5 0 0 0 6 21.75h12a1.5 1.5 0 0 0 1.5-1.5v-9" fill="none" />
    <path d="M21 3 13.5 2.25v5.25H21" />
    <path d="M12 12v6" />
    <path d="m9.75 15.75 2.25 2.25 2.25-2.25" />
  </>
);

export const FireIcon = createIcon(
  <>
    <path d="M12 21c4.556 0 6.75-3.834 6.75-6.75 0-4.5-3.375-6-3.375-9 0-2.25-1.5-3.75-3.375-3.75S8.625 3 8.625 5.25c0 3-3.375 4.5-3.375 9C5.25 17.166 7.444 21 12 21Z" fill="none" />
    <path d="M9.75 13.5c0 1.657 1.007 3 2.25 3s2.25-1.343 2.25-3-2.25-3.75-2.25-6c0 2.25-2.25 4.343-2.25 6Z" />
  </>
);

export const CheckIcon = createIcon(
  <>
    <path d="m5 12 4 4L19 6" />
  </>
);

export const HomeIcon = createIcon(
  <>
    <path d="M3 9.75 12 3l9 6.75" />
    <path d="M4.5 10.5V21h15V10.5" />
    <path d="M9.75 21v-6.75h4.5V21" />
  </>
);
