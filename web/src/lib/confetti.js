import confetti from 'canvas-confetti';

/**
 * Fires an elegant celebratory confetti burst
 */
export function fireConfetti(options = {}) {
  try {
    const count = options.count || 60;
    const defaults = {
      origin: { y: 0.65 },
      zIndex: 9999,
      colors: ['#7c6cf0', '#3ecf8e', '#58a6ff', '#f0b254', '#f2637a'],
      disableForReducedMotion: true,
    };

    confetti({
      ...defaults,
      ...options,
      particleCount: Math.floor(count * 0.5),
      spread: 60,
    });

    setTimeout(() => {
      confetti({
        ...defaults,
        ...options,
        particleCount: Math.floor(count * 0.5),
        spread: 100,
        angle: 60,
        origin: { x: 0.2, y: 0.7 },
      });
      confetti({
        ...defaults,
        ...options,
        particleCount: Math.floor(count * 0.5),
        spread: 100,
        angle: 120,
        origin: { x: 0.8, y: 0.7 },
      });
    }, 150);
  } catch {
    /* gracefully handle unsupported environments */
  }
}
