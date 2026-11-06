import { supabase } from "./supabase";

const DEFAULT_WEBSITE_DATA = {
  general: {
    companyName: "Mount Kenya Water Distributors",
    tagline: "Bulk water delivery, arranged around your site.",
    description: "Mount Kenya Water Distributors supplies water by tanker for homes, businesses and construction sites across the Mount Kenya and Nairobi region. Contact dispatch to confirm availability, volume and delivery timing.",
    badgeText: "Water delivery · Mount Kenya & Nairobi",
    stats: [],
    operatingHours: "Contact dispatch for availability",
    licenseInfo: "Ask dispatch for current source and quality documentation."
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
      description: "Bulk water delivery for homes, apartments, hotels and residential estates. Share your location and requested volume for a quote.",
      popular: true,
      capacities: "5,000L – 20,000L"
    },
    {
      id: "construction-water",
      title: "Construction & Site Water",
      icon: "🏗️",
      description: "Water supply for construction sites and infrastructure work. Tell us about site access, intended use and expected volume.",
      popular: false,
      capacities: "10,000L – 30,000L"
    },
    {
      id: "emergency-supply",
      title: "Urgent Water Supply",
      icon: "🚨",
      description: "Contact dispatch for urgent requirements at homes, institutions and business sites. Availability and timing depend on location and fleet schedule.",
      popular: false,
      capacities: "Confirm timing with dispatch"
    },
    {
      id: "pool-filling",
      title: "Swimming Pool Filling",
      icon: "🏊",
      description: "Arrange a pool fill and include the pool capacity, access details and preferred delivery date in your request.",
      popular: false,
      capacities: "Single or multi-trip deliveries"
    },
    {
      id: "commercial-industrial",
      title: "Commercial & Industrial Supply",
      icon: "🏭",
      description: "Discuss regular bulk supply for a commercial or industrial site with dispatch. Schedules are confirmed by route and availability.",
      popular: false,
      capacities: "Custom scheduled contracts"
    },
    {
      id: "bowser-leasing",
      title: "Water Bowser / Tanker Leasing",
      icon: "🚛",
      description: "Ask dispatch about vehicle availability for your route, timing and site requirements.",
      popular: false,
      capacities: "Daily, weekly, or monthly rates"
    }
  ],
  locations: [
    {
      id: "nairobi",
      name: "Nairobi County",
      subzones: "Westlands, Kilimani, Karen, Roysambu, Kasarani, Embakasi, Langata, Parklands",
      turnaround: "Confirm with dispatch",
      featured: true
    },
    {
      id: "kiambu",
      name: "Kiambu & Ruiru",
      subzones: "Ruiru, Thika Road, Kiambu Town, Kikuyu, Limuru, Juja, Kahawa Sukari",
      turnaround: "Confirm with dispatch",
      featured: true
    },
    {
      id: "thika",
      name: "Thika & Murang'a",
      subzones: "Thika Town, Makongeni, Kenol, Maragua, Murang'a Town, Kandara",
      turnaround: "Confirm with dispatch",
      featured: true
    },
    {
      id: "nyeri-mtkenya",
      name: "Nyeri & Mount Kenya Region",
      subzones: "Nyeri, Karatina, Nanyuki, Othaya, Mukurweini, Timau",
      turnaround: "Confirm with dispatch",
      featured: true
    },
    {
      id: "machakos-athi",
      name: "Machakos & Athi River",
      subzones: "Mlolongo, Athi River, Syokimau, Kitengela, Machakos Junction",
      turnaround: "Confirm with dispatch",
      featured: false
    }
  ],
  photos: []
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
