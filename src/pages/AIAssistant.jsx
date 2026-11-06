import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  sendGeminiChat,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  testGeminiConnection,
} from "../services/ai/geminiClient";
import {
  buildBusinessContext,
  computeFinancialAudit,
} from "../services/ai/businessAnalyticsEngine";
import {
  detectReportIntent,
  executeReportDownload,
} from "../services/ai/reportDispatcher";
import { fmt, today, getMonthRange, getWeekRange } from "../utils/helpers";
import { getThemeById } from "../utils/dashboardThemes";

const SUGGESTED_PROMPTS = [
  {
    icon: "📊",
    label: "Today's Operations Summary",
    prompt: "Give me a summary of today's operations, including total trips, revenue, expenses, and net profit.",
  },
  {
    icon: "💰",
    label: "Month Profit & Cash Flow",
    prompt: "How much net profit have we generated this month, and what is our current financial position?",
  },
  {
    icon: "🚛",
    label: "Compare KBZ vs KBL",
    prompt: "Compare the performance of lorry KBZ and lorry KBL this month. Which one is more profitable and which had higher maintenance?",
  },
  {
    icon: "💸",
    label: "Money Sent to Boss",
    prompt: "How much money have we physically sent to the boss this month, and what is the remaining outstanding balance?",
  },
  {
    icon: "⚖️",
    label: "Why Payments Differ From Profit",
    prompt: "Explain why our actual payments sent to the boss are different from our total operating profit.",
  },
  {
    icon: "📄",
    label: "Generate Today's Trip PDF Report",
    prompt: "Generate today's trip operations PDF report so I can download it.",
  },
  {
    icon: "📑",
    label: "Generate Reconciliation Report",
    prompt: "Prepare the monthly financial reconciliation report for this month.",
  },
  {
    icon: "⚠️",
    label: "Identify High Expense Trips",
    prompt: "Identify any trips with unusually high operating expenses or missing information.",
  },
  {
    icon: "💬",
    label: "Draft WhatsApp Update to Boss",
    prompt: "Draft a concise, professional WhatsApp payment and operations update to send to the boss for today.",
  },
];

const INITIAL_GREETING = {
  id: "init-1",
  role: "assistant",
  content: `Hello! I am **Bolas AI**, your operations and business intelligence assistant for **Mount Kenya Water Distributors**.

I am connected to your live database records, including:
- 🚛 **Trips & Deliveries** (KBZ, KBL, and all active bowsers)
- 📈 **Revenue, Fuel & Operating Costs**
- 💰 **Payment Records & Transfers to Director/Boss**
- ⚖️ **Additional Deductions & Reconciliation Balances**
- 🔧 **Maintenance & Repair Logs**

How can I help you today? You can ask a financial question, compare lorry efficiency, or click one of the suggested prompts below!`,
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
};

