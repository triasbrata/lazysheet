import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";
import { readStoredSettings, writeStoredSettings } from "@/lib/settings-pref";

vi.mock("@/lib/settings-pref", async (orig) => ({
  ...(await orig()),
  readStoredSettings: vi.fn().mockResolvedValue({ askBeforeClose: false }),
  writeStoredSettings: vi.fn(),
}));

const mockedReadStoredSettings = readStoredSettings as ReturnType<typeof vi.fn>;
const mockedWriteStoredSettings = writeStoredSettings as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedReadStoredSettings.mockResolvedValue({ askBeforeClose: false });
});

describe("useSettings", () => {
  it("initial state is DEFAULT_SETTINGS (askBeforeClose false) before hydration", () => {
    // Never resolves during this synchronous check
    mockedReadStoredSettings.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.askBeforeClose).toBe(false);
  });

  it("mount hydrates from readStoredSettings", async () => {
    mockedReadStoredSettings.mockResolvedValue({ askBeforeClose: true });
    const { result } = renderHook(() => useSettings());
    await waitFor(() => {
      expect(result.current.settings.askBeforeClose).toBe(true);
    });
  });

  it("setAskBeforeClose updates settings and calls writeStoredSettings", async () => {
    mockedReadStoredSettings.mockResolvedValue({ askBeforeClose: false });
    const { result } = renderHook(() => useSettings());

    // Wait for hydration to settle
    await waitFor(() => {
      expect(mockedReadStoredSettings).toHaveBeenCalled();
    });

    act(() => {
      result.current.setAskBeforeClose(true);
    });

    expect(result.current.settings.askBeforeClose).toBe(true);
    expect(mockedWriteStoredSettings).toHaveBeenCalledWith({ askBeforeClose: true });
  });
});
