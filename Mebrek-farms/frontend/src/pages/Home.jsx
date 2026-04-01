import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-yellow-50 text-gray-800">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-8 py-5 bg-white shadow">
        <h1 className="text-2xl font-bold text-green-700">
          Ìµö MEBREK FARMS
        </h1>

        <div className="space-x-6">
          <a href="#about" className="hover:text-green-700">About</a>
          <a href="#products" className="hover:text-green-700">Products</a>
          <a href="#contact" className="hover:text-green-700">Contact</a>

          <Link
            to="/login"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Admin Login
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="text-center py-20 px-6">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Fresh Eggs, Healthy Poultry Ì∞î
        </h2>

        <p className="text-lg mb-6 max-w-xl mx-auto">
          We produce high-quality eggs and poultry products using modern,
          hygienic farming practices in Nigeria.
        </p>

        <Link
          to="/login"
          className="bg-yellow-400 px-6 py-3 rounded-lg font-semibold shadow hover:bg-yellow-500"
        >
          Enter Farm Dashboard
        </Link>
      </section>

      {/* FEATURES */}
      <section className="grid md:grid-cols-3 gap-6 px-8 py-10">
        <div className="card text-center">
          <h3 className="text-xl font-bold mb-2">Ìµö Fresh Eggs</h3>
          <p>Daily production of healthy, organic eggs.</p>
        </div>

        <div className="card text-center">
          <h3 className="text-xl font-bold mb-2">Ì∞î Poultry Farming</h3>
          <p>Well-managed birds with modern feeding systems.</p>
        </div>

        <div className="card text-center">
          <h3 className="text-xl font-bold mb-2">Ìº± Organic Manure</h3>
          <p>High-quality wet and dry manure for agriculture.</p>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="px-8 py-16 bg-white">
        <h2 className="text-3xl font-bold mb-4 text-center">About Us</h2>

        <p className="max-w-3xl mx-auto text-center">
          MEBREK FARMS is dedicated to sustainable poultry farming,
          delivering fresh eggs and high-quality agricultural products.
          Our mission is to provide healthy food while maintaining
          excellent farm standards.
        </p>
      </section>

      {/* PRODUCTS SECTION */}
      <section id="products" className="px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">
          Our Products
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card text-center">
            <h3 className="font-bold text-lg">Crate of Eggs</h3>
            <p>Affordable and fresh daily supply.</p>
          </div>

          <div className="card text-center">
            <h3 className="font-bold text-lg">Broilers</h3>
            <p>Healthy chickens ready for consumption.</p>
          </div>

          <div className="card text-center">
            <h3 className="font-bold text-lg">Manure</h3>
            <p>Organic fertilizer for crops.</p>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="px-8 py-16 bg-white text-center">
        <h2 className="text-3xl font-bold mb-4">Contact Us</h2>

        <p>Ì≥ç Lagos, Nigeria</p>
        <p>Ì≥û +234 XXX XXX XXXX</p>
        <p>Ì≥ß info@mebrekfarms.com</p>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 bg-green-700 text-white">
        <p>¬© 2026 MEBREK FARMS. All rights reserved.</p>
      </footer>

    </div>
  );
}
