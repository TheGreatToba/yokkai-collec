export function enableHorizontalWheel(element: HTMLElement) {
  const scroll = (event: WheelEvent) => {
    if (event.ctrlKey) return;
    const end = element.scrollWidth - element.clientWidth;
    const delta =
      (Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY) *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? element.clientWidth
          : 1);
    if (end <= 0 || delta === 0) return;
    event.preventDefault();
    element.scrollLeft =
      delta > 0 && element.scrollLeft >= end - 1
        ? 0
        : delta < 0 && element.scrollLeft <= 1
          ? end
          : Math.max(0, Math.min(end, element.scrollLeft + delta));
  };
  element.addEventListener("wheel", scroll, { passive: false });
  return () => element.removeEventListener("wheel", scroll);
}

// Use the same scroll position for automatic movement and manual navigation.
export function enableAutomaticScroll(element: HTMLElement) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let resumeAt = 0;
  const pause = () => {
    resumeAt = Date.now() + 6000;
  };
  element.addEventListener("wheel", pause, { passive: true });
  element.addEventListener("pointerdown", pause);
  const timer = window.setInterval(() => {
    if (
      motion.matches ||
      document.hidden ||
      Date.now() < resumeAt ||
      element.matches(":hover, :focus-within")
    )
      return;
    const end = element.scrollWidth - element.clientWidth;
    if (end > 0)
      element.scrollLeft =
        element.scrollLeft >= end - 1
          ? 0
          : Math.min(end, element.scrollLeft + 2);
  }, 50);
  return () => {
    window.clearInterval(timer);
    element.removeEventListener("wheel", pause);
    element.removeEventListener("pointerdown", pause);
  };
}
