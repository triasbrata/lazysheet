// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { screen } from "@testing-library/react";
import React from "react";

// Hero renders a TanStack <Link>, which normally needs a RouterProvider.
// Stub it with a plain anchor so we can test the section in isolation —
// no router, no loader, no network.
// Route.useLoaderData is also mocked so Home can be rendered.
// useParams is a hoisted spy so we can override it per-test to cover fallback branches.
const { mockUseParamsIndex } = vi.hoisted(() => ({
  mockUseParamsIndex: vi.fn(() => ({ locale: 'en' as string | undefined })),
}))

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: (...args: unknown[]) => mockUseParamsIndex(...args),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/en' }),
    createFileRoute: () => (opts: unknown) => ({
      options: opts,
      useLoaderData: () => mockLoaderData,
      useParams: () => ({ locale: 'en' }),
    }),
  };
});

// Stub getDownloadData (a createServerFn) so the Route loader can be invoked
// without a server runtime ("No Start context") error.
vi.mock("#/lib/releases-data", () => ({
  getDownloadData: vi.fn(() =>
    Promise.resolve({ release: null, serverOS: "unknown" }),
  ),
}));

// motion/react mock — needed by BentoGrid/BentoCard used in Features
vi.mock('motion/react', () => {
  function makeMotionComponent(tag: string) {
    return function MotionEl({
      children,
      style,
      className,
      onMouseMove,
      onMouseLeave,
      whileHover,
      initial,
      variants,
      transition,
      ...rest
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) {
      return React.createElement(
        tag,
        { style, className, onMouseMove, onMouseLeave, ...rest },
        children,
      )
    }
  }

  const motion = new Proxy(
    {},
    {
      get(_target, tag: string) {
        return makeMotionComponent(tag)
      },
    },
  )

  return {
    motion,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: (_mv: unknown, _in: unknown, out: unknown[]) => ({
      get: () => (Array.isArray(out) ? out[0] : 0),
    }),
    useMotionValue: (v: number) => ({ get: () => v, set: vi.fn() }),
    useSpring: (mv: unknown) => mv,
    useReducedMotion: () => false,
    useMotionValueEvent: vi.fn(),
  }
})

// Stub FeedbackDialog so it doesn't pull in createServerFn (server-only)
vi.mock("#/features/feedback/feedback-dialog", () => ({
  FeedbackDialog: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

// Stub GithubStars so it doesn't pull in the fetch hook
vi.mock("#/features/github/github-stars", () => ({
  GithubStars: () => null,
}))

// Pin client OS detection to "unknown" so the DownloadButton label is driven
// by serverOS (happy-dom's userAgent says "Linux", which would override it).
vi.mock("#/lib/os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#/lib/os")>();
  return {
    ...actual,
    detectClientOSArch: () => Promise.resolve({ os: "unknown", arch: null }),
  };
});

import { Hero, Formats, Faq, Route } from "#/routes/$locale/index";
import type { DownloadData } from "#/lib/releases-data";
import { renderWithI18n } from "#/test/i18n";

const mockData: DownloadData = {
  serverOS: "macOS",
  release: null,
} as DownloadData;

// Mutable loader data used by Route.useLoaderData stub
let mockLoaderData: DownloadData = mockData;

afterEach(() => {
  cleanup();
  mockLoaderData = mockData;
  mockUseParamsIndex.mockReset();
  mockUseParamsIndex.mockImplementation(() => ({ locale: 'en' }));
});

describe("Hero section — what the user sees", () => {
  it('shows the headline "Fast. Simple. Spreadsheet Viewer."', () => {
    renderWithI18n(<Hero data={mockData} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Fast. Simple.");
    expect(heading.textContent).toContain("Spreadsheet Viewer.");
  });

  it("shows the value-proposition subheading", () => {
    renderWithI18n(<Hero data={mockData} />);

    expect(screen.getByText(/Open 100MB CSVs instantly/i)).toBeTruthy();
  });

  it('offers a download action and an "Other downloads" link', () => {
    renderWithI18n(<Hero data={mockData} />);

    // DownloadButton renders an anchor whose label starts with "Download"
    expect(screen.getByText(/^Download/i)).toBeTruthy();
    expect(screen.getByText(/Other downloads/i)).toBeTruthy();
  });

  it('labels the download button "Download for <os>" with the Apple icon', () => {
    const { container } = renderWithI18n(
      <Hero data={{ ...mockData, serverOS: "macOS" }} />,
    );
    expect(screen.getByText("Download for macOS")).toBeTruthy();
    expect(container.querySelector('svg[data-icon="apple"]')).toBeTruthy();
  });

  it("reflects a Windows serverOS with label and Windows icon", () => {
    const { container } = renderWithI18n(
      <Hero data={{ ...mockData, serverOS: "Windows" }} />,
    );
    expect(screen.getByText("Download for Windows")).toBeTruthy();
    expect(container.querySelector('svg[data-icon="windows"]')).toBeTruthy();
  });

  it("reflect75s a Linux serverOS with label and Linux icon", () => {
    const { container } = renderWithI18n(
      <Hero data={{ ...mockData, serverOS: "Linux" }} />,
    );
    expect(screen.getByText("Download for Linux")).toBeTruthy();
    expect(container.querySelector('svg[data-icon="linux"]')).toBeTruthy();
  });
});

describe("Formats section — what the user sees", () => {
  it('shows the "Wide format support" heading', () => {
    renderWithI18n(<Formats />);
    expect(screen.getByText(/Wide format support/i)).toBeTruthy();
  });

  it("lists the supported file extensions", () => {
    renderWithI18n(<Formats />);
    for (const ext of [".xlsx", ".xlsm", ".xls", ".csv", ".tsv"]) {
      expect(screen.getByText(ext)).toBeTruthy();
    }
  });
});

describe("Faq section — what the user sees", () => {
  it("shows the troubleshooting heading", () => {
    renderWithI18n(<Faq />);
    expect(screen.getByText(/Having trouble opening the app\?/i)).toBeTruthy();
  });

  it("shows the Gatekeeper question as an accordion trigger", () => {
    renderWithI18n(<Faq />);
    expect(screen.getByText(/unidentified\s+developer/i)).toBeTruthy();
  });

  it("reveals the fix command (open by default)", () => {
    renderWithI18n(<Faq />);
    expect(screen.getByText(/xattr -dr com\.apple\.quarantine/i)).toBeTruthy();
  });

  it("shows the Linux .deb dependency question as an accordion trigger", () => {
    renderWithI18n(<Faq />);
    expect(screen.getByText(/missing dependencies/i)).toBeTruthy();
  });

  it("reveals the apt install command after opening the .deb item", () => {
    renderWithI18n(<Faq />);
    fireEvent.click(screen.getByText(/missing dependencies/i));
    expect(
      screen.getByText(
        /sudo apt install -y libjavascriptcoregtk-4\.1-0 libsoup-3\.0-0 libsoup-3\.0-common libwebkit2gtk-4\.1-0/i,
      ),
    ).toBeTruthy();
  });
});

describe("Features section (bento grid) — what the user sees", () => {
  it('renders the "Features" heading via BentoGrid header', () => {
    // Access via Route.options.component, which is Home; but Features is the
    // inner component. Render via Home route component instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const Home = opts.component as React.ComponentType

    renderWithI18n(React.createElement(Home));
    // The Features section heading (from en.json: features.heading)
    expect(screen.getByText(/Engineered for Performance/i)).toBeTruthy();
  });

  it('shows at least one bento tile title', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const Home = opts.component as React.ComponentType
    renderWithI18n(React.createElement(Home));
    // "Group-by Summary" is always the first bento tile (may appear in heading + dialog title)
    const tiles = screen.getAllByText(/Group-by Summary/i);
    expect(tiles.length).toBeGreaterThan(0);
  });
});

describe("Home page (route component) — rendering via loader data", () => {
  it("renders without crashing with null release", () => {
    mockLoaderData = { serverOS: "macOS", release: null } as DownloadData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const Home = opts.component as React.ComponentType
    expect(() => renderWithI18n(React.createElement(Home))).not.toThrow();
  });

  it("renders the hero heading", () => {
    mockLoaderData = { serverOS: "Windows", release: null } as DownloadData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    const Home = opts.component as React.ComponentType
    renderWithI18n(React.createElement(Home));
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Fast. Simple.");
  });
});

// ---------------------------------------------------------------------------
// Hero locale fallback branch — when params.locale is undefined
// ---------------------------------------------------------------------------
describe("Hero locale fallback branch", () => {
  it("renders correctly when useParams returns no locale (hits DEFAULT_LOCALE fallback)", () => {
    // Override useParams to return no locale — hits the `?? ''` branch and DEFAULT_LOCALE fallback
    mockUseParamsIndex.mockReturnValue({ locale: undefined });
    renderWithI18n(<Hero data={mockData} />);
    // Should still render the download button (uses DEFAULT_LOCALE = 'en')
    expect(screen.getByText(/^Download/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Route.options.loader — covers the loader function
// ---------------------------------------------------------------------------
describe("Route.options.loader", () => {
  it("calls getDownloadData when invoked", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = (Route as any).options
    // The loader is `() => getDownloadData()`. getDownloadData is mocked above,
    // so await it to keep the rejection from escaping as an unhandled error.
    expect(typeof opts.loader).toBe('function');
    await expect(opts.loader()).resolves.toEqual({
      release: null,
      serverOS: "unknown",
    });
  });
});
