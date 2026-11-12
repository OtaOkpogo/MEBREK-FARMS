import { Link as RouterLink } from "react-router-dom";
import {
  btn,
  Wave,
  SectionHeading,
  PageHero,
  FarmStyles,
  QuickContact,
} from "./farmShared";

// =========================================================
// ABOUT PAGE
// Animations are handled centrally by PageMotion.jsx
// =========================================================

const FOCUS = [
  {
    icon: "🐔",
    tint: "bg-[#0D3B2B]/10",
    title: "Poultry Production",
    text: "Careful flock management supports healthy birds and consistent poultry production.",
  },
  {
    icon: "🥚",
    tint: "bg-[#F6B93B]/25",
    title: "Quality Eggs",
    text: "We focus on producing and supplying quality eggs for customers looking for dependable farm products.",
  },
  {
    icon: "❤️",
    tint: "bg-[#0D3B2B]/10",
    title: "Bird Health",
    text: "Monitoring flock health, vaccinations, mortality and medication forms an important part of responsible poultry management.",
  },
  {
    icon: "🌱",
    tint: "bg-[#F6B93B]/25",
    title: "Farm Resources",
    text: "Feed, manure and other farm resources are managed as part of a structured agricultural operation.",
  },
];

const STEPS = [
  {
    title: "Monitor the flock",
    text: "Production, health and flock activities are monitored carefully.",
  },
  {
    title: "Manage resources",
    text: "Feed, medication and other farm resources are managed as part of daily operations.",
  },
  {
    title: "Deliver quality",
    text: "The goal is to provide customers with reliable, quality farm products.",
  },
];

const WHY = [
  {
    icon: "🌾",
    title: "Farm-Focused",
    text: "Our business is centered around poultry production and agricultural operations.",
  },
  {
    icon: "🤝",
    title: "Customer Focused",
    text: "We make it easy for customers to enquire about products, availability and orders.",
  },
  {
    icon: "📋",
    title: "Organized Operations",
    text: "Structured farm management helps us keep track of production, flock health, resources and sales.",
  },
];

