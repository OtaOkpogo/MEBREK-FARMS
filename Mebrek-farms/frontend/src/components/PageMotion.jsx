import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { animate, stagger } from "animejs";

// ============================================================
// CENTRAL PUBLIC WEBSITE ANIMATION SYSTEM
// MEBREK FARMS
// ============================================================

export default function PageMotion() {
  const { pathname } = useLocation();

  useEffect(() => {
    const motionRoot = document.querySelector("[data-farm-motion-root]");

    if (!motionRoot) return;

    // Animate only the public page content.
    // Keep the Navbar and Footer outside the animation system.
    const page = motionRoot.querySelector("main");

    if (!page) return;

    // ========================================================
    // ACCESSIBILITY
    // ========================================================

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      return;
    }

    const animations = [];
    const observers = [];

    // Keep track of elements already assigned to animations.
    const animatedElements = new Set();

    // ========================================================
    // ANIMATION HELPER
    // ========================================================

    const runAnimation = (targets, options) => {
      const validTargets = Array.from(targets || []).filter(Boolean);

      if (!validTargets.length) return;

      const animation = animate(validTargets, options);

      animations.push(animation);

      validTargets.forEach((element) => {
        animatedElements.add(element);
      });

      return animation;
    };

    // ========================================================
    // INTERSECTION OBSERVER HELPER
    // ========================================================

    const observeElements = (elements, callback, options = {}) => {
      const validElements = Array.from(elements || []).filter(Boolean);

      if (!validElements.length) return;

      // Older browser fallback.
      // Do not leave content hidden if IntersectionObserver
      // is unavailable.
      if (!("IntersectionObserver" in window)) {
        callback(validElements);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleElements = entries
            .filter((entry) => entry.isIntersecting)
            .map((entry) => entry.target);

          if (!visibleElements.length) return;

          callback(visibleElements);

          visibleElements.forEach((element) => {
            observer.unobserve(element);
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -40px 0px",
          ...options,
        },
      );

      validElements.forEach((element) => {
        observer.observe(element);
      });

      observers.push(observer);
    };

    // ========================================================
    // HERO ANIMATION
    // Supports:
    // data-hero-badge
    // data-hero-title
    // data-hero-description
    // data-hero-buttons
    // data-hero-features
    //
    // Also supports existing Contact page classes:
    // .contact-hero-item
    // ========================================================

    const hero = page.querySelector("section");

    const heroSelectors = [
      "[data-hero-badge]",
      "[data-hero-title]",
      "[data-hero-description]",
      "[data-hero-buttons]",
      "[data-hero-features]",
    ];

    let heroItems = [];

    if (hero) {
      heroItems = heroSelectors
        .map((selector) => hero.querySelector(selector))
        .filter(Boolean);

      // Support the existing Contact page animation classes.
      if (!heroItems.length) {
        heroItems = Array.from(hero.querySelectorAll(".contact-hero-item"));
      }

      // Fallback for a hero without individual animation markers.
      if (!heroItems.length) {
        const heroContent = hero.querySelector(".site-container > div");

        if (heroContent) {
          heroItems = Array.from(heroContent.children);
        }
      }
    }

    if (heroItems.length) {
      runAnimation(heroItems, {
        opacity: [0, 1],
        translateY: [28, 0],
        delay: stagger(130, { start: 120 }),
        duration: 850,
        ease: "out(3)",
      });
    }

    // ========================================================
    // GENERAL SCROLL REVEALS
    //
    // Supports:
    // data-reveal
    // .contact-section-heading
    // .contact-product-panel
    // .contact-form-panel
    // .contact-bottom-cta
    //
    // Elements already assigned to hero/card animations
    // are excluded to prevent duplicate animations.
    // ========================================================

    const revealSelectors = [
      "[data-reveal]",
      ".contact-section-heading",
      ".contact-product-panel",
      ".contact-form-panel",
      ".contact-bottom-cta",
    ];

    const revealElements = Array.from(
      page.querySelectorAll(revealSelectors.join(", ")),
    ).filter((element) => !animatedElements.has(element));

    // Exclude elements already handled as cards or approach steps.
    const filteredRevealElements = revealElements.filter((element) => {
      return (
        !element.closest(
          "[data-stagger-group], [data-feature-grid], [data-approach-steps]",
        ) && !element.closest(".contact-info-card")
      );
    });

    filteredRevealElements.forEach((element) => {
      element.style.opacity = "0";
    });

    observeElements(
      filteredRevealElements,
      (elements) => {
        runAnimation(elements, {
          opacity: [0, 1],
          translateY: [28, 0],
          duration: 800,
          delay: stagger(90),
          ease: "out(3)",
        });
      },
      {
        threshold: 0.12,
      },
    );

    // ========================================================
    // STAGGERED CARD ANIMATIONS
    //
    // Supports:
    // data-stagger-group / data-stagger-card
    // data-feature-grid / data-feature-card
    //
    // Also supports:
    // .contact-info-card
    // ========================================================

    const staggerGroups = Array.from(
      page.querySelectorAll("[data-stagger-group], [data-feature-grid]"),
    );

    staggerGroups.forEach((group) => {
      const cards = Array.from(
        group.querySelectorAll("[data-stagger-card], [data-feature-card]"),
      ).filter((card) => !animatedElements.has(card));

      if (!cards.length) return;

      cards.forEach((card) => {
        card.style.opacity = "0";
      });

      observeElements(
        [group],
        () => {
          runAnimation(cards, {
            opacity: [0, 1],
            translateY: [30, 0],
            delay: stagger(110),
            duration: 750,
            ease: "out(3)",
          });
        },
        {
          threshold: 0.12,
        },
      );
    });

    // ========================================================
    // CONTACT INFORMATION CARDS
    // Supports the existing Contact.jsx classes.
    // ========================================================

    const contactCards = Array.from(
      page.querySelectorAll(".contact-info-card"),
    ).filter((card) => !animatedElements.has(card));

    if (contactCards.length) {
      contactCards.forEach((card) => {
        card.style.opacity = "0";
      });

      observeElements(
        contactCards,
        (visibleCards) => {
          runAnimation(visibleCards, {
            opacity: [0, 1],
            translateY: [25, 0],
            duration: 750,
            delay: stagger(120),
            ease: "out(3)",
          });
        },
        {
          threshold: 0.12,
        },
      );
    }

    // ========================================================
    // FARMING APPROACH STEPS
    // Supports:
    // data-approach-steps
    // data-approach-step
    // ========================================================

    const approachGroups = Array.from(
      page.querySelectorAll("[data-approach-steps]"),
    );

    approachGroups.forEach((group) => {
      const steps = Array.from(
        group.querySelectorAll("[data-approach-step]"),
      ).filter((step) => !animatedElements.has(step));

      if (!steps.length) return;

      steps.forEach((step) => {
        step.style.opacity = "0";
      });

      observeElements(
        [group],
        () => {
          runAnimation(steps, {
            opacity: [0, 1],
            translateX: [-22, 0],
            delay: stagger(160),
            duration: 700,
            ease: "out(3)",
          });
        },
        {
          threshold: 0.2,
        },
      );
    });

    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      observers.forEach((observer) => {
        observer.disconnect();
      });

      animations.forEach((animation) => {
        animation.cancel();
      });
    };
  }, [pathname]);

  return null;
}
