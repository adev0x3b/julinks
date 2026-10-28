"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FramedImage } from "@/components/PublicProfile";
import { MAX_ZOOM, type ImageFocus } from "@/lib/validation";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Picks where a picture is centred inside its frame, and how far it is zoomed
 * in around that point. Click or drag on the picture to move the point, or use
 * the sliders; the frame on the right shows the result the way the public page
 * crops it (see focusStyle). Parents own the value and decide when to save it.
 */
export function FocalPointPicker({
  src,
  focus,
  shape,
  name,
  onChange,
}: {
  src: string;
  focus: ImageFocus;
  /** The frame to preview: the round avatar or small thumbnail, or the big card image. */
  shape: "circle" | "card";
  /** Makes the control labels unique on a page with several pickers. */
  name: string;
  onChange: (focus: ImageFocus) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function pointAt(ev: ReactPointerEvent<HTMLDivElement>) {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    onChange({
      ...focus,
      x: clamp(((ev.clientX - box.left) / box.width) * 100),
      y: clamp(((ev.clientY - box.top) / box.height) * 100),
    });
  }

  return (
    <div
      className="flex flex-wrap items-start gap-4"
      data-testid="focal-point-picker"
    >
      <div className="flex w-56 max-w-full flex-col gap-2">
        <div
          ref={areaRef}
          className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg bg-stone-100"
          onPointerDown={(ev) => {
            dragging.current = true;
            ev.currentTarget.setPointerCapture(ev.pointerId);
            pointAt(ev);
          }}
          onPointerMove={(ev) => dragging.current && pointAt(ev)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          data-testid="focal-point-area"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="block w-full" draggable={false} />
          <span
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
            style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
            aria-hidden
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <span className="w-16">Horizontal</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focus.x}
            aria-label={`Horizontal position of ${name}`}
            onChange={(ev) =>
              onChange({ ...focus, x: Number(ev.target.value) })
            }
            className="min-w-0 flex-1"
          />
          <span className="w-9 text-right tabular-nums">{focus.x}%</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <span className="w-16">Vertical</span>
          <input
            type="range"
            min={0}
            max={100}
            value={focus.y}
            aria-label={`Vertical position of ${name}`}
            onChange={(ev) =>
              onChange({ ...focus, y: Number(ev.target.value) })
            }
            className="min-w-0 flex-1"
          />
          <span className="w-9 text-right tabular-nums">{focus.y}%</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <span className="w-16">Zoom</span>
          <input
            type="range"
            min={100}
            max={MAX_ZOOM}
            step={5}
            value={focus.zoom}
            aria-label={`Zoom of ${name}`}
            onChange={(ev) =>
              onChange({ ...focus, zoom: Number(ev.target.value) })
            }
            className="min-w-0 flex-1"
          />
          <span className="w-9 text-right tabular-nums">
            {(focus.zoom / 100).toFixed(1)}×
          </span>
        </label>
      </div>
      <div className="flex flex-col items-center gap-1">
        <FramedImage
          src={src}
          focus={focus}
          className={
            shape === "circle"
              ? "size-20 rounded-full"
              : "aspect-[16/10] w-40 rounded-xl"
          }
          testId="focal-point-preview"
        />
        <span className="text-xs text-stone-500">Preview</span>
      </div>
    </div>
  );
}

/** Calls `save` with the latest value once changes pause for `delay` ms, and once more on unmount if one is pending. */
export function useDebouncedSave<T>(save: (value: T) => void, delay = 400) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValue = useRef<T | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (pendingValue.current !== null)
          saveRef.current(pendingValue.current);
      }
    },
    [],
  );
  return (value: T) => {
    pendingValue.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      pendingValue.current = null;
      saveRef.current(value);
    }, delay);
  };
}
