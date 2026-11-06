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

const THEMES = [
  {
    id: "emerald",
    name: "Emerald Executive (Brand Signature)",
    badgeColor: "green",
    cardBg: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white border-emerald-500/40",
    cardAccent: "text-amber-400",
    cardPill: "bg-emerald-800/80 text-emerald-200 border border-emerald-600/40",
    qrDark: "#064e3b",
    posterBg: "bg-gradient-to-b from-slate-950 via-emerald-950 to-slate-900 text-white",
    posterHeader: "from-emerald-900 via-teal-900 to-slate-900",
    accentBorder: "border-emerald-500",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    id: "glacier",
    name: "Glacier Blue (Pure Water Tech)",
    badgeColor: "blue",
    cardBg: "bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-950 text-white border-sky-500/40",
    cardAccent: "text-cyan-300",
    cardPill: "bg-sky-800/80 text-sky-200 border border-sky-600/40",
    qrDark: "#0369a1",
    posterBg: "bg-gradient-to-b from-slate-950 via-sky-950 to-slate-900 text-white",
    posterHeader: "from-sky-900 via-cyan-900 to-slate-900",
    accentBorder: "border-sky-500",
    buttonBg: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  {
    id: "obsidian",
    name: "Midnight Obsidian (Luxury Dark)",
    badgeColor: "slate",
    cardBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-white border-slate-700",
    cardAccent: "text-emerald-400",
    cardPill: "bg-slate-800 text-slate-300 border border-slate-700",
    qrDark: "#0f172a",
    posterBg: "bg-gradient-to-b from-black via-slate-950 to-slate-900 text-white",
    posterHeader: "from-slate-900 via-zinc-900 to-black",
    accentBorder: "border-emerald-400",
    buttonBg: "bg-slate-800 hover:bg-slate-700 text-white",
  },
  {
    id: "print-white",
    name: "Clean Print White (Paper Friendly)",
    badgeColor: "slate",
    cardBg: "bg-white text-slate-900 border-slate-300 shadow-sm",
    cardAccent: "text-emerald-700",
    cardPill: "bg-slate-100 text-slate-700 border border-slate-300",
    qrDark: "#000000",
    posterBg: "bg-white text-slate-900 border-slate-200 shadow-sm",
    posterHeader: "from-emerald-800 via-teal-800 to-slate-800 text-white",
    accentBorder: "border-emerald-600",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
];

const DEFAULT_CONFIG = {
  // Company & Brand
  companyName: "Mount Kenya Water Distributors",
  tagline: "Pure, Reliable Bulk Water Delivery",
  accreditation: "Licensed Clean Bulk Water Transporter",

  // Cardholder Profile
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
  themeId: "emerald",

  // Poster Specific Content
  posterHeadline: "NEED PURE BULK WATER DELIVERED FAST?",
  posterSubheadline:
    "Reliable, food-grade tanker water supply for residential estates, hotels, swimming pools, and construction sites.",
  capacitiesBadge: "5,000L to 30,000L Fleet",
  speedBadge: "Fast Same-Day Dispatch",
  qualityBadge: "100% Certified Clean Drinking Water",
  coverageAreas: "Nairobi · Kiambu · Ruiru · Thika · Kenol · Murang'a · Nyeri · Nanyuki",
  specialOfferNote: "Call dispatch now for instant availability, pricing, and guaranteed delivery schedule!",

  // Services Included
  services: [
    { title: "Clean Bulk Drinking Water", desc: "For homes, estates, apartments & hotels", icon: "💧" },
    { title: "Construction & Site Supply", desc: "Compaction, concrete curing & dust control", icon: "🏗️" },
    { title: "Swimming Pool Filling", desc: "Fast multi-trip filling with clean water", icon: "🏊" },
    { title: "Urgent & Emergency Supply", desc: "Priority tanker dispatch 7 days a week", icon: "🚨" },
    { title: "Commercial & Industrial", desc: "Scheduled supply contracts for factories", icon: "🏭" },
    { title: "Tanker / Bowser Leasing", desc: "Daily, weekly or monthly rental rates", icon: "🚛" },
  ],
};

const STORAGE_KEY = "mk_marketing_studio_config";

export default function MarketingStudioPage({ onNavigateToWebsite }) {
  const { isPrivileged } = useAuth();

  // Active view tab: 'card' or 'poster'
  const [activeTab, setActiveTab] = useState("card");

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

  // Active theme
  const currentTheme = THEMES.find((t) => t.id === config.themeId) || THEMES[0];

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

  // Set default website URL to window.location.origin if it's running live
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
          dark: darkColor || "#064e3b",
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
    if (window.confirm("Reset all card and poster customizations back to initial defaults?")) {
      setConfig(DEFAULT_CONFIG);
      setSelectedBossId("");
    }
  };

  // Generic Field updater
  const updateField = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Service toggle/update
  const updateServiceTitle = (index, newTitle) => {
    setConfig((prev) => {
      const list = [...prev.services];
      list[index] = { ...list[index], title: newTitle };
      return { ...prev, services: list };
    });
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
    setExportNotice("Rendering 300-DPI High-Res Marketing Poster (PNG)...");
    try {
      await downloadElementAsImage(posterRef.current, "Mount_Kenya_Water_Distributors_Poster.png", 3);
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
    setExportNotice("Compiling Print-Ready A4 Poster (PDF)...");
    try {
      await downloadPosterPDF({
        posterElement: posterRef.current,
        filename: "Mount_Kenya_Water_Distributors_Poster_A4.pdf",
      });
    } catch (err) {
      alert("Poster PDF export failed: " + err.message);
    } finally {
      setExporting(false);
      setExportNotice("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Marketing & Branding Studio
            </h1>
            <Badge color="green">Print Ready</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate high-resolution, custom-branded business cards and promotional marketing posters with live scannable website QR codes.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
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
            <span>Marketing Poster</span>
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
            {/* Canvas Header & Controls */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {activeTab === "card" ? "Business Card Preview (3.5\" × 2.0\")" : "Poster Preview (Standard A4)"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  300 DPI
                </span>
              </div>

              {/* Front/Back Flip Toggle for Business Card */}
              {activeTab === "card" && (
                <div className="inline-flex p-0.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setCardSide("front")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      cardSide === "front" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Front Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide("back")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      cardSide === "back" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Back Side
                  </button>
                </div>
              )}
            </div>

            {/* -------------------------------------------------------------------
                LIVE BUSINESS CARD CANVAS (Front & Back)
               ------------------------------------------------------------------- */}
            {activeTab === "card" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                {/* Visual Card Wrapper (Keeps aspect ratio 3.5 : 2 ~ 1.75 : 1) */}
                <div className="w-full max-w-[540px] aspect-[1.75/1] relative select-none">
                  {/* FRONT SIDE */}
                  <div
                    ref={frontCardRef}
                    className={`w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                      currentTheme.cardBg
                    } ${cardSide === "front" ? "block" : "hidden"}`}
                    style={{ minHeight: "290px" }}
                  >
                    {/* Background Decorative Mountain & Water Overlay */}
                    <div className="absolute -right-12 -bottom-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none blur-2xl" />
                    <div className="absolute right-8 top-0 bottom-0 w-32 bg-white/[0.02] transform -skew-x-12 pointer-events-none" />

                    {/* Top Row: Brand Crest & Accreditations */}
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

                    {/* Middle Row: Person Name & Title */}
                    <div className="relative z-10 my-2">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-1.5">
                        <span>{config.personName}</span>
                      </h2>
                      <p className={`text-xs font-bold tracking-wide uppercase mt-0.5 ${currentTheme.cardAccent}`}>
                        {config.personTitle}
                      </p>
                    </div>

                    {/* Bottom Row: Contact Details (Left) & Scannable QR Code (Right) */}
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

                      {/* QR Code Container */}
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
                    {/* Decorative element */}
                    <div className="absolute -left-12 -top-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none blur-2xl" />

                    {/* Top: Slogan & Mission */}
                    <div className="relative z-10 text-center border-b border-white/10 pb-2">
                      <p className={`text-xs font-black uppercase tracking-widest ${currentTheme.cardAccent}`}>
                        Mount Kenya Water Distributors
                      </p>
                      <h4 className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5">
                        "{config.tagline}"
                      </h4>
                    </div>

                    {/* Middle: 6 Key Services Checklist */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] sm:text-[11px] relative z-10 my-2">
                      {config.services.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-xs shrink-0">{s.icon || "💧"}</span>
                          <span className="font-semibold truncate">{s.title}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bottom: Fast Dispatch Callout & Website URL */}
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

            {/* -------------------------------------------------------------------
                LIVE MARKETING POSTER CANVAS (A4 Format)
               ------------------------------------------------------------------- */}
            {activeTab === "poster" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                <div
                  ref={posterRef}
                  className={`w-full max-w-[480px] p-6 sm:p-8 rounded-3xl border shadow-2xl relative overflow-hidden select-none flex flex-col justify-between ${
                    currentTheme.posterBg
                  }`}
                  style={{ minHeight: "680px" }}
                >
                  {/* Decorative Background Elements */}
                  <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

                  {/* Top Header Banner */}
                  <div className="relative z-10 text-center border-b border-white/10 pb-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-emerald-300 mb-2">
                      <span>🚛</span>
                      <span>{config.accreditation}</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight">
                      {config.companyName}
                    </h2>
                    <p className={`text-xs sm:text-sm font-bold tracking-wide mt-1 ${currentTheme.cardAccent}`}>
                      "{config.tagline}"
                    </p>
                  </div>

                  {/* Big Hero Catchy Hook */}
                  <div className="relative z-10 my-4 text-center">
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">
                      {config.posterHeadline}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-medium mt-2 max-w-sm mx-auto leading-snug">
                      {config.posterSubheadline}
                    </p>

                    {/* 3 Prominent Feature Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                      <span className="px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-xs">
                        🚚 {config.capacitiesBadge}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold shadow-xs">
                        ⚡ {config.speedBadge}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-xs">
                        💧 {config.qualityBadge}
                      </span>
                    </div>
                  </div>

                  {/* Services Offered Grid */}
                  <div className="relative z-10 my-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2 text-center">
                      OUR WATER DELIVERY SERVICES
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {config.services.map((svc, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-start gap-2"
                        >
                          <span className="text-base shrink-0 mt-0.5">{svc.icon}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs leading-tight truncate">{svc.title}</p>
                            <p className="text-[10px] text-slate-400 leading-snug mt-0.5">{svc.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coverage Locations Ribbon */}
                  <div className="relative z-10 my-2 p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                      Delivery Regions Covered:
                    </span>
                    <span className="text-xs font-semibold text-emerald-200 block">
                      {config.coverageAreas}
                    </span>
                  </div>

                  {/* High-Contrast Bottom Call-To-Action & QR Code Box */}
                  <div className="relative z-10 pt-3 border-t border-white/10 bg-black/40 -mx-4 -mb-4 p-4 rounded-b-2xl flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider block">
                        24/7 Dispatch & Inquiries
                      </span>
                      <p className="text-base sm:text-lg font-black text-white tracking-tight">
                        📞 {config.primaryPhone}
                      </p>
                      {config.secondaryPhone && (
                        <p className="text-xs font-bold text-slate-300">
                          Alt: {config.secondaryPhone}
                        </p>
                      )}
                      <p className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                        <span>💬 WhatsApp:</span>
                        <span>{config.whatsappNumber}</span>
                      </p>
                      <p className="text-[9.5px] text-slate-400 truncate max-w-[200px]">
                        📍 {config.address}
                      </p>
                    </div>

                    {/* Giant Scannable QR Code */}
                    <div className="bg-white p-2 rounded-2xl shadow-xl flex flex-col items-center shrink-0 border border-white/90">
                      {qrDataUrl && (
                        <img
                          src={qrDataUrl}
                          alt="Website QR Code"
                          className="w-20 h-20 sm:w-22 sm:h-22 object-contain"
                        />
                      )}
                      <span className="text-[8px] font-black text-slate-900 tracking-tighter uppercase mt-1 text-center max-w-[90px] leading-tight">
                        Scan to Order Online
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Export Actions Bar Under Canvas */}
            <div className="w-full mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Download Assets:</span>
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
                    <span>Download High-Res Poster (PNG)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPosterPDF}
                    disabled={exporting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>📄</span>
                    <span>Download Print PDF (A4)</span>
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
          {/* Quick Preset / One-Click Actions Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Quick Setup & Data Sync
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Load from Website CMS Button */}
              <button
                type="button"
                onClick={handleLoadFromCMS}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <span>🔄</span>
                <span>Sync from Website CMS</span>
              </button>

              {/* Reset to Factory Defaults */}
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
                  Autofill from Boss Profile
                </label>
                <select
                  value={selectedBossId}
                  onChange={(e) => handleSelectBoss(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">👤 Select Boss to auto-fill cardholder...</option>
                  {bosses.map((b) => (
                    <option key={b.id || b.name} value={b.id}>
                      {b.name} — {b.title || "Director"} {b.phone ? `(${b.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Visual Theme Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                Visual Theme Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateField("themeId", theme.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      config.themeId === theme.id
                        ? "border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600"
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

          {/* Form Settings Accordion / Tabs */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Customize Information & Text
            </h3>

            {/* Company & Accreditation */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Tagline / Slogan
                </label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Accreditation / Badge Text
                </label>
                <input
                  type="text"
                  value={config.accreditation}
                  onChange={(e) => updateField("accreditation", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Cardholder Profile (For Business Card) */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                Cardholder Profile
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={config.personName}
                    onChange={(e) => updateField("personName", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={config.personTitle}
                    onChange={(e) => updateField("personTitle", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Contacts & Dispatch Lines */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                Phone & Direct Channels
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Primary Phone
                  </label>
                  <input
                    type="text"
                    value={config.primaryPhone}
                    onChange={(e) => updateField("primaryPhone", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={config.whatsappNumber}
                    onChange={(e) => updateField("whatsappNumber", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Depot / Physical Address
                </label>
                <input
                  type="text"
                  value={config.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Website & Live QR Code Settings */}
            <div className="pt-3 border-t border-slate-100 space-y-3 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                  Website & Scannable QR Code
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">Live Synced</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Website URL (Encoded in QR Code)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={config.websiteUrl}
                    onChange={(e) => updateField("websiteUrl", e.target.value)}
                    placeholder="https://mountkenyawater.co.ke"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold text-slate-800"
                  />
                  {config.websiteUrl && (
                    <a
                      href={config.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0 transition-colors"
                      title="Open website link in new tab to test"
                    >
                      Test ↗
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  When customers scan the QR code on your card or poster, their phone camera directly opens this website.
                </p>
              </div>
            </div>

            {/* Poster-Specific Customizations */}
            {activeTab === "poster" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                  Poster Headlines & Copy
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Main Catchy Headline
                  </label>
                  <input
                    type="text"
                    value={config.posterHeadline}
                    onChange={(e) => updateField("posterHeadline", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Sub-Headline / Description
                  </label>
                  <textarea
                    rows={2}
                    value={config.posterSubheadline}
                    onChange={(e) => updateField("posterSubheadline", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Coverage Areas Text
                  </label>
                  <input
                    type="text"
                    value={config.coverageAreas}
                    onChange={(e) => updateField("coverageAreas", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

