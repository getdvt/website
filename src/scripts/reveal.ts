/**
 * Scroll-reveal: fades/rises elements marked [data-reveal] into view as they
 * enter the viewport. Honours reduced-motion (everything shows immediately).
 * Optional per-element stagger via data-reveal-delay="120" (ms).
 */
const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduced || !('IntersectionObserver' in window)) {
  els.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay || 0);
        if (delay) el.style.transitionDelay = `${delay}ms`;
        el.classList.add('in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
  );
  els.forEach((el) => io.observe(el));
}
