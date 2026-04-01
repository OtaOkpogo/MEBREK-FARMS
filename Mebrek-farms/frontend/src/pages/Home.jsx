import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-yellow-50 text-gray-800">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-8 py-5 bg-white shadow">
        <h1 className="text-2xl font-bold text-green-700">
          íµš MEBREK FARMS
        </h1>

        <div className="space-x-6">
          <a href="#about" className="hover:text-green-700">About</a>
          <a href="#products" className="hover:text-green-700">Products</a>
          <a href="#contact" className="hover:text-green-700">Contact</a>

          <Link
            to="/login"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Admin Login
          </Link>
        </div>
      </nav>

      {/* HERO SECTION WITH BACKGROUND IMAGE */}
      <section
        className="h-[90vh] flex flex-col justify-center items-center text-center text-white bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1589927986089-35812388d1f4')"
        }}
      >
        <div className="bg-black/50 p-10 rounded-xl animate-fadeIn">
          <h2 className="text-5xl font-bold mb-4">
            Fresh Eggs, Healthy Poultry í°”
          </h2>

          <p className="text-lg mb-6">
            Premium egg production and poultry farming in Nigeria
          </p>

          <Link
            to="/login"
            className="bg-yellow-400 px-6 py-3 rounded-lg font-semibold text-black hover:bg-yellow-500 transition"
          >
            Enter Dashboard
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid md:grid-cols-3 gap-6 px-8 py-12">
        <div className="card text-center hover:scale-105 transition">
          <img
  		src="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
  		alt="Fresh farm eggs"
  		className="rounded-lg mb-3 hover-zoom object-cover h-40 w-full"
          />
          <h3 className="text-xl font-bold">íµš Fresh Eggs</h3>
          <p>Daily healthy egg production.</p>
        </div>

        <div className="card text-center hover:scale-105 transition">
          <img
            src="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
            className="rounded-lg mb-3"
          />
          <h3 className="text-xl font-bold">í°” Poultry</h3>
          <p>Well-fed and managed birds.</p>
        </div>

        <div className="card text-center hover:scale-105 transition">
          <img
            src="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
            className="rounded-lg mb-3"
          />
          <h3 className="text-xl font-bold">í¼± Manure</h3>
          <p>Organic fertilizer for farming.</p>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="px-8 py-16 bg-white text-center">
        <h2 className="text-3xl font-bold mb-4">About Us</h2>
        <p className="max-w-2xl mx-auto">
          MEBREK FARMS provides high-quality poultry products with modern,
          hygienic farming methods tailored for Nigerian agriculture.
        </p>
      </section>

      {/* PRICING / PRODUCTS */}
      <section id="products" className="px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">
          Our Products & Prices
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="card text-center hover:scale-105 transition">
            <h3 className="text-xl font-bold mb-2">íµš Crate of Eggs</h3>
            <p className="text-2xl font-bold text-green-700">â‚¦3,500</p>
            <p>Fresh daily supply</p>
          </div>

          <div className="card text-center hover:scale-105 transition">
            <h3 className="text-xl font-bold mb-2">í°” Broilers</h3>
            <p className="text-2xl font-bold text-green-700">â‚¦8,000</p>
            <p>Healthy and ready</p>
          </div>

          <div className="card text-center hover:scale-105 transition">
            <h3 className="text-xl font-bold mb-2">í¼± Manure</h3>
            <p className="text-2xl font-bold text-green-700">â‚¦2,000</p>
            <p>Organic fertilizer</p>
          </div>

        </div>
      </section>

      {/* CONTACT / ORDER FORM */}
      <section id="contact" className="px-8 py-16 bg-white">
        <h2 className="text-3xl font-bold text-center mb-6">
          Place an Order / Contact Us
        </h2>

        <form className="max-w-xl mx-auto space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="input"
          />

          <input
            type="email"
            placeholder="Email"
            className="input"
          />

          <textarea
            placeholder="Your Order / Message"
            className="input"
          ></textarea>

          <button className="btn btn-primary w-full">
            Submit
          </button>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 bg-green-700 text-white">
        <p>Â© 2026 MEBREK FARMS. All rights reserved.</p>
      </footer>

    </div>
  );
}
