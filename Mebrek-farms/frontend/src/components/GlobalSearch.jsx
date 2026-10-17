import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../services/searchService";

const EMPTY_RESULTS = {
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
};

const CATEGORIES = [
  {
    key: "workers",
    label: "Workers",
    icon: "👤",
    path: "/admin/staff",
  },
  {
    key: "production",
    label: "Production",
    icon: "🥚",
    path: "/admin/production",
  },
  {
    key: "eggSales",
    label: "Egg Sales",
    icon: "💰",
    path: "/admin/egg-sales",
  },
  {
    key: "feedInventory",
    label: "Feed Inventory",
    icon: "🌽",
    path: "/admin/feeds",
  },
  {
    key: "roomInventory",
    label: "Room Inventory",
    icon: "🏠",
    path: "/admin/room-inventory",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "🔔",
    path: "/admin/notifications",
  },
  {
    key: "warehouse",
    label: "Warehouse",
    icon: "📦",
    path: "/admin/warehouse",
  },
  {
    key: "orders",
    label: "Orders",
    icon: "🧾",
    path: "/admin/orders",
  },
  {
    key: "vaccinations",
    label: "Vaccinations",
    icon: "💉",
    path: "/admin/vaccinations",
  },
  {
    key: "medications",
    label: "Medications",
    icon: "💊",
    path: "/admin/medications",
  },
];

