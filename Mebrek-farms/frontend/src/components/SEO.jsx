
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://mebrekfarms.com";

const DEFAULT_IMAGE = `${SITE_URL}/images/mebrek-farms-social.png`;

const PAGE_SEO = {
  "/": {
    title: "Mebrek Farms | Quality Poultry, Fresh Eggs & Organic Manure",
    description:
      "Welcome to Mebrek Farms. Discover quality poultry products, fresh farm eggs, turkey eggs and organic manure, delivered with care and a commitment to sustainable farming.",
  },

  "/about": {
    title: "About Mebrek Farms | Our Story, Values & Farming",
    description:
      "Learn about Mebrek Farms, our commitment to quality poultry production, responsible farming practices and providing reliable agricultural products.",
  },

  "/products": {
    title: "Our Products | Fresh Eggs, Poultry & Organic Manure",
    description:
      "Explore Mebrek Farms products, including small, normal, big and jumbo eggs, turkey eggs, poultry products and organic manure.",
  },

  "/contact": {
    title: "Contact Mebrek Farms | Orders & Enquiries",
    description:
      "Contact Mebrek Farms for fresh egg orders, poultry products, organic manure, bookings and general enquiries. Call or WhatsApp us today.",
  },
};

function updateMetaTag(attribute, key, content) {
  let element = document.head.querySelector(
    `meta[${attribute}="${key}"]`
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function updateCanonicalUrl(url) {
  let canonical = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

export default function SEO() {
  const location = useLocation();

  useEffect(() => {
    const pathname =
      location.pathname.replace(/\/+$/, "") || "/";

    const page = PAGE_SEO[pathname];

    // Do not apply public SEO metadata to unknown routes.
    if (!page) return;

    const canonicalUrl =
      pathname === "/" ? SITE_URL : `${SITE_URL}${pathname}`;

    document.title = page.title;

    // Standard SEO metadata
    updateMetaTag("name", "description", page.description);
    updateMetaTag("name", "author", "Mebrek Farms");
    updateMetaTag("name", "robots", "index, follow");

    // Open Graph metadata
    updateMetaTag("property", "og:type", "website");
    updateMetaTag("property", "og:site_name", "Mebrek Farms");
    updateMetaTag("property", "og:title", page.title);
    updateMetaTag("property", "og:description", page.description);
    updateMetaTag("property", "og:url", canonicalUrl);
    updateMetaTag("property", "og:image", DEFAULT_IMAGE);
    updateMetaTag(
      "property",
      "og:image:alt",
      "Mebrek Farms poultry, fresh eggs and organic farm products"
    );

    // Twitter / X metadata
    updateMetaTag(
      "name",
      "twitter:card",
      "summary_large_image"
    );
    updateMetaTag("name", "twitter:title", page.title);
    updateMetaTag(
      "name",
      "twitter:description",
      page.description
    );
    updateMetaTag("name", "twitter:image", DEFAULT_IMAGE);

    // Canonical URL
    updateCanonicalUrl(canonicalUrl);

    // Scroll to the top when changing public pages.
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [location.pathname]);

  return null;
}

