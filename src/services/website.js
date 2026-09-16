import { supabase } from "./supabase";

const DEFAULT_WEBSITE_DATA = {
  general: {
    companyName: "Mount Kenya Water Distributors",
    tagline: "Pure, Reliable Bulk Water Delivery Across Mount Kenya & Nairobi Region",
    description: "Kenya's leading clean bulk water delivery service. Providing pristine, food-grade certified water for residential, commercial, industrial, and emergency requirements 24/7 with our modern tanker fleet.",
    badgeText: "24/7 Fast Dispatch Available",
    stats: [
      { label: "Liters Delivered", value: "25M+" },
      { label: "Dedicated Tankers", value: "18+" },
      { label: "Satisfied Clients", value: "3,500+" },
      { label: "On-Time Delivery", value: "99.8%" }
    ],
    operatingHours: "24 Hours / 7 Days a Week",
    licenseInfo: "Licensed by KEBS & Ministry of Water & Sanitation"
  },
  contacts: {
    primaryPhone: "+254 712 345 678",
    secondaryPhone: "+254 722 987 654",
    whatsappNumber: "254712345678",
    email: "info@mountkenyawater.co.ke",
    address: "Mount Kenya Water Distribution Depot, Thika Road / Ruiru Bypass, Kenya",
    googleMapsUrl: "https://maps.google.com"
  },
  services: [
    {
      id: "bulk-clean-water",
      title: "Clean Bulk Drinking Water",
      icon: "💧",
      description: "Tested and certified food-grade water delivered in clean stainless steel tankers for homes, estates, apartments, and hotels.",
      popular: true,
      capacities: "5,000L – 20,000L"
    },
    {
      id: "construction-water",
      title: "Construction & Site Water",
      icon: "🏗️",
      description: "High-volume water supply for concrete batching, dust suppression, soil compaction, and commercial construction projects.",
      popular: false,
      capacities: "10,000L – 30,000L"
    },
    {
      id: "emergency-supply",
      title: "Emergency 24/7 Water Supply",
      icon: "🚨",
      description: "Rapid response delivery for hospitals, institutions, factories, and schools facing municipal water shortages.",
      popular: false,
      capacities: "Guaranteed express dispatch within 90 mins"
    },
    {
      id: "pool-filling",
      title: "Swimming Pool Filling",
      icon: "🏊",
      description: "Crystal clear water pumped directly into residential and commercial swimming pools with specialized high-pressure hoses.",
      popular: false,
      capacities: "Single or multi-trip deliveries"
    },
    {
      id: "commercial-industrial",
      title: "Commercial & Industrial Supply",
      icon: "🏭",
      description: "Scheduled daily, weekly, or monthly bulk water contracts for manufacturing plants, breweries, car washes, and floriculture.",
      popular: false,
      capacities: "Custom scheduled contracts"
    },
    {
      id: "bowser-leasing",
      title: "Water Bowser / Tanker Leasing",
      icon: "🚛",
      description: "Short and long-term water bowser rentals with experienced certified drivers and pumping equipment.",
      popular: false,
      capacities: "Daily, weekly, or monthly rates"
    }
  ],
  locations: [
    {
      id: "nairobi",
      name: "Nairobi County",
      subzones: "Westlands, Kilimani, Karen, Roysambu, Kasarani, Embakasi, Langata, Parklands",
      turnaround: "1 – 2 hours",
      featured: true
    },
    {
      id: "kiambu",
      name: "Kiambu & Ruiru",
      subzones: "Ruiru, Thika Road, Kiambu Town, Kikuyu, Limuru, Juja, Kahawa Sukari",
      turnaround: "45 – 90 mins",
      featured: true
    },
    {
      id: "thika",
      name: "Thika & Murang'a",
      subzones: "Thika Town, Makongeni, Kenol, Maragua, Murang'a Town, Kandara",
      turnaround: "1 – 2 hours",
      featured: true
    },
    {
      id: "nyeri-mtkenya",
      name: "Nyeri & Mount Kenya Region",
      subzones: "Nyeri, Karatina, Nanyuki, Othaya, Mukurweini, Timau",
      turnaround: "Scheduled & Express",
      featured: true
    },
    {
      id: "machakos-athi",
      name: "Machakos & Athi River",
      subzones: "Mlolongo, Athi River, Syokimau, Kitengela, Machakos Junction",
      turnaround: "2 – 3 hours",
      featured: false
    }
  ],
  photos: [
    {
      id: "photo-1",
      url: "https://images.unsplash.com/photo-1541888946425-d0fbb186c5f9?auto=format&fit=crop&w=1200&q=80",
      caption: "Heavy-duty 20,000L clean water delivery tanker on transit",
      category: "Fleet"
    },
    {
      id: "photo-2",
      url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80",
      caption: "High pressure pumping equipment for high-rise residential & commercial storage",
      category: "Operations"
    },
    {
      id: "photo-3",
      url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
      caption: "Pristine natural mountain water catchment and processing source",
      category: "Sources"
    },
    {
      id: "photo-4",
      url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
      caption: "Regular sanitation & quality testing of stainless steel food-grade tanks",
      category: "Quality"
    },
    {
      id: "photo-5",
      url: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=1200&q=80",
      caption: "Bulk water delivery directly to construction site batching plant",
      category: "Operations"
    },
    {
      id: "photo-6",
      url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80",
      caption: "Dedicated bowser fleet stationed for rapid 24/7 emergency dispatch",
      category: "Fleet"
    }
  ]
};

