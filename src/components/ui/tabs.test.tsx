import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants } from "./tabs";

describe("Tabs", () => {
  function BasicTabs() {
    return (
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );
  }

  it("renders tabs with triggers", () => {
    renderWithProviders(<BasicTabs />);
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
  });

  it("renders first tab content by default", () => {
    renderWithProviders(<BasicTabs />);
    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });

  it("switches tab content when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BasicTabs />);

    await user.click(screen.getByText("Tab 2"));
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("renders Tabs with correct data-slot", () => {
    renderWithProviders(<BasicTabs />);
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs).toBeInTheDocument();
  });

  it("renders TabsList with correct data-slot", () => {
    renderWithProviders(<BasicTabs />);
    const list = document.querySelector("[data-slot='tabs-list']");
    expect(list).toBeInTheDocument();
  });

  it("renders TabsTrigger with correct data-slot", () => {
    renderWithProviders(<BasicTabs />);
    const triggers = document.querySelectorAll("[data-slot='tabs-trigger']");
    expect(triggers.length).toBe(2);
  });

  it("renders TabsContent with correct data-slot", () => {
    renderWithProviders(<BasicTabs />);
    const contents = document.querySelectorAll("[data-slot='tabs-content']");
    expect(contents.length).toBeGreaterThan(0);
  });

  it("renders Tabs with vertical orientation", () => {
    renderWithProviders(
      <Tabs defaultValue="tab1" orientation="vertical">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs).toHaveAttribute("data-orientation", "vertical");
  });

  it("renders TabsList with default variant", () => {
    renderWithProviders(
      <Tabs defaultValue="tab1">
        <TabsList variant="default">
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );
    const list = document.querySelector("[data-slot='tabs-list']");
    expect(list).toHaveAttribute("data-variant", "default");
  });

  it("renders TabsList with line variant", () => {
    renderWithProviders(
      <Tabs defaultValue="tab1">
        <TabsList variant="line">
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );
    const list = document.querySelector("[data-slot='tabs-list']");
    expect(list).toHaveAttribute("data-variant", "line");
  });

  describe("tabsListVariants", () => {
    it("returns class string for default variant", () => {
      const cls = tabsListVariants({ variant: "default" });
      expect(typeof cls).toBe("string");
      expect(cls).toContain("bg-muted");
    });

    it("returns class string for line variant", () => {
      const cls = tabsListVariants({ variant: "line" });
      expect(typeof cls).toBe("string");
      expect(cls).toContain("bg-transparent");
    });

    it("returns class string with no args (uses defaults)", () => {
      const cls = tabsListVariants();
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
    });
  });

  it("renders custom className on Tabs", () => {
    renderWithProviders(
      <Tabs defaultValue="tab1" className="custom-tabs">
        <TabsList>
          <TabsTrigger value="tab1">Tab</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );
    const tabs = document.querySelector("[data-slot='tabs']");
    expect(tabs?.className).toContain("custom-tabs");
  });

  it("renders controlled Tabs with value and onValueChange", async () => {
    const user = userEvent.setup();
    let currentValue = "tab1";
    const { rerender } = renderWithProviders(
      <Tabs value={currentValue} onValueChange={(v) => { currentValue = v; }}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });
});
