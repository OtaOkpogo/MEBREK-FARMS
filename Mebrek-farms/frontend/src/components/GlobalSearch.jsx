import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../services/searchService";

function highlightText(text, search) {
  if (!text) return "";

  if (!search || search.trim() === "") {
    return text;
  }

  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = String(text).split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-300 text-black rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function SearchSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200"></div>
        <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin"></div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <span className="font-medium text-gray-700">
          Searching farm records
        </span>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"></span>
          <span
            className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"
            style={{ animationDelay: ".15s" }}
          ></span>
          <span
            className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"
            style={{ animationDelay: ".30s" }}
          ></span>
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-1">
        Workers • Production • Sales • Feed • Inventory • Notifications
      </p>
    </div>
  );
}

function SectionHeader({ icon, title, count }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
          {title}
        </span>
      </div>

      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full ${
          count > 10
            ? "bg-red-100 text-red-700"
            : count > 5
              ? "bg-yellow-100 text-yellow-700"
              : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

export default function GlobalSearch() {
  const navigate = useNavigate();

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const selectedRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    workers: [],
    production: [],
    eggSales: [],
    feedInventory: [],
    roomInventory: [],
    notifications: [],
    warehouse: [],
    orders: [],
    vaccinations: [],
    medications: [],
  });

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const [recentSearches, setRecentSearches] = useState(() => {
    return JSON.parse(localStorage.getItem("recentSearches") || "[]");
  });

  // ==========================
  // PLATFORM-AWARE SHORTCUT LABEL
  // ==========================

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const shortcutLabel = isMac ? "⌘ + K" : "Ctrl + K";

  // ==========================
  // SEARCH (debounced)
  // ==========================

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({
        workers: [],
        production: [],
        eggSales: [],
        feedInventory: [],
        roomInventory: [],
        notifications: [],
        warehouse: [],
        orders: [],
        vaccinations: [],
        medications: [],
      });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const data = await globalSearch(query);

        setResults({
          workers: data.workers || [],
          production: data.production || [],
          eggSales: data.eggSales || [],
          feedInventory: data.feedInventory || [],
          roomInventory: data.roomInventory || [],
          notifications: data.notifications || [],
          warehouse: data.warehouse || [],
          orders: data.orders || [],
          vaccinations: data.vaccinations || [],
          medications: data.medications || [],
        });

        setOpen(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // ==========================
  // FLATTEN RESULTS (single source of truth)
  // ==========================

  const flatResults = useMemo(() => {
    const rows = [];

    results.workers.forEach((item) =>
      rows.push({ type: "worker", path: "/admin/staff", data: item }),
    );
    results.production.forEach((item) =>
      rows.push({ type: "production", path: "/admin/production", data: item }),
    );
    results.eggSales.forEach((item) =>
      rows.push({ type: "eggSales", path: "/admin/egg-sales", data: item }),
    );
    results.feedInventory.forEach((item) =>
      rows.push({ type: "feed", path: "/admin/feeds", data: item }),
    );
    results.roomInventory.forEach((item) =>
      rows.push({ type: "room", path: "/admin/room-inventory", data: item }),
    );
    results.notifications.forEach((item) =>
      rows.push({
        type: "notification",
        path: "/admin/notifications",
        data: item,
      }),
    );
    results.warehouse.forEach((item) =>
      rows.push({ type: "warehouse", path: "/admin/warehouse", data: item }),
    );
    results.orders.forEach((item) =>
      rows.push({ type: "order", path: "/admin/orders", data: item }),
    );
    results.vaccinations.forEach((item) =>
      rows.push({
        type: "vaccination",
        path: "/admin/vaccinations",
        data: item,
      }),
    );
    results.medications.forEach((item) =>
      rows.push({
        type: "medication",
        path: "/admin/medications",
        data: item,
      }),
    );

    return rows;
  }, [results]);

  const totalResults = flatResults.length;

  const searchedCategories = [
    results.workers.length,
    results.production.length,
    results.eggSales.length,
    results.feedInventory.length,
    results.roomInventory.length,
    results.notifications.length,
    results.warehouse.length,
    results.orders.length,
    results.vaccinations.length,
    results.medications.length,
  ].filter((count) => count > 0).length;

  // ==========================
  // RECENT SEARCH HISTORY
  // ==========================

  const saveSearch = (text) => {
    if (!text.trim()) return;

    let history = JSON.parse(localStorage.getItem("recentSearches") || "[]");

    history = history.filter(
      (item) => item.toLowerCase() !== text.toLowerCase(),
    );

    history.unshift(text);

    history = history.slice(0, 8);

    localStorage.setItem("recentSearches", JSON.stringify(history));

    setRecentSearches(history);
  };

  const removeRecentSearch = (search) => {
    const updated = recentSearches.filter((item) => item !== search);

    setRecentSearches(updated);

    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  // ==========================
  // NAVIGATION HELPER
  // ==========================

  const go = (path) => {
    saveSearch(query);

    setOpen(false);

    navigate(path);
  };

  // ==========================
  // RESET SELECTION WHEN RESULTS CHANGE
  // ==========================

  useEffect(() => {
    if (open) {
      setSelectedIndex(flatResults.length > 0 ? 0 : -1);
    }
  }, [flatResults, open]);
  // ==========================
  // AUTO-SCROLL SELECTED ITEM INTO VIEW
  // ==========================

  useEffect(() => {
    if (selectedIndex >= 0 && document.activeElement === inputRef.current) {
      selectedRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // ==========================
  // KEYBOARD SHORTCUTS (single combined handler)
  // ==========================

  useEffect(() => {
    const handler = (e) => {
      // CTRL/CMD + K focuses the input regardless of open state
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (!open) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, flatResults.length - 1),
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "Enter":
          if (selectedIndex >= 0 && flatResults[selectedIndex]) {
            e.preventDefault();
            go(flatResults[selectedIndex].path);
          }
          break;

        case "Escape":
          setOpen(false);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selectedIndex, flatResults]);

  // ==========================
  // CLOSE WHEN CLICKING OUTSIDE
  // ==========================

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ==========================
  // UI
  // ==========================

  let resultIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
          }}
          placeholder="Search anything across the farm..."
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pl-11 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
        />

        <span className="absolute left-4 top-3.5 text-gray-400">
          {loading ? (
            <svg
              className="w-5 h-5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="60"
                strokeDashoffset="20"
              />
            </svg>
          ) : (
            "🔍"
          )}
        </span>

        <span className="absolute right-3 top-3 text-xs bg-gray-100 px-2 py-1 rounded">
          {shortcutLabel}
        </span>
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border max-h-[600px] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
          {!loading && query.length < 2 && recentSearches.length > 0 && (
            <div className="border-b">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <h3 className="text-xs font-bold uppercase text-gray-500">
                  🕘 Recent Searches
                </h3>

                <button
                  onClick={() => {
                    setRecentSearches([]);
                    localStorage.removeItem("recentSearches");
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Clear
                </button>
              </div>

              {recentSearches.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between px-4 py-3 hover:bg-emerald-50"
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => setQuery(item)}
                  >
                    🔍 {item}
                  </button>

                  <button
                    onClick={() => removeRecentSearch(item)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && query.length < 2 && recentSearches.length === 0 && (
            <div className="p-8 text-center">
              <div className="text-5xl mb-3">🔎</div>

              <h3 className="font-semibold text-gray-700">
                Start typing to search
              </h3>

              <p className="text-sm text-gray-500 mt-2">
                Search workers, production, feed, egg sales, inventory and
                notifications.
              </p>

              <div className="mt-6 text-xs text-gray-400">
                Shortcut:
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded">
                  Ctrl + K
                </span>
              </div>
            </div>
          )}

          {loading && <SearchSpinner />}

          {!loading && totalResults === 0 && query.trim().length >= 2 && (
            <div className="p-6 text-center text-gray-400">
              No results found.
            </div>
          )}

          {!loading && totalResults > 0 && (
            <>
              <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border-b">
                <div className="text-sm font-semibold text-emerald-700">
                  {totalResults} result{totalResults !== 1 ? "s" : ""} found
                </div>
                <div className="text-xs text-gray-500">
                  {searchedCategories} categor
                  {searchedCategories === 1 ? "y" : "ies"} matched
                </div>
              </div>

              <div className="divide-y">
                {/* ================= WORKERS ================= */}
                {results.workers.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="👤"
                      title="Workers"
                      count={results.workers.length}
                    />

                    {results.workers.map((worker) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={worker._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/staff")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold text-gray-800">
                            {highlightText(worker.name, query)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {highlightText(worker.email, query)}
                          </div>
                          <div className="mt-1">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              {highlightText(worker.role, query)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= PRODUCTION ================= */}
                {results.production.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="🥚"
                      title="Production"
                      count={results.production.length}
                    />

                    {results.production.map((item) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={item._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/production")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold">
                            {highlightText(item.pen, query)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(item.date).toLocaleDateString()}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>Crates: {item.cratesProduced}</span>
                            <span>{item.productionPercentage}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= EGG SALES ================= */}
                {results.eggSales.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="💰"
                      title="Egg Sales"
                      count={results.eggSales.length}
                    />

                    {results.eggSales.map((sale) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={sale._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/egg-sales")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold">
                            {highlightText(sale.customer, query)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {highlightText(sale.phone, query)}
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-sm font-semibold text-emerald-700">
                              ₦{Number(sale.totalAmount || 0).toLocaleString()}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                sale.paymentStatus === "Paid"
                                  ? "bg-green-100 text-green-700"
                                  : sale.paymentStatus === "Part Paid"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {highlightText(sale.paymentStatus, query)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= FEED INVENTORY ================= */}
                {results.feedInventory.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="🌽"
                      title="Feed Inventory"
                      count={results.feedInventory.length}
                    />

                    {results.feedInventory.map((feed) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={feed._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/feeds")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold">
                            {highlightText(feed.name, query)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {feed.unit}
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-gray-500">
                            <span>
                              Qty: {highlightText(feed.quantity, query)}
                            </span>
                            <span>{highlightText(feed.supplier, query)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= ROOM INVENTORY ================= */}
                {results.roomInventory.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="🏠"
                      title="Room Inventory"
                      count={results.roomInventory.length}
                    />

                    {results.roomInventory.map((item) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={item._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/room-inventory")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold">
                            {highlightText(item.itemName, query)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {highlightText(item.roomName, query)}
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              Qty: {highlightText(item.quantity, query)}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                item.condition === "Excellent"
                                  ? "bg-green-100 text-green-700"
                                  : item.condition === "Good"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.condition === "Fair"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                              }`}
                            >
                              {highlightText(item.condition, query)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= NOTIFICATIONS ================= */}
                {results.notifications.length > 0 && (
                  <div className="p-3">
                    <SectionHeader
                      icon="🔔"
                      title="Notifications"
                      count={results.notifications.length}
                    />

                    {results.notifications.map((notification) => {
                      resultIndex++;

                      const active = resultIndex === selectedIndex;

                      return (
                        <button
                          key={notification._id}
                          ref={active ? selectedRef : null}
                          onClick={() => go("/admin/notifications")}
                          className={`w-full text-left p-3 rounded-lg transition ${
                            active
                              ? "bg-emerald-100 border-l-4 border-emerald-600"
                              : "hover:bg-emerald-50"
                          }`}
                        >
                          {active && (
                            <div className="text-xs text-emerald-700 font-semibold mb-1">
                              Press Enter ↵
                            </div>
                          )}
                          <div className="font-semibold">
                            {highlightText(notification.subject, query)}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {highlightText(notification.message, query)}
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
                            {highlightText(notification.senderName, query)} •{" "}
                            {new Date(notification.createdAt).toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ================= FOOTER ================= */}
                <div className="p-3 text-center border-t">
                  <div className="flex justify-center gap-5 text-xs text-gray-500">
                    <span>↑ ↓ Navigate</span>
                    <span>↵ Open</span>
                    <span>Esc Close</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
