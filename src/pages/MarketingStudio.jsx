import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { useAuth } from "../contexts/AuthContext";
import { bossesService } from "../services/bosses";
import { websiteService } from "../services/website";
import {
  downloadElementAsImage,
  downloadBusinessCardPDF,
  downloadPosterPDF,
} from "../utils/marketingExporter";
import { Badge } from "../components/ui";

// Available Themes for Business Cards & Posters
const THEMES = [
  {
    id: "geo-cyan",
    name: "Cyan & Slate (Reference Match)",
    badgeColor: "blue",
    cardBg: "bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 text-white border-sky-500/40",
    cardAccent: "text-cyan-400",
    cardPill: "bg-sky-800/80 text-sky-200 border border-sky-600/40",
    qrDark: "#0284c7",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-sky-600 text-white",
    quoteBg: "bg-[#2d1b33] text-white", // deep plum like reference
    accentColor: "text-sky-600",
    accentBorder: "border-sky-500",
    buttonBg: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  {
    id: "emerald",
    name: "Emerald Signature & White",
    badgeColor: "green",
    cardBg: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white border-emerald-500/40",
    cardAccent: "text-amber-400",
    cardPill: "bg-emerald-800/80 text-emerald-200 border border-emerald-600/40",
    qrDark: "#064e3b",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-emerald-600 text-white",
    quoteBg: "bg-slate-900 text-white",
    accentColor: "text-emerald-600",
    accentBorder: "border-emerald-500",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    id: "royal-blue",
    name: "Royal Water Blue & White",
    badgeColor: "blue",
    cardBg: "bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900 text-white border-blue-500/40",
    cardAccent: "text-blue-300",
    cardPill: "bg-blue-800/80 text-blue-200 border border-blue-600/40",
    qrDark: "#1e40af",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-blue-700 text-white",
    quoteBg: "bg-slate-900 text-white",
    accentColor: "text-blue-600",
    accentBorder: "border-blue-500",
    buttonBg: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  {
    id: "obsidian-dark",
    name: "Midnight Obsidian (Dark Luxe)",
    badgeColor: "slate",
    cardBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-white border-slate-700",
    cardAccent: "text-emerald-400",
    cardPill: "bg-slate-800 text-slate-300 border border-slate-700",
    qrDark: "#0f172a",
    posterBg: "bg-slate-950 text-white",
    bannerBg: "bg-slate-900 text-white border-t border-slate-800",
    quoteBg: "bg-slate-900/90 text-white border border-slate-700",
    accentColor: "text-emerald-400",
    accentBorder: "border-emerald-400",
    buttonBg: "bg-slate-800 hover:bg-slate-700 text-white",
  },
];

// Poster Paper Formats
const POSTER_SIZES = [
  {
    id: "a5",
    label: "A5 Flyer",
    tag: "Recommended",
    dimensions: "148 × 210 mm",
    printRatio: "aspect-[1/1.414]",
    idealFor: "Standard handouts, mailbox drops, and direct client flyering",
  },
  {
    id: "a6",
    label: "A6 Postcard",
    tag: "Pocket Flyer",
    dimensions: "105 × 148 mm",
    printRatio: "aspect-[1/1.414]",
    idealFor: "Compact pocket flyer, invoice inclusion, or counter distribution",
  },
  {
    id: "a2",
    label: "A2 Wall Poster",
    tag: "Large Display",
    dimensions: "420 × 594 mm",
    printRatio: "aspect-[1/1.414]",
    idealFor: "High-visibility depot noticeboards, site entrance gates & billboards",
  },
  {
    id: "a4",
    label: "A4 Sheet",
    tag: "Standard Document",
    dimensions: "210 × 297 mm",
    printRatio: "aspect-[1/1.414]",
    idealFor: "Standard office printer paper & wall bulletin noticeboards",
  },
];

// Poster Layout Templates
const POSTER_LAYOUTS = [
  {
    id: "geo-split",
    name: "Geo-Split (Sample Match)",
    description: "Crisp white panel + angled photo container + vibrant banner + quote badge",
  },
  {
    id: "photo-hero",
    name: "Photo Hero + Bottom Gradient",
    description: "Full photo backdrop with bottom-to-top gradient transparency for 100% text legibility",
  },
  {
    id: "clean-corporate",
    name: "Clean White Corporate",
    description: "Sleek high-contrast white layout with dual brand badges and top photographic banner",
  },
];

// Curated Background Photo Presets
const PHOTO_PRESETS = [
  {
    id: "tanker-highway",
    name: "Heavy Bowser Tanker",
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80",
    tag: "Fleet Truck",
  },
  {
    id: "mountain-spring",
    name: "Mount Kenya Springs",
    url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    tag: "Pure Source",
  },
  {
    id: "stainless-tanker",
    name: "Food-Grade Stainless Bowsers",
    url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    tag: "Sanitary",
  },
  {
    id: "site-delivery",
    name: "Site Water Supply & Construction",
    url: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f9?auto=format&fit=crop&w=1200&q=80",
    tag: "On-Site",
  },
];

const DEFAULT_CONFIG = {
  // Brand & Company
  companyName: "Mount Kenya Water Distributors",
  tagline: "Pure, Reliable Bulk Water Delivery",
  accreditation: "Licensed Clean Bulk Water Transporter",

  // Business Cardholder Profile
  personName: "Caleb Bollus",
  personTitle: "Managing Director / Fleet Dispatch",

  // Contacts
  primaryPhone: "+254 746 346 888",
  secondaryPhone: "+254 712 345 678",
  whatsappNumber: "+254 746 346 888",
  email: "info@mountkenyawater.co.ke",
  address: "Thika Road / Ruiru Bypass Depot, Nairobi & Mount Kenya",

  // Website & QR Code
  websiteUrl: "https://mountkenyawater.co.ke",
  qrCallout: "Scan with Camera to Visit Website & Order",
  themeId: "geo-cyan",

  // Poster Specific Settings
  posterSize: "a5", // "a5" | "a6" | "a2" | "a4"
  posterLayout: "geo-split", // "geo-split" | "photo-hero" | "clean-corporate"
  posterBgPhoto: PHOTO_PRESETS[0].url,
  gradientIntensity: "high", // "high" | "balanced" | "subtle"

  // Poster Copy & Headline
  posterHeadlineLabel: "4 REASONS",
  posterHeadlineMain: "Why you need bulk pure water delivery",
  posterSubheadline:
    "Reliable, food-grade water supply for residential estates, hotels, swimming pools, and construction sites.",

  // 4 Key Value Pillars (Reference Style)
  reasons: [
    {
      icon: "💧",
      title: "100% Pure Certified Water",
      desc: "KEBS certified potable water, thoroughly filtered and laboratory tested for human consumption.",
    },
    {
      icon: "⚡",
      title: "Express Site Dispatch",
      desc: "Fast on-site arrival within 60 to 90 minutes across Nairobi, Ruiru, Kiambu & Thika corridor.",
    },
    {
      icon: "🚚",
      title: "5,000L to 30,000L Fleet",
      desc: "Flexible tanker capacities to handle residential tanks, commercial towers, or pool filling.",
    },
    {
      icon: "🛡️",
      title: "Food-Grade Stainless Tanks",
      desc: "Sanitary stainless steel bowsers dedicated exclusively to clean water—zero contamination.",
    },
  ],

  // Executive Quote Box (Top Right Polygon in Reference)
  quoteText:
    "Clean water delivered on time, every single time — guaranteed purity for your family, tenants, and construction projects.",
  quoteAuthor: "Caleb Bollus, Fleet Operations Director",

  // Bottom Banner Text
  bottomBannerMission:
    "We believe that with our reliable tanker supply, your household and commercial enterprise will never run dry.",
  bottomBannerCta: "Call dispatch now for instant tanker availability, pricing, and guaranteed delivery schedule!",
  coverageAreas: "Nairobi · Kiambu · Ruiru · Thika · Kenol · Murang'a · Nyeri · Nanyuki",

  // General Services for Card Back
  services: [
    { title: "Clean Bulk Drinking Water", desc: "For homes, estates, apartments & hotels", icon: "💧" },
    { title: "Construction & Site Supply", desc: "Compaction, concrete curing & dust control", icon: "🏗️" },
    { title: "Swimming Pool Filling", desc: "Fast multi-trip filling with clean water", icon: "🏊" },
    { title: "Urgent & Emergency Supply", desc: "Priority tanker dispatch 7 days a week", icon: "🚨" },
    { title: "Commercial & Industrial", desc: "Scheduled supply contracts for factories", icon: "🏭" },
    { title: "Tanker / Bowser Leasing", desc: "Daily, weekly or monthly rental rates", icon: "🚛" },
  ],
};

const STORAGE_KEY = "mk_marketing_studio_config_v2";

export default function MarketingStudioPage() {
  const { isPrivileged } = useAuth();

  // Active view tab: 'poster' (primary) or 'card'
  const [activeTab, setActiveTab] = useState("poster");

  // Card view side: 'front' or 'back'
  const [cardSide, setCardSide] = useState("front");

  // Customization Configuration
  const [config, setConfig] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch (e) {
        console.warn("Failed reading saved marketing config:", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  // Bosses from directory for 1-click select
  const [bosses, setBosses] = useState([]);
  const [selectedBossId, setSelectedBossId] = useState("");

  // Live QR Code data URL
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Exporting state
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");

  // DOM Refs for capture
  const frontCardRef = useRef(null);
  const backCardRef = useRef(null);
  const posterRef = useRef(null);
  const fileInputRef = useRef(null);

  // Active theme & size
  const currentTheme = THEMES.find((t) => t.id === config.themeId) || THEMES[0];
  const currentSize = POSTER_SIZES.find((s) => s.id === config.posterSize) || POSTER_SIZES[0];

  // Save config to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("Failed to persist marketing config:", e);
    }
  }, [config]);

  // Load bosses for quick-select
  useEffect(() => {
    bossesService.fetchAll().then((b) => {
      setBosses(b || []);
    });
  }, []);

  // Set default website URL to window.location.origin if running live
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.origin && !config.websiteUrl) {
      const origin = window.location.origin;
      if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        setConfig((prev) => ({ ...prev, websiteUrl: origin }));
      }
    }
  }, [config.websiteUrl]);

  // Generate QR Code dynamically
  const generateQrCode = useCallback(async (url, darkColor) => {
    if (!url) return;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 1,
        color: {
          dark: darkColor || "#0f172a",
          light: "#ffffff",
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
    }
  }, []);

  useEffect(() => {
    generateQrCode(config.websiteUrl, currentTheme.qrDark);
  }, [config.websiteUrl, currentTheme.qrDark, generateQrCode]);

  // Auto-fill from Boss profile
  const handleSelectBoss = (bossId) => {
    setSelectedBossId(bossId);
    if (!bossId) return;
    const b = bosses.find((boss) => boss.id === bossId);
    if (b) {
      setConfig((prev) => ({
        ...prev,
        personName: b.name || prev.personName,
        personTitle: b.title || "Director",
        primaryPhone: b.phone || prev.primaryPhone,
      }));
    }
  };

  // Auto-fill from Website CMS data
  const handleLoadFromCMS = async () => {
    try {
      const cms = await websiteService.fetchContent();
      if (cms) {
        setConfig((prev) => ({
          ...prev,
          companyName: cms.general?.companyName || prev.companyName,
          tagline: cms.general?.tagline || prev.tagline,
          primaryPhone: cms.contacts?.primaryPhone || prev.primaryPhone,
          secondaryPhone: cms.contacts?.secondaryPhone || prev.secondaryPhone,
          whatsappNumber: cms.contacts?.whatsappNumber ? `+${cms.contacts.whatsappNumber}` : prev.whatsappNumber,
          email: cms.contacts?.email || prev.email,
          address: cms.contacts?.address || prev.address,
        }));
        alert("Company contacts and tagline synchronized from Website CMS!");
      }
    } catch (e) {
      alert("Failed to load CMS data: " + e.message);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (window.confirm("Reset all customizations back to initial defaults?")) {
      setConfig(DEFAULT_CONFIG);
      setSelectedBossId("");
    }
  };

  // Generic Field updater
  const updateField = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Update specific reason in 4 pillars
  const updateReason = (index, field, value) => {
    setConfig((prev) => {
      const list = [...prev.reasons];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, reasons: list };
    });
  };

  // Handle Local Custom Image Upload
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        updateField("posterBgPhoto", event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Export Handlers ---
  const handleDownloadCardImage = async (side = "front") => {
    const target = side === "front" ? frontCardRef.current : backCardRef.current;
    if (!target) return;
    setExporting(true);
    setExportNotice(`Rendering High-Res PNG (${side.toUpperCase()} SIDE)...`);
    try {
      const name = `Mount_Kenya_Business_Card_${side}_${config.personName.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      await downloadElementAsImage(target, name, 3);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
      setExportNotice("");
    }
  };

  const handleDownloadCardPDF = async (mode = "single") => {
    if (!frontCardRef.current) return;
    setExporting(true);
    setExportNotice(mode === "sheet" ? "Generating A4 Printable Sheet (8 Cards)..." : "Generating Vector Business Card PDF...");
    try {
      const name = mode === "sheet" ? "Mount_Kenya_Business_Cards_A4_Sheet.pdf" : "Mount_Kenya_Business_Card.pdf";
      await downloadBusinessCardPDF({
        frontElement: frontCardRef.current,
        backElement: backCardRef.current,
        filename: name,
        mode,
      });
    } catch (err) {
      alert("PDF generation failed: " + err.message);
    } finally {
      setExporting(false);
      setExportNotice("");
    }
  };

  const handleDownloadPosterImage = async () => {
    if (!posterRef.current) return;
    setExporting(true);
    setExportNotice(`Rendering 300-DPI High-Res Marketing Poster (${config.posterSize.toUpperCase()})...`);
    try {
      const filename = `Mount_Kenya_Water_Poster_${config.posterSize.toUpperCase()}_300DPI.png`;
      await downloadElementAsImage(posterRef.current, filename, config.posterSize === "a2" ? 2 : 3);
    } catch (err) {
      alert("Poster export failed: " + err.message);
    } finally {
      setExporting(false);
      setExportNotice("");
    }
  };

  const handleDownloadPosterPDF = async () => {
    if (!posterRef.current) return;
    setExporting(true);
    setExportNotice(`Compiling Print-Ready ${config.posterSize.toUpperCase()} Vector PDF...`);
    try {
      const filename = `Mount_Kenya_Water_Poster_${config.posterSize.toUpperCase()}.pdf`;
      await downloadPosterPDF({
        posterElement: posterRef.current,
        filename,
        paperSize: config.posterSize,
      });
    } catch (err) {
      alert("Poster PDF export failed: " + err.message);
    } finally {
      setExporting(false);
      setExportNotice("");
    }
  };

  // Gradient transparency styles based on intensity
  const getGradientOverlayClass = () => {
    switch (config.gradientIntensity) {
      case "subtle":
        return "bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent";
      case "balanced":
        return "bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent";
      case "high":
      default:
        return "bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Marketing & Flyer Studio
            </h1>
            <Badge color="green">Print Ready</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Design professional A5/A6/A2 flyers & business cards with customizable photos, bottom-to-top gradients, and live scannable website QR codes.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("poster")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "poster"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🖼️</span>
            <span>Posters & Flyers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("card")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "card"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📇</span>
            <span>Business Cards</span>
          </button>
        </div>
      </div>

      {/* Exporting Loading Overlay Banner */}
      {exporting && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-spin">⏳</span>
            <div>
              <p className="font-bold text-sm">{exportNotice || "Generating high-resolution document..."}</p>
              <p className="text-xs text-emerald-700">Please wait while the graphic engine compiles crystal-clear print assets.</p>
            </div>
          </div>
          <Badge color="green">Processing</Badge>
        </div>
      )}

      {/* Main 2-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            LEFT COLUMN: INTERACTIVE VISUAL CANVAS PREVIEW (7 cols on lg)
           ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/5 p-4 sm:p-6 rounded-3xl border border-slate-200/80 flex flex-col items-center">
            {/* Canvas Header & Format Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {activeTab === "card"
                    ? "Business Card Preview (3.5\" × 2.0\")"
                    : `${currentSize.label} Preview (${currentSize.dimensions})`}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  300 DPI
                </span>
              </div>

              {/* Poster Paper Size Pill Selector (When in poster tab) */}
              {activeTab === "poster" && (
                <div className="inline-flex p-0.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                  {POSTER_SIZES.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => updateField("posterSize", sz.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        config.posterSize === sz.id
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {sz.id.toUpperCase()}
                      {sz.id === "a5" && <span className="ml-1 text-[9px] text-emerald-400 font-normal">★</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Front/Back Flip Toggle for Business Card */}
              {activeTab === "card" && (
                <div className="inline-flex p-0.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCardSide("front")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      cardSide === "front" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Front Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide("back")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      cardSide === "back" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Back Side
                  </button>
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------------
                TAB 1: POSTERS & FLYERS CANVAS (With Reference Geo-Split Layout)
               ------------------------------------------------------------------- */}
            {activeTab === "poster" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                {/* Visual Canvas Target Wrapper */}
                <div
                  ref={posterRef}
                  className="w-full max-w-[500px] bg-white text-slate-900 rounded-3xl shadow-2xl relative overflow-hidden select-none flex flex-col justify-between border border-slate-200"
                  style={{
                    minHeight: config.posterSize === "a6" ? "640px" : "720px",
                  }}
                >
                  {/* =========================================================
                      LAYOUT STYLE A: GEO-SPLIT (Exact Match to User Reference)
                     ========================================================= */}
                  {config.posterLayout === "geo-split" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-white">
                      {/* --- TOP SECTION: Split into Left Headline & Right Geometric Quote Badge --- */}
                      <div className="relative flex items-stretch">
                        {/* Top-Left: 4 REASONS & Main Headline Area */}
                        <div className="w-7/12 p-5 sm:p-6 z-10">
                          <div className="inline-block">
                            <span className="text-[11px] sm:text-xs font-black tracking-widest uppercase text-sky-600 block mb-0.5">
                              {config.posterHeadlineLabel}
                            </span>
                            <div className="w-8 h-0.5 bg-sky-600 mb-2 rounded-full" />
                          </div>

                          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                            {config.posterHeadlineMain}
                          </h2>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-1 leading-snug">
                            {config.posterSubheadline}
                          </p>
                        </div>

                        {/* Top-Right: Deep Plum/Slate Geometric Polygon Quote Box */}
                        <div
                          className="w-5/12 p-4 sm:p-5 relative text-white flex flex-col justify-center"
                          style={{
                            backgroundColor: currentTheme.id === "emerald" ? "#064e3b" : "#2d1b33",
                            clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 82%)",
                          }}
                        >
                          {/* Large quotation mark decorative element */}
                          <div className="text-3xl sm:text-4xl font-serif text-white/30 leading-none mb-1">
                            “
                          </div>
                          <p className="text-[9.5px] sm:text-[10.5px] font-bold text-white/95 leading-snug tracking-tight">
                            {config.quoteText}
                          </p>
                          <span className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider text-white/60 mt-1 block">
                            {config.quoteAuthor}
                          </span>
                        </div>
                      </div>

                      {/* --- MIDDLE SECTION: 4 Bullet Points (Left) & Angled Photo with Bottom-to-Top Gradient (Right) --- */}
                      <div className="relative flex items-stretch min-h-[300px]">
                        {/* Middle-Left: The 4 Feature Cards with Circular Icon Badges */}
                        <div className="w-6/12 p-4 sm:p-6 space-y-3 z-10 flex flex-col justify-center">
                          {config.reasons.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              {/* Circular Icon Badge */}
                              <div className="w-8 h-8 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center text-sm shrink-0 shadow-xs">
                                {item.icon || "💧"}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase leading-tight">
                                  {item.title}
                                </h4>
                                <p className="text-[9px] sm:text-[9.5px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Middle-Right: Angled Photographic Container with Bottom-to-Top Gradient */}
                        <div
                          className="w-6/12 relative overflow-hidden"
                          style={{
                            clipPath: "polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)",
                          }}
                        >
                          {/* Background Photo */}
                          <img
                            src={config.posterBgPhoto || PHOTO_PRESETS[0].url}
                            alt="Mount Kenya Water Truck"
                            crossOrigin="anonymous"
                            className="absolute inset-0 w-full h-full object-cover object-center"
                          />

                          {/* Smooth Bottom-to-Top Gradient Transparency for Text Clarity */}
                          <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />

                          {/* Subtle Brand Watermark inside the photo container */}
                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 text-[8px] font-bold text-white uppercase tracking-wider">
                            Mount Kenya Fleet
                          </div>

                          {/* Photo Lower Text Overlay (Super legible thanks to bottom-to-top gradient) */}
                          <div className="absolute bottom-3 left-4 right-3 z-10 text-white">
                            <span className="text-[8px] font-bold text-sky-300 uppercase tracking-wider block">
                              Guaranteed Fresh
                            </span>
                            <p className="text-[10px] font-black leading-tight text-white drop-shadow-xs">
                              Pure Potable Tanker Delivery
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* --- BOTTOM SECTION: Vibrant Angled Cyan / Emerald Banner & QR Code --- */}
                      <div
                        className={`relative p-5 sm:p-6 text-white overflow-hidden ${
                          currentTheme.id === "emerald"
                            ? "bg-emerald-600"
                            : currentTheme.id === "royal-blue"
                            ? "bg-blue-700"
                            : currentTheme.id === "obsidian-dark"
                            ? "bg-slate-900"
                            : "bg-sky-600"
                        }`}
                        style={{
                          clipPath: "polygon(0% 12%, 100% 0%, 100% 100%, 0% 100%)",
                          paddingTop: "2.2rem",
                        }}
                      >
                        {/* Company Tagline / Mission */}
                        <div className="mb-3 max-w-[340px]">
                          <p className="text-xs sm:text-sm font-black leading-tight text-white">
                            "{config.bottomBannerMission}"
                          </p>
                          <p className="text-[9.5px] text-white/80 font-medium mt-0.5">
                            {config.bottomBannerCta}
                          </p>
                        </div>

                        {/* Contacts & Live Scannable Website QR Code Row */}
                        <div className="flex items-end justify-between gap-3 pt-2 border-t border-white/20">
                          <div className="space-y-1 text-[10px] sm:text-[11px] font-medium leading-tight">
                            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-white">
                              <span>📞</span>
                              <span>{config.primaryPhone}</span>
                              {config.secondaryPhone && (
                                <span className="text-[10px] font-semibold text-white/80">/ {config.secondaryPhone}</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-white/95">
                              <span>💬</span>
                              <span>WhatsApp: <strong className="text-white">{config.whatsappNumber}</strong></span>
                            </div>

                            <div className="flex items-center gap-1.5 text-white/95">
                              <span>🌐</span>
                              <span className="font-bold underline tracking-wide">
                                {config.websiteUrl.replace(/^https?:\/\//, "")}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-white/80 text-[9px] pt-0.5">
                              <span>📍</span>
                              <span className="truncate max-w-[240px]">{config.address}</span>
                            </div>
                          </div>

                          {/* Giant Scannable QR Code */}
                          <div className="bg-white p-1.5 rounded-2xl shadow-xl flex flex-col items-center shrink-0 border border-white">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="Website QR Code"
                                className="w-16 h-16 sm:w-18 sm:h-18 object-contain"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                                QR Code
                              </div>
                            )}
                            <span className="text-[7.5px] font-black text-slate-900 tracking-tighter uppercase mt-0.5 text-center">
                              Scan to Order
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      LAYOUT STYLE B: FULL PHOTO HERO WITH BOTTOM-TO-TOP GRADIENT
                     ========================================================= */}
                  {config.posterLayout === "photo-hero" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden min-h-[680px]">
                      {/* Full-bleed Photo Background */}
                      <img
                        src={config.posterBgPhoto || PHOTO_PRESETS[0].url}
                        alt="Water Delivery"
                        crossOrigin="anonymous"
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />

                      {/* Continuous Bottom-to-Top Gradient Overlay for Text Clarity */}
                      <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />

                      {/* Top Header Pill */}
                      <div className="relative z-10 p-6 text-center border-b border-white/10 backdrop-blur-xs bg-black/20">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-sky-300 mb-2">
                          <span>🚛</span>
                          <span>{config.accreditation}</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                          {config.companyName}
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">
                          "{config.tagline}"
                        </p>
                      </div>

                      {/* Middle Catchy Hook & Features */}
                      <div className="relative z-10 px-6 my-auto text-center">
                        <span className="text-xs font-black uppercase tracking-widest text-sky-400 block mb-1">
                          {config.posterHeadlineLabel}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-tight">
                          {config.posterHeadlineMain}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-200 font-medium mt-2 max-w-sm mx-auto leading-snug">
                          {config.posterSubheadline}
                        </p>

                        {/* 4 Feature Badges */}
                        <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                          {config.reasons.map((r, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 backdrop-blur-md"
                            >
                              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                <span>{r.icon}</span>
                                <span className="truncate">{r.title}</span>
                              </div>
                              <p className="text-[9.5px] text-slate-300 mt-0.5 line-clamp-2">
                                {r.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Banner with QR Code */}
                      <div className="relative z-10 p-5 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-1 text-white text-xs">
                          <p className="font-black text-base sm:text-lg text-white">
                            📞 {config.primaryPhone}
                          </p>
                          <p className="text-[11px] text-sky-300 font-semibold">
                            💬 WhatsApp: {config.whatsappNumber}
                          </p>
                          <p className="text-[10px] text-slate-300">
                            🌐 {config.websiteUrl.replace(/^https?:\/\//, "")}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[220px]">
                            📍 {config.address}
                          </p>
                        </div>

                        <div className="bg-white p-1.5 rounded-2xl shadow-xl flex flex-col items-center shrink-0">
                          {qrDataUrl && (
                            <img
                              src={qrDataUrl}
                              alt="Website QR Code"
                              className="w-16 h-16 sm:w-18 sm:h-18 object-contain"
                            />
                          )}
                          <span className="text-[7.5px] font-black text-slate-900 uppercase mt-0.5">
                            Scan to Order
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      LAYOUT STYLE C: CLEAN WHITE CORPORATE
                     ========================================================= */}
                  {config.posterLayout === "clean-corporate" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-white text-slate-900 p-6">
                      {/* Top Corporate Header */}
                      <div className="border-b pb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-sky-600 uppercase tracking-widest">
                            {config.accreditation}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                            Bulk Water Fleet
                          </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-1">
                          {config.companyName}
                        </h2>
                        <p className="text-xs font-bold text-slate-500">
                          "{config.tagline}"
                        </p>
                      </div>

                      {/* Photo Section */}
                      <div className="relative h-44 rounded-2xl overflow-hidden my-3 border border-slate-200">
                        <img
                          src={config.posterBgPhoto || PHOTO_PRESETS[0].url}
                          alt="Fleet"
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />
                        <div className="absolute bottom-3 left-4 text-white">
                          <p className="text-sm font-black uppercase">
                            {config.posterHeadlineMain}
                          </p>
                          <p className="text-[10px] text-slate-200 max-w-xs">
                            {config.posterSubheadline}
                          </p>
                        </div>
                      </div>

                      {/* 4 Reasons List */}
                      <div className="grid grid-cols-2 gap-2.5 my-2">
                        {config.reasons.map((r, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-base">{r.icon}</span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1">{r.title}</h4>
                            <p className="text-[9.5px] text-slate-500 leading-snug mt-0.5">{r.desc}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Footer & QR */}
                      <div className="pt-3 border-t flex items-center justify-between gap-3">
                        <div className="space-y-1 text-xs text-slate-700">
                          <p className="font-black text-slate-900 text-sm">📞 {config.primaryPhone}</p>
                          <p className="text-emerald-700 font-bold">💬 WhatsApp: {config.whatsappNumber}</p>
                          <p className="text-[10px] text-slate-500">🌐 {config.websiteUrl}</p>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex flex-col items-center">
                          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-14 h-14" />}
                          <span className="text-[7.5px] font-bold text-slate-600 uppercase mt-0.5">Scan to Visit</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------------
                TAB 2: LIVE BUSINESS CARD CANVAS (Front & Back)
               ------------------------------------------------------------------- */}
            {activeTab === "card" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                <div className="w-full max-w-[540px] aspect-[1.75/1] relative select-none">
                  {/* FRONT SIDE */}
                  <div
                    ref={frontCardRef}
                    className={`w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                      currentTheme.cardBg
                    } ${cardSide === "front" ? "block" : "hidden"}`}
                    style={{ minHeight: "290px" }}
                  >
                    <div className="absolute -right-12 -bottom-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none blur-2xl" />
                    <div className="absolute right-8 top-0 bottom-0 w-32 bg-white/[0.02] transform -skew-x-12 pointer-events-none" />

                    <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner shrink-0">
                          🚛
                        </div>
                        <div>
                          <h3 className="font-black text-sm sm:text-base tracking-tight leading-tight uppercase">
                            {config.companyName}
                          </h3>
                          <p className="text-[10px] sm:text-[11px] opacity-80 font-medium tracking-wide">
                            {config.accreditation}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentTheme.cardPill}`}>
                        Bulk Water
                      </span>
                    </div>

                    <div className="relative z-10 my-2">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-1.5">
                        <span>{config.personName}</span>
                      </h2>
                      <p className={`text-xs font-bold tracking-wide uppercase mt-0.5 ${currentTheme.cardAccent}`}>
                        {config.personTitle}
                      </p>
                    </div>

                    <div className="flex items-end justify-between gap-3 relative z-10 pt-2 border-t border-white/10">
                      <div className="space-y-1 text-[10px] sm:text-[11px] font-medium leading-tight">
                        <div className="flex items-center gap-1.5 opacity-90">
                          <span>📞</span>
                          <span className="font-bold">{config.primaryPhone}</span>
                          {config.secondaryPhone && <span className="opacity-70">/ {config.secondaryPhone}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-90">
                          <span>💬</span>
                          <span>WhatsApp: <strong className="text-white">{config.whatsappNumber}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-90">
                          <span>✉️</span>
                          <span className="truncate max-w-[200px]">{config.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80 text-[9.5px]">
                          <span>📍</span>
                          <span className="truncate max-w-[230px]">{config.address}</span>
                        </div>
                      </div>

                      <div className="bg-white p-1.5 rounded-xl shadow-md flex flex-col items-center shrink-0 border border-white/80">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt="Website QR Code"
                            className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                            QR Code
                          </div>
                        )}
                        <span className="text-[7.5px] font-black text-slate-700 tracking-tighter uppercase mt-0.5 text-center">
                          Scan to Visit
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BACK SIDE */}
                  <div
                    ref={backCardRef}
                    className={`w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                      currentTheme.cardBg
                    } ${cardSide === "back" ? "block" : "hidden"}`}
                    style={{ minHeight: "290px" }}
                  >
                    <div className="absolute -left-12 -top-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none blur-2xl" />

                    <div className="relative z-10 text-center border-b border-white/10 pb-2">
                      <p className={`text-xs font-black uppercase tracking-widest ${currentTheme.cardAccent}`}>
                        Mount Kenya Water Distributors
                      </p>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5">
                        "{config.tagline}"
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] sm:text-[11px] relative z-10 my-2">
                      {config.services.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-xs shrink-0">{s.icon || "💧"}</span>
                          <span className="font-semibold truncate">{s.title}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 relative z-10 text-[10px]">
                      <div>
                        <span className="block font-bold text-white">⚡ Same-Day Delivery Dispatch</span>
                        <span className="opacity-75 text-[9px]">5,000L to 30,000L Food-Grade Tankers</span>
                      </div>

                      <div className="text-right">
                        <span className={`block font-black text-xs ${currentTheme.cardAccent}`}>
                          {config.websiteUrl ? config.websiteUrl.replace(/^https?:\/\//, "") : "mountkenyawater.co.ke"}
                        </span>
                        <span className="opacity-75 text-[9px]">Online Booking Available</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Export Actions Bar Under Canvas */}
            <div className="w-full mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Download Assets:</span>
                <span className="text-xs font-black text-slate-700">
                  {activeTab === "poster" ? `Size: ${config.posterSize.toUpperCase()}` : "Card"}
                </span>
              </div>

              {activeTab === "card" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadCardImage(cardSide)}
                    disabled={exporting}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>📥</span>
                    <span>Download PNG ({cardSide.toUpperCase()})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadCardPDF("single")}
                    disabled={exporting}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>📄</span>
                    <span>Download Card PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadCardPDF("sheet")}
                    disabled={exporting}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Generate an A4 page with 8 business cards ready for print & cutting"
                  >
                    <span>🖨️</span>
                    <span>Print Sheet (A4 • 8 Cards)</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPosterImage}
                    disabled={exporting}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>📥</span>
                    <span>Download High-Res PNG ({config.posterSize.toUpperCase()})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPosterPDF}
                    disabled={exporting}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>📄</span>
                    <span>Download Print PDF ({config.posterSize.toUpperCase()})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: COMPREHENSIVE CUSTOMIZATION PANEL (5 cols on lg)
           ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* Paper Size & Layout Selector Card (If Poster tab active) */}
          {activeTab === "poster" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Paper Sizing & Layout Style
                </h3>
                <Badge color="blue">{config.posterSize.toUpperCase()}</Badge>
              </div>

              {/* Sizing Grid (A5, A6, A2, A4) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Select Target Print Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POSTER_SIZES.map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => updateField("posterSize", sz.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        config.posterSize === sz.id
                          ? "border-sky-600 bg-sky-50/50 shadow-xs ring-1 ring-sky-600"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs text-slate-900">{sz.label}</span>
                        {sz.id === "a5" && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Best
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{sz.dimensions}</p>
                      <p className="text-[9px] text-slate-400 line-clamp-1 mt-1">{sz.idealFor}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Poster Layout Switcher */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Poster Layout Design
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {POSTER_LAYOUTS.map((layout) => (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => updateField("posterLayout", layout.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        config.posterLayout === layout.id
                          ? "border-sky-600 bg-sky-50/60 ring-1 ring-sky-600 shadow-xs"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{layout.name}</span>
                        <span className="text-[10px] text-slate-500">{layout.description}</span>
                      </div>
                      {config.posterLayout === layout.id && <span className="text-sky-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Background Photo & Bottom-to-Top Gradient Settings */}
          {activeTab === "poster" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Background Photo & Gradient
                </h3>
                <span className="text-[10px] font-bold text-sky-600">Bottom-to-Top Transparency</span>
              </div>

              {/* Curated Preset Photos */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Choose Photo Preset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PHOTO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateField("posterBgPhoto", preset.url)}
                      className={`relative h-20 rounded-xl overflow-hidden border text-left cursor-pointer group ${
                        config.posterBgPhoto === preset.url
                          ? "ring-2 ring-sky-600 border-transparent shadow-md"
                          : "border-slate-200 hover:opacity-90"
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 flex flex-col justify-end">
                        <span className="text-[9px] font-black text-white leading-tight">{preset.name}</span>
                        <span className="text-[7.5px] text-sky-300 font-semibold">{preset.tag}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Custom Local Truck/Depot Image */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Or Upload Your Own Photo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>📸</span>
                    <span>Upload Bowser / Site Photo</span>
                  </button>
                  {config.posterBgPhoto && (
                    <button
                      type="button"
                      onClick={() => updateField("posterBgPhoto", PHOTO_PRESETS[0].url)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                      title="Reset to default fleet photo"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports your real phone camera shots or company truck pictures directly.
                </p>
              </div>

              {/* Bottom-to-Top Gradient Intensity for Text Legibility */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Bottom-to-Top Gradient Contrast (For Text Clarity)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "high", label: "Deep Contrast", desc: "100% Readable" },
                    { id: "balanced", label: "Balanced", desc: "Standard Mix" },
                    { id: "subtle", label: "Subtle", desc: "More Photo" },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => updateField("gradientIntensity", lvl.id)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        config.gradientIntensity === lvl.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xs font-bold block">{lvl.label}</span>
                      <span className="text-[9px] opacity-75">{lvl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Setup & Visual Themes */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Color Palette & Quick Sync
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleLoadFromCMS}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <span>🔄</span>
                <span>Sync from Website CMS</span>
              </button>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>↺</span>
                <span>Reset to Defaults</span>
              </button>
            </div>

            {/* Select Boss Profile Dropdown */}
            {bosses.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Autofill Contact from Director
                </label>
                <select
                  value={selectedBossId}
                  onChange={(e) => handleSelectBoss(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="">👤 Select Director to auto-fill...</option>
                  {bosses.map((b) => (
                    <option key={b.id || b.name} value={b.id}>
                      {b.name} — {b.title || "Director"} {b.phone ? `(${b.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visual Color Theme Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Color Palette Mix
              </label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateField("themeId", theme.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      config.themeId === theme.id
                        ? "border-sky-600 bg-sky-50/50 shadow-xs ring-1 ring-sky-600"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full ${theme.buttonBg}`} />
                      <span className="text-xs font-bold text-slate-800 truncate">{theme.name.split(" ")[0]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editable Content: 4 Reasons, Quote & Headlines */}
          {activeTab === "poster" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Poster Headline & 4 Reasons
              </h3>

              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Label Badge
                    </label>
                    <input
                      type="text"
                      value={config.posterHeadlineLabel}
                      onChange={(e) => updateField("posterHeadlineLabel", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Main Headline
                    </label>
                    <input
                      type="text"
                      value={config.posterHeadlineMain}
                      onChange={(e) => updateField("posterHeadlineMain", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Sub-Headline Explanation
                  </label>
                  <input
                    type="text"
                    value={config.posterSubheadline}
                    onChange={(e) => updateField("posterSubheadline", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* 4 Reasons Customization */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">
                    The 4 Key Service Highlights
                  </span>
                  {config.reasons.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.icon}
                          onChange={(e) => updateReason(idx, "icon", e.target.value)}
                          className="w-10 px-2 py-1 text-xs rounded-lg border border-slate-300 text-center bg-white"
                          title="Icon emoji"
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateReason(idx, "title", e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
                          placeholder="Highlight Title"
                        />
                      </div>
                      <input
                        type="text"
                        value={item.desc}
                        onChange={(e) => updateReason(idx, "desc", e.target.value)}
                        className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-slate-300 text-slate-600 bg-white"
                        placeholder="Highlight details description"
                      />
                    </div>
                  ))}
                </div>

                {/* Executive Quote Box Customization */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">
                    Executive Promise & Quote Box
                  </span>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Quote Text
                    </label>
                    <textarea
                      rows={2}
                      value={config.quoteText}
                      onChange={(e) => updateField("quoteText", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Attribution
                    </label>
                    <input
                      type="text"
                      value={config.quoteAuthor}
                      onChange={(e) => updateField("quoteAuthor", e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Bottom Banner Tagline */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">
                    Bottom Banner Message
                  </span>
                  <input
                    type="text"
                    value={config.bottomBannerMission}
                    onChange={(e) => updateField("bottomBannerMission", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                    placeholder="Company mission promise"
                  />
                  <input
                    type="text"
                    value={config.bottomBannerCta}
                    onChange={(e) => updateField("bottomBannerCta", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-600 focus:outline-none focus:border-sky-500"
                    placeholder="Callout / action note"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contact Details & Live QR Code */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Phone Lines & Scannable QR Code
            </h3>

            {/* Contacts & Dispatch Lines */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Primary Dispatch Phone
                  </label>
                  <input
                    type="text"
                    value={config.primaryPhone}
                    onChange={(e) => updateField("primaryPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    WhatsApp Hotline
                  </label>
                  <input
                    type="text"
                    value={config.whatsappNumber}
                    onChange={(e) => updateField("whatsappNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Secondary Phone
                  </label>
                  <input
                    type="text"
                    value={config.secondaryPhone}
                    onChange={(e) => updateField("secondaryPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Depot Location
                  </label>
                  <input
                    type="text"
                    value={config.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Website & Live QR Code Settings */}
            <div className="pt-3 border-t border-slate-100 space-y-2 bg-sky-50/50 p-3 rounded-xl border border-sky-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-900 block">
                  Website URL (In QR Code)
                </span>
                <span className="text-[10px] text-sky-700 font-bold">Auto-Encoded</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={config.websiteUrl}
                  onChange={(e) => updateField("websiteUrl", e.target.value)}
                  placeholder="https://mountkenyawater.co.ke"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:border-sky-500 font-bold text-slate-800"
                />
                {config.websiteUrl && (
                  <a
                    href={config.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                    title="Open website link in new tab to test"
                  >
                    Test ↗
                  </a>
                )}
              </div>
              <p className="text-[10px] text-slate-500">
                Any customer pointing their smartphone camera at the poster or card will immediately be redirected to this URL.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
