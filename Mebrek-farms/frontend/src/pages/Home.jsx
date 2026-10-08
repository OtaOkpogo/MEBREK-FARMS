import { Link as RouterLink } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

// =========================================================
// REUSABLE PRODUCT CARD
// =========================================================

function ProductCard({
  image,
  icon,
  title,
  description,
  price,
  link = "/products",
}) {
  return (
    <div className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
      <div className="relative h-56 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-gray-900 shadow">
          <span>{icon}</span>
          {title}
        </div>
      </div>

      <div className="p-6">
        {price && (
          <p className="mb-2 text-lg font-bold text-farmGreen">{price}</p>
        )}

        <p className="mb-5 text-sm leading-7 text-gray-600 sm:text-base">
          {description}
        </p>

        <RouterLink
          to={link}
          className="inline-flex items-center gap-2 font-semibold text-farmGreen transition hover:gap-3"
        >
          Learn more
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </div>
  );
}

// =========================================================
// SMALL STAT CARD
// =========================================================

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold text-white sm:text-4xl">
        {value}
      </div>

      <div className="mt-1 text-sm text-green-100">{label}</div>
    </div>
  );
}

// =========================================================
// HOME PAGE
// =========================================================

export default function Home() {
  const [form, setForm] = useState({
    name: "",
    contact: "",
    message: "",
  });

  const [success, setSuccess] = useState("");

  // =======================================================
  // HANDLE INPUT CHANGE
  // =======================================================

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setSuccess("");
  };

  // =======================================================
  // HANDLE ORDER SUBMIT
  // =======================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSuccess("");

    try {
      await axios.post("http://localhost:5000/api/orders", form);

      setSuccess("Order sent successfully! We will contact you shortly.");

      setForm({
        name: "",
        contact: "",
        message: "",
      });
    } catch (err) {
      console.error("ORDER SUBMIT ERROR:", err);

      setSuccess(
        "Unable to send your order right now. Please contact us directly or order through WhatsApp.",
      );
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-stone-50 text-gray-800">
      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="relative isolate min-h-[650px] overflow-hidden sm:min-h-[720px]">
        {/* Background */}
        <div
          className="absolute inset-0 -z-20 scale-105 animate-zoomSlow bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://static.vecteezy.com/system/resources/thumbnails/029/340/262/small/ai-generated-ai-generative-organic-eco-chicken-rooster-and-egg-at-countryside-farm-background-graphic-art-photo.jpg')",
          }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/60" />

        {/* Green tint */}
        <div className="absolute inset-0 -z-10 bg-green-950/10" />

        <div className="site-container flex min-h-[650px] items-center py-20 sm:min-h-[720px]">
          <div className="max-w-3xl animate-fadeUp text-white">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
              <span>🌱</span>
              Modern farming in Nigeria
            </div>

            <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Fresh from our farm.
              <span className="block text-yellow-300">
                Quality you can trust.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-gray-200 sm:text-lg md:text-xl">
              Mebrek Farms produces quality poultry products using responsible,
              hygienic and professionally managed farming practices.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <RouterLink
                to="/products"
                className="btn btn-secondary px-7 py-3.5"
              >
                Explore Our Products
                <span>→</span>
              </RouterLink>

              <RouterLink
                to="/contact"
                className="btn border border-white/40 bg-white/10 px-7 py-3.5 text-white backdrop-blur hover:bg-white hover:text-gray-900"
              >
                Contact Mebrek Farms
              </RouterLink>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-gray-200">
              <span className="flex items-center gap-2">
                <span className="text-yellow-300">✓</span>
                Farm-direct products
              </span>

              <span className="flex items-center gap-2">
                <span className="text-yellow-300">✓</span>
                Quality-focused production
              </span>

              <span className="flex items-center gap-2">
                <span className="text-yellow-300">✓</span>
                Customer-focused service
              </span>
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
              <span className="eyebrow">About Mebrek Farms</span>

              <h2 className="section-title mt-5">
                Farming with purpose, quality and care.
              </h2>

              <p className="mt-6 text-base leading-8 text-gray-600 sm:text-lg">
                Mebrek Farms is focused on producing quality poultry products
                through modern and hygienic farming practices tailored to the
                Nigerian agricultural environment.
              </p>

              <p className="mt-4 text-base leading-8 text-gray-600">
                From daily egg production to professionally managed poultry
                operations and useful farm by-products, our goal is to provide
                dependable agricultural products while maintaining responsible
                farm practices.
              </p>

              <div className="mt-8">
                <RouterLink to="/about" className="btn btn-primary">
                  Discover Our Farm
                  <span>→</span>
                </RouterLink>
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-3xl shadow-2xl">
                <img
                  src="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
                  alt="Poultry farming at Mebrek Farms"
                  className="h-[420px] w-full object-cover transition duration-700 hover:scale-105"
                />
              </div>

              <div className="absolute -bottom-6 -left-4 hidden rounded-2xl bg-farmGreen p-5 text-white shadow-xl sm:block md:-left-8">
                <div className="text-3xl">🐔</div>

                <div className="mt-1 font-bold">Poultry Production</div>

                <div className="text-sm text-green-100">
                  Quality-focused farming
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          WHY CHOOSE US
      ===================================================== */}

      <section className="section bg-farmGreen text-white">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wider text-green-100">
                Why Mebrek Farms
              </span>

              <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                More than farming.
                <span className="block text-yellow-300">
                  We care about quality.
                </span>
              </h2>

              <p className="mt-6 max-w-xl leading-8 text-green-50">
                Our approach combines responsible farm management, attention to
                animal health and a commitment to delivering quality
                agricultural products to our customers.
              </p>

              <RouterLink to="/about" className="btn btn-secondary mt-8">
                Learn About Us
                <span>→</span>
              </RouterLink>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15">
                <div className="text-3xl">🌿</div>

                <h3 className="mt-4 text-xl font-bold">Responsible Farming</h3>

                <p className="mt-2 text-sm leading-7 text-green-100">
                  We value responsible farming practices and a clean,
                  well-managed production environment.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15">
                <div className="text-3xl">🥚</div>

                <h3 className="mt-4 text-xl font-bold">Quality Products</h3>

                <p className="mt-2 text-sm leading-7 text-green-100">
                  Our products are produced with attention to quality and
                  consistency.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15">
                <div className="text-3xl">🐔</div>

                <h3 className="mt-4 text-xl font-bold">Healthy Poultry</h3>

                <p className="mt-2 text-sm leading-7 text-green-100">
                  Farm health and proper management are important parts of our
                  production process.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/15">
                <div className="text-3xl">🤝</div>

                <h3 className="mt-4 text-xl font-bold">Reliable Service</h3>

                <p className="mt-2 text-sm leading-7 text-green-100">
                  We make it easy for customers to contact us and request our
                  farm products.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FARM STATS
      ===================================================== */}

      <section className="bg-green-950 py-12">
        <div className="site-container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat value="24/7" label="Farm Management" />
            <Stat value="100%" label="Quality Focus" />
            <Stat value="Farm" label="Direct Products" />
            <Stat value="Nigeria" label="Our Agricultural Home" />
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURED PRODUCTS
      ===================================================== */}

      <section className="section bg-white">
        <div className="site-container">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <span className="eyebrow">Featured Products</span>

              <h2 className="section-title mt-5">
                Fresh products from the farm
              </h2>

              <p className="mt-4 max-w-2xl leading-7 text-gray-600">
                Explore some of the products available from Mebrek Farms.
                Contact us for current availability, quantities and orders.
              </p>
            </div>

            <RouterLink
              to="/products"
              className="font-semibold text-farmGreen transition hover:underline"
            >
              Explore products →
            </RouterLink>
          </div>

          <div className="grid gap-7 md:grid-cols-3">
            <ProductCard
              image="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
              icon="🥚"
              title="Fresh Eggs"
              price="From ₦4,000 / crate"
              description="Fresh eggs in different sizes and categories. Contact us for current availability and pricing."
            />

            <ProductCard
              image="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
              icon="🐓"
              title="Poultry"
              price="Available on request"
              description="Professionally managed poultry products available according to farm stock."
            />

            <ProductCard
              image="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
              icon="🌱"
              title="Farm Manure"
              price="Available on request"
              description="Farm manure available for agricultural and soil improvement applications."
            />
          </div>
        </div>
      </section>

      {/* =====================================================
          CUSTOMER CTA
      ===================================================== */}

      <section className="relative overflow-hidden bg-yellow-300">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-200/50" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-yellow-400/40" />

        <div className="site-container relative py-16 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <span className="text-4xl">🥚 🐔 🌱</span>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Looking for quality farm products?
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-700 sm:text-lg">
              Talk to Mebrek Farms about your requirements. We are ready to help
              you with product availability and orders.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <RouterLink
                to="/contact"
                className="btn bg-farmGreen px-7 py-3.5 text-white hover:bg-green-800"
              >
                Contact Us
              </RouterLink>

              <a
                href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20order%20farm%20products"
                target="_blank"
                rel="noopener noreferrer"
                className="btn border-2 border-gray-900 bg-transparent px-7 py-3.5 text-gray-900 hover:bg-gray-900 hover:text-white"
              >
                Order on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ORDER / CONTACT FORM
      ===================================================== */}

      <section className="section bg-stone-50">
        <div className="site-container">
          <div className="grid overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5 lg:grid-cols-[0.8fr_1.2fr]">
            {/* LEFT */}
            <div className="bg-farmGreen p-8 text-white sm:p-10 lg:p-12">
              <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wider text-green-100">
                Farm Direct
              </span>

              <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
                Place an order or send us a message.
              </h2>

              <p className="mt-5 leading-8 text-green-50">
                Tell us what you need and how we can reach you. Our team can
                respond with availability and further information.
              </p>

              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="text-2xl">📞</div>

                  <div>
                    <div className="font-bold">Phone</div>

                    <a
                      href="tel:+2349033723103"
                      className="text-green-100 hover:text-white"
                    >
                      +234 903 372 3103
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-2xl">✉️</div>

                  <div>
                    <div className="font-bold">Email</div>

                    <a
                      href="mailto:info@mebrekfarms.com"
                      className="text-green-100 hover:text-white"
                    >
                      info@mebrekfarms.com
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="text-2xl">💬</div>

                  <div>
                    <div className="font-bold">WhatsApp</div>

                    <a
                      href="https://wa.me/2349033723103"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-100 hover:text-white"
                    >
                      Chat with Mebrek Farms
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM */}
            <div className="p-8 sm:p-10 lg:p-12">
              <div className="mb-7">
                <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  Send an enquiry
                </h3>

                <p className="mt-2 text-gray-600">
                  Complete the form and we'll get back to you.
                </p>
              </div>

              {success && (
                <div
                  className={`mb-6 rounded-xl p-4 text-sm font-medium ${
                    success.includes("Unable")
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Your Name
                  </label>

                  <input
                    id="name"
                    type="text"
                    name="name"
                    placeholder="Enter your name"
                    value={form.name}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Phone or Email
                  </label>

                  <input
                    id="contact"
                    type="text"
                    name="contact"
                    placeholder="How can we contact you?"
                    value={form.contact}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Order / Message
                  </label>

                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us what you would like to order..."
                    value={form.message}
                    onChange={handleChange}
                    className="input resize-none"
                    rows={5}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full py-3.5">
                  Send Enquiry
                  <span>→</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FLOATING WHATSAPP
      ===================================================== */}

      <a
        href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20order%20farm%20products"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Order on WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 font-semibold text-white shadow-xl transition duration-300 hover:scale-105 hover:bg-green-700"
      >
        <span className="text-xl">💬</span>
        <span className="hidden sm:inline">Order on WhatsApp</span>
      </a>
    </div>
  );
}
