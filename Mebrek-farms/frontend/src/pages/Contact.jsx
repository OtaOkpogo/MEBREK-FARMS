import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import axios from "axios";

const initialForm = {
  name: "",
  contact: "",
  message: "",
};

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (success) {
      setSuccess("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    setSuccess("");

    try {
      await axios.post("http://localhost:5000/api/orders", form);

      setSuccess("success");
      setForm(initialForm);
    } catch (error) {
      console.error("ORDER SUBMISSION ERROR:", error);

      setSuccess("error");
    } finally {
      setLoading(false);
    }
  };

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
              CONTACT MEBREK FARMS
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Let&apos;s talk about
              <span className="block text-yellow-300">
                your farm product needs.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-green-100 sm:text-lg">
              Looking for eggs, poultry products or agricultural products? Send
              us an enquiry and our team can help you with availability,
              quantities and current pricing.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#enquiry" className="btn btn-secondary">
                Send an Enquiry
              </a>

              <a
                href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                target="_blank"
                rel="noopener noreferrer"
                className="btn border-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white hover:text-green-900"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          CONTACT DETAILS + FORM
      ===================================================== */}
      <section id="enquiry" className="section bg-white">
        <div className="site-container">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
            {/* =================================================
                CONTACT INFORMATION
            ================================================= */}
            <div className="lg:col-span-2">
              <span className="eyebrow">Get In Touch</span>

              <h2 className="section-title mt-5">
                We&apos;d love to hear from you
              </h2>

              <p className="mt-6 leading-8 text-gray-600">
                Whether you want to order eggs, enquire about poultry products,
                ask about manure or discuss another farm requirement, you can
                contact MEBREK FARMS directly.
              </p>

              <div className="mt-8 space-y-4">
                {/* Phone */}
                <a
                  href="tel:+2349033723103"
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-stone-50 p-5 transition hover:-translate-y-1 hover:border-green-200 hover:bg-green-50 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-2xl">
                    📞
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500">Phone</p>

                    <p className="mt-1 font-bold text-gray-900 group-hover:text-green-800">
                      +234 903 372 3103
                    </p>
                  </div>
                </a>

                {/* Email */}
                <a
                  href="mailto:info@mebrekfarms.com"
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-stone-50 p-5 transition hover:-translate-y-1 hover:border-green-200 hover:bg-green-50 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-2xl">
                    ✉️
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500">Email</p>

                    <p className="mt-1 font-bold text-gray-900 group-hover:text-green-800">
                      info@mebrekfarms.com
                    </p>
                  </div>
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-stone-50 p-5 transition hover:-translate-y-1 hover:border-green-200 hover:bg-green-50 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-2xl">
                    💬
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-500">
                      WhatsApp
                    </p>

                    <p className="mt-1 font-bold text-gray-900 group-hover:text-green-800">
                      Chat with MEBREK FARMS
                    </p>
                  </div>
                </a>
              </div>

              {/* Product links */}
              <div className="mt-8 rounded-3xl bg-green-950 p-7 text-white shadow-xl">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-300">
                  Looking for a product?
                </p>

                <h3 className="mt-3 text-2xl font-bold">
                  Browse our farm products
                </h3>

                <p className="mt-3 text-sm leading-7 text-green-100">
                  Explore our egg sizes and other products before sending your
                  enquiry.
                </p>

                <RouterLink
                  to="/products"
                  className="mt-6 inline-flex items-center font-bold text-yellow-300 transition hover:gap-2"
                >
                  View Products
                  <span className="ml-2">→</span>
                </RouterLink>
              </div>
            </div>

            {/* =================================================
                ENQUIRY FORM
            ================================================= */}
            <div className="lg:col-span-3">
              <div className="rounded-3xl bg-stone-50 p-6 shadow-sm ring-1 ring-black/5 sm:p-8 lg:p-10">
                <div>
                  <span className="text-sm font-bold uppercase tracking-[0.2em] text-green-800">
                    Send an Enquiry
                  </span>

                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900">
                    How can we help?
                  </h2>

                  <p className="mt-3 leading-7 text-gray-600">
                    Fill in the form below and tell us what you need.
                  </p>
                </div>

                {/* Success message */}
                {success === "success" && (
                  <div
                    className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800"
                    role="status"
                  >
                    <strong>Enquiry sent successfully.</strong>
                    <br />
                    Thank you for contacting MEBREK FARMS. We will get back to
                    you as soon as possible.
                  </div>
                )}

                {/* Error message */}
                {success === "error" && (
                  <div
                    className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
                    role="alert"
                  >
                    <strong>We could not send your enquiry.</strong>
                    <br />
                    Please try again or contact us directly by phone or
                    WhatsApp.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-bold text-gray-800"
                    >
                      Your Name
                    </label>

                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      required
                      className="input"
                    />
                  </div>

                  {/* Contact */}
                  <div>
                    <label
                      htmlFor="contact"
                      className="mb-2 block text-sm font-bold text-gray-800"
                    >
                      Phone Number or Email
                    </label>

                    <input
                      id="contact"
                      name="contact"
                      type="text"
                      value={form.contact}
                      onChange={handleChange}
                      placeholder="e.g. 08012345678 or your@email.com"
                      required
                      className="input"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-bold text-gray-800"
                    >
                      How Can We Help?
                    </label>

                    <textarea
                      id="message"
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us what you would like to order or enquire about..."
                      rows={6}
                      required
                      className="input resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Sending Enquiry..." : "Send Enquiry"}
                  </button>

                  <p className="text-center text-xs leading-5 text-gray-500">
                    Your enquiry will be sent to MEBREK FARMS for processing.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SIMPLE ORDER CTA
      ===================================================== */}
      <section className="bg-yellow-300">
        <div className="site-container py-14 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-green-900">
                Prefer WhatsApp?
              </p>

              <h2 className="mt-2 text-3xl font-extrabold text-green-950 sm:text-4xl">
                Chat with us directly.
              </h2>

              <p className="mt-3 text-green-900/80">
                Send us a message and tell us what you need.
              </p>
            </div>

            <a
              href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20make%20an%20enquiry"
              target="_blank"
              rel="noopener noreferrer"
              className="btn bg-green-900 text-white hover:bg-green-800"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
