import { useState, useEffect, useMemo } from "react";
import { websiteService } from "../services/website";
import "./PublicWebsite.css";

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
      <div className="public-site min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl border border-slate-200 max-w-sm">
          <div className="text-3xl mb-3 text-cyan-700">◌</div>
          <p className="text-cyan-800 font-bold tracking-wide uppercase text-xs">Mount Kenya Water Distributors</p>
          <p className="text-slate-500 text-sm mt-1">Loading company information…</p>
        </div>
      </div>
    );
  }

  const { general, contacts, services, locations } = content;
  const defaultSiteCopy = {
    tagline: "Bulk water delivery, arranged around your site.",
    description: "Mount Kenya Water Distributors supplies water by tanker for homes, businesses and construction sites across the Mount Kenya and Nairobi region. Contact dispatch to confirm availability, volume and delivery timing.",
    badgeText: "Water delivery · Mount Kenya & Nairobi"
  };
  const oldDefaultTagline = "Pure, Reliable Bulk Water Delivery Across Mount Kenya & Nairobi Region";
  const oldDefaultDescription = "Kenya's leading clean bulk water delivery service. Providing pristine, food-grade certified water for residential, commercial, industrial, and emergency requirements 24/7 with our modern tanker fleet.";
  const heroTagline = !general.tagline || general.tagline === oldDefaultTagline ? defaultSiteCopy.tagline : general.tagline;
  const heroDescription = !general.description || general.description === oldDefaultDescription ? defaultSiteCopy.description : general.description;
  const heroBadge = !general.badgeText || general.badgeText === "24/7 Fast Dispatch Available" ? defaultSiteCopy.badgeText : general.badgeText;
  const operatingHours = general.operatingHours === "24 Hours / 7 Days a Week" ? "Contact dispatch for availability" : general.operatingHours;
  const licenseInfo = general.licenseInfo === "Licensed by KEBS & Ministry of Water & Sanitation"
    ? "Ask dispatch for current source and quality documentation."
    : general.licenseInfo;
  const displayServices = services.map(service => service.title === "Emergency 24/7 Water Supply"
    ? { ...service, title: "Urgent Water Supply", description: "Contact dispatch for urgent requirements. Availability and timing depend on location and fleet schedule.", capacities: "Confirm timing with dispatch" }
    : service);
  const displayLocations = locations.map(location => ({
    ...location,
    turnaround: ["1 – 2 hours", "45 – 90 mins", "Scheduled & Express", "2 – 3 hours"].includes(location.turnaround)
      ? "Confirm with dispatch"
      : location.turnaround
  }));
  const legacyStockPhotoUrls = [
    "photo-1541888946425-d0fbb186c5f9",
    "photo-1581092160607-ee22621dd758",
    "photo-1500382017468-9049fed747ef",
    "photo-1542601906990-b4d3fb778b09",
    "photo-1574943320219-553eb213f72d",
    "photo-1519003722824-194d4455a60c"
  ];
  const photos = (content.photos || []).filter(photo => !legacyStockPhotoUrls.some(photoId => photo.url?.includes(photoId)));

  // Filtered photos
  const filteredPhotos = activeCategory === "All"
    ? photos
    : photos.filter(p => p.category?.toLowerCase() === activeCategory.toLowerCase());

  const categories = ["All", ...Array.from(new Set(photos.map(p => p.category).filter(Boolean)))];

  // Filtered locations
  const filteredLocations = displayLocations.filter(loc => {
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
      : calcPurpose === "emergency" ? "Urgent Water Supply"
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
      serviceType: displayServices[0]?.title || "Clean Bulk Drinking Water",
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
      q: "Can I order water for drinking?",
      a: "Tell dispatch how the water will be used when you request a delivery. Ask the team about the source and any current quality documentation before confirming a drinking-water order."
    },
    {
      q: "How soon can a tanker arrive?",
      a: "Timing depends on your location, the required volume and vehicle availability. Call or message dispatch with your location for a current estimate."
    },
    {
      q: "Can you fill a rooftop or underground tank?",
      a: "Include the tank position, access details and approximate hose distance in your request. Dispatch can confirm which equipment is available for the site."
    },
    {
      q: "What tanker sizes can I request?",
      a: "The booking form lists common volume options. Availability varies by route, so dispatch will confirm the vehicle and number of trips for your order."
    },
    {
      q: "How do I confirm price and payment?",
      a: "Share your delivery location and volume with dispatch to receive a quote and payment instructions before confirming the order."
    },
    {
      q: "Can I arrange recurring deliveries?",
      a: "Yes, you can ask dispatch about a regular schedule. The team will confirm route availability and agree the details with you."
    }
  ];

  return (
    <div className="public-site min-h-screen bg-[#f7f8f6] text-slate-800 font-sans selection:bg-cyan-700 selection:text-white relative">
      
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
      <div className="public-utility bg-slate-950 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-cyan-300 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
              Water delivery · Mount Kenya & Nairobi
            </span>
            <span className="hidden md:inline text-slate-400">|</span>
            <span className="hidden md:inline text-slate-400">Bulk supply for homes, businesses and construction sites</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <a href={`tel:${contacts.primaryPhone}`} className="hover:text-emerald-400 transition-colors flex items-center gap-1">
              <span>Dispatch:</span>
              <span className="font-bold text-white">{contacts.primaryPhone}</span>
            </a>
            <span className="text-slate-600">|</span>
              <span className="text-slate-300">{operatingHours}</span>
          </div>
        </div>
      </div>

      {/* Modern Clean Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="public-mark w-10 h-10 rounded-lg bg-cyan-900 flex items-center justify-center text-white text-lg font-semibold">
              MK
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-[0.15em] text-cyan-800 uppercase">Mount Kenya</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Water</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight">
                {general.companyName.replace("Mount Kenya ", "")}
              </h1>
            </div>
          </a>

          {/* Nav Links Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#calculator" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
              <span>Volume guide</span>
            </a>
            <a href="#services" className="hover:text-emerald-600 transition-colors">Services</a>
            <a href="#coverage" className="hover:text-emerald-600 transition-colors">Coverage</a>
            <a href="#gallery" className="hover:text-emerald-600 transition-colors">Gallery</a>
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
              <span>Call Dispatch</span>
            </a>

            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="public-button inline-flex items-center gap-1.5 text-xs font-bold text-white bg-cyan-900 hover:bg-cyan-800 px-4 py-2.5 rounded-lg transition-colors"
            >
              <span>WhatsApp dispatch</span>
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

      <section className="public-hero border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-12 lg:gap-20 items-center">
            <div className="max-w-3xl">
              <p className="public-eyebrow mb-5"><span className="public-eyebrow-mark" /> {heroBadge}</p>
              <h2 className="text-4xl sm:text-6xl lg:text-7xl font-semibold text-slate-950 tracking-[-0.055em] leading-[1.02] mb-6">
                {heroTagline}
              </h2>
              <p className="text-base sm:text-lg text-slate-600 leading-8 mb-8 max-w-2xl">
                {heroDescription}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="#order-section" className="public-primary-link">Request a delivery <span aria-hidden="true">↗</span></a>
                <a href={`tel:${contacts.primaryPhone}`} className="public-secondary-link">Call {contacts.primaryPhone}</a>
              </div>
            </div>
            <aside className="public-dispatch-card" aria-label="Dispatch contact details">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">Talk to dispatch</p>
              <p className="mt-5 text-2xl sm:text-3xl font-semibold leading-tight text-white">Tell us where and how much.</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">We’ll confirm availability, tanker size and delivery timing for your location.</p>
              <div className="mt-8 border-t border-white/15 pt-5 flex flex-col gap-3">
                <a className="public-dispatch-phone" href={`tel:${contacts.primaryPhone}`}>{contacts.primaryPhone} <span>↗</span></a>
                <a className="text-sm font-medium text-cyan-200 hover:text-white" href={buildWhatsAppLink("Hello, I need a bulk water delivery. Please confirm availability and timing.")} target="_blank" rel="noreferrer">Message us on WhatsApp →</a>
              </div>
              <p className="mt-7 text-[11px] text-slate-400">{operatingHours}</p>
            </aside>
          </div>
          <div className="public-route-note mt-14 pt-5 border-t border-slate-200 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Delivery areas</span><span className="public-route-line" /> Nairobi · Kiambu · Thika · Murang’a · Nyeri
          </div>
        </div>
      </section>

      {/* NEW INTERACTIVE FEATURE: Water Need & Tanker Estimator */}
      <section id="calculator" className="py-20 bg-white relative border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200/70">
              Plan a delivery
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              Choose a delivery volume
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              Choose a volume to carry it into the request form. Dispatch will confirm the right vehicle for your site.
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
                      Request details
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Volume selected:</p>
                      <h4 className="text-xl font-black text-slate-900 mt-0.5">
                        {calcVolume} water delivery
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Delivery timing</p>
                        <p className="text-xs font-extrabold text-slate-800 mt-0.5">Confirm with dispatch</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Site access</p>
                        <p className="text-xs font-extrabold text-slate-800 mt-0.5">Share details when booking</p>
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200/70 p-3.5 rounded-2xl text-xs text-emerald-800 space-y-1">
                      <p className="font-black flex items-center gap-1.5">Need a quote?</p>
                      <p className="text-emerald-700 leading-relaxed">Share your location and intended use with dispatch to confirm availability and any site requirements.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={handleApplyCalculator}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Continue to request</span>
                    <span>→</span>
                  </button>

                  <a
                    href={buildWhatsAppLink(`Hello Mount Kenya Water Distributors, based on your online estimator I would like to order a ${calcVolume} tanker for ${calcPurpose}. Please confirm availability and cost.`)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Ask dispatch on WhatsApp</span>
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
            {displayServices.map((svc, index) => (
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
                  <div className="public-service-index w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-sm font-semibold mb-5">
                    {String(index + 1).padStart(2, "0")}
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
              Contact dispatch with your town or site address to confirm route availability and delivery timing.
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
                      {loc.turnaround}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Key Delivery Zones:</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                    {loc.subzones}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">
                      Availability by route
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
              How ordering works
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
              From request to delivery
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-2">
              A few details help the team plan the right vehicle and route.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Share your location",
                desc: "Give dispatch the town, estate and a nearby landmark.",
                icon: "01"
              },
              {
                step: "02",
                title: "Choose a volume",
                desc: "Estimate the amount you need and describe how the water will be used.",
                icon: "02"
              },
              {
                step: "03",
                title: "Confirm the details",
                desc: "Dispatch confirms availability, price and timing before you book.",
                icon: "03"
              },
              {
                step: "04",
                title: "Prepare the site",
                desc: "Let the team know about access, hose distance and where the tank is located.",
                icon: "04"
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
                Field photos
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">
                Fleet & delivery work
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Photos from deliveries and day-to-day operations.
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
          {filteredPhotos.length > 0 ? (
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
          ) : (
            <div className="public-gallery-empty">
              <span className="public-gallery-rule" />
              <p className="font-semibold text-slate-800">Delivery photos will appear here.</p>
              <p className="mt-1 text-sm text-slate-500">For current availability, contact the dispatch team.</p>
            </div>
          )}
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
                Send your details and the dispatch team will follow up to confirm availability, price and timing.
              </p>
            </div>

            {submittedInquiry ? (
              <div className="text-center py-10 bg-emerald-50/80 border-2 border-emerald-500/40 rounded-3xl p-8">
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white text-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                  ✓
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-2">Request received</h3>
                <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
                  Thank you, <span className="font-semibold text-slate-900">{submittedInquiry.customerName}</span>. We’ve recorded your request for <span className="font-semibold text-cyan-800">{submittedInquiry.volume}</span> ({submittedInquiry.serviceType}) at <span className="font-medium text-slate-900">{submittedInquiry.deliveryLocation}</span>. Contact dispatch to confirm the order and delivery timing.
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
                    <span>Follow up on WhatsApp</span>
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
                    {displayServices.map(s => (
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
                      <option value="Emergency ASAP">Emergency request (call to confirm availability)</option>
                      <option value="Today">Today (timing to be confirmed)</option>
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
                    <span>{submitting ? "Sending request…" : "Send delivery request"}</span>
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
              A few details about requesting a delivery.
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
                Operating: {operatingHours}
              </p>
            </div>

            {/* Direct Phone Lines */}
            <div className="bg-slate-850/80 border border-slate-800 rounded-3xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-2xl mb-4 text-cyan-400">
                📞
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Dispatch Hotlines</h3>
              <p className="text-slate-400 text-xs mb-3">Call to check dispatch availability and arrange a booking.</p>
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
              <h3 className="font-extrabold text-base text-white mb-1">Company information</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-3">
                {licenseInfo}
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
          </div>
        </div>
      </section>

      {/* Floating Fast-Action Widget (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2.5">
        <a
          href={buildWhatsAppLink("Hello Mount Kenya Water, I need a bulk water tanker. Please assist.")}
          target="_blank"
          rel="noreferrer"
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-lg shadow-md font-bold text-xs sm:text-sm flex items-center gap-2 transition-all"
          title="Chat on WhatsApp"
        >
          <span>WhatsApp dispatch</span>
        </a>
      </div>

    </div>
  );
}