export default function AIAssistantPage({
  trips = [],
  vehicles = [],
  paymentRecords = [],
  financialDeductions = [],
  maintenance = [],
  brokers = [],
  personnel = [],
  settings = {},
  onNavigateToSettings,
}) {
  const { profile } = useAuth();
  const themeKey = settings?.dashboardTheme || (typeof window !== "undefined" ? localStorage.getItem("wt_dashboard_theme") : "glacier") || "glacier";
  const currentTheme = getThemeById(themeKey);

  // Chat State
  const [messages, setMessages] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wt_bolas_ai_chat");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [INITIAL_GREETING];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Settings & Key Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey());
  const [selectedModel, setSelectedModel] = useState(() => getStoredModel());
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Persist chat messages
  useEffect(() => {
    if (typeof window !== "undefined" && messages.length > 0) {
      try {
        localStorage.setItem("wt_bolas_ai_chat", JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  // Check if API key is present
  const hasApiKey = Boolean(getStoredApiKey());

  // Grounding Context prepared from actual database records
  const businessContext = useMemo(() => {
    return buildBusinessContext({
      trips,
      vehicles,
      paymentRecords,
      financialDeductions,
      maintenance,
      brokers,
      personnel,
    });
  }, [trips, vehicles, paymentRecords, financialDeductions, maintenance, brokers, personnel]);

  // System instructions for Gemini AI
  const systemInstruction = `
You are Bolas AI, the executive operational and financial business intelligence assistant for Mount Kenya Water Distributors (a bulk water delivery company in Nairobi and Mount Kenya region, Kenya).

YOUR CORE RESPONSIBILITIES:
1. Provide 100% accurate, factual business answers based EXCLUSIVELY on the verified database records provided below.
2. NEVER guess, estimate, or hallucinate financial figures. If a record is missing or not recorded, explicitly say so.
3. All currency amounts MUST be displayed in KES (Kenyan Shillings, e.g. "KES 45,000").
4. Always provide a clear, short breakdown explaining how any calculated figure was derived.
5. Respect Financial Reconciliation rules:
   - Trip Operating Profit = Gross Revenue - Trip Operating Costs.
   - Additional Deductions (from financial_deductions) are deductions not already included in trips.
   - Net Payable to Boss = Operating Profit - Additional Deductions.
   - Actual Payments Sent = physical money transferred (recorded in payment_records).
   - Outstanding Balance = Net Payable - Actual Payments Sent.
6. When comparing lorries (such as KBZ vs KBL), compare their trip count, gross revenue, operating costs, fuel spend, net profit, and maintenance expenses side-by-side using a clean markdown table.
7. Tone: Professional, courteous, executive, direct, and helpful. Use clear markdown formatting (bold numbers, clean bullet lists, tables).
8. If the user asks for a report, provide the summary and tell them they can download the official PDF directly from the report card below.

GROUND TRUTH DATABASE CONTEXT:
${businessContext}
`.trim();

  // Handle Send Message
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    if (!hasApiKey) {
      setShowConfigModal(true);
      return;
    }

    const userMsg = {
      id: "u-" + Date.now(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage("");
    setLoading(true);
    setErrorStatus("");

    // Check if the user is requesting a PDF report
    const reportIntent = detectReportIntent(text);

    try {
      // Keep recent context within conversation limits (last 10 messages)
      const contextMessages = newMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const replyText = await sendGeminiChat({
        messages: contextMessages,
        systemInstruction,
        model: selectedModel,
      });

      const assistantMsg = {
        id: "a-" + Date.now(),
        role: "assistant",
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reportIntent: reportIntent || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("AI Assistant Error:", err);
      let userFriendlyError = err.message || "Failed to communicate with AI service.";

      if (err.message.includes("KEY_REQUIRED") || err.message.includes("INVALID_KEY")) {
        userFriendlyError = "Google Gemini API key is missing or invalid. Please configure your key in settings.";
        setShowConfigModal(true);
      } else if (err.message.includes("RATE_LIMIT")) {
        userFriendlyError = "Google Gemini free-tier rate limit reached (15 requests/minute). Please wait 30 seconds before sending another question.";
      }

      setErrorStatus(userFriendlyError);
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: `⚠️ **Connection Error**: ${userFriendlyError}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger report download directly
  const handleTriggerReportDownload = (report) => {
    if (!report) return;
    executeReportDownload({
      type: report.type,
      title: report.title,
      startDate: report.startDate,
      endDate: report.endDate,
      vehicleFilter: report.vehicleFilter,
      trips,
      paymentRecords,
      financialDeductions,
      vehicles,
    });
  };

  // Copy text to clipboard (e.g. WhatsApp update)
  const handleCopyText = (content, index) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 3000);
  };

  // Clear Chat History
  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to start a new chat and clear message history?")) {
      setMessages([INITIAL_GREETING]);
      if (typeof window !== "undefined") {
        localStorage.removeItem("wt_bolas_ai_chat");
      }
    }
  };

  // Test and save API Key
  const handleSaveAndTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);

    const res = await testGeminiConnection(apiKeyInput, selectedModel);
    setTestingKey(false);
    setTestResult(res);

    if (res.ok) {
      setStoredApiKey(apiKeyInput);
      setStoredModel(selectedModel);
      setTimeout(() => {
        setShowConfigModal(false);
        setTestResult(null);
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-130px)] lg:h-[calc(100vh-100px)] min-w-0 max-w-5xl mx-auto pb-2">
      {/* ── TOP HEADER DOCK ── */}
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm shrink-0 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xl sm:text-2xl shadow-md shadow-sky-500/20 shrink-0">
            🤖
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                Bolas AI
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                Operations & Finance
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
              Intelligent Business Assistant · Mount Kenya Water Distributors
            </p>
          </div>
        </div>

        {/* Actions & Connection Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              hasApiKey
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80"
            }`}
            title="Configure Gemini API Key"
          >
            <span className={`h-2 w-2 rounded-full ${hasApiKey ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}></span>
            <span>{hasApiKey ? "Gemini Ready" : "Setup Free Key"}</span>
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            title="Start new conversation"
          >
            <span>➕</span>
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            title="AI Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* ── KEY REQUIRED BANNER (If not set) ── */}
      {!hasApiKey && (
        <div className="mb-3 p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">🔑</span>
            <div>
              <p className="text-xs font-bold text-amber-900">
                Google Gemini API Key Required (100% Free Tier)
              </p>
              <p className="text-[11px] text-amber-800/80 mt-0.5">
                Connect your free Google AI Studio key to enable business intelligence, financial audits, and report generation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
          >
            Connect API Key →
          </button>
        </div>
      )}

      {/* ── CHAT MESSAGES THREAD ── */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-2 py-2 space-y-4 hide-scrollbar">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id || index}
              className={`flex gap-2.5 sm:gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Assistant Avatar */}
              {!isUser && (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-sm shadow-sm shrink-0 mt-1">
                  🤖
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 rounded-tr-xs"
                    : msg.isError
                    ? "bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs"
                    : "bg-white border border-slate-200/90 text-slate-800 shadow-xs rounded-tl-xs"
                }`}
              >
                {/* Message Content */}
                <div className="prose prose-sm max-w-none space-y-2 break-words">
                  {msg.content.split("\n\n").map((paragraph, pIdx) => {
                    // Check if paragraph is a table or list
                    if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
                      const items = paragraph.split("\n").filter(Boolean);
                      return (
                        <ul key={pIdx} className="list-disc pl-4 space-y-1">
                          {items.map((item, itemIdx) => (
                            <li key={itemIdx}>
                              {item.replace(/^[-*]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={pIdx} className="leading-relaxed whitespace-pre-wrap">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>

                {/* Interactive Report Download Card (If message prepares a report) */}
                {msg.reportIntent && (
                  <div className="mt-3.5 p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-xl bg-sky-600 text-white flex items-center justify-center text-base shrink-0">
                        📄
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {msg.reportIntent.title}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Period: {msg.reportIntent.startDate} to {msg.reportIntent.endDate}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTriggerReportDownload(msg.reportIntent)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <span>📥</span>
                      <span>Download PDF</span>
                    </button>
                  </div>
                )}

                {/* Timestamp & Copy Action */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{msg.timestamp}</span>
                  {!isUser && !msg.isError && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(msg.content, index)}
                      className="hover:text-slate-700 cursor-pointer flex items-center gap-1"
                      title="Copy response"
                    >
                      <span>{copiedIndex === index ? "✓ Copied" : "📋 Copy"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-2xl bg-slate-800 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-1">
                  {profile?.name?.charAt(0) || "U"}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 justify-start items-center animate-pulse">
            <div className="h-8 w-8 rounded-2xl bg-sky-500 text-white flex items-center justify-center text-sm shadow-xs">
              🤖
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-500 flex items-center gap-2 shadow-2xs">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-600 animate-ping"></span>
              <span>Bolas AI is analyzing live database records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── SUGGESTED PROMPTS BAR (Carousel) ── */}
      <div className="pt-2 pb-2 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
          💡 Suggested Questions & Actions
        </p>
        <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
          {SUGGESTED_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item.prompt)}
              disabled={loading}
              className="snap-start shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200/90 shadow-2xs hover:border-sky-300 hover:text-sky-900 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── INPUT BAR DOCK ── */}
      <div className="p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-lg shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              hasApiKey
                ? "Ask Bolas AI about trips, profits, payments, or request a PDF report..."
                : "Enter Gemini API key to activate Bolas AI..."
            }
            disabled={loading}
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <span>Ask</span>
            <span className="text-xs">➤</span>
          </button>
        </form>
      </div>

      {/* ── API KEY & SETTINGS MODAL ── */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔑</span>
                <h3 className="text-base font-bold text-slate-900">
                  Google Gemini AI Configuration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 text-sky-900 leading-relaxed">
                <p className="font-bold">✨ Free Tier Supported</p>
                <p className="text-[11px] text-sky-800 mt-1">
                  Google Gemini 2.0 Flash is available free of charge with up to 1,500 requests per day. You can get an API key with zero payment required from Google AI Studio.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 font-black text-sky-700 underline hover:text-sky-900"
                >
                  Get Free API Key on Google AI Studio ↗
                </a>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  AI Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest & Free Tier Recommended)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Reliable Fallback)</option>
                </select>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    testResult.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {testResult.ok ? "✓ Connection successful! Model ready." : `✕ ${testResult.error}`}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndTestKey}
                  disabled={testingKey || !apiKeyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>{testingKey ? "Testing..." : "Test & Save Key"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
