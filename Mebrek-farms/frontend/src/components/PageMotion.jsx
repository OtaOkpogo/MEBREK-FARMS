import { useEffect } from "react";
import { animate, stagger } from "animejs";

export default function PageMotion() {
  useEffect(() => {
    const page = document.querySelector(
      "[data-farm-motion-root]"
    ) || document.querySelector("main") || document.body;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    const animations = [];

    const runAnimation = (targets, options) => {
      if (!targets || !targets.length) return;

      animations.push(
        animate(targets, options)
      );
    };

    // -------------------------------------------------------
    // HERO ENTRANCE
    // -------------------------------------------------------

    const hero = page.querySelector("section");

    if (hero) {
      const heroContent = hero.querySelector(
        ".site-container > div"
      );

      if (heroContent) {
        const heroItems = Array.from(heroContent.children);

        runAnimation(heroItems, {
          opacity: [0, 1],
          translateY: [28, 0],
          delay: stagger(120),
          duration: 850,
          ease: "out(3)",
        });
      }
    }

    // -------------------------------------------------------
    // SCROLL-TRIGGERED SECTION REVEALS
    // -------------------------------------------------------

    const sections = Array.from(
      page.querySelectorAll("section")
    ).filter((section) => section !== hero);

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const section = entry.target;
          const container = section.querySelector(".site-container");

          if (!container) {
            currentObserver.unobserve(section);
            return;
          }

          const directChildren = Array.from(container.children);

          // Animate the main content groups in the section.
          runAnimation(directChildren, {
            opacity: [0, 1],
            translateY: [24, 0],
            delay: stagger(100),
            duration: 750,
            ease: "out(3)",
          });

          // Stagger cards inside grids.
          const grids = section.querySelectorAll(".grid");

          grids.forEach((grid) => {
            const cards = Array.from(grid.children).filter(
              (child) => child.children.length > 0
            );

            if (cards.length > 1) {
              runAnimation(cards, {
                opacity: [0, 1],
                translateY: [22, 0],
                delay: stagger(85),
                duration: 700,
                ease: "out(3)",
              });
            }
          });

          currentObserver.unobserve(section);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -45px 0px",
      }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      observer.disconnect();

      animations.forEach((animation) => {
        animation.cancel();
      });
    };
  }, []);

  return null;
}
