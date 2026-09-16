import { useState, useEffect } from "react";
import { websiteService } from "../services/website";

export default function PublicWebsite({ onOpenLogin, user, onReturnToDashboard }) {
  const [content, setContent] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

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
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-bounce mb-3">💧</div>
          <p className="text-emerald-400 font-bold tracking-wider uppercase text-sm">Mount Kenya Water Distributors</p>
          <p className="text-slate-400 text-xs mt-1">Loading official portal…</p>
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

  const handleSelectService = (serviceTitle) => {
    setForm(prev => ({ ...prev, serviceType: serviceTitle }));
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
    const rawNumber = contacts.whatsappNumber.replace(/[^0-9]/g, "");
    const cleanNumber = rawNumber.startsWith("0") ? "254" + rawNumber.substring(1) : rawNumber;
    const text = encodeURIComponent(customText || `Hello ${general.companyName}, I would like to order a water tanker.`);
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Floating Staff Banner if logged in */}
      {user && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white text-xs font-bold py-2.5 px-4 shadow-lg flex items-center justify-between border-b border-emerald-500/30">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-ping" />
            <span>Staff Portal Mode • Logged in as <span className="underline">{user.email}</span></span>
          </div>
          <button
            onClick={onReturnToDashboard}
            className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-lg shadow font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📊</span>
            <span>Return to Dashboard</span>
          </button>
        </div>
      )}

      {/* Modern Top Header / Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-900/30 ring-1 ring-white/20 group-hover:scale-105 transition-transform">
              🚛
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold tracking-[0.2em] text-emerald-400 uppercase">Mount Kenya</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Water</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight tracking-tight">
                {general.companyName.replace("Mount Kenya ", "")}
              </h1>
            </div>
          </a>

          {/* Nav Links Desktop */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-300">
            <a href="#services" className="hover:text-emerald-400 transition-colors">Services</a>
            <a href="#coverage" className="hover:text-emerald-400 transition-colors">Coverage Areas</a>
            <a href="#gallery" className="hover:text-emerald-400 transition-colors">Gallery</a>
            <a href="#order-section" className="hover:text-emerald-400 transition-colors">Request Tanker</a>
            <a href="#contact" className="hover:text-emerald-400 transition-colors">Contact</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={`tel:${contacts.primaryPhone}`}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 rounded-xl border border-slate-700/60 transition-all"
            >
              <span>📞</span>
              <span>{contacts.primaryPhone}</span>
            </a>

            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl shadow-md shadow-emerald-900/30 transition-all hover:scale-105"
            >
              <span className="text-base">💬</span>
              <span className="hidden xs:inline">WhatsApp Order</span>
            </a>

            {onOpenLogin && !user && (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-2 rounded-xl border border-slate-700/80 transition-all ml-1 cursor-pointer"
                title="Staff Portal Login"
              >
                <span>🔐</span>
                <span className="hidden sm:inline">Staff Portal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[450px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold mb-6 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{general.badgeText || "24/7 Fast Dispatch Available"}</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] mb-6">
              {general.tagline}
            </h2>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed mb-8 max-w-2xl mx-auto">
              {general.description}
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-14">
              <a
                href="#order-section"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-7 py-3.5 rounded-2xl shadow-xl shadow-emerald-500/20 text-base transition-all hover:scale-105"
              >
                <span>💧</span>
                <span>Request Tanker Now</span>
              </a>

              <a
                href={buildWhatsAppLink("Hello, I need immediate bulk water delivery. Please advise available bowsers.")}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 text-white font-bold px-6 py-3.5 rounded-2xl border border-slate-700 text-base transition-all hover:border-emerald-500/50"
              >
                <span className="text-emerald-400">💬</span>
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href={`tel:${contacts.primaryPhone}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-800/40 hover:bg-slate-800 text-slate-300 font-semibold px-5 py-3.5 rounded-2xl border border-slate-700/50 text-sm transition-all"
              >
                <span>📞</span>
                <span>Call Hotline</span>
              </a>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
              <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4">
                <div className="text-2xl mb-1.5">⚡</div>
                <h3 className="font-bold text-sm text-white">Rapid Dispatch</h3>
                <p className="text-xs text-slate-400 mt-0.5">Under 90 mins in core coverage zones</p>
              </div>
              <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4">
                <div className="text-2xl mb-1.5">🛡️</div>
                <h3 className="font-bold text-sm text-white">Food-Grade Tanks</h3>
                <p className="text-xs text-slate-400 mt-0.5">100% sanitized food-grade stainless steel</p>
              </div>
              <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4">
                <div className="text-2xl mb-1.5">🚛</div>
                <h3 className="font-bold text-sm text-white">Flexible Capacities</h3>
                <p className="text-xs text-slate-400 mt-0.5">5,000L to 30,000L+ bowsers</p>
              </div>
              <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4">
                <div className="text-2xl mb-1.5">🕒</div>
                <h3 className="font-bold text-sm text-white">24/7 Availability</h3>
                <p className="text-xs text-slate-400 mt-0.5">{general.operatingHours}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Counter Stats Bar */}
        {general.stats && general.stats.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 mt-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700/70 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
              {general.stats.map((stat, idx) => (
                <div key={idx} className="text-center py-2 border-slate-700/40 not-last:border-r">
                  <p className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300">
                    {stat.value}
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-slate-950/70 border-t border-b border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Bulk Supply Solutions
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
              Specialized Water Delivery Services
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              From residential estates to heavy infrastructure and commercial facilities, we deliver quality water on demand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <div
                key={svc.id}
                className={`relative rounded-3xl p-7 transition-all flex flex-col justify-between ${
                  svc.popular
                    ? "bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900 border-2 border-emerald-500/50 shadow-xl shadow-emerald-950/30"
                    : "bg-slate-900/80 border border-slate-800 hover:border-slate-700"
                }`}
              >
                {svc.popular && (
                  <span className="absolute -top-3.5 right-6 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                    ★ Most Requested
                  </span>
                )}

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl mb-5">
                    {svc.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{svc.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {svc.description}
                  </p>
                </div>

                <div>
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-500 font-medium">Capacities:</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {svc.capacities}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSelectService(svc.title)}
                    className="w-full bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-200 font-bold text-xs py-3 rounded-xl transition-all border border-slate-700 hover:border-emerald-500 flex items-center justify-center gap-2 cursor-pointer"
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

      {/* Coverage Areas Section */}
      <section id="coverage" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              Fleet Range & Turnaround
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
              Locations & Delivery Coverage
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Our tankers are strategically stationed along primary corridors for rapid, guaranteed turnaround.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all relative overflow-hidden group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">📍</span>
                    <h3 className="font-extrabold text-lg text-white group-hover:text-emerald-400 transition-colors">
                      {loc.name}
                    </h3>
                  </div>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                    ⏱️ {loc.turnaround}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Key Delivery Zones:</p>
                <p className="text-sm text-slate-300 leading-relaxed mb-5">
                  {loc.subzones}
                </p>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    Bowser On Standby
                  </span>
                  <button
                    onClick={() => {
                      setForm(prev => ({ ...prev, deliveryLocation: loc.name }));
                      document.getElementById("order-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="text-slate-400 hover:text-white underline cursor-pointer font-bold"
                  >
                    Select Zone
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Gallery Section */}
      <section id="gallery" className="py-20 bg-slate-950/80 border-t border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Visual Showcase
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
                Our Fleet & Operations Gallery
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Take a look at our clean stainless steel tankers, pumping gear, and source management.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeCategory === cat
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
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
                className="group relative h-64 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 cursor-pointer shadow-lg hover:shadow-2xl transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.caption}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                <div className="absolute top-4 left-4">
                  <span className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                    {photo.category || "General"}
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-sm font-bold text-white leading-snug line-clamp-2">
                    {photo.caption}
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>🔍</span> Click to expand
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
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-800 text-white font-black flex items-center justify-center border border-slate-700 cursor-pointer"
            >
              ✕
            </button>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption}
              className="w-full max-h-[70vh] object-cover"
            />
            <div className="p-6 bg-slate-900 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                  {lightboxPhoto.category}
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {lightboxPhoto.caption}
                </h4>
              </div>
              <a
                href={buildWhatsAppLink(`Hello, I saw your photo regarding "${lightboxPhoto.caption}" and would like to order water.`)}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                Inquire via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Online Order / Inquiry Section */}
      <section id="order-section" className="py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-12 backdrop-blur-xl">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Direct Booking
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
                Request Water Tanker Delivery
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mt-2">
                Submit your water request below. Our dispatch team coordinates the nearest active bowser right away.
              </p>
            </div>

            {submittedInquiry ? (
              <div className="text-center py-10 bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-3xl flex items-center justify-center mx-auto mb-4">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-white mb-2">Request Received!</h3>
                <p className="text-slate-300 text-sm max-w-md mx-auto mb-6">
                  Thank you, <span className="font-bold text-white">{submittedInquiry.customerName}</span>. Your request for <span className="font-bold text-emerald-400">{submittedInquiry.volume}</span> ({submittedInquiry.serviceType}) has been logged. Our dispatch supervisor is reviewing available units now.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={buildWhatsAppLink(
                      `Hello Mount Kenya Water Distributors, I submitted order #${submittedInquiry.id}. Name: ${submittedInquiry.customerName}, Location: ${submittedInquiry.deliveryLocation}, Volume: ${submittedInquiry.volume}. Please confirm dispatch ETA.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm"
                  >
                    <span>💬</span>
                    <span>Confirm ETA on WhatsApp</span>
                  </a>

                  <button
                    onClick={() => setSubmittedInquiry(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-3 rounded-xl border border-slate-700 transition-all text-sm cursor-pointer"
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
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Full Name / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Kamau / Apex Construction"
                      value={form.customerName}
                      onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0712 345 678"
                      value={form.phoneNumber}
                      onChange={e => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Delivery Location */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Delivery Location / Estate / Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ruiru Membley, Near Catholic Church"
                      value={form.deliveryLocation}
                      onChange={e => setForm(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Service Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Service Type *
                    </label>
                    <select
                      value={form.serviceType}
                      onChange={e => setForm(prev => ({ ...prev, serviceType: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      {services.map(s => (
                        <option key={s.id} value={s.title}>{s.title} ({s.capacities})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Volume Required */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Volume / Tanker Capacity *
                    </label>
                    <select
                      value={form.volume}
                      onChange={e => setForm(prev => ({ ...prev, volume: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="5,000L">5,000 Liters (Small Bowsers / Domestic)</option>
                      <option value="10,000L">10,000 Liters (Medium Bowser - Popular)</option>
                      <option value="15,000L">15,000 Liters (Commercial / Pools)</option>
                      <option value="20,000L">20,000 Liters (Large Bowser / Sites)</option>
                      <option value="30,000L+">30,000+ Liters (Multi-Trip / Industrial)</option>
                    </select>
                  </div>

                  {/* Urgency */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Urgency / Preferred Timing
                    </label>
                    <select
                      value={form.urgency}
                      onChange={e => setForm(prev => ({ ...prev, urgency: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Emergency ASAP">🚨 Emergency ASAP (Immediate Dispatch)</option>
                      <option value="Today">Today (Within 2 - 4 hours)</option>
                      <option value="Tomorrow">Tomorrow Morning</option>
                      <option value="Scheduled Date">Scheduled Later / Regular Contract</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Specific hose length required, underground vs rooftop tank, gate access instructions, etc."
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 text-base transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{submitting ? "Sending Request…" : "Submit Water Request"}</span>
                    <span>🚛</span>
                  </button>
                  <p className="text-center text-xs text-slate-400 mt-3">
                    Need instant response? You can also call us directly at <a href={`tel:${contacts.primaryPhone}`} className="text-emerald-400 font-bold underline">{contacts.primaryPhone}</a>.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Direct Contact & Details Section */}
      <section id="contact" className="py-16 bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Depot & Address */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl mb-4">
                📍
              </div>
              <h3 className="font-bold text-base text-white mb-1">Depot & Headquarters</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-4">
                {contacts.address}
              </p>
              <p className="text-emerald-400 text-xs font-semibold">
                Operating: {general.operatingHours}
              </p>
            </div>

            {/* Direct Phone Lines */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl mb-4">
                📞
              </div>
              <h3 className="font-bold text-base text-white mb-1">Dispatch Hotlines</h3>
              <p className="text-slate-400 text-xs mb-3">Available 24 hours for emergency calls & bookings:</p>
              <div className="space-y-1.5 text-sm font-bold text-white">
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
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl mb-4">
                📜
              </div>
              <h3 className="font-bold text-base text-white mb-1">Certifications & Quality</h3>
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
          <div className="mt-16 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} {general.companyName}. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#services" className="hover:text-slate-300">Services</a>
              <a href="#coverage" className="hover:text-slate-300">Coverage</a>
              <a href="#gallery" className="hover:text-slate-300">Gallery</a>
              {onOpenLogin && !user && (
                <button onClick={onOpenLogin} className="text-emerald-400 hover:underline font-bold cursor-pointer">
                  Staff Login
                </button>
              )}
            </div>
            <p>
              Designed by <span className="font-semibold text-emerald-500">Cyber Vision Lab</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
