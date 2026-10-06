import { Link as RouterLink } from "react-router-dom";

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

function EggProductCard({ product }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
      {/* Product visual */}
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-yellow-50 to-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-200/50 transition-transform duration-500 group-hover:scale-125" />

        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-green-100/60 transition-transform duration-500 group-hover:scale-110" />

        <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white text-6xl shadow-lg ring-8 ring-white/60 transition-transform duration-500 group-hover:scale-110">
          {product.icon}
        </div>

        <span className="absolute left-5 top-5 rounded-full bg-green-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
          {product.badge}
        </span>
      </div>

      {/* Product details */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>

          <span className="whitespace-nowrap text-lg font-extrabold text-green-800">
            {product.price}
          </span>
        </div>

        <p className="mt-3 min-h-[84px] text-sm leading-7 text-gray-600">
          {product.description}
        </p>

        <div className="mt-5 border-t border-gray-100 pt-5">
          <RouterLink
            to="/contact"
            className="inline-flex items-center gap-2 font-bold text-green-800 transition hover:gap-3 hover:text-green-950"
          >
            Enquire about this product
            <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </div>
    </article>
  );
}

function ServiceCard({ icon, title, description }) {
  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
        {icon}
      </div>

      <h3 className="mt-6 text-xl font-bold text-gray-900">{title}</h3>

      <p className="mt-3 leading-7 text-gray-600">{description}</p>

      <RouterLink
        to="/contact"
        className="mt-5 inline-flex font-semibold text-green-800 hover:text-green-950"
      >
        Contact us →
      </RouterLink>
    </div>
  );
}

export default function Products() {
  return (
    <main className="min-h-screen bg-stone-50 text-gray-800">
      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="relative overflow-hidden bg-green-950">
        <div className="absolute inset-0 bg-gradient-to-br from-green-950 via-green-900 to-green-800" />

        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-300/10" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative site-container py-20 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <span className="eyebrow bg-green-800 text-green-100">
              MEBREK FARMS PRODUCTS
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Fresh farm products,
              <span className="block text-yellow-300">ready for you.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-green-100 sm:text-lg">
              Explore our range of poultry and agricultural products. From
              everyday eggs to specialty poultry products, we make it easy to
              enquire and place your order.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#eggs" className="btn btn-secondary">
                Shop Eggs
              </a>

              <RouterLink
                to="/contact"
                className="btn border-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-green-900"
              >
                Make an Enquiry
              </RouterLink>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          EGG PRODUCTS
      ===================================================== */}
      <section id="eggs" className="section bg-white">
        <div className="site-container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Egg Products</span>

            <h2 className="section-title mt-5">
              Choose the egg size that suits you
            </h2>

            <p className="section-subtitle">
              Our egg range gives customers different options depending on their
              household, retail or food-service needs.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eggProducts.map((product) => (
              <EggProductCard key={product.name} product={product} />
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-center">
            <p className="text-sm leading-6 text-gray-700">
              <strong className="text-green-900">Please note:</strong> Prices
              shown are per crate and may be subject to change. Contact MEBREK
              FARMS to confirm current availability and pricing before placing
              an order.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          OTHER FARM PRODUCTS
      ===================================================== */}
      <section className="section bg-stone-50">
        <div className="site-container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">More From The Farm</span>

            <h2 className="section-title mt-5">More than eggs</h2>

            <p className="section-subtitle">
              MEBREK FARMS also operates across other areas of poultry and
              agricultural production.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
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
      <section className="section bg-white">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <span className="eyebrow">Why Choose Us</span>

              <h2 className="section-title mt-5">
                Farm products with a focus on quality
              </h2>

              <p className="mt-6 text-base leading-8 text-gray-600 sm:text-lg">
                We understand that customers want farm products they can
                confidently order and use. That is why our operations place
                emphasis on poultry health, production management and organized
                farm processes.
              </p>

              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Quality-focused production
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      We pay attention to poultry production and flock
                      management.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Clear product options
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Customers can choose from different egg sizes and enquire
                      about other farm products.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Direct enquiries
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Contact us directly to confirm availability, pricing and
                      order requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-green-950 p-8 shadow-2xl sm:p-10">
              <div className="text-5xl">🥚</div>

              <h3 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
                Looking for eggs?
              </h3>

              <p className="mt-4 leading-8 text-green-100">
                Whether you are buying for your home, a food business or regular
                supply, get in touch with MEBREK FARMS to discuss your
                requirements.
              </p>

              <div className="mt-8">
                <RouterLink
                  to="/contact"
                  className="btn btn-secondary w-full sm:w-auto"
                >
                  Enquire Now
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ORDER CTA
      ===================================================== */}
      <section className="bg-yellow-300">
        <div className="site-container py-14 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-900">
                Place an enquiry
              </p>

              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-green-950 sm:text-4xl">
                Need farm products?
              </h2>

              <p className="mt-3 leading-7 text-green-900/80">
                Contact MEBREK FARMS today and let us know what you need.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <RouterLink
                to="/contact"
                className="btn bg-green-900 text-white hover:bg-green-800"
              >
                Contact Us
              </RouterLink>

              <a
                href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20order%20farm%20products"
                target="_blank"
                rel="noopener noreferrer"
                className="btn border-2 border-green-900 bg-transparent text-green-950 hover:bg-green-900 hover:text-white"
              >
                WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
