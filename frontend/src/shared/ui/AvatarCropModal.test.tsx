import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MockMediaSize = {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
};

type MockCropperProps = {
  style?: {
    cropAreaStyle?: Record<string, string>;
  };
  onMediaLoaded?: (mediaSize: MockMediaSize) => void;
  onCropComplete?: (
    croppedArea: MockCropArea,
    croppedAreaPixels: MockCropArea,
  ) => void;
  onCropAreaChange?: (
    croppedArea: MockCropArea,
    croppedAreaPixels: MockCropArea,
  ) => void;
};

const cropperState = vi.hoisted(() => ({
  props: null as MockCropperProps | null,
}));

vi.mock("react-easy-crop", () => ({
  default: (props: MockCropperProps) => {
    cropperState.props = props;
    return <div data-testid="avatar-cropper" />;
  },
}));

import { AvatarCropModal } from "./AvatarCropModal";

describe("AvatarCropModal", () => {
  beforeEach(() => {
    cropperState.props = null;
  });

  it("normalizes crop from completed pixel area and media natural size", () => {
    const onApply = vi.fn();

    render(
      <AvatarCropModal
        open
        image="blob:test-image"
        onCancel={vi.fn()}
        onApply={onApply}
      />,
    );

    expect(cropperState.props?.style?.cropAreaStyle).toEqual({
      width: "100%",
      height: "100%",
    });

    act(() => {
      cropperState.props?.onMediaLoaded?.({
        width: 360,
        height: 360,
        naturalWidth: 4000,
        naturalHeight: 2000,
      });
      cropperState.props?.onCropComplete?.(
        { x: 10, y: 20, width: 30, height: 40 },
        { x: 400, y: 500, width: 1000, height: 700 },
      );
    });

    fireEvent.click(screen.getAllByRole("button")[1] as HTMLButtonElement);

    expect(onApply).toHaveBeenCalledWith({
      x: 0.1,
      y: 0.25,
      width: 0.25,
      height: 0.35,
    });
  });

  it("preserves crop size near edges and adjusts only x/y into bounds", () => {
    const onApply = vi.fn();

    render(
      <AvatarCropModal
        open
        image="blob:test-image"
        onCancel={vi.fn()}
        onApply={onApply}
      />,
    );

    act(() => {
      cropperState.props?.onMediaLoaded?.({
        width: 300,
        height: 300,
        naturalWidth: 1000,
        naturalHeight: 1000,
      });
      cropperState.props?.onCropComplete?.(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 950, y: 970, width: 120, height: 80 },
      );
      cropperState.props?.onCropAreaChange?.(
        { x: 50, y: 50, width: 10, height: 10 },
        { x: 200, y: 200, width: 20, height: 20 },
      );
    });

    fireEvent.click(screen.getAllByRole("button")[1] as HTMLButtonElement);

    const crop = onApply.mock.calls[0]?.[0] as MockCropArea;
    expect(crop.width).toBeCloseTo(0.12, 6);
    expect(crop.height).toBeCloseTo(0.08, 6);
    expect(crop.x).toBeCloseTo(0.88, 6);
    expect(crop.y).toBeCloseTo(0.92, 6);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1);
  });

  it("does not dismiss on backdrop click or Escape and only triggers actions via buttons", () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();

    render(
      <AvatarCropModal
        open
        image="blob:test-image"
        onCancel={onCancel}
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button")[0] as HTMLButtonElement);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole("button")[1] as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
