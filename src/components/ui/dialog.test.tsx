import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
} from "./dialog";

describe("Dialog", () => {
  it("renders dialog trigger", () => {
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Open Dialog")).toBeInTheDocument();
  });

  it("opens dialog content after trigger click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <p>Dialog content text</p>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    expect(screen.getByText("Dialog content text")).toBeInTheDocument();
  });

  it("shows close button when showCloseButton is true (default)", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showCloseButton>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText("Open"));
    // Close button has sr-only "Close" text
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("does not show close button when showCloseButton is false", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByText("Open"));
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("renders with open prop (controlled open state)", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Controlled Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Controlled Title")).toBeInTheDocument();
  });

  it("renders DialogHeader with children", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header Title</DialogTitle>
            <DialogDescription>Header Description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Header Title")).toBeInTheDocument();
    expect(screen.getByText("Header Description")).toBeInTheDocument();
  });

  it("renders DialogFooter", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("renders DialogFooter with showCloseButton", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
          <DialogFooter showCloseButton>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    // DialogFooter's Close button is present (DialogContent's own close button is suppressed)
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders DialogTitle with correct data-slot", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogTitle>My Title</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    const title = screen.getByText("My Title");
    expect(title).toHaveAttribute("data-slot", "dialog-title");
  });

  it("renders DialogDescription with correct data-slot", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogDescription>Desc text</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const desc = screen.getByText("Desc text");
    expect(desc).toHaveAttribute("data-slot", "dialog-description");
  });

  it("DialogClose renders a close element", () => {
    renderWithProviders(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
          <DialogClose>Custom Close</DialogClose>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Custom Close")).toBeInTheDocument();
  });
});
