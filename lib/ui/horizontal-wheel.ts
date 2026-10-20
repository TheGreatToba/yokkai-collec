function periodWidth(element: HTMLElement) {
  const width =
    element.querySelector<HTMLElement>("[data-scroll-period]")?.offsetWidth ??
    0;
  return width > element.clientWidth ? width : 0;
}

// Recenter on the identical middle copy, preserving the exact offset.
export function scrollStripBy(element: HTMLElement, delta: number) {
  const period = periodWidth(element);
  element.scrollLeft = period
    ? period +
      ((((element.scrollLeft - period + delta) % period) + period) % period)
    : Math.max(
        0,
        Math.min(
          element.scrollWidth - element.clientWidth,
          element.scrollLeft + delta
        )
      );
}

export function enableHorizontalWheel(element: HTMLElement) {
  const layout = () => {
    const period = periodWidth(element);
    element
      .querySelectorAll<HTMLElement>("[data-scroll-clone]")
      .forEach(copy => {
        copy.hidden = !period;
      });
    if (period) scrollStripBy(element, 0);
  };
  const recenter = () => {
    // Keyboard focus remains on the accessible copy; native focus scrolling wins.
    if (
      document.activeElement === element ||
      !element.contains(document.activeElement)
    )
      scrollStripBy(element, 0);
  };
  const scroll = (event: WheelEvent) => {
    if (event.ctrlKey) return;
    const delta =
      (Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY) *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? element.clientWidth
          : 1);
    if (element.scrollWidth <= element.clientWidth || !delta) return;
    event.preventDefault();
    scrollStripBy(element, delta);
  };
  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(element);
  const period = element.querySelector("[data-scroll-period]");
  if (period) observer.observe(period);
  element.addEventListener("wheel", scroll, { passive: false });
  element.addEventListener("scroll", recenter);
  return () => {
    observer.disconnect();
    element.removeEventListener("wheel", scroll);
    element.removeEventListener("scroll", recenter);
  };
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
    scrollStripBy(element, 2);
  }, 50);
  return () => {
    window.clearInterval(timer);
    element.removeEventListener("wheel", pause);
    element.removeEventListener("pointerdown", pause);
  };
}
