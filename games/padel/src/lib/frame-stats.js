// Lightweight, read-only diagnostics. CPU time is JS submission time, not GPU time.
export function createFrameStats(canvas, renderer) {
  let start = performance.now();
  let total = 0;
  let samples = [];
  return {
    reset() {
      start = performance.now();
      samples = [];
    },
    sample(cpuMs) {
      total++;
      samples.push(cpuMs);
      const now = performance.now();
      if (now - start < 1000) return;
      const count = samples.length;
      samples.sort((a, b) => a - b);
      canvas.dataset.performance = JSON.stringify({
        fps: Number(((count * 1000) / (now - start)).toFixed(1)),
        cpuMs: Number(
          (samples.reduce((sum, ms) => sum + ms, 0) / count).toFixed(2)
        ),
        cpuP95Ms: Number(samples[Math.floor((count - 1) * 0.95)].toFixed(2)),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        width: canvas.width,
        height: canvas.height,
        frames: total,
      });
      samples = [];
      start = now;
    },
  };
}
