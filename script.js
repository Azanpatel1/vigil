// One-time reveal-on-scroll for general sections
const revealEls = document.querySelectorAll(
  ".feature, .tl-item, .device-card, .pioneer, .solution-head, .science-intro, .cta-inner"
);
revealEls.forEach((el) => el.classList.add("reveal"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = entry.target.classList.contains("feature") || entry.target.classList.contains("tl-item") ? i * 40 : 0;
        setTimeout(() => entry.target.classList.add("in"), delay);
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
revealEls.forEach((el) => revealObserver.observe(el));

// Problem cards: pop in/out every time they enter or leave the viewport
const cards = document.querySelectorAll(".problem-cards .pcard");
cards.forEach((c) => c.classList.add("pop-hidden"));
const cardObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("pop-hidden", !entry.isIntersecting);
    });
  },
  { threshold: 0.25 }
);
cards.forEach((c) => cardObserver.observe(c));

// Big stat count-up — re-runs every time it scrolls back into view
const formatNum = (n) => n.toLocaleString("en-US");
const statEl = document.querySelector(".stat-num");
if (statEl) {
  const target = parseInt(statEl.dataset.count, 10);
  let raf = null;
  const runCount = () => {
    if (raf) cancelAnimationFrame(raf);
    const duration = 1800;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      statEl.textContent = formatNum(Math.floor(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
      else statEl.textContent = "Nearly " + formatNum(target);
    };
    raf = requestAnimationFrame(tick);
  };
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCount();
        } else {
          if (raf) cancelAnimationFrame(raf);
          statEl.textContent = "0";
        }
      });
    },
    { threshold: 0.6 }
  );
  countObserver.observe(statEl);
}
