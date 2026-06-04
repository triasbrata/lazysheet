// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { screen } from "@testing-library/react";

// Hero renders a TanStack <Link>, which normally needs a RouterProvider.
// Stub it with a plain anchor so we can test the section in isolation —
// no router, no loader, no network.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
    useParams: () => ({ locale: 'en' }),
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/en' }),
  };
});

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

import { Hero, Formats, Faq } from "#/routes/$locale/index";
import type { DownloadData } from "#/lib/releases-data";
import { renderWithI18n } from "#/test/i18n";

const mockData: DownloadData = {
  serverOS: "macOS",
  release: null,
} as DownloadData;

afterEach(cleanup);

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