export default function About() {
  return (
    <main className="mf-root min-h-screen overflow-x-hidden bg-[#F4EFE4] text-[#14221B]">
      <FarmStyles />

      {/* =====================================================
          HERO
      ===================================================== */}

      <PageHero
        badge="About Mebrek Farms"
        title="Farming with care."
        accent="Producing with purpose."
        text="Mebrek Farms provides high-quality poultry products through modern, hygienic farming practices tailored to the needs of Nigerian agriculture."
        waveColor="#F8F4EA"
      >
        <RouterLink to="/products" className={btn.yellow}>
          Explore our products
        </RouterLink>

        <RouterLink to="/contact" className={btn.ghost}>
          Talk to us
        </RouterLink>
      </PageHero>

      {/* =====================================================
          INTRODUCTION
      ===================================================== */}

      <section className="mf-bg-hero relative pb-24 pt-16 sm:pb-32 sm:pt-24">
        <div className="site-container">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div data-reveal>
              <SectionHeading
                eyebrow="Who we are"
                title="A farm built around quality, care and consistency"
              />

              <p className="mt-6 text-lg leading-8 text-[#14221B]/75">
                Mebrek Farms is a poultry-focused agricultural business
                committed to producing quality farm products while maintaining
                modern and hygienic farming practices.
              </p>

              <p className="mt-5 leading-8 text-[#14221B]/75">
                From poultry production and egg production to flock health, feed
                management and farm operations, our approach is focused on
                maintaining healthy birds and delivering dependable products to
                customers.
              </p>

              <p className="mt-5 leading-8 text-[#14221B]/75">
                We combine practical farming with organized farm management so
                that important areas of production can be monitored carefully
                and managed responsibly.
              </p>
            </div>

            <div data-reveal className="relative">
              {/* Offset yellow frame behind the card */}
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-[#F6B93B] sm:translate-x-4 sm:translate-y-4"
              />

              <div className="mf-bg-steps relative rounded-3xl p-8 text-white shadow-2xl sm:p-10">
                <div aria-hidden="true" className="text-6xl">
                  🐔
                </div>

                <h3 className="mf-display mt-6 text-3xl font-bold">
                  Modern Poultry Farming
                </h3>

                <p className="mt-4 text-lg leading-8 text-green-50/90">
                  We place attention on poultry health, production, nutrition,
                  hygiene and responsible farm management.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition-colors duration-300 hover:bg-white/15">
                    <div aria-hidden="true" className="text-2xl">
                      🥚
                    </div>
                    <p className="mt-2 font-semibold">Egg Production</p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 transition-colors duration-300 hover:bg-white/15">
                    <div aria-hidden="true" className="text-2xl">
                      🌱
                    </div>
                    <p className="mt-2 font-semibold">Agricultural Services</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Wave color="#E9E0D0" />
      </section>

      {/* =====================================================
          OUR FOCUS
      ===================================================== */}

      <section className="mf-bg-products relative py-16 sm:py-24">
        <div className="site-container">
          <SectionHeading
            data-reveal
            center
            eyebrow="Our focus"
            title="Everything starts with good farm management"
            text="Quality agricultural products depend on the health of the flock, good production practices and careful day-to-day management."
          />

          <div
            data-stagger-group
            className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {FOCUS.map((item) => (
              <div
                key={item.title}
                data-stagger-card
                className="rounded-3xl bg-white p-7 shadow-md ring-1 ring-[#14221B]/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              >
                <div
                  aria-hidden="true"
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${item.tint}`}
                >
                  {item.icon}
                </div>

                <h3 className="mf-display mt-5 text-xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-2 leading-7 text-[#14221B]/75">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          OUR APPROACH
      ===================================================== */}

      <section className="mf-bg-why relative py-16 sm:py-24">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div data-reveal className="order-2 lg:order-1">
              <div className="mf-bg-steps rounded-3xl p-8 text-white shadow-2xl sm:p-10">
                <p className="font-semibold text-[#F6B93B]">Our approach</p>

                <h2 className="mf-display mt-3 text-3xl font-bold sm:text-4xl">
                  Practical farming backed by organized management
                </h2>

                <p className="mt-5 text-lg leading-8 text-green-50/90">
                  A successful poultry operation requires more than producing
                  eggs. It requires attention to the flock throughout its
                  production cycle.
                </p>

                <ol data-approach-steps className="mt-8 space-y-6">
                  {STEPS.map((step, index) => (
                    <li
                      key={step.title}
                      data-approach-step
                      className="flex gap-4"
                    >
                      <span
                        aria-hidden="true"
                        className="mf-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6B93B] text-lg font-extrabold text-[#14221B]"
                      >
                        {index + 1}
                      </span>

                      <div>
                        <h3 className="mf-display text-lg font-bold">
                          {step.title}
                        </h3>
                        <p className="mt-1 leading-7 text-green-50/90">
                          {step.text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div data-reveal className="order-1 lg:order-2">
              <SectionHeading
                eyebrow="Responsible farming"
                title="From the farm to the customer"
              />

              <p className="mt-6 text-lg leading-8 text-[#14221B]/75">
                Our farm operations bring together production, flock health,
                feed management, inventory and sales so that the different parts
                of the business work together.
              </p>

              <p className="mt-5 leading-8 text-[#14221B]/75">
                This organized approach helps us maintain better visibility over
                our farming activities while keeping our focus on the products
                and services our customers need.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#14221B]/10 transition-shadow duration-300 hover:shadow-md">
                  <p className="mf-display text-2xl font-extrabold text-[#0D3B2B]">
                    Quality
                  </p>
                  <p className="mt-1 text-sm text-[#14221B]/70">
                    In products and processes
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#14221B]/10 transition-shadow duration-300 hover:shadow-md">
                  <p className="mf-display text-2xl font-extrabold text-[#0D3B2B]">
                    Care
                  </p>
                  <p className="mt-1 text-sm text-[#14221B]/70">
                    For our flock and customers
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY CHOOSE US
      ===================================================== */}

      <section className="mf-bg-order relative py-16 sm:py-24">
        <div className="site-container">
          <SectionHeading
            data-reveal
            center
            eyebrow="Why Mebrek Farms"
            title="A dependable agricultural partner"
            text="Whether you are buying eggs, poultry products or agricultural by-products, we aim to make dealing with the farm simple and straightforward."
          />

          <div data-stagger-group className="mt-14 grid gap-6 md:grid-cols-3">
            {WHY.map((item) => (
              <div
                key={item.title}
                data-stagger-card
                className="rounded-3xl bg-white p-7 shadow-md ring-1 ring-[#14221B]/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
              >
                <div
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF1E8] text-3xl"
                >
                  {item.icon}
                </div>

                <h3 className="mf-display mt-5 text-xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-2 leading-7 text-[#14221B]/75">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA
      ===================================================== */}

      <section className="mf-bg-steps relative pb-32 pt-24 text-white sm:pb-28 sm:pt-28">
        <Wave color="#F0E4CF" flip />

        <div className="site-container relative">
          <div
            data-reveal
            className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"
          >
            <div className="max-w-2xl">
              <p className="font-semibold text-[#F6B93B]">
                Ready to do business with us?
              </p>

              <h2 className="mf-display mt-2 text-3xl font-extrabold sm:text-5xl">
                Explore our farm products today.
              </h2>

              <p className="mt-3 max-w-xl text-lg leading-8 text-green-50/90">
                Browse our available products or contact Mebrek Farms directly
                for enquiries and orders.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <RouterLink to="/products" className={btn.yellow}>
                View products
              </RouterLink>

              <RouterLink to="/contact" className={btn.ghost}>
                Contact us
              </RouterLink>
            </div>
          </div>
        </div>
      </section>

      <QuickContact message="Hello Mebrek Farms, I want to ask about your farm products." />
    </main>
  );
}
