import { Link as RouterLink } from "react-router-dom";
import {
  whatsappLink,
  focusRing,
  btn,
  WhatsAppIcon,
  Wave,
  SectionHeading,
  PageHero,
  FarmStyles,
  QuickContact,
} from "./farmShared";

// ============================================================
// EGG PRODUCTS
// ============================================================

const eggProducts = [
  {
    name: "Small Eggs",
    price: "₦4,000",
    description:
      "Quality farm eggs in our smaller egg category, suitable for everyday household and commercial use.",
    icon: "🥚",
    badge: "Everyday Choice",
  },
  {
    name: "Normal Eggs",
    price: "₦5,000",
    description:
      "A dependable everyday egg option for households, food businesses and regular customers.",
    icon: "🥚",
    badge: "Popular",
  },
  {
    name: "Big Eggs",
    price: "₦5,100",
    description:
      "Larger farm eggs suitable for customers looking for a bigger egg size for cooking and food service.",
    icon: "🥚",
    badge: "Large Size",
  },
  {
    name: "Jumbo Eggs",
    price: "₦5,800",
    description:
      "Our jumbo egg option for customers who prefer larger eggs for household and commercial needs.",
    icon: "🥚",
    badge: "Premium Size",
  },
  {
    name: "Turkey Eggs",
    price: "₦6,000",
    description:
      "Turkey eggs available for customers looking for an alternative poultry egg product.",
    icon: "🦃",
    badge: "Specialty",
  },
];

// ============================================================
// EGG PRODUCT CARD
// ============================================================

