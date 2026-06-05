import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  describe("variants", () => {
    it("renders default variant", () => {
      renderWithProviders(<Button variant="default">Default</Button>);
      expect(screen.getByRole("button", { name: "Default" })).toBeInTheDocument();
    });

    it("renders destructive variant", () => {
      renderWithProviders(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole("button", { name: "Destructive" })).toBeInTheDocument();
    });

    it("renders outline variant", () => {
      renderWithProviders(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole("button", { name: "Outline" })).toBeInTheDocument();
    });

    it("renders secondary variant", () => {
      renderWithProviders(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole("button", { name: "Secondary" })).toBeInTheDocument();
    });

    it("renders ghost variant", () => {
      renderWithProviders(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole("button", { name: "Ghost" })).toBeInTheDocument();
    });

    it("renders link variant", () => {
      renderWithProviders(<Button variant="link">Link</Button>);
      expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
    });
  });

  describe("sizes", () => {
    it("renders default size", () => {
      renderWithProviders(<Button size="default">Default Size</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders xs size", () => {
      renderWithProviders(<Button size="xs">XS</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders sm size", () => {
      renderWithProviders(<Button size="sm">SM</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders lg size", () => {
      renderWithProviders(<Button size="lg">LG</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders icon size", () => {
      renderWithProviders(<Button size="icon">I</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders icon-xs size", () => {
      renderWithProviders(<Button size="icon-xs">I</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders icon-sm size", () => {
      renderWithProviders(<Button size="icon-sm">I</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders icon-lg size", () => {
      renderWithProviders(<Button size="icon-lg">I</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("asChild (Slot path)", () => {
    it("renders as anchor element when asChild is true", () => {
      renderWithProviders(
        <Button asChild>
          <a href="https://example.com">Link Button</a>
        </Button>
      );
      const link = screen.getByRole("link", { name: "Link Button" });
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe("A");
    });
  });

  describe("buttonVariants", () => {
    it("returns a class string for default variant", () => {
      const cls = buttonVariants({ variant: "default", size: "default" });
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
    });

    it("returns a class string for destructive variant", () => {
      const cls = buttonVariants({ variant: "destructive" });
      expect(typeof cls).toBe("string");
      expect(cls).toContain("destructive");
    });

    it("returns a class string for outline variant", () => {
      const cls = buttonVariants({ variant: "outline" });
      expect(typeof cls).toBe("string");
    });

    it("returns a class string for secondary variant", () => {
      const cls = buttonVariants({ variant: "secondary" });
      expect(typeof cls).toBe("string");
    });

    it("returns a class string for ghost variant", () => {
      const cls = buttonVariants({ variant: "ghost" });
      expect(typeof cls).toBe("string");
    });

    it("returns a class string for link variant", () => {
      const cls = buttonVariants({ variant: "link" });
      expect(typeof cls).toBe("string");
    });

    it("returns class string with no args (uses defaults)", () => {
      const cls = buttonVariants();
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
    });
  });

  it("applies custom className", () => {
    renderWithProviders(<Button className="my-custom-class">Custom</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("my-custom-class");
  });

  it("passes data-slot attribute", () => {
    renderWithProviders(<Button>Slot</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-slot", "button");
  });

  it("passes data-variant attribute", () => {
    renderWithProviders(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-variant", "ghost");
  });
});
