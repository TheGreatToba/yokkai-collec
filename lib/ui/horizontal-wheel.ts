export function enableHorizontalWheel(element: HTMLElement) {
  const scroll = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))
      return;
    const delta =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? element.clientWidth
          : 1);
    const next = Math.max(
      0,
      Math.min(
        element.scrollWidth - element.clientWidth,
        element.scrollLeft + delta
      )
    );
    if (next === element.scrollLeft) return;
    event.preventDefault();
    element.scrollLeft = next;
  };
  element.addEventListener("wheel", scroll, { passive: false });
  return () => element.removeEventListener("wheel", scroll);
}
