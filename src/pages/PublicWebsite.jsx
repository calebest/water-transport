import { useState, useEffect, useMemo } from "react";
import { websiteService } from "../services/website";

export default function PublicWebsite({ onOpenLogin, user, onReturnToDashboard }) {
  const [content, setContent] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("All");
  const [openFaq, setOpenFaq] = useState(null);

  // Interactive Calculator State
  const [calcPurpose, setCalcPurpose] = useState("residential");
  const [calcVolume, setCalcVolume] = useState("10,000L");

  // Inquiry Form State
  const [form, setForm] = useState({
    customerName: "",
    phoneNumber: "",
    whatsappNumber: "",
    deliveryLocation: "",
    serviceType: "Clean Bulk Drinking Water",
    volume: "10,000L",
    urgency: "Today",
    notes: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState(null);
  const [sameAsPhone, setSameAsPhone] = useState(true);

  useEffect(() => {
    const unsub = websiteService.subscribe((data) => {
      setContent(data);
    });
    return () => unsub();
  }, []);

  if (!content) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-3xl shadow-xl border border-slate-100 max-w-sm">
          <div className="text-5xl animate-bounce mb-3">💧</div>
          <p className="text-emerald-600 font-extrabold tracking-wider uppercase text-xs">Mount Kenya Water Distributors</p>
          <p className="text-slate-500 text-sm mt-1">Connecting to live fleet portal…</p>
        </div>
      </div>
    );
  }

  const { general, contacts, services, locations, photos } = content;

  // Filtered photos
  const filteredPhotos = activeCategory === "All"
    ? photos
    : photos.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());

  const categories = ["All", ...Array.from(new Set(photos.map(p => p.category).filter(Boolean)))];

  // Filtered locations
  const filteredLocations = locations.filter(loc => {
    const matchesSearch = !locationSearch || 
      loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
      loc.subzones?.toLowerCase().includes(locationSearch.toLowerCase());
    
    if (selectedCounty === "All") return matchesSearch;
    return matchesSearch && loc.name.toLowerCase().includes(selectedCounty.toLowerCase());
  });

  const handleSelectService = (serviceTitle) => {
    setForm(prev => ({ ...prev, serviceType: serviceTitle }));
    const orderSection = document.getElementById("order-section");
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSelectLocation = (locName) => {
    setForm(prev => ({ ...prev, deliveryLocation: locName }));
    const orderSection = document.getElementById("order-section");
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleApplyCalculator = () => {
    setForm(prev => ({
      ...prev,
      volume: calcVolume,
      serviceType: calcPurpose === "pool" ? "Swimming Pool Filling"
        : calcPurpose === "construction" ? "Construction & Site Water"
        : calcPurpose === "emergency" ? "Emergency 24/7 Water Supply"
        : "Clean Bulk Drinking Water",
      urgency: calcPurpose === "emergency" ? "Emergency ASAP" : "Today"
    }));
    const orderSection = document.getElementById("order-section");
    if (orderSection) {
      orderSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    if (!form.customerName || !form.phoneNumber || !form.deliveryLocation) {
      alert("Please fill in your name, phone number, and delivery location.");
      return;
    }

    setSubmitting(true);
    try {
      const inquiryPayload = {
        ...form,
        whatsappNumber: sameAsPhone ? form.phoneNumber : (form.whatsappNumber || form.phoneNumber)
      };
      const saved = await websiteService.submitInquiry(inquiryPayload);
      setSubmittedInquiry(saved);
      // Reset form
      setForm({
        customerName: "",
        phoneNumber: "",
        whatsappNumber: "",
        deliveryLocation: "",
        serviceType: services[0]?.title || "Clean Bulk Drinking Water",
        volume: "10,000L",
        urgency: "Today",
        notes: ""
      });
    } catch (err) {
      console.error("Failed to submit inquiry:", err);
      alert("There was an issue sending your request. Please call our dispatch directly.");
    } finally {
      setSubmitting(false);
    }
  };

  // Build direct WhatsApp link
  const buildWhatsAppLink = (customText) => {
    const rawNumber = (contacts?.whatsappNumber || "254712345678").replace(/[^0-9]/g, "");
    const cleanNumber = rawNumber.startsWith("0") ? "254" + rawNumber.substring(1) : rawNumber;
    const text = encodeURIComponent(customText || `Hello ${general.companyName}, I would like to order a clean water tanker delivery.`);
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  const FAQS = [
    {
      q: "Where is the water sourced and is it tested for drinking?",
      a: "Our water is drawn from certified, natural high-altitude freshwater springs and rigorously regulated deep boreholes along the Mount Kenya watershed. Every batch undergoes microbiological safety checks and is 100% certified by KEBS and public health authorities for residential and commercial consumption."
    },
    {
      q: "How fast can a water bowser reach my location in an emergency?",
      a: "We maintain standby tankers along main transit corridors across Nairobi, Kiambu, Thika, and Mount Kenya towns. Emergency dispatches typically arrive within 45 to 90 minutes of order confirmation, 24 hours a day."
    },
    {
      q: "Do you have long delivery hoses for high-rise buildings and rooftop tanks?",
      a: "Yes! Every bowser in our fleet is fitted with heavy-duty booster pumps and up to 80 meters (260+ feet) of clean food-grade delivery hose. We easily pump water up to 5-story building rooftops, basement storage, and elevated agricultural tanks."
    },
    {
      q: "What sizes of water tankers are available for booking?",
      a: "Our fleet consists of 5,000L, 10,000L, 15,000L, 20,000L, and heavy 30,000L+ multi-axle tankers. Whether you need a single residential refill or ongoing high-volume site supply, we deploy the exact vehicle size needed."
    },
    {
      q: "What payment options are supported?",
      a: "We accept M-Pesa (Buy Goods / Paybill), direct bank wire transfers, and cash upon delivery. For recurring commercial estates, construction contractors, and hospitality facilities, we provide structured 15 or 30-day corporate invoices."
    },
    {
      q: "Can we schedule recurring weekly or daily tanker deliveries?",
      a: "Absolutely. We manage automated recurring contracts for hotels, schools, hospitals, commercial laundries, and apartment complexes, ensuring your storage tanks never run dry."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white relative">
      
      {/* Top Floating Staff Banner if logged in */}
      {user && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs font-bold py-2.5 px-4 shadow-md flex items-center justify-between border-b border-emerald-400/30">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-200 animate-ping" />
            <span>Staff Portal Mode • Logged in as <span className="underline font-black">{user.email}</span></span>
          </div>
          <button
            onClick={onReturnToDashboard}
            className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-lg shadow-sm font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📊</span>
            <span>Return to Dashboard</span>
          </button>
        </div>
      )}

      {/* Top Utility Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Fleet Active
            </span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-slate-300">24/7 Bulk Water Supply Across Mt. Kenya & Nairobi Corridors</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <a href={`tel:${contacts.primaryPhone}`} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
              <span>📞 Hotline:</span>
              <span className="font-bold text-white">{contacts.primaryPhone}</span>
            </a>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">🕒 {general.operatingHours}</span>
          </div>
        </div>
      </div>

      {/* Modern Clean Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-100 group-hover:scale-105 transition-transform">
              🚛
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black tracking-[0.18em] text-emerald-600 uppercase">Mount Kenya</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Water</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight">
                {general.companyName.replace("Mount Kenya ", "")}
              </h1>
            </div>
          </a>

          {/* Nav Links Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#calculator" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              <span>🧮</span>
              <span>Estimator</span>
            </a>
            <a href="#services" className="hover:text-emerald-600 transition-colors">Services</a>
            <a href="#coverage" className="hover:text-emerald-600 transition-colors">Coverage</a>
            <a href="#gallery" className="hover:text-emerald-600 transition-colors">Fleet Gallery</a>
            <a href="#faqs" className="hover:text-emerald-600 transition-colors">FAQs</a>
            <a href="#order-section" className="text-emerald-600 hover:text-emerald-700 font-black transition-colors">
              Book Delivery
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={`tel:${contacts.primaryPhone}`}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl border border-slate-200 transition-all"
            >
              <span>📞</span>
              <span>Call Dispatch</span>
            </a>

            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/25 transition-all hover:scale-105"
            >
              <span className="text-base">💬</span>
              <span>WhatsApp Order</span>
            </a>

            {onOpenLogin && !user && (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 transition-all ml-1 cursor-pointer"
                title="Staff Portal Login"
              >
                <span>🔐</span>
                <span className="hidden lg:inline">Staff</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section — Bright, Luminous, Pure */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-sky-50/70 via-white to-emerald-50/30 border-b border-slate-100">
        {/* Soft Ambient Light Glows */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-br from-emerald-200/40 via-cyan-200/35 to-sky-200/30 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[300px] bg-teal-100/50 rounded-full blur-[90px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-emerald-200/80 text-emerald-700 text-xs font-extrabold mb-6 shadow-sm shadow-emerald-500/5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{general.badgeText || "24/7 Fast Dispatch Available"}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 font-semibold">100% Certified Food Grade</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12] mb-6">
              {general.tagline}
            </h2>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed mb-8 max-w-2xl mx-auto">
              {general.description}
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
              <a
                href="#order-section"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-600/25 text-base transition-all hover:scale-105"
              >
                <span>💧</span>
                <span>Request Tanker Now</span>
              </a>

              <a
                href={buildWhatsAppLink("Hello, I need urgent bulk water delivery. Please share available bowsers and estimated ETA.")}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-emerald-50/50 text-slate-800 font-extrabold px-6 py-4 rounded-2xl border-2 border-emerald-500/30 text-base shadow-sm transition-all hover:border-emerald-500 hover:text-emerald-700"
              >
                <span className="text-emerald-600 text-lg">💬</span>
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href="#calculator"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-4 rounded-2xl border border-slate-200 text-sm transition-all"
              >
                <span>🧮</span>
                <span>Water Estimator</span>
              </a>
            </div>

            {/* Key Value Highlights Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-1.5">⚡</div>
                <h3 className="font-extrabold text-sm text-slate-800">Rapid Dispatch</h3>
                <p className="text-xs text-slate-500 mt-0.5">Under 60–90 mins in core coverage zones</p>
              </div>
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-1.5">🛡️</div>
                <h3 className="font-extrabold text-sm text-slate-800">Food-Grade Tanks</h3>
                <p className="text-xs text-slate-500 mt-0.5">100% sanitized food-grade stainless steel</p>
              </div>
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-1.5">🚛</div>
                <h3 className="font-extrabold text-sm text-slate-800">Flexible Capacities</h3>
                <p className="text-xs text-slate-500 mt-0.5">5,000L to 30,000L+ bowsers</p>
              </div>
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-2xl mb-1.5">🕒</div>
                <h3 className="font-extrabold text-sm text-slate-800">24/7 Availability</h3>
                <p className="text-xs text-slate-500 mt-0.5">{general.operatingHours}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Stats Bar — Bright Glassmorphism */}
        {general.stats && general.stats.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 mt-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
              {general.stats.map((stat, idx) => (
                <div key={idx} className="text-center py-2 border-slate-100 not-last:border-r">
                  <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* NEW INTERACTIVE FEATURE: Water Need & Tanker Estimator */}
      <section id="calculator" className="py-20 bg-white relative border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200/70">
              Interactive Tool
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Water Need & Tanker Estimator
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Select your use case and desired volume to find the right bowser specification, pump reach, and instant recommendation.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50/40 rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-lg">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Controls Column */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                    1. What is your water requirement for?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: "residential", label: "Home / Residential", icon: "🏡" },
                      { id: "construction", label: "Construction Site", icon: "🏗️" },
                      { id: "pool", label: "Swimming Pool", icon: "🏊" },
                      { id: "hotel", label: "Hotel / Restaurant", icon: "🏨" },
                      { id: "farm", label: "Farm / Irrigation", icon: "🌾" },
                      { id: "emergency", label: "Emergency / Rapid", icon: "🚨" },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCalcPurpose(item.id)}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          calcPurpose === item.id
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-[1.02]"
                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-xl mb-1">{item.icon}</span>
                        <span className="text-xs font-bold leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      2. Choose Required Tanker Capacity
                    </label>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Selected: {calcVolume}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { vol: "5,000L", tag: "Small / Domestic" },
                      { vol: "10,000L", tag: "Most Popular" },
                      { vol: "15,000L", tag: "Commercial" },
                      { vol: "20,000L", tag: "Heavy Site" },
                      { vol: "30,000L+", tag: "Industrial Bulk" },
                    ].map(item => (
                      <button
                        key={item.vol}
                        type="button"
                        onClick={() => setCalcVolume(item.vol)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                          calcVolume === item.vol
                            ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <p className="text-sm font-black">{item.vol}</p>
                        <p className={`text-[10px] mt-0.5 font-medium ${calcVolume === item.vol ? "text-emerald-300" : "text-slate-400"}`}>
                          {item.tag}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Result Card */}
              <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-emerald-500/30 p-6 sm:p-7 shadow-xl shadow-emerald-950/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Recommendation</span>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      Ready for Dispatch
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Recommended Unit:</p>
                      <h4 className="text-xl font-black text-slate-900 mt-0.5">
                        {calcVolume} Food-Grade Stainless Steel Bowser
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Pumping Reach</p>
                        <p className="text-xs font-extrabold text-slate-800 mt-0.5">Up to 80m High-Pressure</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Average Turnaround</p>
                        <p className="text-xs font-extrabold text-emerald-600 mt-0.5">45 – 90 Minutes</p>
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200/70 p-3.5 rounded-2xl text-xs text-emerald-800 space-y-1">
                      <p className="font-black flex items-center gap-1.5">
                        <span>✓</span> 100% Quality Certified
                      </p>
                      <p className="text-emerald-700 leading-relaxed">
                        Pure freshwater certified by public water authorities and KEBS. Safe for drinking, domestic, and commercial use.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={handleApplyCalculator}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Use in Booking Form</span>
                    <span>→</span>
                  </button>

                  <a
                    href={buildWhatsAppLink(`Hello Mount Kenya Water Distributors, based on your online estimator I would like to order a ${calcVolume} tanker for ${calcPurpose}. Please confirm availability and cost.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>💬 Direct WhatsApp Quote</span>
                  </a>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Services Section — Clean Modern Cards */}
      <section id="services" className="py-20 bg-gradient-to-b from-slate-50 to-white relative border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80">
              Bulk Supply Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Specialized Water Delivery Services
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              From residential estates to heavy infrastructure and commercial facilities, we deliver quality water on demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <div
                key={svc.id}
                className={`relative rounded-3xl p-7 transition-all flex flex-col justify-between group hover:-translate-y-1.5 ${
                  svc.popular
                    ? "bg-white border-2 border-emerald-500 shadow-xl shadow-emerald-600/10"
                    : "bg-white border border-slate-200/90 hover:border-emerald-300 shadow-sm hover:shadow-lg"
                }`}
              >
                {svc.popular && (
                  <span className="absolute -top-3.5 right-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                    ★ Most Requested
                  </span>
                )}

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/70 flex items-center justify-center text-3xl mb-5 group-hover:scale-110 transition-transform">
                    {svc.icon}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">{svc.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 font-normal">
                    {svc.description}
                  </p>
                </div>

                <div>
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-500 font-semibold">Capacities:</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      {svc.capacities}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectService(svc.title)}
                    className="w-full bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Request This Service</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage Areas Section with Town Search */}
      <section id="coverage" className="py-20 bg-white relative border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-cyan-700 bg-cyan-50 px-3.5 py-1.5 rounded-full border border-cyan-200">
              Fleet Range & Turnaround
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Locations & Delivery Coverage
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Our tankers are stationed along primary regional corridors for rapid, guaranteed delivery times.
            </p>
          </div>

          {/* Interactive Search & Filter Bar */}
          <div className="max-w-xl mx-auto mb-10 flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search your town, estate, or highway corridor…"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
              {locationSearch && (
                <button
                  onClick={() => setLocationSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              {["All", "Nairobi", "Kiambu", "Thika", "Nyeri"].map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCounty(c)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCounty === c
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {filteredLocations.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-3xl border border-slate-200 max-w-md mx-auto">
              <p className="text-slate-500 font-semibold text-sm">No coverage zone matching "{locationSearch}".</p>
              <p className="text-xs text-slate-400 mt-1">We still deliver custom bulk routes across Kenya!</p>
              <a
                href={buildWhatsAppLink(`Hello Mount Kenya Water, I need delivery to: ${locationSearch}. Do you deliver here?`)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-emerald-600 font-bold text-xs underline"
              >
                Inquire on WhatsApp →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-6 hover:border-emerald-400 hover:shadow-md transition-all relative overflow-hidden group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">📍</span>
                      <h3 className="font-black text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {loc.name}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                      ⏱️ {loc.turnaround}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Key Delivery Zones:</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                    {loc.subzones}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      Bowser On Standby
                    </span>
                    <button
                      onClick={() => handleSelectLocation(loc.name)}
                      className="bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-extrabold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Select Zone →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4-Step Pure Water Assurance Process */}
      <section className="py-20 bg-gradient-to-b from-sky-50/50 via-slate-50 to-white relative border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200">
              Purity & Safety Guarantee
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              How We Deliver Pristine Water
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Rigorous safety protocols from pure mountain catchment down to your destination tank.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Certified Pure Source",
                desc: "Drawn from pristine natural high-altitude freshwater springs and certified deep boreholes.",
                icon: "🏔️"
              },
              {
                step: "02",
                title: "Sanitized Stainless Tanks",
                desc: "Bowser tanks are steam-sanitized before loading to ensure zero bacterial contamination.",
                icon: "🛡️"
              },
              {
                step: "03",
                title: "Sealed Transit & GPS",
                desc: "Tamper-evident seals on filling valves with real-time GPS tracking for accurate ETA.",
                icon: "🚛"
              },
              {
                step: "04",
                title: "Metered Pumping",
                desc: "High-pressure clean pumping with calibrated volume meters directly into your storage.",
                icon: "💧"
              }
            ].map((p, idx) => (
              <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative overflow-hidden">
                <span className="text-4xl font-black text-slate-100 absolute top-4 right-5 select-none">
                  {p.step}
                </span>
                <div className="text-3xl mb-4">{p.icon}</div>
                <h3 className="text-lg font-black text-slate-900 mb-2">{p.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Gallery Section — Bright, Modern Grid */}
      <section id="gallery" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                Visual Showcase
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
                Our Fleet & Operations Gallery
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Take a look at our clean stainless steel tankers, pumping gear, and source management.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    activeCategory === cat
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setLightboxPhoto(photo)}
                className="group relative h-64 rounded-3xl overflow-hidden border border-slate-200/90 bg-slate-100 cursor-pointer shadow-sm hover:shadow-xl transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />

                <div className="absolute top-4 left-4">
                  <span className="bg-white/90 backdrop-blur-md text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm">
                    {photo.category || "General"}
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-sm font-bold leading-snug line-clamp-2">
                    {photo.caption}
                  </p>
                  <p className="text-[11px] text-emerald-300 font-bold mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>🔍</span> Click to view high-res
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 font-black flex items-center justify-center shadow-md cursor-pointer"
            >
              ✕
            </button>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption}
              className="w-full max-h-[70vh] object-cover bg-slate-100"
            />
            <div className="p-6 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">
                  {lightboxPhoto.category}
                </span>
                <h4 className="text-base font-extrabold text-slate-900 mt-1">
                  {lightboxPhoto.caption}
                </h4>
              </div>
              <a
                href={buildWhatsAppLink(`Hello, I saw your fleet photo: "${lightboxPhoto.caption}" and would like to order water delivery.`)}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 whitespace-nowrap"
              >
                Inquire on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Online Order / Booking Section — Clean, High-Trust Card */}
      <section id="order-section" className="py-20 bg-gradient-to-b from-slate-50 via-sky-50/30 to-emerald-50/20 relative border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border-2 border-emerald-500/20 rounded-3xl shadow-xl shadow-slate-200/80 p-6 sm:p-12">
            
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
                Direct Booking
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
                Request Water Tanker Delivery
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-2">
                Submit your water request below. Our dispatch team coordinates the nearest active bowser right away.
              </p>
            </div>

            {submittedInquiry ? (
              <div className="text-center py-10 bg-emerald-50/80 border-2 border-emerald-500/40 rounded-3xl p-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white text-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">Request Successfully Received!</h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
                  Thank you, <span className="font-black text-slate-900">{submittedInquiry.customerName}</span>. Your request for <span className="font-black text-emerald-600">{submittedInquiry.volume}</span> ({submittedInquiry.serviceType}) at <span className="font-bold text-slate-900">{submittedInquiry.deliveryLocation}</span> has been logged.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={buildWhatsAppLink(
                      `Hello Mount Kenya Water Distributors, I submitted online order #${submittedInquiry.id}. Name: ${submittedInquiry.customerName}, Location: ${submittedInquiry.deliveryLocation}, Volume: ${submittedInquiry.volume}. Please confirm dispatch ETA.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 text-sm"
                  >
                    <span>💬</span>
                    <span>Confirm ETA on WhatsApp</span>
                  </a>

                  <button
                    onClick={() => setSubmittedInquiry(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-3.5 rounded-xl border border-slate-200 transition-all text-sm cursor-pointer"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      Full Name / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Kamau / Apex Construction"
                      value={form.customerName}
                      onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0712 345 678"
                      value={form.phoneNumber}
                      onChange={e => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Delivery Location */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      Delivery Location / Estate / Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ruiru Membley, Near Catholic Church"
                      value={form.deliveryLocation}
                      onChange={e => setForm(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {/* Service Type */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      Service Type *
                    </label>
                    <select
                      value={form.serviceType}
                      onChange={e => setForm(prev => ({ ...prev, serviceType: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    >
                      {services.map(s => (
                        <option key={s.id} value={s.title}>{s.title} ({s.capacities})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Volume Selector with Interactive Chips */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Tanker Capacity / Volume *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {[
                      { vol: "5,000L", label: "5,000 Liters" },
                      { vol: "10,000L", label: "10,000 Liters (Popular)" },
                      { vol: "15,000L", label: "15,000 Liters" },
                      { vol: "20,000L", label: "20,000 Liters" },
                      { vol: "30,000L+", label: "30,000L+ Bulk" },
                    ].map(item => (
                      <button
                        key={item.vol}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, volume: item.vol }))}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          form.volume === item.vol
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm font-black"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold"
                        }`}
                      >
                        <p className="text-xs">{item.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Urgency */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                      Urgency / Preferred Timing
                    </label>
                    <select
                      value={form.urgency}
                      onChange={e => setForm(prev => ({ ...prev, urgency: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    >
                      <option value="Emergency ASAP">🚨 Emergency ASAP (Immediate Dispatch)</option>
                      <option value="Today">Today (Within 2 - 4 hours)</option>
                      <option value="Tomorrow">Tomorrow Morning</option>
                      <option value="Scheduled Date">Scheduled Later / Regular Contract</option>
                    </select>
                  </div>

                  {/* WhatsApp Checkbox */}
                  <div className="flex flex-col justify-end">
                    <label className="inline-flex items-center gap-2.5 text-xs text-slate-600 font-bold cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        checked={sameAsPhone}
                        onChange={e => setSameAsPhone(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>My WhatsApp number is the same as my phone number</span>
                    </label>
                    {!sameAsPhone && (
                      <input
                        type="tel"
                        placeholder="WhatsApp Number (if different)"
                        value={form.whatsappNumber}
                        onChange={e => setForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        className="mt-2 w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400"
                      />
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specific hose length needed, underground tank vs rooftop tank, gate code, compound access instructions, etc."
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-600/25 text-base transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{submitting ? "Sending Request…" : "Submit Water Request"}</span>
                    <span>🚛</span>
                  </button>
                  <p className="text-center text-xs text-slate-500 mt-3 font-medium">
                    Need instant response? You can also call dispatch directly at <a href={`tel:${contacts.primaryPhone}`} className="text-emerald-700 font-extrabold underline">{contacts.primaryPhone}</a>.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion Section */}
      <section id="faqs" className="py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200">
              Clear Answers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Everything you need to know about water source purity, delivery turnaround, and tankers.
            </p>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full text-left p-5 flex items-center justify-between gap-4 font-extrabold text-sm sm:text-base text-slate-900 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className={`w-7 h-7 rounded-full bg-white flex items-center justify-center text-emerald-700 text-sm shadow-xs transition-transform duration-300 ${isOpen ? "rotate-180 bg-emerald-50" : ""}`}>
                      ▼
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Direct Contact & Details Section — Clean Light Theme */}
      <section id="contact" className="py-16 bg-slate-900 text-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Depot & Address */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl mb-4 text-emerald-400">
                📍
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Depot & Headquarters</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                {contacts.address}
              </p>
              <p className="text-emerald-400 text-xs font-bold">
                Operating: {general.operatingHours}
              </p>
            </div>

            {/* Direct Phone Lines */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl mb-4 text-cyan-400">
                📞
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Dispatch Hotlines</h3>
              <p className="text-slate-400 text-xs mb-3">Available 24 hours for emergency calls & bookings:</p>
              <div className="space-y-1.5 text-sm font-black text-white">
                <div>
                  <a href={`tel:${contacts.primaryPhone}`} className="hover:text-emerald-400 transition-colors">
                    Primary: {contacts.primaryPhone}
                  </a>
                </div>
                {contacts.secondaryPhone && (
                  <div>
                    <a href={`tel:${contacts.secondaryPhone}`} className="hover:text-emerald-400 transition-colors">
                      Secondary: {contacts.secondaryPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Digital & Compliance */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl mb-4 text-teal-400">
                📜
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Certifications & Quality</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-3">
                {general.licenseInfo}
              </p>
              <div className="text-xs text-slate-300">
                <span className="text-slate-400">Email: </span>
                <a href={`mailto:${contacts.email}`} className="text-emerald-400 font-bold hover:underline">
                  {contacts.email}
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {general.companyName}. All rights reserved.</p>
            <div className="flex items-center gap-6 font-semibold">
              <a href="#services" className="hover:text-white transition-colors">Services</a>
              <a href="#coverage" className="hover:text-white transition-colors">Coverage</a>
              <a href="#gallery" className="hover:text-white transition-colors">Fleet Gallery</a>
              <a href="#faqs" className="hover:text-white transition-colors">FAQs</a>
              {onOpenLogin && !user && (
                <button onClick={onOpenLogin} className="text-emerald-400 hover:underline font-bold cursor-pointer">
                  Staff Login
                </button>
              )}
            </div>
            <p>
              Designed by <span className="font-bold text-emerald-400">Cyber Vision Lab</span>
            </p>
          </div>
        </div>
      </section>

      {/* Floating Fast-Action Widget (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5">
        <a
          href={buildWhatsAppLink("Hello Mount Kenya Water, I need a bulk water tanker. Please assist.")}
          target="_blank"
          rel="noreferrer"
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-emerald-700/40 font-black text-xs sm:text-sm flex items-center gap-2 transition-all hover:scale-110"
          title="Chat on WhatsApp"
        >
          <span className="text-lg">💬</span>
          <span className="hidden sm:inline">Order on WhatsApp</span>
        </a>
      </div>

    </div>
  );
}