function readRecentSearches() {
  try {
    const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    return Array.isArray(saved)
      ? saved.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function highlightText(value, search) {
  if (value === null || value === undefined || value === "") return "—";

  const text = String(value);
  const term = String(search || "").trim();

  if (!term) return text;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-yellow-200 px-0.5 text-gray-900">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// Supports both normalized results and raw documents returned by the API.
function normalizeResult(category, item) {
  const first = (...values) =>
    values.find(
      (value) => value !== undefined && value !== null && value !== "",
    );

  let title = item.title;
  let subtitle = item.subtitle;
  let detail = item.detail;
  let date = item.date;

  switch (category) {
    case "workers":
      title = first(
        title,
        item.name,
        [item.firstName, item.lastName].filter(Boolean).join(" "),
        item.employeeId,
      );
      subtitle = first(subtitle, item.email, item.employeeId, item.department);
      detail = first(detail, item.role, item.department, item.status);
      break;

    case "production":
      title = first(title, item.pen, "Production record");
      subtitle = first(
        subtitle,
        item.date ? new Date(item.date).toLocaleDateString() : "",
      );
      detail =
        detail ??
        [
          item.cratesProduced !== undefined
            ? `Crates: ${item.cratesProduced}`
            : null,
          item.productionPercentage !== undefined
            ? `Production: ${item.productionPercentage}%`
            : null,
          item.totalEggs !== undefined ? `Eggs: ${item.totalEggs}` : null,
        ]
          .filter(Boolean)
          .join(" • ");
      date = first(date, item.date);
      break;

    case "eggSales":
      title = first(title, item.customer, item.customerName, "Egg sale");
      subtitle = first(subtitle, item.phone, item.invoiceNumber);
      detail =
        detail ??
        [
          item.totalAmount !== undefined
            ? `Total: ₦${Number(item.totalAmount || 0).toLocaleString()}`
            : null,
          item.paymentStatus || item.status,
        ]
          .filter(Boolean)
          .join(" • ");
      date = first(date, item.date);
      break;

    case "feedInventory":
      title = first(title, item.name, item.feedName, "Feed inventory");
      subtitle = first(
        subtitle,
        item.supplier,
        item.unit ? `Unit: ${item.unit}` : "",
      );
      detail =
        detail ??
        [
          item.quantity !== undefined ? `Quantity: ${item.quantity}` : null,
          item.unit,
        ]
          .filter(Boolean)
          .join(" • ");
      break;

    case "roomInventory":
      title = first(title, item.itemName, item.name, "Inventory item");
      subtitle = first(subtitle, item.roomName, item.category);
      detail =
        detail ??
        [
          item.quantity !== undefined ? `Quantity: ${item.quantity}` : null,
          item.condition,
        ]
          .filter(Boolean)
          .join(" • ");
      break;

    case "notifications":
      title = first(title, item.subject, "Notification");
      subtitle = first(subtitle, item.message, item.senderName);
      detail = detail ?? item.senderName;
      date = first(date, item.createdAt);
      break;

    case "warehouse":
      title = first(title, item.itemName, item.name, "Warehouse item");
      subtitle = first(subtitle, item.category, item.location);
      detail =
        detail ??
        [
          item.quantity !== undefined ? `Quantity: ${item.quantity}` : null,
          item.unit,
          item.status,
        ]
          .filter(Boolean)
          .join(" • ");
      break;

    case "orders":
      title = first(title, item.name, item.customer, item.contact, "Order");
      subtitle = first(subtitle, item.contact, item.message);
      detail = detail ?? item.status;
      date = first(date, item.createdAt, item.date);
      break;

    case "vaccinations":
      title = first(title, item.vaccineName, item.name, "Vaccination record");
      subtitle = first(subtitle, item.birdBatch, item.administeredBy);
      detail =
        detail ??
        [
          item.quantity !== undefined ? `Quantity: ${item.quantity}` : null,
          item.nextDueDate ? `Next due: ${item.nextDueDate}` : null,
        ]
          .filter(Boolean)
          .join(" • ");
      date = first(date, item.dateAdministered, item.createdAt);
      break;

    case "medications":
      title = first(title, item.medicationName, item.name, "Medication record");
      subtitle = first(subtitle, item.purpose, item.administeredTo);
      detail =
        detail ??
        [item.dosage ? `Dosage: ${item.dosage}` : null, item.administeredTo]
          .filter(Boolean)
          .join(" • ");
      date = first(date, item.dateAdministered, item.createdAt);
      break;

    default:
      title = first(title, item.name, item._id, "Record");
  }

  return {
    ...item,
    title: String(title ?? "Record"),
    subtitle: subtitle == null ? "" : String(subtitle),
    detail: detail == null ? "" : String(detail),
    date,
  };
}

function formatDate(value) {
  if (!value) return "";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString();
}

function SearchSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative h-10 w-10">
        <div className="h-10 w-10 rounded-full border-4 border-gray-200" />
        <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>

      <p className="mt-4 font-medium text-gray-700">
        Searching farm records...
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Searching the records available to your account
      </p>
    </div>
  );
}

function SectionHeader({ icon, title, count }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-gray-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
          {title}
        </span>
      </div>
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
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
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/i.test(
      `${navigator.platform || ""} ${navigator.userAgent || ""}`,
    );

  const shortcutLabel = isMac ? "⌘ K" : "Ctrl K";

  useEffect(() => {
    const term = query.trim();
    let cancelled = false;

    if (term.length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setError("");
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const data = await globalSearch(term);

        if (cancelled) return;

        // Also supports an Axios response if the service hasn't unwrapped it.
        const payload = data?.data ?? data ?? {};

        const safeResults = {};
        for (const category of CATEGORIES) {
          const value = payload[category.key];
          safeResults[category.key] = Array.isArray(value)
            ? value.map((item) => normalizeResult(category.key, item))
            : [];
        }

        setResults(safeResults);
        setSelectedIndex(-1);
        setOpen(true);
      } catch (err) {
        if (cancelled) return;

        console.error("Global search failed:", err);
        setResults(EMPTY_RESULTS);
        setError(
          err?.response?.data?.message ||
            "Search failed. Please check your connection and try again.",
        );
        setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const flatResults = useMemo(
    () =>
      CATEGORIES.flatMap((category) =>
        results[category.key].map((item) => ({
          category,
          item,
        })),
      ),
    [results],
  );

  const totalResults = flatResults.length;

  const searchedCategories = CATEGORIES.filter(
    (category) => results[category.key].length > 0,
  ).length;

  useEffect(() => {
    if (selectedIndex >= 0 && document.activeElement === inputRef.current) {
      selectedRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const saveSearch = (value) => {
    const term = String(value || "").trim();
    if (!term) return;

    const history = [
      term,
      ...readRecentSearches().filter(
        (item) => item.toLowerCase() !== term.toLowerCase(),
      ),
    ].slice(0, 8);

    localStorage.setItem("recentSearches", JSON.stringify(history));
    setRecentSearches(history);
  };

  const removeRecentSearch = (value) => {
    const updated = recentSearches.filter((item) => item !== value);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const go = (path) => {
    saveSearch(query);
    setOpen(false);
    navigate(path);
  };

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown" && flatResults.length > 0) {
        event.preventDefault();
        setSelectedIndex((previous) =>
          previous < flatResults.length - 1 ? previous + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp" && flatResults.length > 0) {
        event.preventDefault();
        setSelectedIndex((previous) =>
          previous > 0 ? previous - 1 : flatResults.length - 1,
        );
        return;
      }

      if (event.key === "Enter" && selectedIndex >= 0) {
        const selected = flatResults[selectedIndex];
        if (selected) {
          event.preventDefault();
          go(selected.category.path);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatResults, selectedIndex, query]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  let resultIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search anything across the farm..."
          aria-label="Search farm records"
          aria-expanded={open}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pl-11 pr-20 text-gray-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
        />

        <span className="absolute left-4 top-3.5 text-gray-500">
          {loading ? "⏳" : "🔍"}
        </span>

        <span className="absolute right-3 top-3 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
          {shortcutLabel}
        </span>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[600px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          {!loading && query.trim().length < 2 && (
            <div>
              {recentSearches.length > 0 ? (
                <>
                  <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
                    <h3 className="text-xs font-bold uppercase text-gray-600">
                      🕘 Recent Searches
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setRecentSearches([]);
                        localStorage.removeItem("recentSearches");
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  </div>

                  {recentSearches.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 border-b px-4 py-3 hover:bg-emerald-50"
                    >
                      <button
                        type="button"
                        className="flex-1 text-left text-sm text-gray-700"
                        onClick={() => {
                          setQuery(item);
                          setOpen(true);
                        }}
                      >
                        🔍 {item}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${item} from recent searches`}
                        onClick={() => removeRecentSearch(item)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-8 text-center">
                  <div className="mb-3 text-4xl">🔎</div>
                  <h3 className="font-semibold text-gray-800">
                    Start typing to search
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Search the farm records your account is allowed to access.
                  </p>
                  <p className="mt-4 text-xs text-gray-500">
                    Use {shortcutLabel} to focus the search bar.
                  </p>
                </div>
              )}
            </div>
          )}

          {loading && <SearchSpinner />}

          {!loading && error && (
            <div className="p-5 text-center">
              <p className="font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => setQuery((value) => `${value} `.trim())}
                className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Try again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            query.trim().length >= 2 &&
            totalResults === 0 && (
              <div className="p-7 text-center">
                <div className="mb-2 text-3xl">🔎</div>
                <p className="font-semibold text-gray-800">No results found</p>
                <p className="mt-1 text-sm text-gray-600">
                  Try another name, item, pen, customer, or keyword.
                </p>
              </div>
            )}

          {!loading && !error && totalResults > 0 && (
            <>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-emerald-50 px-4 py-3">
                <span className="text-sm font-semibold text-emerald-900">
                  {totalResults} result{totalResults === 1 ? "" : "s"} found
                </span>
                <span className="text-xs text-gray-600">
                  {searchedCategories} categor
                  {searchedCategories === 1 ? "y" : "ies"} matched
                </span>
              </div>

              {CATEGORIES.map((category) => {
                const items = results[category.key];
                if (!items.length) return null;

                return (
                  <section
                    key={category.key}
                    className="border-b last:border-b-0"
                  >
                    <SectionHeader
                      icon={category.icon}
                      title={category.label}
                      count={items.length}
                    />

                    <div className="p-2">
                      {items.map((item) => {
                        resultIndex++;
                        const currentIndex = resultIndex;
                        const active = currentIndex === selectedIndex;

                        return (
                          <button
                            key={
                              item._id ||
                              `${category.key}-${currentIndex}-${item.title}`
                            }
                            ref={active ? selectedRef : null}
                            type="button"
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            onClick={() => go(category.path)}
                            className={`mb-1 w-full rounded-lg border-l-4 p-3 text-left transition ${
                              active
                                ? "border-emerald-700 bg-emerald-100"
                                : "border-transparent hover:bg-emerald-50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="pt-0.5 text-lg">
                                {category.icon}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="break-words font-semibold text-gray-900">
                                  {highlightText(item.title, query)}
                                </div>

                                {item.subtitle && (
                                  <div className="mt-1 break-words text-sm text-gray-700">
                                    {highlightText(item.subtitle, query)}
                                  </div>
                                )}

                                {item.detail && (
                                  <div className="mt-1 break-words text-xs text-gray-600">
                                    {highlightText(item.detail, query)}
                                  </div>
                                )}

                                {item.date && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {formatDate(item.date)}
                                  </div>
                                )}

                                {active && (
                                  <div className="mt-2 text-xs font-semibold text-emerald-800">
                                    Press Enter ↵ to open this section
                                  </div>
                                )}
                              </div>

                              <span className="text-xs text-gray-400">↗</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <div className="sticky bottom-0 flex justify-center gap-5 border-t bg-gray-50 p-3 text-xs text-gray-600">
                <span>↑ ↓ Navigate</span>
                <span>↵ Open section</span>
                <span>Esc Close</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
