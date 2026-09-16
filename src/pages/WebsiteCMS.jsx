import { useState, useEffect } from "react";
import { websiteService } from "../services/website";
import { Badge, Modal } from "../components/ui";

export default function WebsiteCMS({ onPreviewWebsite }) {
  const [content, setContent] = useState(null);
  const [activeTab, setActiveTab] = useState("inquiries");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [inquiryFilter, setInquiryFilter] = useState("all");

  // Modals for editing lists
  const [serviceModal, setServiceModal] = useState({ open: false, item: null });
  const [locationModal, setLocationModal] = useState({ open: false, item: null });
  const [photoModal, setPhotoModal] = useState({ open: false, item: null });

  useEffect(() => {
    const unsubContent = websiteService.subscribe((data) => {
      setContent(data);
    });
    setInquiries(websiteService.getInquiries());
    return () => unsubContent();
  }, []);

  if (!content) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="text-3xl mb-2 animate-spin">⏳</div>
        <p>Loading Website CMS…</p>
      </div>
    );
  }

  const handleSaveAll = async (updatedContent = content) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await websiteService.saveContent(updatedContent);
      setContent(updatedContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save changes to server. Saved locally as fallback.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm("Are you sure you want to reset all website content to standard Mount Kenya Water Distributors defaults?")) {
      return;
    }
    setSaving(true);
    try {
      const def = await websiteService.resetToDefaults();
      setContent(def);
      alert("Website content reset to factory defaults.");
    } catch (err) {
      console.error(err);
      alert("Could not reset defaults.");
    } finally {
      setSaving(false);
    }
  };

  // Inquiries Actions
  const handleUpdateInquiryStatus = (id, newStatus) => {
    const updated = websiteService.updateInquiryStatus(id, newStatus);
    setInquiries(updated);
  };

  const handleDeleteInquiry = (id) => {
    if (!window.confirm("Are you sure you want to delete this customer inquiry?")) return;
    const updated = websiteService.deleteInquiry(id);
    setInquiries(updated);
  };

  const filteredInquiries = inquiries.filter(inq => {
    if (inquiryFilter === "all") return true;
    return (inq.status || "New").toLowerCase() === inquiryFilter.toLowerCase();
  });

  const newInquiriesCount = inquiries.filter(i => (i.status || "New") === "New").length;

  // Services CRUD
  const handleSaveService = (serviceData) => {
    let updatedServices;
    if (serviceModal.item && serviceModal.item.id) {
      updatedServices = content.services.map(s => s.id === serviceModal.item.id ? { ...s, ...serviceData } : s);
    } else {
      const newSvc = {
        id: "svc-" + Date.now(),
        ...serviceData
      };
      updatedServices = [...content.services, newSvc];
    }
    const updated = { ...content, services: updatedServices };
    setContent(updated);
    handleSaveAll(updated);
    setServiceModal({ open: false, item: null });
  };

  const handleDeleteService = (id) => {
    if (!window.confirm("Are you sure you want to remove this service?")) return;
    const updated = { ...content, services: content.services.filter(s => s.id !== id) };
    setContent(updated);
    handleSaveAll(updated);
  };

  // Locations CRUD
  const handleSaveLocation = (locData) => {
    let updatedLocations;
    if (locationModal.item && locationModal.item.id) {
      updatedLocations = content.locations.map(l => l.id === locationModal.item.id ? { ...l, ...locData } : l);
    } else {
      const newLoc = {
        id: "loc-" + Date.now(),
        ...locData
      };
      updatedLocations = [...content.locations, newLoc];
    }
    const updated = { ...content, locations: updatedLocations };
    setContent(updated);
    handleSaveAll(updated);
    setLocationModal({ open: false, item: null });
  };

  const handleDeleteLocation = (id) => {
    if (!window.confirm("Are you sure you want to remove this location?")) return;
    const updated = { ...content, locations: content.locations.filter(l => l.id !== id) };
    setContent(updated);
    handleSaveAll(updated);
  };

  // Photos CRUD
  const handleSavePhoto = (photoData) => {
    let updatedPhotos;
    if (photoModal.item && photoModal.item.id) {
      updatedPhotos = content.photos.map(p => p.id === photoModal.item.id ? { ...p, ...photoData } : p);
    } else {
      const newPhoto = {
        id: "photo-" + Date.now(),
        ...photoData
      };
      updatedPhotos = [...content.photos, newPhoto];
    }
    const updated = { ...content, photos: updatedPhotos };
    setContent(updated);
    handleSaveAll(updated);
    setPhotoModal({ open: false, item: null });
  };

  const handleDeletePhoto = (id) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;
    const updated = { ...content, photos: content.photos.filter(p => p.id !== id) };
    setContent(updated);
    handleSaveAll(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800">
              Official Website CMS
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              Live Editor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage public website branding, contact numbers, services, delivery zones, photo gallery, and online tanker orders.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onPreviewWebsite && (
            <button
              onClick={onPreviewWebsite}
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>👁️</span>
              <span>Preview Live Site</span>
            </button>
          )}

          <button
            onClick={() => handleSaveAll(content)}
            disabled={saving}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>💾</span>
            <span>{saving ? "Saving…" : "Save All Changes"}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold px-4 py-3 rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
          <span>✓</span>
          <span>Website content updated successfully and published to visitors!</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("inquiries")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "inquiries"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📬 Customer Inquiries</span>
          {newInquiriesCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === "inquiries" ? "bg-white text-emerald-800" : "bg-rose-500 text-white"}`}>
              {newInquiriesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "branding"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>🏢 Branding & Info</span>
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "contacts"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📞 Contacts & WhatsApp</span>
        </button>

        <button
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "services"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>💧 Services ({content.services?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("locations")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "locations"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📍 Coverage & Zones ({content.locations?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("photos")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "photos"
              ? "bg-emerald-600 text-white shadow"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📸 Gallery ({content.photos?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: CUSTOMER INQUIRIES */}
      {activeTab === "inquiries" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Status:</span>
              {["all", "New", "Contacted", "Fulfilled", "Cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => setInquiryFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inquiryFilter.toLowerCase() === st.toLowerCase()
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing {filteredInquiries.length} of {inquiries.length} inquiries
            </div>
          </div>

          {filteredInquiries.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <div className="text-4xl mb-3">📬</div>
              <h3 className="text-base font-bold text-slate-700">No Inquiries Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Customer tanker requests submitted via the public website will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredInquiries.map((inq) => {
                const isNew = (inq.status || "New") === "New";
                const isFulfilled = inq.status === "Fulfilled";
                const cleanPhone = (inq.phoneNumber || "").replace(/[^0-9]/g, "");

                return (
                  <div
                    key={inq.id}
                    className={`bg-white rounded-2xl p-5 border transition-all shadow-sm ${
                      isNew
                        ? "border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/20"
                        : "border-slate-100"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-800">
                            {inq.customerName}
                          </h3>
                          <Badge
                            color={
                              inq.status === "Fulfilled" ? "green" :
                              inq.status === "Contacted" ? "blue" :
                              inq.status === "Cancelled" ? "slate" : "amber"
                            }
                          >
                            {inq.status || "New"}
                          </Badge>
                          {inq.urgency?.includes("Emergency") && (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                              🚨 Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Received: {new Date(inq.created_at).toLocaleString()} • Ref: #{inq.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Select */}
                        <select
                          value={inq.status || "New"}
                          onChange={(e) => handleUpdateInquiryStatus(inq.id, e.target.value)}
                          className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="New">Status: New</option>
                          <option value="Contacted">Status: Contacted</option>
                          <option value="Fulfilled">Status: Fulfilled</option>
                          <option value="Cancelled">Status: Cancelled</option>
                        </select>

                        <button
                          onClick={() => handleDeleteInquiry(inq.id)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 text-xs transition-colors cursor-pointer"
                          title="Delete inquiry"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3.5 text-xs mb-3 border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Location:</span>
                        <span className="font-extrabold text-slate-800">{inq.deliveryLocation}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Service & Volume:</span>
                        <span className="font-bold text-slate-800">{inq.volume} — {inq.serviceType}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block uppercase text-[10px]">Urgency:</span>
                        <span className="font-semibold text-slate-700">{inq.urgency}</span>
                      </div>
                    </div>

                    {inq.notes && (
                      <div className="mb-3 text-xs bg-amber-50/60 border border-amber-200/60 text-amber-900 rounded-xl p-2.5">
                        <span className="font-bold">Customer Notes: </span> {inq.notes}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                        <span>📞 {inq.phoneNumber}</span>
                        {inq.whatsappNumber && inq.whatsappNumber !== inq.phoneNumber && (
                          <span>💬 WA: {inq.whatsappNumber}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${inq.phoneNumber}`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>Call</span>
                        </a>

                        <a
                          href={`https://wa.me/${cleanPhone.startsWith("0") ? "254" + cleanPhone.substring(1) : cleanPhone}?text=${encodeURIComponent(
                            `Hello ${inq.customerName}, regarding your Mount Kenya Water Distributors request for ${inq.volume} at ${inq.deliveryLocation}...`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                        >
                          <span>💬</span>
                          <span>Chat on WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BRANDING & GENERAL INFO */}
      {activeTab === "branding" && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-800">Company Identity & Hero Section</h3>
            <p className="text-xs text-slate-400 mt-0.5">Control the primary branding and value proposition displayed on the landing page.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Company Legal Name
              </label>
              <input
                type="text"
                value={content.general.companyName}
                onChange={e => setContent({ ...content, general: { ...content.general, companyName: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Hero Top Badge Text
              </label>
              <input
                type="text"
                value={content.general.badgeText}
                onChange={e => setContent({ ...content, general: { ...content.general, badgeText: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Hero Tagline / Headline
            </label>
            <input
              type="text"
              value={content.general.tagline}
              onChange={e => setContent({ ...content, general: { ...content.general, tagline: e.target.value } })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Company Description / Mission Statement
            </label>
            <textarea
              rows={3}
              value={content.general.description}
              onChange={e => setContent({ ...content, general: { ...content.general, description: e.target.value } })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Operating Hours
              </label>
              <input
                type="text"
                value={content.general.operatingHours}
                onChange={e => setContent({ ...content, general: { ...content.general, operatingHours: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Compliance / License Statement
              </label>
              <input
                type="text"
                value={content.general.licenseInfo}
                onChange={e => setContent({ ...content, general: { ...content.general, licenseInfo: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Stats Editor */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Counter Statistics Strip (4 Key Metrics)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {content.general.stats?.map((stat, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Metric Label</label>
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => {
                      const newStats = [...content.general.stats];
                      newStats[idx].label = e.target.value;
                      setContent({ ...content, general: { ...content.general, stats: newStats } });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold mb-2"
                  />
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Display Value</label>
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => {
                      const newStats = [...content.general.stats];
                      newStats[idx].value = e.target.value;
                      setContent({ ...content, general: { ...content.general, stats: newStats } });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-black text-emerald-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={handleResetDefaults}
              className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
            >
              ⚠️ Reset Site to Default Content
            </button>
            <button
              onClick={() => handleSaveAll(content)}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer"
            >
              {saving ? "Saving…" : "Save Branding Changes"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: CONTACTS & WHATSAPP */}
      {activeTab === "contacts" && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-extrabold text-slate-800">Dispatch Lines & Direct Order Channels</h3>
            <p className="text-xs text-slate-400 mt-0.5">Configure hotline numbers, official WhatsApp order line, and physical address.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Primary Dispatch Phone *
              </label>
              <input
                type="text"
                value={content.contacts.primaryPhone}
                onChange={e => setContent({ ...content, contacts: { ...content.contacts, primaryPhone: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Secondary / Alternative Hotline
              </label>
              <input
                type="text"
                value={content.contacts.secondaryPhone}
                onChange={e => setContent({ ...content, contacts: { ...content.contacts, secondaryPhone: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                WhatsApp Order Line (Number only, with country code, e.g. 254712345678) *
              </label>
              <input
                type="text"
                value={content.contacts.whatsappNumber}
                onChange={e => setContent({ ...content, contacts: { ...content.contacts, whatsappNumber: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Customers clicking "WhatsApp Order" will be routed to this line.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Email Address
              </label>
              <input
                type="email"
                value={content.contacts.email}
                onChange={e => setContent({ ...content, contacts: { ...content.contacts, email: e.target.value } })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Depot / Physical Address
            </label>
            <input
              type="text"
              value={content.contacts.address}
              onChange={e => setContent({ ...content, contacts: { ...content.contacts, address: e.target.value } })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => handleSaveAll(content)}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer"
            >
              {saving ? "Saving…" : "Save Contact Details"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: SERVICES */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Services Catalog</h3>
              <p className="text-xs text-slate-400">Offerings shown on the public site and inquiry form dropdown.</p>
            </div>
            <button
              onClick={() => setServiceModal({ open: true, item: null })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span>＋</span>
              <span>Add New Service</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.services?.map((svc) => (
              <div key={svc.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 rounded-xl bg-slate-100">{svc.icon}</span>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{svc.title}</h4>
                        <span className="text-xs font-bold text-emerald-600">{svc.capacities}</span>
                      </div>
                    </div>
                    {svc.popular && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                        ★ Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2 mb-4">
                    {svc.description}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setServiceModal({ open: true, item: svc })}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(svc.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: COVERAGE & LOCATIONS */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Coverage Zones & Turnaround</h3>
              <p className="text-xs text-slate-400">Regions serviced by our water tankers and average arrival times.</p>
            </div>
            <button
              onClick={() => setLocationModal({ open: true, item: null })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span>＋</span>
              <span>Add Coverage Zone</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.locations?.map((loc) => (
              <div key={loc.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📍</span>
                      <h4 className="font-extrabold text-slate-800 text-sm">{loc.name}</h4>
                    </div>
                    <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-black px-2.5 py-0.5 rounded-lg">
                      ⏱️ {loc.turnaround}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2 mb-4">
                    <strong className="text-slate-700">Subzones:</strong> {loc.subzones}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setLocationModal({ open: true, item: loc })}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: PHOTO GALLERY */}
      {activeTab === "photos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Fleet & Operations Gallery</h3>
              <p className="text-xs text-slate-400">Photos displayed on the public gallery section.</p>
            </div>
            <button
              onClick={() => setPhotoModal({ open: true, item: null })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
            >
              <span>＋</span>
              <span>Add New Photo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {content.photos?.map((photo) => (
              <div key={photo.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="relative h-44 bg-slate-100">
                    <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {photo.category}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                      {photo.caption}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-100 bg-slate-50/50">
                  <button
                    onClick={() => setPhotoModal({ open: true, item: photo })}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SERVICE MODAL */}
      <Modal
        open={serviceModal.open}
        onClose={() => setServiceModal({ open: false, item: null })}
        title={serviceModal.item ? "Edit Service" : "Add New Service"}
      >
        <ServiceForm
          initial={serviceModal.item}
          onSave={handleSaveService}
          onCancel={() => setServiceModal({ open: false, item: null })}
        />
      </Modal>

      {/* LOCATION MODAL */}
      <Modal
        open={locationModal.open}
        onClose={() => setLocationModal({ open: false, item: null })}
        title={locationModal.item ? "Edit Coverage Zone" : "Add Coverage Zone"}
      >
        <LocationForm
          initial={locationModal.item}
          onSave={handleSaveLocation}
          onCancel={() => setLocationModal({ open: false, item: null })}
        />
      </Modal>

      {/* PHOTO MODAL */}
      <Modal
        open={photoModal.open}
        onClose={() => setPhotoModal({ open: false, item: null })}
        title={photoModal.item ? "Edit Photo" : "Add Gallery Photo"}
      >
        <PhotoForm
          initial={photoModal.item}
          onSave={handleSavePhoto}
          onCancel={() => setPhotoModal({ open: false, item: null })}
        />
      </Modal>
    </div>
  );
}

// Sub-components for forms inside modals
function ServiceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    icon: initial?.icon || "💧",
    description: initial?.description || "",
    capacities: initial?.capacities || "5,000L – 20,000L",
    popular: initial?.popular || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title) return alert("Service title is required.");
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Service Title *</label>
        <input
          type="text"
          required
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="e.g. Clean Bulk Drinking Water"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Emoji / Icon</label>
          <input
            type="text"
            value={form.icon}
            onChange={e => setForm({ ...form, icon: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
            placeholder="e.g. 💧, 🏗️, 🚨"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Capacity Badge</label>
          <input
            type="text"
            value={form.capacities}
            onChange={e => setForm({ ...form, capacities: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
            placeholder="e.g. 10,000L – 30,000L"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="Short service explanation..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="popularSvc"
          checked={form.popular}
          onChange={e => setForm({ ...form, popular: e.target.checked })}
          className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
        />
        <label htmlFor="popularSvc" className="text-xs font-bold text-slate-700">
          Mark as "Most Requested" / Popular highlight
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow">
          Save Service
        </button>
      </div>
    </form>
  );
}

function LocationForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    subzones: initial?.subzones || "",
    turnaround: initial?.turnaround || "1 – 2 hours",
    featured: initial?.featured ?? true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return alert("Location name is required.");
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Region / Location Name *</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="e.g. Kiambu & Ruiru"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Average Turnaround Time</label>
        <input
          type="text"
          value={form.turnaround}
          onChange={e => setForm({ ...form, turnaround: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="e.g. 45 – 90 mins"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Subzones / Estates Covered</label>
        <textarea
          rows={3}
          value={form.subzones}
          onChange={e => setForm({ ...form, subzones: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="e.g. Ruiru, Thika Road, Kiambu Town, Kikuyu..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow">
          Save Zone
        </button>
      </div>
    </form>
  );
}

function PhotoForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    url: initial?.url || "",
    caption: initial?.caption || "",
    category: initial?.category || "Fleet"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.url) return alert("Image URL is required.");
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Image URL *</label>
        <input
          type="url"
          required
          value={form.url}
          onChange={e => setForm({ ...form, url: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="https://images.unsplash.com/..."
        />
      </div>

      {form.url && (
        <div className="h-32 bg-slate-100 rounded-xl overflow-hidden">
          <img src={form.url} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
        <select
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <option value="Fleet">Fleet</option>
          <option value="Operations">Operations</option>
          <option value="Sources">Sources</option>
          <option value="Quality">Quality & Sanitization</option>
          <option value="General">General</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Photo Caption</label>
        <input
          type="text"
          value={form.caption}
          onChange={e => setForm({ ...form, caption: e.target.value })}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
          placeholder="e.g. 20,000L clean water delivery tanker on transit"
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow">
          Save Photo
        </button>
      </div>
    </form>
  );
}