const STORAGE_KEY = "wt_website_cms_data";
const INQUIRIES_KEY = "wt_customer_inquiries";

export const websiteService = {
  // Get website content with cache fallback
  getContent: async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "website_content")
        .single();

      if (!error && data?.value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value));
        return data.value;
      }
    } catch (e) {
      console.warn("Could not fetch remote website content, using local fallback:", e);
    }

    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try { return JSON.parse(local); } catch (e) { /* ignore */ }
    }
    return DEFAULT_WEBSITE_DATA;
  },

  // Subscribe to real-time website updates
  subscribe: (callback) => {
    // Initial call from local or defaults
    const initial = localStorage.getItem(STORAGE_KEY);
    callback(initial ? JSON.parse(initial) : DEFAULT_WEBSITE_DATA);

    // Fetch latest
    websiteService.getContent().then(callback);

    const channel = supabase
      .channel("public:settings:website_content")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: "key=eq.website_content" },
        (payload) => {
          if (payload.new && payload.new.value) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.new.value));
            callback(payload.new.value);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  // Update website content (Admin)
  saveContent: async (newContent) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newContent));

    const { data: existing } = await supabase
      .from("settings")
      .select("key")
      .eq("key", "website_content")
      .single();

    if (!existing) {
      const { error } = await supabase.from("settings").insert({
        key: "website_content",
        value: newContent
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("settings")
        .update({ value: newContent, updated_at: new Date().toISOString() })
        .eq("key", "website_content");
      if (error) throw error;
    }
  },

  // Reset to rich defaults
  resetToDefaults: async () => {
    await websiteService.saveContent(DEFAULT_WEBSITE_DATA);
    return DEFAULT_WEBSITE_DATA;
  },

  // Customer Inquiries / Online Orders
  submitInquiry: async (inquiryData) => {
    const inquiry = {
      id: "inq_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
      status: "New", // New | Contacted | Fulfilled | Cancelled
      ...inquiryData
    };

    // Save locally
    const existing = websiteService.getInquiries();
    const updated = [inquiry, ...existing];
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));

    // Try saving to Supabase settings for inquiries sync
    try {
      const { data: remote } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "customer_inquiries")
        .single();

      const remoteList = Array.isArray(remote?.value) ? remote.value : [];
      const merged = [inquiry, ...remoteList.filter(i => i.id !== inquiry.id)].slice(0, 100);

      if (!remote) {
        await supabase.from("settings").insert({ key: "customer_inquiries", value: merged });
      } else {
        await supabase.from("settings").update({ value: merged }).eq("key", "customer_inquiries");
      }
    } catch (e) {
      console.warn("Could not sync inquiry to Supabase:", e.message);
    }

    return inquiry;
  },

  getInquiries: () => {
    const local = localStorage.getItem(INQUIRIES_KEY);
    if (local) {
      try { return JSON.parse(local); } catch (e) { /* ignore */ }
    }
    return [];
  },

  subscribeInquiries: (callback) => {
    callback(websiteService.getInquiries());

    supabase
      .from("settings")
      .select("value")
      .eq("key", "customer_inquiries")
      .single()
      .then(({ data }) => {
        if (Array.isArray(data?.value)) {
          localStorage.setItem(INQUIRIES_KEY, JSON.stringify(data.value));
          callback(data.value);
        }
      });

    const channel = supabase
      .channel("public:settings:customer_inquiries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: "key=eq.customer_inquiries" },
        (payload) => {
          if (Array.isArray(payload.new?.value)) {
            localStorage.setItem(INQUIRIES_KEY, JSON.stringify(payload.new.value));
            callback(payload.new.value);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  updateInquiryStatus: async (inquiryId, status) => {
    const list = websiteService.getInquiries().map(item =>
      item.id === inquiryId ? { ...item, status } : item
    );
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));

    try {
      await supabase
        .from("settings")
        .update({ value: list })
        .eq("key", "customer_inquiries");
    } catch (e) {
      console.warn("Error updating inquiry status:", e);
    }
  },

  deleteInquiry: async (inquiryId) => {
    const list = websiteService.getInquiries().filter(item => item.id !== inquiryId);
    localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));

    try {
      await supabase
        .from("settings")
        .update({ value: list })
        .eq("key", "customer_inquiries");
    } catch (e) {
      console.warn("Error deleting inquiry:", e);
    }
  }
};
