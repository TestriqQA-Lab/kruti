"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseAutoSaveOptions {
  postId: string;
  title: string;
  body: string;
  customSignature: string | null;
  isPublished: boolean;
  debounceMs?: number;
}

export function useAutoSave({
  postId,
  title,
  body,
  customSignature,
  isPublished,
  debounceMs = 3000,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  const lastSavedRef = useRef({ title, body, customSignature });
  const isDirtyRef = useRef(false);

  const isDirty =
    title !== lastSavedRef.current.title || 
    body !== lastSavedRef.current.body || 
    customSignature !== lastSavedRef.current.customSignature;

  // Update isDirtyRef for beforeunload handler
  isDirtyRef.current = isDirty;

  // Cancel any pending auto-save timer
  const cancelAutoSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Mark content as saved (called after manual save succeeds)
  const markSaved = useCallback(() => {
    lastSavedRef.current = { title, body, customSignature };
    cancelAutoSave();
    setStatus("idle");
  }, [title, body, customSignature, cancelAutoSave]);

  // Perform the auto-save
  const doAutoSave = useCallback(
    async (currentTitle: string, currentBody: string, currentSignature: string | null) => {
      if (savingRef.current) return;
      if (
        currentTitle === lastSavedRef.current.title && 
        currentBody === lastSavedRef.current.body &&
        currentSignature === lastSavedRef.current.customSignature
      ) return;

      savingRef.current = true;
      setStatus("saving");
      try {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            title: currentTitle, 
            body: currentBody,
            customSignature: currentSignature 
          }),
        });

        if (res.ok) {
          lastSavedRef.current = { title: currentTitle, body: currentBody, customSignature: currentSignature };
          setStatus("saved");
          setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      } finally {
        savingRef.current = false;
      }
    },
    [postId]
  );

  // Watch for content changes and schedule auto-save
  useEffect(() => {
    // Skip on mount
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    // Don't auto-save published posts
    if (isPublished) return;

    // Don't auto-save if nothing changed
    if (
      title === lastSavedRef.current.title && 
      body === lastSavedRef.current.body &&
      customSignature === lastSavedRef.current.customSignature
    ) return;

    // Clear existing timer and set new one
    cancelAutoSave();
    timerRef.current = setTimeout(() => {
      doAutoSave(title, body, customSignature);
    }, debounceMs);

    return () => cancelAutoSave();
  }, [title, body, customSignature, isPublished, debounceMs, cancelAutoSave, doAutoSave]);

  // Warn on page leave with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAutoSave();
  }, [cancelAutoSave]);

  return { status, isDirty, cancelAutoSave, markSaved };
}
