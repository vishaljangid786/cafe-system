"use client";

import { useEffect } from "react";

function findDateInput(target, event) {
  if (!(target instanceof Element)) return null;

  const directInput = target.closest('input[type="date"]');
  if (directInput instanceof HTMLInputElement) return directInput;

  let node = target;
  for (let depth = 0; node && depth < 4; depth += 1) {
    const input = node.querySelector?.('input[type="date"]');
    if (input instanceof HTMLInputElement) {
      const rect = input.getBoundingClientRect();
      const isInsideInput =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (isInsideInput) return input;
    }

    node = node.parentElement;
  }

  return null;
}

export default function DateInputEnhancer() {
  useEffect(() => {
    const openDatePicker = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const input = findDateInput(event.target, event);
      if (!input || input.disabled || input.readOnly) return;

      input.focus({ preventScroll: true });

      if (typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch {
          // Some browsers throw if the picker is already open or blocked.
        }
      }
    };

    document.addEventListener("pointerdown", openDatePicker, true);

    return () => {
      document.removeEventListener("pointerdown", openDatePicker, true);
    };
  }, []);

  return null;
}
