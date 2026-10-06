import { Link as RouterLink } from "react-router-dom";

export default function About() {
  return (
    <main className="min-h-screen bg-stone-50 text-gray-800">
      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="relative overflow-hidden bg-green-950">
        <div className="absolute inset-0 bg-gradient-to-br from-green-950 via-green-900 to-green-800" />

        <div className="relative site-container py-20 sm:py-24 lg:py-32">
          <div className="max-w-3xl">
            <span className="eyebrow bg-green-800 text-green-100">
              About MEBREK FARMS
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Farming with care.
              <span className="block text-yellow-300">
                Producing with purpose.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-green-100 sm:text-lg">
              MEBREK FARMS provides high-quality poultry products through
              modern, hygienic farming practices tailored to the needs of
              Nigerian agriculture.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <RouterLink to="/products" className="btn btn-secondary">
                Explore Our Products
              </RouterLink>

              <RouterLink
                to="/contact"
                className="btn border-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-green-900"
              >
                Talk to Us
              </RouterLink>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          INTRODUCTION
      ===================================================== */}
      <section className="section bg-white">
        <div className="site-container">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <span className="eyebrow">Who We Are</span>

              <h2 className="section-title mt-5">
                A farm built around quality, care and consistency
              </h2>

              <p className="mt-6 text-base leading-8 text-gray-600 sm:text-lg">
                MEBREK FARMS is a poultry-focused agricultural business
                committed to producing quality farm products while maintaining
                modern and hygienic farming practices.
              </p>

              <p className="mt-5 text-base leading-8 text-gray-600">
                From poultry production and egg production to flock health, feed
                management and farm operations, our approach is focused on
                maintaining healthy birds and delivering dependable products to
                customers.
              </p>

              <p className="mt-5 text-base leading-8 text-gray-600">
                We combine practical farming with organized farm management so
                that important areas of production can be monitored carefully
                and managed responsibly.
              </p>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-3xl bg-green-900 p-8 shadow-2xl sm:p-10">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-300/20" />
                <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-white/5" />

                <div className="relative">
                  <div className="text-6xl">🐔</div>

                  <h3 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
                    Modern Poultry Farming
                  </h3>

                  <p className="mt-4 leading-7 text-green-100">
                    We place attention on poultry health, production, nutrition,
                    hygiene and responsible farm management.
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                      <div className="text-2xl">🥚</div>
                      <p className="mt-2 font-semibold text-white">
                        Egg Production
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                      <div className="text-2xl">🌱</div>
                      <p className="mt-2 font-semibold text-white">
                        Agricultural Services
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          OUR FOCUS
      ===================================================== */}
      <section className="section bg-stone-50">
        <div className="site-container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Our Focus</span>

            <h2 className="section-title mt-5">
              Everything starts with good farm management
            </h2>

            <p className="section-subtitle">
              Quality agricultural products depend on the health of the flock,
              good production practices and careful day-to-day management.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1 */}
            <div className="card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
                🐔
              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-900">
                Poultry Production
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Careful flock management supports healthy birds and consistent
                poultry production.
              </p>
            </div>

            {/* Card 2 */}
            <div className="card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-3xl">
                🥚
              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-900">
                Quality Eggs
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                We focus on producing and supplying quality eggs for customers
                looking for dependable farm products.
              </p>
            </div>

            {/* Card 3 */}
            <div className="card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-3xl">
                ❤️
              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-900">
                Bird Health
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Monitoring flock health, vaccinations, mortality and medication
                forms an important part of responsible poultry management.
              </p>
            </div>

            {/* Card 4 */}
            <div className="card">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-3xl">
                🌱
              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-900">
                Farm Resources
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Feed, manure and other farm resources are managed as part of a
                structured agricultural operation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          OUR APPROACH
      ===================================================== */}
      <section className="section bg-white">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div className="order-2 lg:order-1">
              <div className="rounded-3xl bg-green-950 p-8 shadow-xl sm:p-10">
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-300">
                  Our Approach
                </span>

                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
                  Practical farming backed by organized management
                </h2>

                <p className="mt-5 leading-8 text-green-100">
                  A successful poultry operation requires more than producing
                  eggs. It requires attention to the flock throughout its
                  production cycle.
                </p>

                <div className="mt-8 space-y-5">
                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-bold text-green-950">
                      1
                    </div>

                    <div>
                      <h3 className="font-bold text-white">
                        Monitor the flock
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-green-100">
                        Production, health and flock activities are monitored
                        carefully.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-bold text-green-950">
                      2
                    </div>

                    <div>
                      <h3 className="font-bold text-white">Manage resources</h3>
                      <p className="mt-1 text-sm leading-6 text-green-100">
                        Feed, medication and other farm resources are managed as
                        part of daily operations.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-bold text-green-950">
                      3
                    </div>

                    <div>
                      <h3 className="font-bold text-white">Deliver quality</h3>
                      <p className="mt-1 text-sm leading-6 text-green-100">
                        The goal is to provide customers with reliable, quality
                        farm products.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <span className="eyebrow">Responsible Farming</span>

              <h2 className="section-title mt-5">
                From the farm to the customer
              </h2>

              <p className="mt-6 text-base leading-8 text-gray-600 sm:text-lg">
                Our farm operations bring together production, flock health,
                feed management, inventory and sales so that the different parts
                of the business work together.
              </p>

              <p className="mt-5 text-base leading-8 text-gray-600">
                This organized approach helps us maintain better visibility over
                our farming activities while keeping our focus on the products
                and services our customers need.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
                  <p className="text-2xl font-extrabold text-green-800">
                    Quality
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    In products and processes
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5">
                  <p className="text-2xl font-extrabold text-green-800">Care</p>
                  <p className="mt-1 text-sm text-gray-600">
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
      <section className="section bg-stone-50">
        <div className="site-container">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">Why MEBREK FARMS</span>

            <h2 className="section-title mt-5">
              A dependable agricultural partner
            </h2>

            <p className="section-subtitle">
              Whether you are buying eggs, poultry products or agricultural
              by-products, we aim to make dealing with the farm simple and
              straightforward.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5">
              <div className="text-4xl">🌾</div>

              <h3 className="mt-5 text-xl font-bold text-gray-900">
                Farm-Focused
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Our business is centered around poultry production and
                agricultural operations.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5">
              <div className="text-4xl">🤝</div>

              <h3 className="mt-5 text-xl font-bold text-gray-900">
                Customer Focused
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                We make it easy for customers to enquire about products,
                availability and orders.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-black/5">
              <div className="text-4xl">📋</div>

              <h3 className="mt-5 text-xl font-bold text-gray-900">
                Organized Operations
              </h3>

              <p className="mt-3 leading-7 text-gray-600">
                Structured farm management helps us keep track of production,
                flock health, resources and sales.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          CTA
      ===================================================== */}
      <section className="bg-yellow-300">
        <div className="site-container py-14 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-900">
                Ready to do business with us?
              </p>

              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-green-950 sm:text-4xl">
                Explore our farm products today.
              </h2>

              <p className="mt-3 max-w-xl leading-7 text-green-900/80">
                Browse our available products or contact MEBREK FARMS directly
                for enquiries and orders.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <RouterLink
                to="/products"
                className="btn bg-green-900 text-white hover:bg-green-800"
              >
                View Products
              </RouterLink>

              <RouterLink
                to="/contact"
                className="btn border-2 border-green-900 bg-transparent text-green-950 hover:bg-green-900 hover:text-white"
              >
                Contact Us
              </RouterLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
