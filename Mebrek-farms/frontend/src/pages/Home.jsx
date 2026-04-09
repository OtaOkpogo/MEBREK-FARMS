import { Link as RouterLink } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import logo from "../assets/logo.PNG";

// Reusable Card Component

function useInView() {
  const ref = useRef();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 },
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}
function Card({ image, title, price, description }) {
  return (
    <div className="bg-white text-center hover:scale-105 transition duration-300 rounded-xl shadow-lg hover:shadow-2xl overflow-hidden">
      <img src={image} alt={title} className="object-cover h-40 w-full" />
      <div className="p-4">
        <h3 className="text-lg md:text-xl font-bold mb-2">{title}</h3>
        {price && (
          <p className="text-xl md:text-2xl font-bold text-green-700 mb-1">
            {price}
          </p>
        )}
        <p className="text-sm md:text-base">{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  // ✅ STATE
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [success, setSuccess] = useState("");

  // ✅ HANDLE INPUT CHANGE
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // ✅ HANDLE SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/api/orders", form);

      setSuccess("✅ Order sent successfully!");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      console.error(err);
      setSuccess("❌ Failed to send order");
    }
  };

  return (
    <div className="min-h-screen bg-yellow-50 text-gray-800 scroll-smooth">
      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-4 md:px-8 py-4 bg-white shadow sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img src={logo} alt="MEBREK FARMS Logo" className="h-12 md:h-16" />
          <span className="text-lg md:text-2xl font-bold text-green-700">
            MEBREK FARMS
          </span>
        </div>

        <div className="hidden md:flex space-x-6 items-center">
          <a href="#about" className="hover:text-green-700">
            About
          </a>
          <a href="#products" className="hover:text-green-700">
            Products
          </a>
          <a href="#contact" className="hover:text-green-700">
            Contact
          </a>

          <RouterLink
            to="/login"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Admin
          </RouterLink>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative h-screen flex items-center justify-center text-center text-white overflow-hidden">
        {/* BACKGROUND IMAGE */}
        <div
          className="absolute inset-0 bg-cover bg-center scale-105 animate-zoomSlow"
          style={{
            backgroundImage:
              "url('https://static.vecteezy.com/system/resources/thumbnails/029/340/262/small/ai-generated-ai-generative-organic-eco-chicken-rooster-and-egg-at-countryside-farm-background-graphic-art-photo.jpg')",
          }}
        ></div>

        {/* GRADIENT OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70"></div>

        {/* CONTENT */}
        <div className="relative z-10 px-4 animate-fadeUp">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            🥚 Fresh Eggs, Healthy Poultry
          </h2>

          <p className="text-sm md:text-lg mb-6 opacity-90">
            Premium egg production and poultry farming in Nigeria
          </p>

          <RouterLink
            to="/login"
            className="bg-yellow-400 px-6 py-3 rounded-lg font-semibold text-black hover:scale-110 transition duration-300 shadow-lg"
          >
            Enter Dashboard
          </RouterLink>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-4 md:px-8 py-12">
        <Card
          image="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
          title="🥚 Fresh Eggs"
          description="Daily healthy egg production."
        />
        <Card
          image="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
          title="🐓 Poultry"
          description="Well-fed and managed birds."
        />
        <Card
          image="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
          title="🌱 Manure"
          description="Organic fertilizer for farming."
        />
      </section>

      {/* ABOUT */}
      <section id="about" className="px-4 md:px-8 py-16 bg-white text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">About Us</h2>
        <p className="max-w-2xl mx-auto">
          MEBREK FARMS provides high-quality poultry products with modern,
          hygienic farming methods tailored for Nigerian agriculture.
        </p>
      </section>

      {/* PRODUCTS */}
      <section id="products" className="px-4 md:px-8 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          Our Products & Prices
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card
            title="🥚 Crate of Eggs"
            price="₦4,800"
            description="Fresh daily supply"
            image="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
          />
          <Card
            title="🐓 Layers"
            price="₦20,000"
            description="Healthy and ready"
            image="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
          />
          <Card
            title="🌱 Manure"
            price="₦1,000/500"
            description="Organic fertilizer"
            image="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
          />
        </div>
      </section>

      {/* CONTACT FORM */}
      <section id="contact" className="px-4 md:px-8 py-16 bg-white">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
          Place an Order / Contact Us
        </h2>

        <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
          {success && <p className="text-center text-green-600">{success}</p>}

          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={form.name}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
          />

          <textarea
            name="message"
            placeholder="Your Order / Message"
            value={form.message}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            rows={5}
            required
          ></textarea>

          <button className="w-full bg-green-600 text-white py-3 rounded-lg">
            Submit Order
          </button>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 bg-green-700 text-white">
        <p>© 2026 MEBREK FARMS. All rights reserved.</p>
      </footer>

      {/* WHATSAPP BUTTON */}
      <a
        href="https://wa.me/2349033723103?text=Hello%20MEBREK%20FARMS,%20I%20want%20to%20order%20eggs"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-full shadow-lg hover:scale-110 transition z-50"
      >
        📱 <span className="hidden md:inline">Order on WhatsApp</span>
      </a>
    </div>
  );
}
