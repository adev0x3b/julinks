"use client";

import { useEffect } from "react";

/**
 * Public pages only. Adds ?from=<site the visitor arrived from> to the page's link addresses, so
 * the click counter learns that the visitor came from, say, instagram.com: the tap itself always
 * comes from this page. Only the host is sent, and nothing is stored in the browser.
 */
export function ReferrerTagger() {
  useEffect(() => {
    let host: string;
    try {
      host = new URL(document.referrer).host;
    } catch {
      return; // No referrer (typed in, an app that hides it): the click counts as direct.
    }
    if (!host || host === location.host) return;
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-link-id][href]")) {
      const url = new URL(a.href);
      url.searchParams.set("from", host);
      a.href = url.pathname + url.search;
    }
  }, []);
  return null;
}
