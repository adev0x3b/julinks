"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sharing on the public page: a button for the page itself and a ⋮ menu per link.
 * Both use the system share sheet where there is one (phones) and copy the address
 * otherwise. In previews they render but do nothing, like every other link there.
 */

async function shareOrCopy(title: string, url: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      // Closing the sheet is not a failure; anything else falls through to copying.
      if ((error as Error).name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

const chip = "jl-chip grid size-10 place-items-center rounded-full transition hover:scale-105";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

/** A short confirmation under the control that asked for it. */
function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return [
    notice,
    (text: string) => {
      setNotice(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), 2000);
    },
  ] as const;
}

export function PageShareButton({ username, displayName, preview }: { username: string; displayName: string; preview: boolean }) {
  const [notice, notify] = useNotice();
  return (
    <div className="relative">
      <button
        type="button"
        className={chip}
        aria-label="Share this page"
        title="Share this page"
        onClick={async () => {
          if (preview) return;
          const outcome = await shareOrCopy(displayName, `${window.location.origin}/${username}`);
          if (outcome === "copied") notify("Link copied");
          if (outcome === "failed") notify("Could not copy the link");
        }}
        data-testid="share-page"
      >
        <ShareIcon />
      </button>
      {notice && (
        <p className="jl-chip absolute right-0 top-12 whitespace-nowrap rounded-full px-3 py-1 text-xs" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

export function LinkMenu({ title, url, preview, className = "" }: { title: string; url: string; preview: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const [notice, notify] = useNotice();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (ev: Event) => {
      if (ev instanceof KeyboardEvent ? ev.key === "Escape" : !ref.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function run(action: "share" | "copy") {
    setOpen(false);
    if (action === "share") {
      const outcome = await shareOrCopy(title, url);
      if (outcome === "copied") notify("Link copied");
    } else {
      try {
        await navigator.clipboard.writeText(url);
        notify("Link copied");
      } catch {
        notify("Could not copy the link");
      }
    }
  }

  return (
    <div ref={ref} className={`absolute ${open ? "z-30" : "z-10"} ${className}`}>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100"
        style={{ color: "var(--jl-btn-text)" }}
        aria-label={`More options for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => !preview && setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-xl bg-white py-1 text-left text-sm text-stone-900 shadow-lg ring-1 ring-black/10">
          <button type="button" role="menuitem" className="block w-full px-4 py-2 text-left hover:bg-stone-100" onClick={() => run("share")}>
            Share link
          </button>
          <button type="button" role="menuitem" className="block w-full px-4 py-2 text-left hover:bg-stone-100" onClick={() => run("copy")}>
            Copy link
          </button>
        </div>
      )}
      {notice && (
        <p className="absolute right-0 top-10 z-20 whitespace-nowrap rounded-full bg-stone-900 px-3 py-1 text-xs text-white" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