function EggProductCard({ product }) {
  return (
    <article
      data-stagger-card
      className="product-card group flex flex-col overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#14221B]/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
    >
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-[#EEF1E8] via-[#FFF3D6] to-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F6B93B]/30 transition-transform duration-500 group-hover:scale-125" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#0D3B2B]/10 transition-transform duration-500 group-hover:scale-110" />

        <div
          aria-hidden="true"
          className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-lg ring-8 ring-white/60 transition-transform duration-500 group-hover:scale-110"
        >
          {product.icon}
        </div>

        <span className="absolute left-4 top-4 rounded-full bg-[#0D3B2B] px-3 py-1.5 text-xs font-bold text-white">
          {product.badge}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="mf-display text-2xl font-bold">{product.name}</h3>

          <div className="text-right">
            <p className="mf-display whitespace-nowrap text-2xl font-extrabold text-[#0D3B2B]">
              {product.price}
            </p>
            <p className="text-xs text-[#14221B]/60">per crate</p>
          </div>
        </div>

        <p className="mt-3 flex-1 leading-7 text-[#14221B]/75">
          {product.description}
        </p>

        <div className="mt-6 space-y-3">
          <a
            href={whatsappLink(
              `Hello Mebrek Farms, I want to order ${product.name} (${product.price} per crate).`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[#128C4A] px-5 py-3 font-bold text-white transition-colors hover:bg-[#0E7440] ${focusRing}`}
          >
            <WhatsAppIcon />
            Order on WhatsApp
          </a>

          <RouterLink
            to="/contact"
            className={`flex min-h-[3.25rem] w-full items-center justify-center rounded-full border-2 border-[#14221B]/20 px-5 py-3 font-semibold transition-colors hover:border-[#0D3B2B] hover:bg-[#0D3B2B]/5 ${focusRing}`}
          >
            Ask a question
          </RouterLink>
        </div>
      </div>
    </article>
  );
}

// ============================================================
// OTHER FARM SERVICES
// ============================================================

function ServiceCard({ icon, title, description }) {
  return (
    <div
      data-stagger-card
      className="service-card flex flex-col rounded-3xl bg-white p-7 shadow-md ring-1 ring-[#14221B]/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6B93B]/25 text-3xl"
      >
        {icon}
      </div>

      <h3 className="mf-display mt-5 text-xl font-bold">{title}</h3>

      <p className="mt-2 flex-1 leading-7 text-[#14221B]/75">{description}</p>

      <RouterLink
        to="/contact"
        className={`mt-5 inline-flex min-h-[3rem] items-center gap-2 font-bold text-[#0D3B2B] hover:underline ${focusRing}`}
      >
        Contact us
        <span aria-hidden="true">→</span>
      </RouterLink>
    </div>
  );
}

// ============================================================
// PRODUCTS PAGE
// All animations are handled by PageMotion.jsx
// ============================================================

const WHY_POINTS = [
  {
    title: "Quality-focused production",
    text: "We pay attention to poultry production and flock management.",
  },
  {
    title: "Clear product options",
    text: "Customers can choose from different egg sizes and enquire about other farm products.",
  },
  {
    title: "Direct enquiries",
    text: "Contact us directly to confirm availability, pricing and order requirements.",
  },
];

export default function Products() {
  return (
    <main className="mf-root min-h-screen overflow-x-hidden bg-[#F4EFE4] text-[#14221B]">
      <FarmStyles />

      {/* =====================================================
          HERO
      ===================================================== */}

      <PageHero
        badge="Mebrek Farms products"
        title="Fresh farm products,"
        accent="ready for you."
        text="Explore our range of poultry and agricultural products. From everyday eggs to specialty poultry products, we make it easy to enquire and place your order."
        waveColor="#E9E0D0"
        aside={
          <div
            data-hero-buttons
            className="rounded-3xl bg-white p-6 text-[#14221B] shadow-2xl sm:p-8"
          >
            <p className="mf-display text-xl font-bold">
              Egg prices at a glance
            </p>
            <p className="text-sm text-[#14221B]/60">Per crate</p>

            <ul className="mt-4 divide-y divide-[#14221B]/10">
              {eggProducts.map((product) => (
                <li
                  key={product.name}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="font-medium">
                    <span aria-hidden="true">{product.icon}</span>{" "}
                    {product.name}
                  </span>
                  <span className="mf-display text-lg font-extrabold text-[#0D3B2B]">
                    {product.price}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-5 text-[#14221B]/60">
              Prices may change. Please confirm availability before ordering.
            </p>
          </div>
        }
      >
        <a href="#eggs" className={btn.yellow}>
          Shop eggs
        </a>

        <RouterLink to="/contact" className={btn.ghost}>
          Make an enquiry
        </RouterLink>
      </PageHero>

      {/* =====================================================
          EGG PRODUCTS
      ===================================================== */}

      <section
        id="eggs"
        className="mf-bg-products relative scroll-mt-4 py-16 sm:py-24"
      >
        <div className="site-container">
          <SectionHeading
            data-reveal
            className="products-section-heading"
            center
            eyebrow="Egg products"
            title="Choose the egg size that suits you"
            text="Our egg range gives customers different options depending on their household, retail or food-service needs."
          />

          <div
            data-stagger-group
            className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {eggProducts.map((product) => (
              <EggProductCard key={product.name} product={product} />
            ))}
          </div>

          <div
            data-reveal
            className="products-feature mt-10 rounded-2xl bg-white/80 p-5 text-center shadow-sm ring-1 ring-[#F6B93B]/60"
          >
            <p className="leading-7 text-[#14221B]/80">
              <strong className="text-[#0D3B2B]">Please note:</strong> Prices
              shown are per crate and may be subject to change. Contact Mebrek
              Farms to confirm current availability and pricing before placing
              an order.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          OTHER FARM PRODUCTS
      ===================================================== */}

      <section className="mf-bg-why relative py-16 sm:py-24">
        <div className="site-container">
          <SectionHeading
            data-reveal
            className="products-section-heading"
            center
            eyebrow="More from the farm"
            title="More than eggs"
            text="Mebrek Farms also operates across other areas of poultry and agricultural production."
          />

          <div data-stagger-group className="mt-14 grid gap-6 md:grid-cols-3">
            <ServiceCard
              icon="🐔"
              title="Poultry"
              description="Poultry products are available based on current farm stock and production. Contact us for current availability and pricing."
            />

            <ServiceCard
              icon="🌱"
              title="Organic Manure"
              description="Farm manure is available for agricultural use. Contact us to enquire about current availability and quantities."
            />

            <ServiceCard
              icon="📦"
              title="Farm Orders"
              description="Tell us what you need and our team can help you confirm product availability, quantities and current pricing."
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY BUY FROM US
      ===================================================== */}

      <section className="mf-bg-hero relative py-16 sm:py-24">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div data-reveal className="products-feature">
              <SectionHeading
                eyebrow="Why choose us"
                title="Farm products with a focus on quality"
                text="We understand that customers want farm products they can confidently order and use. That is why our operations place emphasis on poultry health, production management and organized farm processes."
              />

              <ul className="mt-8 space-y-5">
                {WHY_POINTS.map((point) => (
                  <li key={point.title} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0D3B2B] font-bold text-white"
                    >
                      ✓
                    </span>

                    <div>
                      <h3 className="mf-display text-lg font-bold">
                        {point.title}
                      </h3>
                      <p className="mt-1 leading-7 text-[#14221B]/75">
                        {point.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div
              data-reveal
              className="products-feature mf-bg-steps rounded-3xl p-8 text-white shadow-2xl sm:p-10"
            >
              <div aria-hidden="true" className="text-5xl">
                🥚
              </div>

              <h3 className="mf-display mt-5 text-3xl font-bold">
                Looking for eggs?
              </h3>

              <p className="mt-4 text-lg leading-8 text-green-50/90">
                Whether you are buying for your home, a food business or regular
                supply, get in touch with Mebrek Farms to discuss your
                requirements.
              </p>

              <div className="mt-8">
                <RouterLink
                  to="/contact"
                  className={`${btn.yellow} w-full sm:w-auto`}
                >
                  Enquire now
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ORDER CTA
      ===================================================== */}

      <section className="mf-bg-steps relative pb-32 pt-24 text-white sm:pb-28 sm:pt-28">
        <Wave color="#F8F4EA" flip />

        <div className="site-container relative">
          <div
            data-reveal
            className="products-cta-content flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"
          >
            <div className="max-w-2xl">
              <p className="font-semibold text-[#F6B93B]">Place an enquiry</p>

              <h2 className="mf-display mt-2 text-3xl font-extrabold sm:text-5xl">
                Need farm products?
              </h2>

              <p className="mt-3 text-lg leading-8 text-green-50/90">
                Contact Mebrek Farms today and let us know what you need.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <RouterLink to="/contact" className={btn.yellow}>
                Contact us
              </RouterLink>

              <a
                href={whatsappLink(
                  "Hello Mebrek Farms, I want to order farm products.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={btn.ghost}
              >
                <WhatsAppIcon />
                WhatsApp us
              </a>
            </div>
          </div>
        </div>
      </section>

      <QuickContact message="Hello Mebrek Farms, I want to order farm products." />
    </main>
  );
}
