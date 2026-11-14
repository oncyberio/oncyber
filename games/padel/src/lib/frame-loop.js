/** Pace expensive scene work, and leave paused/hidden scenes completely asleep. */
export function createFrameLoop(
  render,
  {
    request = requestAnimationFrame,
    cancel = cancelAnimationFrame,
    fps = 60,
  } = {}
) {
  const interval = 1000 / fps;
  let frame = null;
  let visible = true;
  let running = false;
  let disposed = false;
  let lastDue = null;
  let lastRendered = null;
  const resetTime = () => {
    lastDue = lastRendered = null;
  };
  function stop() {
    if (frame !== null) cancel(frame);
    frame = null;
    resetTime();
  }
  function invalidate() {
    if (!disposed && visible && frame === null) frame = request(tick);
  }
  function tick(now) {
    frame = null;
    if (disposed || !visible) return;
    const elapsed = lastDue === null ? interval : now - lastDue;
    if (running && elapsed < interval - 0.5) {
      invalidate();
      return;
    }
    const dt = running
      ? Math.min(
          0.04,
          lastRendered === null ? 1 / fps : (now - lastRendered) / 1000
        )
      : 0;
    lastDue = now - (Math.max(0, elapsed - interval) % interval);
    lastRendered = now;
    render(dt);
    if (running) invalidate();
  }
  return {
    invalidate,
    setRunning(value) {
      if (running === value || disposed) return;
      running = value;
      stop();
      // One final frame applies the pause UI/resize, then no more callbacks.
      invalidate();
    },
    setVisible(value) {
      if (visible === value || disposed) return;
      visible = value;
      stop();
      invalidate();
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
