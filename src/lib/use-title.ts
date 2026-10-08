"use client";

import { useEffect } from "react";

export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Idea Garden` : "Idea Garden";
  }, [title]);
}
