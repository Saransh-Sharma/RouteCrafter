import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageField } from "./PdfThemeControls";

describe("ImageField", () => {
  it("updates the controlled URL when the selected itinerary changes", () => {
    const props = {
      onUpload: vi.fn(),
      onUrl: vi.fn(),
      onClear: vi.fn(),
    };
    const { rerender } = render(
      <ImageField value="https://example.com/a.jpg" {...props} />,
    );

    expect(
      (screen.getByPlaceholderText("or paste image URL") as HTMLInputElement)
        .value,
    ).toBe("https://example.com/a.jpg");

    rerender(<ImageField value="https://example.com/b.jpg" {...props} />);

    expect(
      (screen.getByPlaceholderText("or paste image URL") as HTMLInputElement)
        .value,
    ).toBe("https://example.com/b.jpg");
  });

  it("commits a changed URL on blur", () => {
    const onUrl = vi.fn();
    render(
      <ImageField
        value=""
        onUpload={vi.fn()}
        onUrl={onUrl}
        onClear={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("or paste image URL");
    fireEvent.change(input, {
      target: { value: "https://example.com/cover.jpg" },
    });
    fireEvent.blur(input);

    expect(onUrl).toHaveBeenCalledWith("https://example.com/cover.jpg");
  });
});
