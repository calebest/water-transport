import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { useAuth } from "../contexts/AuthContext";
import { bossesService } from "../services/bosses";
import { websiteService } from "../services/website";
import { supabase } from "../services/supabase";
import {
  downloadElementAsImage,
  downloadBusinessCardPDF,
  downloadPosterPDF,
} from "../utils/marketingExporter";
import { Badge } from "../components/ui";

/**
 * Resizes and compresses user-uploaded images using a hidden canvas.
 * Reduces 5MB-10MB mobile/desktop camera photos down to ~80KB-140KB,
 * ensuring they never breach browser localStorage quotas (5MB) and save instantly.
 */
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// Available Themes for Marketing Posters
const POSTER_THEMES = [
  {
    id: "geo-cyan",
    name: "Cyan & Slate (Reference Match)",
    badgeColor: "blue",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-sky-600 text-white",
    quoteBg: "bg-[#2d1b33] text-white", // deep plum like reference
    accentColor: "text-sky-600",
    accentBorder: "border-sky-500",
    qrDark: "#0284c7",
    buttonBg: "bg-sky-600 hover:bg-sky-700 text-white",
  },
  {
    id: "emerald",
    name: "Emerald Signature & White",
    badgeColor: "green",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-emerald-600 text-white",
    quoteBg: "bg-slate-900 text-white",
    accentColor: "text-emerald-600",
    accentBorder: "border-emerald-500",
    qrDark: "#064e3b",
    buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    id: "royal-blue",
    name: "Royal Water Blue & White",
    badgeColor: "blue",
    posterBg: "bg-white text-slate-900",
    bannerBg: "bg-blue-700 text-white",
    quoteBg: "bg-slate-900 text-white",
    accentColor: "text-blue-600",
    accentBorder: "border-blue-500",
    qrDark: "#1e40af",
    buttonBg: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  {
    id: "obsidian-dark",
    name: "Midnight Obsidian (Dark Luxe)",
    badgeColor: "slate",
    posterBg: "bg-slate-950 text-white",
    bannerBg: "bg-slate-900 text-white border-t border-slate-800",
    quoteBg: "bg-slate-900/90 text-white border border-slate-700",
    accentColor: "text-emerald-400",
    accentBorder: "border-emerald-400",
    qrDark: "#0f172a",
    buttonBg: "bg-slate-800 hover:bg-slate-700 text-white",
  },
];

// Rich Mixed Card Styles (Light, Two-Tone Split, and Dark Luxury)
const CARD_THEMES = [
  {
    id: "geo-split-white",
    name: "Modern Geo-Split (White & Cyan)",
    tag: "Two-Tone Split",
    category: "mixed",
    qrDark: "#0284c7",
    accentText: "text-sky-600",
    description: "Clean white left panel with dark typography + angled vibrant cyan right panel with QR code.",
  },
  {
    id: "crisp-white-emerald",
    name: "Crisp Executive White & Emerald",
    tag: "Clean Corporate",
    category: "light",
    qrDark: "#064e3b",
    accentText: "text-emerald-700",
    description: "Bright white cardstock with charcoal typography, emerald branding, and gold accents.",
  },
  {
    id: "ice-blue-modern",
    name: "Minimalist Ice Blue & Slate",
    tag: "Modern Tech",
    category: "light",
    qrDark: "#0284c7",
    accentText: "text-sky-600",
    description: "Pure white card with architectural ice-blue accent bar and high-contrast dark text.",
  },
  {
    id: "emerald-ribbon-white",
    name: "Emerald Diagonal Ribbon & White",
    tag: "Two-Tone Split",
    category: "mixed",
    qrDark: "#064e3b",
    accentText: "text-emerald-600",
    description: "Clean white base with angled deep emerald corner geometry and gold executive stars.",
  },
  {
    id: "emerald-dark-luxe",
    name: "Emerald Signature (Dark Luxe)",
    tag: "Dark Luxury",
    category: "dark",
    qrDark: "#064e3b",
    accentText: "text-amber-400",
    description: "Deep emerald velvet gradient with glowing amber typography and dark styling.",
  },
  {
    id: "obsidian-dark-gold",
    name: "Midnight Obsidian (Dark Gold)",
    tag: "Dark Luxury",
    category: "dark",
    qrDark: "#0f172a",
    accentText: "text-emerald-400",
    description: "Ultra-dark midnight slate with emerald accents and high-contrast night styling.",
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

  // Business Card Settings
  cardTheme: "geo-split-white", // "geo-split-white" | "crisp-white-emerald" | "ice-blue-modern" | "emerald-ribbon-white" | "emerald-dark-luxe" | "obsidian-dark-gold"
  personName: "Caleb Bollus",
  personTitle: "Managing Director / Fleet Dispatch",
  personPhoto: "", // Passport photo / headshot data URL
  showPassportPhoto: true,
  avatarShape: "circle", // "circle" | "rounded"
  avatarSize: 48, // 36 to 72 pixels (default 48px)

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

const STORAGE_KEY = "mk_marketing_studio_config_v3";
const TAB_STORAGE_KEY = "mk_marketing_studio_active_tab";

export default function MarketingStudioPage() {
  const { isPrivileged } = useAuth();

  // Active view tab: persisted in localStorage so refresh never resets to card
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(TAB_STORAGE_KEY) || "poster";
      } catch (e) {
        return "poster";
      }
    }
    return "poster";
  });

  // Card view side: 'front' or 'back'
  const [cardSide, setCardSide] = useState("front");

  // Card category filter for theme selector: 'all' | 'light' | 'dark'
  const [cardFilter, setCardFilter] = useState("all");

  // Save status indicator ('saved' | 'saving')
  const [saveStatus, setSaveStatus] = useState("saved");

  // Customization Configuration (Loaded from localStorage with deep merge fallback)
  const [config, setConfig] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_CONFIG,
            ...parsed,
            reasons:
              Array.isArray(parsed.reasons) && parsed.reasons.length > 0
                ? parsed.reasons
                : DEFAULT_CONFIG.reasons,
            services:
              Array.isArray(parsed.services) && parsed.services.length > 0
                ? parsed.services
                : DEFAULT_CONFIG.services,
          };
        }
      } catch (e) {
        console.warn("Failed reading saved marketing config from localStorage:", e);
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
  const passportPhotoInputRef = useRef(null);

  // Active Poster theme, Poster size, & Card theme
  const currentPosterTheme = POSTER_THEMES.find((t) => t.id === config.themeId) || POSTER_THEMES[0];
  const currentPosterSize = POSTER_SIZES.find((s) => s.id === config.posterSize) || POSTER_SIZES[0];
  const currentCardTheme = CARD_THEMES.find((t) => t.id === config.cardTheme) || CARD_THEMES[0];

  // Helper to switch and persist active tab
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch (e) {}
  };

  // 1. On Mount: Fetch remote backup from Supabase 'settings' table and merge
  useEffect(() => {
    let isMounted = true;
    const fetchRemoteConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "marketing_studio_config")
          .single();

        if (isMounted && !error && data?.value) {
          const remote = data.value;
          setConfig((prev) => {
            const merged = {
              ...DEFAULT_CONFIG,
              ...prev,
              ...remote,
              reasons:
                Array.isArray(remote.reasons) && remote.reasons.length > 0
                  ? remote.reasons
                  : prev.reasons,
              services:
                Array.isArray(remote.services) && remote.services.length > 0
                  ? remote.services
                  : prev.services,
            };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch (err) {}
            return merged;
          });
        }
      } catch (err) {
        console.warn("Could not sync remote marketing config from Supabase:", err);
      }
    };

    fetchRemoteConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. On Config Change: Save to localStorage immediately, and debounce sync to Supabase
  useEffect(() => {
    setSaveStatus("saving");

    // LocalStorage save
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("localStorage quota exceeded or failed:", e);
      // If photo was too big, revert photo to preset for local storage
      if (e.name === "QuotaExceededError" || e.code === 22) {
        try {
          const fallback = { ...config, posterBgPhoto: PHOTO_PRESETS[0].url };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
        } catch (err) {}
      }
    }

    // Debounce cloud sync to Supabase (1.5 seconds)
    const timeout = setTimeout(async () => {
      try {
        const { data: existing } = await supabase
          .from("settings")
          .select("key")
          .eq("key", "marketing_studio_config")
          .single();

        if (!existing) {
          await supabase.from("settings").insert({
            key: "marketing_studio_config",
            value: config,
          });
        } else {
          await supabase
            .from("settings")
            .update({
              value: config,
              updated_at: new Date().toISOString(),
            })
            .eq("key", "marketing_studio_config");
        }
        setSaveStatus("saved");
      } catch (err) {
        console.warn("Debounced cloud sync to Supabase failed:", err);
        setSaveStatus("saved"); // Still saved locally
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [config]);

  // Manual Instant Save Handler
  const handleManualSave = async () => {
    setSaveStatus("saving");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

      const { data: existing } = await supabase
        .from("settings")
        .select("key")
        .eq("key", "marketing_studio_config")
        .single();

      if (!existing) {
        await supabase.from("settings").insert({
          key: "marketing_studio_config",
          value: config,
        });
      } else {
        await supabase
          .from("settings")
          .update({
            value: config,
            updated_at: new Date().toISOString(),
          })
          .eq("key", "marketing_studio_config");
      }
      setSaveStatus("saved");
      alert("✓ All poster and business card information successfully saved!");
    } catch (err) {
      console.warn("Manual save error:", err);
      setSaveStatus("saved");
      alert("✓ Saved locally in your browser session!");
    }
  };

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

  // Re-generate QR when URL or active theme changes
  useEffect(() => {
    const darkColor = activeTab === "card" ? currentCardTheme.qrDark : currentPosterTheme.qrDark;
    generateQrCode(config.websiteUrl, darkColor);
  }, [config.websiteUrl, activeTab, currentCardTheme.qrDark, currentPosterTheme.qrDark, generateQrCode]);

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

  // Handle Local Custom Image Upload with automatic canvas compression
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    try {
      // Compress to max 1200x1200px at 82% JPEG quality (~80-140KB)
      // This prevents QuotaExceededError in localStorage and saves immediately
      const compressedDataUrl = await compressImage(file, 1200, 1200, 0.82);
      updateField("posterBgPhoto", compressedDataUrl);
    } catch (err) {
      console.warn("Canvas compression fallback to direct reader:", err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateField("posterBgPhoto", event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Passport Photo Upload for Business Card
  const handlePassportPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    try {
      // Compress avatar to 400x400 max (~25-45KB) for sharp 300 DPI display and fast storage
      const compressedDataUrl = await compressImage(file, 400, 400, 0.85);
      setConfig((prev) => ({
        ...prev,
        personPhoto: compressedDataUrl,
        showPassportPhoto: true,
      }));
    } catch (err) {
      console.warn("Passport photo compression fallback to direct reader:", err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setConfig((prev) => ({
            ...prev,
            personPhoto: event.target.result,
            showPassportPhoto: true,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
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

  // Gradient transparency styles for poster
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

  // Filtered card themes
  const filteredCardThemes = CARD_THEMES.filter((t) => {
    if (cardFilter === "light") return t.category === "light" || t.category === "mixed";
    if (cardFilter === "dark") return t.category === "dark";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Marketing & Business Card Studio
            </h1>
            <Badge color="green">Print Ready</Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Design professional business cards & flyers with mixed light/dark/two-tone layouts and live scannable website QR codes.
          </p>
        </div>

        {/* Actions & View Mode Tabs */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Live Auto-save indicator & Manual Save */}
          <div className="flex items-center gap-2">
            {saveStatus === "saving" ? (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                <span className="animate-spin text-xs">⏳</span>
                <span>Saving...</span>
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="text-emerald-600 text-xs">✓</span>
                <span>Auto-saved</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleManualSave}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Manually save all customizations to browser & cloud storage"
            >
              <span>💾</span>
              <span>Save</span>
            </button>
          </div>

          {/* View Mode Tabs (Persistent across refresh) */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleTabSwitch("poster")}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
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
              onClick={() => handleTabSwitch("card")}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
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
                    ? `Business Card (3.5" × 2.0" • ${currentCardTheme.tag})`
                    : `${currentPosterSize.label} Preview (${currentPosterSize.dimensions})`}
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

              {/* Poster Paper Size Selector (When in poster tab) */}
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
            </div>

            {/* -------------------------------------------------------------------
                TAB 1: LIVE BUSINESS CARD CANVAS (Front & Back with Mixed Themes)
               ------------------------------------------------------------------- */}
            {activeTab === "card" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                <div className="w-full max-w-[540px] aspect-[1.75/1] relative select-none">
                  {/* ==========================================
                      CARD FRONT SIDE: THEME-AWARE RENDERING
                     ========================================== */}
                  <div
                    ref={frontCardRef}
                    className="w-full h-full rounded-2xl relative overflow-hidden transition-opacity duration-300"
                    style={{
                      minHeight: "295px",
                      opacity: cardSide === "front" ? 1 : 0,
                      pointerEvents: cardSide === "front" ? "auto" : "none",
                      zIndex: cardSide === "front" ? 10 : 0,
                    }}
                  >
                    {/* STYLE 1: TWO-TONE GEO-SPLIT (White & Cyan) */}
                    {config.cardTheme === "geo-split-white" && (
                      <div className="w-full h-full bg-white text-slate-900 border border-slate-200 shadow-xl flex items-stretch">
                        {/* Left Side: Crisp White Typography & Contacts (66% Width) */}
                        <div className="w-8/12 p-5 flex flex-col justify-between z-10">
                          {/* Brand Header */}
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-lg shadow-2xs shrink-0">
                              🚛
                            </div>
                            <div>
                              <h3 className="font-black text-xs sm:text-sm tracking-tight leading-tight uppercase text-slate-900">
                                {config.companyName}
                              </h3>
                              <p className="text-[9.5px] text-slate-500 font-semibold">
                                {config.accreditation}
                              </p>
                            </div>
                          </div>

                          {/* Cardholder Name & Title with optional Passport Photo */}
                          <div className="my-1.5 flex items-center gap-2.5">
                            {config.personPhoto && config.showPassportPhoto && (
                              <img
                                src={config.personPhoto}
                                alt={config.personName}
                                style={{
                                  width: `${config.avatarSize || 48}px`,
                                  height: `${config.avatarSize || 48}px`,
                                }}
                                className={`object-cover border-2 border-sky-500 shadow-xs shrink-0 ${
                                  config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                                }`}
                              />
                            )}
                            <div className="min-w-0">
                              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
                                {config.personName}
                              </h2>
                              <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wide truncate">
                                {config.personTitle}
                              </p>
                            </div>
                          </div>

                          {/* Contact Details */}
                          <div className="space-y-1 text-[9.5px] sm:text-[10px] text-slate-700 font-medium pt-1.5 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sky-600 font-bold">📞</span>
                              <span className="font-bold text-slate-900">{config.primaryPhone}</span>
                              {config.secondaryPhone && (
                                <span className="text-slate-400">/ {config.secondaryPhone}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-600 font-bold">💬</span>
                              <span>WhatsApp: <strong className="text-slate-900">{config.whatsappNumber}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-slate-400">✉️</span>
                              <span className="truncate">{config.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate text-[9px] text-slate-500">
                              <span className="text-slate-400">📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Angled Vibrant Cyan Polygon with Scannable QR Code (34% Width) */}
                        <div
                          className="w-4/12 bg-sky-600 text-white p-3.5 flex flex-col items-center justify-between relative"
                          style={{
                            clipPath: "polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)",
                            paddingLeft: "1.2rem",
                          }}
                        >
                          {/* Top Pill */}
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white self-end mr-1">
                            Bulk Water
                          </span>

                          {/* QR Code Container */}
                          <div className="bg-white p-1 rounded-xl shadow-md flex flex-col items-center border border-white">
                            {qrDataUrl ? (
                              <img
                                src={qrDataUrl}
                                alt="QR Code"
                                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-[7px] text-slate-400">
                                QR
                              </div>
                            )}
                            <span className="text-[7px] font-black text-slate-900 tracking-tighter uppercase mt-0.5">
                              Scan to Visit
                            </span>
                          </div>

                          {/* Quick delivery promise */}
                          <span className="text-[8px] font-black tracking-tighter text-sky-100 uppercase text-center">
                            ⚡ Same-Day Delivery
                          </span>
                        </div>
                      </div>
                    )}

                    {/* STYLE 2: CRISP EXECUTIVE WHITE & EMERALD */}
                    {config.cardTheme === "crisp-white-emerald" && (
                      <div className="w-full h-full bg-white text-slate-900 border border-slate-200 shadow-xl p-5 sm:p-6 flex flex-col justify-between relative">
                        {/* Subtle top brand accent line */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700" />

                        {/* Top: Header & Pill */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg font-bold">
                              💧
                            </div>
                            <div>
                              <h3 className="font-black text-xs sm:text-sm tracking-tight text-slate-900 uppercase">
                                {config.companyName}
                              </h3>
                              <p className="text-[9.5px] text-emerald-700 font-bold">
                                {config.accreditation}
                              </p>
                            </div>
                          </div>

                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Licensed Transporter
                          </span>
                        </div>

                        {/* Middle: Person Profile with optional Passport Photo */}
                        <div className="my-1 border-l-2 border-emerald-600 pl-3 flex items-center gap-2.5">
                          {config.personPhoto && config.showPassportPhoto && (
                            <img
                              src={config.personPhoto}
                              alt={config.personName}
                              style={{
                                width: `${config.avatarSize || 48}px`,
                                height: `${config.avatarSize || 48}px`,
                              }}
                              className={`object-cover border-2 border-emerald-600 shadow-xs shrink-0 ${
                                config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
                              {config.personName}
                            </h2>
                            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide truncate">
                              {config.personTitle}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: Contacts & QR */}
                        <div className="flex items-end justify-between gap-3 pt-2 border-t border-slate-100">
                          <div className="space-y-1 text-[9.5px] sm:text-[10px] text-slate-700 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-700">📞</span>
                              <span className="font-bold text-slate-900">{config.primaryPhone}</span>
                              {config.secondaryPhone && (
                                <span className="text-slate-400">/ {config.secondaryPhone}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-600">💬</span>
                              <span>WhatsApp: <strong className="text-slate-900">{config.whatsappNumber}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-slate-400">✉️</span>
                              <span className="truncate">{config.email}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate text-[9px] text-slate-500">
                              <span className="text-slate-400">📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-1 rounded-xl shadow-xs flex flex-col items-center border border-slate-200 shrink-0">
                            {qrDataUrl && (
                              <img
                                src={qrDataUrl}
                                alt="QR Code"
                                className="w-13 h-13 sm:w-15 sm:h-15 object-contain"
                              />
                            )}
                            <span className="text-[7px] font-black text-emerald-900 uppercase mt-0.5">
                              Scan to Visit
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STYLE 3: MINIMALIST ICE BLUE & SLATE */}
                    {config.cardTheme === "ice-blue-modern" && (
                      <div className="w-full h-full bg-white text-slate-900 border border-slate-200 shadow-xl p-5 sm:p-6 flex flex-col justify-between relative pl-7">
                        {/* Modern Architectural Left Accent Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-sky-600" />

                        {/* Top: Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest block">
                              Potable Water Transport
                            </span>
                            <h3 className="font-black text-xs sm:text-sm tracking-tight text-slate-900 uppercase">
                              {config.companyName}
                            </h3>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            Fast Dispatch
                          </span>
                        </div>

                        {/* Middle: Profile with optional Passport Photo */}
                        <div className="my-1 flex items-center gap-2.5">
                          {config.personPhoto && config.showPassportPhoto && (
                            <img
                              src={config.personPhoto}
                              alt={config.personName}
                              style={{
                                width: `${config.avatarSize || 48}px`,
                                height: `${config.avatarSize || 48}px`,
                              }}
                              className={`object-cover border-2 border-sky-600 shadow-xs shrink-0 ${
                                config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight truncate">
                              {config.personName}
                            </h2>
                            <p className="text-[11px] font-bold text-sky-600 uppercase truncate">
                              {config.personTitle}
                            </p>
                          </div>
                        </div>

                        {/* Bottom: Contacts & QR */}
                        <div className="flex items-end justify-between gap-3 pt-2 border-t border-slate-100">
                          <div className="space-y-1 text-[9.5px] sm:text-[10px] text-slate-700 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sky-600">📞</span>
                              <span className="font-bold text-slate-900">{config.primaryPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-600">💬</span>
                              <span>WhatsApp: <strong className="text-slate-900">{config.whatsappNumber}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate text-[9px] text-slate-500">
                              <span className="text-slate-400">📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>

                          <div className="bg-white p-1 rounded-xl shadow-xs flex flex-col items-center border border-slate-200 shrink-0">
                            {qrDataUrl && (
                              <img
                                src={qrDataUrl}
                                alt="QR Code"
                                className="w-13 h-13 sm:w-15 sm:h-15 object-contain"
                              />
                            )}
                            <span className="text-[7px] font-black text-slate-700 uppercase mt-0.5">
                              Scan to Visit
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STYLE 4: EMERALD DIAGONAL RIBBON & WHITE */}
                    {config.cardTheme === "emerald-ribbon-white" && (
                      <div className="w-full h-full bg-white text-slate-900 border border-slate-200 shadow-xl flex items-stretch relative overflow-hidden">
                        {/* Left Side Content (67% Width) */}
                        <div className="w-8/12 p-5 flex flex-col justify-between z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🚛</span>
                            <div>
                              <h3 className="font-black text-xs sm:text-sm tracking-tight text-slate-900 uppercase">
                                {config.companyName}
                              </h3>
                              <p className="text-[9px] text-emerald-700 font-bold">{config.accreditation}</p>
                            </div>
                          </div>

                          <div className="my-1 flex items-center gap-2.5">
                            {config.personPhoto && config.showPassportPhoto && (
                              <img
                                src={config.personPhoto}
                                alt={config.personName}
                                style={{
                                  width: `${config.avatarSize || 48}px`,
                                  height: `${config.avatarSize || 48}px`,
                                }}
                                className={`object-cover border-2 border-emerald-600 shadow-xs shrink-0 ${
                                  config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                                }`}
                              />
                            )}
                            <div className="min-w-0">
                              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">{config.personName}</h2>
                              <p className="text-[11px] font-bold text-emerald-700 uppercase truncate">{config.personTitle}</p>
                            </div>
                          </div>

                          <div className="space-y-1 text-[9.5px] text-slate-700 font-medium pt-1.5 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-700">📞</span>
                              <span className="font-bold text-slate-900">{config.primaryPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-600">💬</span>
                              <span>WhatsApp: <strong>{config.whatsappNumber}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 truncate">
                              <span>📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Side Emerald Geometric Ribbon (33% Width) */}
                        <div
                          className="w-4/12 bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-3.5 flex flex-col items-center justify-between"
                          style={{
                            clipPath: "polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)",
                            paddingLeft: "1.2rem",
                          }}
                        >
                          <span className="text-[9px] font-black uppercase text-amber-300">★ Pure Water</span>

                          <div className="bg-white p-1 rounded-xl shadow-md flex flex-col items-center">
                            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-14 h-14 object-contain" />}
                            <span className="text-[7px] font-black text-emerald-950 uppercase mt-0.5">Scan to Visit</span>
                          </div>

                          <span className="text-[8px] text-emerald-200 font-bold uppercase">5K - 30K Litres</span>
                        </div>
                      </div>
                    )}

                    {/* STYLE 5: EMERALD SIGNATURE (DARK LUXE) */}
                    {config.cardTheme === "emerald-dark-luxe" && (
                      <div className="w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white border-emerald-500/40">
                        <div className="absolute -right-12 -bottom-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none blur-2xl" />

                        <div className="flex items-start justify-between relative z-10">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-lg">
                              🚛
                            </div>
                            <div>
                              <h3 className="font-black text-xs sm:text-sm tracking-tight uppercase text-white">
                                {config.companyName}
                              </h3>
                              <p className="text-[9.5px] opacity-80 font-medium">{config.accreditation}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-600/40">
                            Bulk Water
                          </span>
                        </div>

                        <div className="relative z-10 my-1 flex items-center gap-2.5">
                          {config.personPhoto && config.showPassportPhoto && (
                            <img
                              src={config.personPhoto}
                              alt={config.personName}
                              style={{
                                width: `${config.avatarSize || 48}px`,
                                height: `${config.avatarSize || 48}px`,
                              }}
                              className={`object-cover border-2 border-amber-400 shadow-md ring-2 ring-emerald-500/50 shrink-0 ${
                                config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-white leading-tight truncate">{config.personName}</h2>
                            <p className="text-xs font-bold text-amber-400 uppercase truncate">{config.personTitle}</p>
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-3 relative z-10 pt-2 border-t border-white/10">
                          <div className="space-y-1 text-[9.5px] font-medium opacity-90">
                            <div className="flex items-center gap-1.5">
                              <span>📞</span>
                              <span className="font-bold">{config.primaryPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>💬</span>
                              <span>WhatsApp: <strong>{config.whatsappNumber}</strong></span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate text-[9px] opacity-75">
                              <span>📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>

                          <div className="bg-white p-1 rounded-xl shadow-md flex flex-col items-center shrink-0">
                            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-14 h-14 object-contain" />}
                            <span className="text-[7px] font-black text-slate-800 uppercase mt-0.5">Scan to Visit</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STYLE 6: MIDNIGHT OBSIDIAN (DARK GOLD) */}
                    {config.cardTheme === "obsidian-dark-gold" && (
                      <div className="w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 text-white border-slate-700">
                        <div className="flex items-start justify-between relative z-10">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                              🚛
                            </div>
                            <div>
                              <h3 className="font-black text-xs sm:text-sm tracking-tight uppercase text-white">
                                {config.companyName}
                              </h3>
                              <p className="text-[9.5px] text-slate-400 font-medium">{config.accreditation}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            Pure Water
                          </span>
                        </div>

                        <div className="relative z-10 my-1 flex items-center gap-2.5">
                          {config.personPhoto && config.showPassportPhoto && (
                            <img
                              src={config.personPhoto}
                              alt={config.personName}
                              style={{
                                width: `${config.avatarSize || 48}px`,
                                height: `${config.avatarSize || 48}px`,
                              }}
                              className={`object-cover border-2 border-emerald-400 shadow-md ring-2 ring-white/10 shrink-0 ${
                                config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                              }`}
                            />
                          )}
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-white leading-tight truncate">{config.personName}</h2>
                            <p className="text-xs font-bold text-emerald-400 uppercase truncate">{config.personTitle}</p>
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-3 relative z-10 pt-2 border-t border-white/10">
                          <div className="space-y-1 text-[9.5px] font-medium text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span>📞</span>
                              <span className="font-bold text-white">{config.primaryPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>💬</span>
                              <span>WhatsApp: {config.whatsappNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 truncate">
                              <span>📍</span>
                              <span className="truncate">{config.address}</span>
                            </div>
                          </div>

                          <div className="bg-white p-1 rounded-xl shadow-md flex flex-col items-center shrink-0">
                            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-14 h-14 object-contain" />}
                            <span className="text-[7px] font-black text-slate-900 uppercase mt-0.5">Scan to Visit</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ==========================================
                      CARD BACK SIDE: THEME-AWARE RENDERING
                     ========================================== */}
                  <div
                    ref={backCardRef}
                    className="w-full h-full rounded-2xl absolute inset-0 overflow-hidden transition-opacity duration-300"
                    style={{
                      minHeight: "295px",
                      opacity: cardSide === "back" ? 1 : 0,
                      pointerEvents: cardSide === "back" ? "auto" : "none",
                      zIndex: cardSide === "back" ? 10 : 0,
                    }}
                  >
                    {/* BACK SIDE FOR LIGHT & TWO-TONE THEMES */}
                    {currentCardTheme.category !== "dark" && (
                      <div className="w-full h-full p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xl flex flex-col justify-between bg-white text-slate-900 relative">
                        {/* Top Slogan & Mission Strip */}
                        <div className="text-center border-b border-slate-100 pb-2.5">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${currentCardTheme.accentText}`}>
                            {config.companyName}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                            "{config.tagline}"
                          </h4>
                        </div>

                        {/* Middle: 6 Key Services Checklist */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] my-2">
                          {config.services.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="text-sm shrink-0">{s.icon || "💧"}</span>
                              <span className="font-bold text-slate-800 truncate">{s.title}</span>
                            </div>
                          ))}
                        </div>

                        {/* Bottom: Fast Dispatch Callout & Website URL */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9.5px]">
                          <div>
                            <span className="block font-bold text-slate-900">⚡ Same-Day Delivery Dispatch</span>
                            <span className="text-slate-500 text-[8.5px]">5,000L to 30,000L Food-Grade Tankers</span>
                          </div>

                          <div className="text-right">
                            <span className={`block font-black text-xs ${currentCardTheme.accentText}`}>
                              {config.websiteUrl ? config.websiteUrl.replace(/^https?:\/\//, "") : "mountkenyawater.co.ke"}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">Online Booking Available</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BACK SIDE FOR DARK LUXURY THEMES */}
                    {currentCardTheme.category === "dark" && (
                      <div
                        className={`w-full h-full p-5 sm:p-6 rounded-2xl border shadow-xl flex flex-col justify-between text-white relative ${
                          config.cardTheme === "emerald-dark-luxe"
                            ? "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 border-emerald-500/40"
                            : "bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 border-slate-700"
                        }`}
                      >
                        <div className="text-center border-b border-white/10 pb-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wider block text-amber-400">
                            {config.companyName}
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                            "{config.tagline}"
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] my-2">
                          {config.services.map((s, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 border border-white/10">
                              <span className="text-sm shrink-0">{s.icon || "💧"}</span>
                              <span className="font-semibold text-white truncate">{s.title}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[9.5px]">
                          <div>
                            <span className="block font-bold text-white">⚡ Same-Day Delivery Dispatch</span>
                            <span className="opacity-75 text-[8.5px]">5,000L to 30,000L Food-Grade Tankers</span>
                          </div>

                          <div className="text-right">
                            <span className="block font-black text-xs text-amber-400">
                              {config.websiteUrl ? config.websiteUrl.replace(/^https?:\/\//, "") : "mountkenyawater.co.ke"}
                            </span>
                            <span className="opacity-75 text-[8.5px]">Online Booking Available</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------------
                TAB 2: POSTERS & FLYERS CANVAS (With Reference Geo-Split Layout)
               ------------------------------------------------------------------- */}
            {activeTab === "poster" && (
              <div className="w-full flex justify-center py-2 overflow-x-auto">
                <div
                  ref={posterRef}
                  className="w-full max-w-[500px] bg-white text-slate-900 rounded-3xl shadow-2xl relative overflow-hidden select-none flex flex-col justify-between border border-slate-200"
                  style={{
                    minHeight: config.posterSize === "a6" ? "640px" : "720px",
                  }}
                >
                  {/* STYLE A: GEO-SPLIT (Reference Match) */}
                  {config.posterLayout === "geo-split" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-white">
                      {/* Top Split */}
                      <div className="relative flex items-stretch">
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

                        <div
                          className="w-5/12 p-4 sm:p-5 relative text-white flex flex-col justify-center"
                          style={{
                            backgroundColor: currentPosterTheme.id === "emerald" ? "#064e3b" : "#2d1b33",
                            clipPath: "polygon(18% 0%, 100% 0%, 100% 100%, 0% 82%)",
                          }}
                        >
                          <div className="text-3xl sm:text-4xl font-serif text-white/30 leading-none mb-1">“</div>
                          <p className="text-[9.5px] sm:text-[10.5px] font-bold text-white/95 leading-snug tracking-tight">
                            {config.quoteText}
                          </p>
                          <span className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider text-white/60 mt-1 block">
                            {config.quoteAuthor}
                          </span>
                        </div>
                      </div>

                      {/* Middle: 4 Features + Angled Photo with Gradient */}
                      <div className="relative flex items-stretch min-h-[300px]">
                        <div className="w-6/12 p-4 sm:p-6 space-y-3 z-10 flex flex-col justify-center">
                          {config.reasons.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
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

                        <div
                          className="w-6/12 relative overflow-hidden"
                          style={{
                            clipPath: "polygon(22% 0%, 100% 0%, 100% 100%, 0% 100%)",
                          }}
                        >
                          <img
                            src={config.posterBgPhoto || PHOTO_PRESETS[0].url}
                            alt="Mount Kenya Water Truck"
                            crossOrigin="anonymous"
                            className="absolute inset-0 w-full h-full object-cover object-center"
                          />
                          <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />

                          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-xs border border-white/20 text-[8px] font-bold text-white uppercase tracking-wider">
                            Mount Kenya Fleet
                          </div>

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

                      {/* Bottom Banner */}
                      <div
                        className={`relative p-5 sm:p-6 text-white overflow-hidden ${
                          currentPosterTheme.id === "emerald"
                            ? "bg-emerald-600"
                            : currentPosterTheme.id === "royal-blue"
                            ? "bg-blue-700"
                            : currentPosterTheme.id === "obsidian-dark"
                            ? "bg-slate-900"
                            : "bg-sky-600"
                        }`}
                        style={{
                          clipPath: "polygon(0% 12%, 100% 0%, 100% 100%, 0% 100%)",
                          paddingTop: "2.2rem",
                        }}
                      >
                        <div className="mb-3 max-w-[340px]">
                          <p className="text-xs sm:text-sm font-black leading-tight text-white">
                            "{config.bottomBannerMission}"
                          </p>
                          <p className="text-[9.5px] text-white/80 font-medium mt-0.5">
                            {config.bottomBannerCta}
                          </p>
                        </div>

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

                          <div className="bg-white p-1.5 rounded-2xl shadow-xl flex flex-col items-center shrink-0 border border-white">
                            {qrDataUrl && (
                              <img
                                src={qrDataUrl}
                                alt="Website QR Code"
                                className="w-16 h-16 sm:w-18 sm:h-18 object-contain"
                              />
                            )}
                            <span className="text-[7.5px] font-black text-slate-900 tracking-tighter uppercase mt-0.5 text-center">
                              Scan to Order
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE B: PHOTO HERO */}
                  {config.posterLayout === "photo-hero" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden min-h-[680px]">
                      <img
                        src={config.posterBgPhoto || PHOTO_PRESETS[0].url}
                        alt="Water Delivery"
                        crossOrigin="anonymous"
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                      <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />

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

                        <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                          {config.reasons.map((r, i) => (
                            <div key={i} className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 backdrop-blur-md">
                              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                <span>{r.icon}</span>
                                <span className="truncate">{r.title}</span>
                              </div>
                              <p className="text-[9.5px] text-slate-300 mt-0.5 line-clamp-2">{r.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative z-10 p-5 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-3">
                        <div className="space-y-1 text-white text-xs">
                          <p className="font-black text-base sm:text-lg text-white">📞 {config.primaryPhone}</p>
                          <p className="text-[11px] text-sky-300 font-semibold">💬 WhatsApp: {config.whatsappNumber}</p>
                          <p className="text-[10px] text-slate-300">🌐 {config.websiteUrl.replace(/^https?:\/\//, "")}</p>
                          <p className="text-[9px] text-slate-400 truncate max-w-[220px]">📍 {config.address}</p>
                        </div>

                        <div className="bg-white p-1.5 rounded-2xl shadow-xl flex flex-col items-center shrink-0">
                          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-16 h-16 sm:w-18 sm:h-18 object-contain" />}
                          <span className="text-[7.5px] font-black text-slate-900 uppercase mt-0.5">Scan to Order</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STYLE C: CLEAN WHITE CORPORATE */}
                  {config.posterLayout === "clean-corporate" && (
                    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-white text-slate-900 p-6">
                      <div className="border-b pb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-sky-600 uppercase tracking-widest">{config.accreditation}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">Bulk Water Fleet</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-1">{config.companyName}</h2>
                        <p className="text-xs font-bold text-slate-500">"{config.tagline}"</p>
                      </div>

                      <div className="relative h-44 rounded-2xl overflow-hidden my-3 border border-slate-200">
                        <img src={config.posterBgPhoto || PHOTO_PRESETS[0].url} alt="Fleet" crossOrigin="anonymous" className="w-full h-full object-cover" />
                        <div className={`absolute inset-0 ${getGradientOverlayClass()}`} />
                        <div className="absolute bottom-3 left-4 text-white">
                          <p className="text-sm font-black uppercase">{config.posterHeadlineMain}</p>
                          <p className="text-[10px] text-slate-200 max-w-xs">{config.posterSubheadline}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 my-2">
                        {config.reasons.map((r, i) => (
                          <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-base">{r.icon}</span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1">{r.title}</h4>
                            <p className="text-[9.5px] text-slate-500 leading-snug mt-0.5">{r.desc}</p>
                          </div>
                        ))}
                      </div>

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

            {/* Quick Export Actions Bar Under Canvas */}
            <div className="w-full mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Download Assets:</span>
                <span className="text-xs font-black text-slate-700">
                  {activeTab === "poster" ? `Poster (${config.posterSize.toUpperCase()})` : `Card (${currentCardTheme.tag})`}
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
          {/* =====================================================================
              CARD-SPECIFIC THEME / STYLE PICKER (Only visible in Business Card tab)
             ===================================================================== */}
          {activeTab === "card" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Business Card Theme & Style
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select from clean white cardstock, two-tone split, or luxury dark styles.
                  </p>
                </div>
                <Badge color="blue">{currentCardTheme.tag}</Badge>
              </div>

              {/* Filter Tabs: All / Light & Split / Dark */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 w-full text-center">
                <button
                  type="button"
                  onClick={() => setCardFilter("all")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    cardFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({CARD_THEMES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCardFilter("light")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    cardFilter === "light" ? "bg-white text-sky-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Light & Split (4) ★
                </button>
                <button
                  type="button"
                  onClick={() => setCardFilter("dark")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    cardFilter === "dark" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Dark Luxe (2)
                </button>
              </div>

              {/* Themes Grid */}
              <div className="grid grid-cols-1 gap-2">
                {filteredCardThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateField("cardTheme", theme.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      config.cardTheme === theme.id
                        ? "border-sky-600 bg-sky-50/60 ring-1 ring-sky-600 shadow-xs"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            theme.category === "dark"
                              ? "bg-slate-900 border border-slate-700"
                              : theme.category === "mixed"
                              ? "bg-sky-500 border border-sky-400"
                              : "bg-white border-2 border-emerald-600"
                          }`}
                        />
                        <span className="font-bold text-xs text-slate-900 truncate">{theme.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
                          {theme.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{theme.description}</p>
                    </div>
                    {config.cardTheme === theme.id && <span className="text-sky-600 font-bold shrink-0">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =====================================================================
              POSTER-SPECIFIC SIZING & LAYOUT (Only visible in Posters tab)
             ===================================================================== */}
          {activeTab === "poster" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Paper Sizing & Layout Style
                </h3>
                <Badge color="blue">{config.posterSize.toUpperCase()}</Badge>
              </div>

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

          {/* Background Photo & Bottom-to-Top Gradient Settings (Posters only) */}
          {activeTab === "poster" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Background Photo & Gradient
                </h3>
                <span className="text-[10px] font-bold text-sky-600">Bottom-to-Top Transparency</span>
              </div>

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

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                  Or Upload Your Own Photo
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {config.posterBgPhoto?.startsWith("data:image/") ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={config.posterBgPhoto}
                        alt="Custom uploaded"
                        className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-800 block truncate">
                          Custom Uploaded Photo
                        </span>
                        <span className="text-[9.5px] text-emerald-600 font-semibold block">
                          ✓ Saved in browser memory (0 KB Supabase quota used)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-pointer transition-colors"
                        title="Choose a different image from device"
                      >
                        🔄 Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField("posterBgPhoto", PHOTO_PRESETS[0].url)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                        title="Delete custom photo and free space"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>📸</span>
                    <span>Upload Bowser / Site Photo</span>
                  </button>
                )}
              </div>

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

          {/* Quick Setup & Director Sync */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Quick Setup & Data Sync
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
          </div>

          {/* Cardholder Profile Customization (For Business Card) */}
          {activeTab === "card" && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Cardholder Profile
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={config.personName}
                    onChange={(e) => updateField("personName", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Job Title / Role
                  </label>
                  <input
                    type="text"
                    value={config.personTitle}
                    onChange={(e) => updateField("personTitle", e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Tagline / Company Slogan
                </label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Passport Photo / Avatar Section */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase">
                    Passport Photo / Headshot
                  </span>
                  {config.personPhoto && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={config.showPassportPhoto}
                        onChange={(e) => updateField("showPassportPhoto", e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500 h-3.5 w-3.5"
                      />
                      <span>Show on Card</span>
                    </label>
                  )}
                </div>

                <input
                  type="file"
                  ref={passportPhotoInputRef}
                  accept="image/*"
                  onChange={handlePassportPhotoUpload}
                  className="hidden"
                />

                {config.personPhoto ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    {/* Top Row: Preview, Shape Selector & Action Buttons */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={config.personPhoto}
                          alt="Passport headshot"
                          className={`w-11 h-11 object-cover border-2 border-slate-300 shadow-2xs shrink-0 ${
                            config.avatarShape === "rounded" ? "rounded-xl" : "rounded-full"
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            Passport Photo Active
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              type="button"
                              onClick={() => updateField("avatarShape", "circle")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                                config.avatarShape !== "rounded"
                                  ? "bg-sky-600 text-white shadow-2xs"
                                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Circle
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField("avatarShape", "rounded")}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition-all ${
                                config.avatarShape === "rounded"
                                  ? "bg-sky-600 text-white shadow-2xs"
                                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Rounded
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => passportPhotoInputRef.current?.click()}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-pointer transition-colors"
                          title="Replace passport photo"
                        >
                          🔄 Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField("personPhoto", "")}
                          className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer transition-colors"
                          title="Remove passport photo from card"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    </div>

                    {/* Photo Size Adjuster: Slider & Preset Chips */}
                    <div className="pt-2.5 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span>📐</span> Photo Size on Card
                        </span>
                        <span className="text-sky-700 font-mono text-[11px] font-black bg-sky-100/80 px-2 py-0.5 rounded border border-sky-300">
                          {config.avatarSize || 48}px
                        </span>
                      </div>

                      {/* Continuous Range Slider */}
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">34px</span>
                        <input
                          type="range"
                          min="34"
                          max="76"
                          step="2"
                          value={config.avatarSize || 48}
                          onChange={(e) => updateField("avatarSize", Number(e.target.value))}
                          className="flex-1 accent-sky-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        />
                        <span className="text-[10px] text-slate-400 font-bold shrink-0">76px</span>
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {[
                          { label: "Compact", size: 38 },
                          { label: "Standard", size: 48 },
                          { label: "Large", size: 58 },
                          { label: "Extra", size: 68 },
                        ].map((chip) => {
                          const isActive = (config.avatarSize || 48) === chip.size;
                          return (
                            <button
                              key={chip.size}
                              type="button"
                              onClick={() => updateField("avatarSize", chip.size)}
                              className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                                isActive
                                  ? "bg-sky-600 text-white shadow-xs"
                                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {chip.label} ({chip.size}px)
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => passportPhotoInputRef.current?.click()}
                      className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>📸</span>
                      <span>Upload Passport Photo / Headshot</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Adds an executive profile picture or badge headshot beside your name.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editable Content: 4 Reasons, Quote & Headlines (Only in Posters tab) */}
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
                Any customer pointing their smartphone camera at the card will immediately open this website.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
