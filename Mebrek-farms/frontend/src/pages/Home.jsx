import { Link as RouterLink } from "react-router-dom";
import logo from "../assets/logo.PNG";
import { useState } from "react";
import axios from "axios";

// Reusable Card Component
function Card({ image, title, price, description }) {
  return (
    <div className="card text-center hover:scale-105 transition rounded-lg shadow-lg overflow-hidden">
      <img src={image} alt={title} className="object-cover h-40 w-full" />
      <div className="p-4">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        {price && (
          <p className="text-2xl font-bold text-green-700 mb-1">{price}</p>
        )}
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div
      className="min-h-screen bg-yellow-50 text-gray-800 font-sans"
      style={{
        fontFamily:
          '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif',
      }}
    >
      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-8 py-5 bg-white shadow sticky top-0 z-50">
        <h1 className="text-4xl font-bold text-green-700 flex items-center space-x-4">
          <img src={logo} alt="MEBREK FARMS Logo" className="h-20" />
          <span>MEBREK FARMS</span>
        </h1>
        <div className="space-x-4">
          <a href="#about" className="hover:text-green-700 cursor-pointer">
            About
          </a>
          <a href="#products" className="hover:text-green-700 cursor-pointer">
            Products
          </a>
          <a href="#contact" className="hover:text-green-700 cursor-pointer">
            Contact
          </a>
          <RouterLink
            to="/login"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Admin Login
          </RouterLink>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section
        className="h-[90vh] flex flex-col justify-center items-center text-center text-white bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://static.vecteezy.com/system/resources/thumbnails/029/340/262/small/ai-generated-ai-generative-organic-eco-chicken-rooster-and-egg-at-countryside-farm-background-graphic-art-photo.jpg')",
        }}
      >
        <div className="bg-black/50 p-10 rounded-xl animate-fadeIn">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Fresh Eggs, Healthy Poultry 🥚🐓🌿
          </h2>
          <p className="text-lg mb-6">
            Premium egg production and poultry farming in Nigeria
          </p>
          <RouterLink
            to="/login"
            className="bg-yellow-400 px-6 py-3 rounded-lg font-semibold text-black hover:bg-yellow-500 transition"
          >
            Enter Dashboard
          </RouterLink>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid md:grid-cols-3 gap-6 px-8 py-12">
        <Card
          image="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
          title="🥚 Fresh Eggs"
          description="Daily healthy egg production."
        />
        <Card
          image="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
          title="🐓Poultry"
          description="Well-fed and managed birds."
        />
        <Card
          image="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
          title="🌿 Manure"
          description="Organic fertilizer for farming."
        />
      </section>

      {/* ABOUT */}
      <section
        id="about"
        aria-label="About Mebrek Farms"
        className="px-8 py-16 bg-white text-center"
      >
        <h2 className="text-3xl font-bold mb-4">About Us</h2>
        <p className="max-w-2xl mx-auto">
          MEBREK FARMS provides high-quality poultry products with modern,
          hygienic farming methods tailored for Nigerian agriculture.
        </p>
      </section>

      {/* PRODUCTS / PRICING */}
      <section id="products" className="px-8 py-16">
        <h2 className="text-3xl font-bold text-center mb-10">
          Our Products & Prices
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card
            title="🥚🥚🥚 Crate of Eggs"
            price="₦4,800"
            description="Fresh daily supply"
            image="https://cdn.britannica.com/94/151894-050-F72A5317/Brown-eggs.jpg"
          />
          <Card
            title="🐓🐓🐓 Layers"
            price="₦20,000"
            description="Healthy and ready"
            image="https://www.shutterstock.com/image-photo/laying-hen-farm-iron-battery-600nw-2541880001.jpg"
          />
          <Card
            title="🌿🌿🌿 Manure"
            price="₦1,000/500"
            description="Organic fertilizer"
            image="https://media.istockphoto.com/id/469085306/photo/soil-with-a-garden-trowel.jpg?s=612x612&w=0&k=20&c=yOFsnxK_9g5puQIeaYLCFo6Hu1NypryTMDzWfyLEnGA="
          />
        </div>
      </section>

      {/* CONTACT / ORDER FORM */}
      <section
        id="contact"
        aria-label="Contact Mebrek Farms"
        className="px-8 py-16 bg-white"
      >
        <h2 className="text-3xl font-bold text-center mb-6">
          Place an Order / Contact Us
        </h2>
        <form className="max-w-xl mx-auto space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <textarea
            placeholder="Your Order / Message"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
            rows={5}
          ></textarea>
          <button className="bg-green-600 text-white w-full py-3 rounded-lg font-semibold hover:bg-green-700 transition">
            Submit
          </button>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6 bg-green-700 text-white">
        <p>© 2026 MEBREK FARMS. All rights reserved.</p>
      </footer>
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
