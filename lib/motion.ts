export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeOutCubic = [0.33, 1, 0.68, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.7,
      ease: easeOutExpo,
    },
  }),
};

export const prefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
