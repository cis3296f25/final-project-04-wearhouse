import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import "./App.css";

import { getWeather } from "./services/weatherCalendarService";
import { suggestOutfit as generateOutfitSuggestion } from "./services/outfitSuggestionService";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Log environment variables for debugging
console.log("URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("ANON:", import.meta.env.VITE_SUPABASE_ANON?.slice(0, 10) + "...");
console.log(
  "Weather API Key:",
  import.meta.env.VITE_WEATHER_API_KEY ? "✅ Set" : "❌ Not set"
);

// Initialize Supabase client with env configuration
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON
);

// Send image to proxy and return background-removed PNG as File
async function removeBackgroundOnServer(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await fetch("http://localhost:3001/remove-bg", {
    method: "POST",
    body: fd,
  });

  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok || !ct.includes("image/png")) {
    // Throw readable error when remove.bg fails
    const txt = await resp.text();
    throw new Error(`remove-bg failed (${resp.status}): ${txt}`);
  }

  // Produce a new PNG File with transparent background
  const ab = await resp.arrayBuffer();
  const cleanedName = file.name.replace(/\.\w+$/, "") + "-nobg.png";
  return new File([ab], cleanedName, { type: "image/png" });
}

// Navigation tabs used for a simple hash-based router
const NAV_LINKS = [
  { id: "home", label: "Home" },
  { id: "signup", label: "Sign Up" },
  { id: "login", label: "Log In" },
];

// Cache ids so we can validate arbitrary hashes
const NAV_LINK_IDS = NAV_LINKS.map((link) => link.id);

function pageFromHash(hashValue = "") {
  const normalized = hashValue.replace(/^#/, "").toLowerCase();
  return NAV_LINK_IDS.includes(normalized) ? normalized : "home";
}

function initialPage() {
  if (typeof window === "undefined") return "home";
  return pageFromHash(window.location.hash);
}

function updateLocationHash(page) {
  if (typeof window === "undefined") return;
  window.location.hash = `#${page}`;
}

const navLinkClassName = (isActive) =>
  `app-nav-link${isActive ? " is-active" : ""}`;

export default function App() {
  // Navigation / auth state
  const [activePage, setActivePage] = useState(initialPage);
  const [currentUser, setCurrentUser] = useState(null);

  // Closet / items state
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("top");
  const [color, setColor] = useState("black");
  const [message, setMessage] = useState("");

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState([]);
  // Event management state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showFormalityModal, setShowFormalityModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // New event form state
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("");
  const [newEventFormality, setNewEventFormality] = useState("casual");

  // Mock data for preview when not logged in or no items
  const mockItems = [
    { id: "mock-1", name: "Blue Oxford Shirt", category: "top", color: "blue", image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&h=300&fit=crop" },
    { id: "mock-2", name: "White T-Shirt", category: "top", color: "white", image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop" },
    { id: "mock-3", name: "Black Jeans", category: "bottom", color: "black", image_url: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=300&fit=crop" },
    { id: "mock-4", name: "Khaki Chinos", category: "bottom", color: "khaki", image_url: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&h=300&fit=crop" },
    { id: "mock-5", name: "White Sneakers", category: "shoes", color: "white", image_url: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&h=300&fit=crop" },
    { id: "mock-6", name: "Navy Blazer", category: "outerwear", color: "navy", image_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300&h=300&fit=crop" },
  ];

  const [mockOutfits, setMockOutfits] = useState([
    {
      id: "outfit-1",
      name: "Casual Friday",
      category: "casual",
      is_favorite: true,
      notes: "Great for casual office days",
      weather_temp: 72,
      weather_condition: "Sunny",
      event_title: "Team Meeting",
      event_formality: "casual",
      created_at: new Date().toISOString(),
      top: mockItems[0],
      bottom: mockItems[2],
      shoes: mockItems[4],
      outerwear: null,
    },
    {
      id: "outfit-2",
      name: "Business Look",
      category: "work",
      is_favorite: false,
      notes: null,
      weather_temp: 65,
      weather_condition: "Cloudy",
      event_title: "Client Presentation",
      event_formality: "business",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      top: mockItems[0],
      bottom: mockItems[3],
      shoes: mockItems[4],
      outerwear: mockItems[5],
    },
  ]);

  // Outfit storage states
  const [outfits, setOutfits] = useState([]);
  const [activeTab, setActiveTab] = useState("items"); // "items" or "outfits"
  const [selectedItems, setSelectedItems] = useState({ top: null, bottom: null, shoes: null, outerwear: null });
  const [showCreateOutfit, setShowCreateOutfit] = useState(false);

  // Outfit organization states
  const [editingOutfitId, setEditingOutfitId] = useState(null);
  const [editOutfitName, setEditOutfitName] = useState("");
  const [editOutfitCategory, setEditOutfitCategory] = useState("casual");
  const [editOutfitNotes, setEditOutfitNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const isHome = activePage === "home";
  const isLoggedIn = Boolean(currentUser?.user_id);

  // Show mock items when not logged in OR when logged in but no items exist
  const showMockData = !isLoggedIn || items.length === 0;
  const displayItems = showMockData ? mockItems : items;
  const displayOutfits = showMockData ? mockOutfits : outfits;

  // ---------- Items / Supabase ----------

  // Load items for the current user from Supabase
  async function loadItems(userId = currentUser?.user_id) {
    if (!userId) {
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error) setItems(data ?? []);
  }

  // ---------- Outfits / Supabase ----------

  // Load outfits for the current user from Supabase
  async function loadOutfits(userId = currentUser?.user_id) {
    if (!userId) {
      setOutfits([]);
      return;
    }

    const { data: outfitsData, error } = await supabase
      .from("outfits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading outfits:", error);
      setOutfits([]);
      return;
    }

    // Fetch related items for each outfit
    const outfitsWithItems = await Promise.all(
      (outfitsData || []).map(async (outfit) => {
        const [top, bottom, shoes, outerwear] = await Promise.all([
          outfit.top_id ? supabase.from("items").select("*").eq("id", outfit.top_id).single() : { data: null },
          outfit.bottom_id ? supabase.from("items").select("*").eq("id", outfit.bottom_id).single() : { data: null },
          outfit.shoes_id ? supabase.from("items").select("*").eq("id", outfit.shoes_id).single() : { data: null },
          outfit.outerwear_id ? supabase.from("items").select("*").eq("id", outfit.outerwear_id).single() : { data: null },
        ]);

        return {
          ...outfit,
          top: top.data,
          bottom: bottom.data,
          shoes: shoes.data,
          outerwear: outerwear.data,
        };
      })
    );

    setOutfits(outfitsWithItems);
  }

  // Save an outfit to the database
  async function saveOutfit(outfitData) {
    const { top, bottom, weather, event, shoes = null, outerwear = null, category = "casual" } = outfitData;

    if (!isLoggedIn) {
      const newOutfit = {
        id: `outfit-${Date.now()}`,
        name: `Outfit - ${new Date().toLocaleDateString()}`,
        top: top,
        bottom: bottom,
        shoes: shoes,
        outerwear: outerwear,
        weather_temp: weather?.tempF || null,
        weather_condition: weather?.condition || null,
        event_title: event?.title || null,
        event_formality: event?.formality || null,
        category: category,
        is_favorite: false,
        notes: null,
        created_at: new Date().toISOString(),
      };
      setMockOutfits(prev => [newOutfit, ...prev]);
      setMessage("Outfit saved! (Log in to save permanently)");
      return true;
    }

    if (!currentUser?.user_id) {
      setMessage("Please log in to save outfits.");
      return false;
    }

    const outfitRecord = {
      user_id: currentUser.user_id,
      name: `Outfit - ${new Date().toLocaleDateString()}`,
      top_id: top?.id || null,
      bottom_id: bottom?.id || null,
      shoes_id: shoes?.id || null,
      outerwear_id: outerwear?.id || null,
      weather_temp: weather?.tempF || null,
      weather_condition: weather?.condition || null,
      event_title: event?.title || null,
      event_formality: event?.formality || null,
      category: category,
      is_favorite: false,
      notes: null
    };

    const { error } = await supabase.from("outfits").insert(outfitRecord);
    if (error) {
      setMessage("Failed to save outfit: " + error.message);
      return false;
    }

    setMessage("Outfit saved to your closet!");
    await loadOutfits(currentUser.user_id);
    return true;
  }

  // Delete an outfit
  async function deleteOutfit(outfitId) {
    if (!isLoggedIn) {
      setMockOutfits(prev => prev.filter(o => o.id !== outfitId));
      setMessage("Outfit deleted");
      return;
    }
    const { error } = await supabase.from("outfits").delete().eq("id", outfitId);
    if (error) {
      setMessage("Failed to delete outfit: " + error.message);
      return;
    }
    setMessage("Outfit deleted");
    await loadOutfits(currentUser?.user_id);
  }

  // Toggle favorite status for an outfit
  async function toggleFavorite(outfitId, currentStatus) {
    if (!isLoggedIn) {
      setMockOutfits(prev => prev.map(o =>
        o.id === outfitId ? { ...o, is_favorite: !currentStatus } : o
      ));
      return;
    }
    const { error } = await supabase
      .from("outfits")
      .update({ is_favorite: !currentStatus })
      .eq("id", outfitId);

    if (error) {
      setMessage("Failed to update favorite: " + error.message);
      return;
    }

    await loadOutfits(currentUser?.user_id);
  }

  // Start editing an outfit
  function startEditingOutfit(outfit) {
    setEditingOutfitId(outfit.id);
    setEditOutfitName(outfit.name || "");
    setEditOutfitCategory(outfit.category || "casual");
    setEditOutfitNotes(outfit.notes || "");
  }

  // Save outfit edits
  async function saveOutfitEdits(outfitId) {
    if (!isLoggedIn) {
      setMockOutfits(prev => prev.map(o =>
        o.id === outfitId
          ? { ...o, name: editOutfitName, category: editOutfitCategory, notes: editOutfitNotes }
          : o
      ));
      setMessage("Outfit updated!");
      setEditingOutfitId(null);
      return;
    }
    const { error } = await supabase
      .from("outfits")
      .update({
        name: editOutfitName,
        category: editOutfitCategory,
        notes: editOutfitNotes
      })
      .eq("id", outfitId);

    if (error) {
      setMessage("Failed to update outfit: " + error.message);
      return;
    }

    setMessage("Outfit updated successfully!");
    setEditingOutfitId(null);
    await loadOutfits(currentUser?.user_id);
  }

  // Cancel editing
  function cancelEditing() {
    setEditingOutfitId(null);
    setEditOutfitName("");
    setEditOutfitCategory("casual");
    setEditOutfitNotes("");
  }

  // Create outfit manually from selected items
  async function createOutfitManually() {
    if (!selectedItems.top && !selectedItems.bottom) {
      setMessage("Please select at least a top or bottom to create an outfit.");
      return;
    }

    if (!isLoggedIn) {
      const newOutfit = {
        id: `outfit-${Date.now()}`,
        name: `Manual Outfit - ${new Date().toLocaleDateString()}`,
        top: selectedItems.top,
        bottom: selectedItems.bottom,
        shoes: selectedItems.shoes,
        outerwear: selectedItems.outerwear,
        category: "casual",
        is_favorite: false,
        notes: null,
        created_at: new Date().toISOString(),
      };
      setMockOutfits(prev => [newOutfit, ...prev]);
      setMessage("Outfit created! (Log in to save permanently)");
      setSelectedItems({ top: null, bottom: null, shoes: null, outerwear: null });
      setShowCreateOutfit(false);
      return;
    }

    if (!currentUser?.user_id) {
      setMessage("Please log in to create outfits.");
      return;
    }

    const outfitRecord = {
      user_id: currentUser.user_id,
      name: `Manual Outfit - ${new Date().toLocaleDateString()}`,
      top_id: selectedItems.top?.id || null,
      bottom_id: selectedItems.bottom?.id || null,
      shoes_id: selectedItems.shoes?.id || null,
      outerwear_id: selectedItems.outerwear?.id || null,
      category: "casual",
      is_favorite: false,
      notes: null
    };

    const { error } = await supabase.from("outfits").insert(outfitRecord);
    if (error) {
      setMessage("Failed to create outfit: " + error.message);
      return;
    }

    setMessage("Outfit created and saved!");
    setSelectedItems({ top: null, bottom: null, shoes: null, outerwear: null });
    setShowCreateOutfit(false);
    await loadOutfits(currentUser.user_id);
  }

  // Toggle item selection for manual outfit creation
  function toggleItemSelection(item) {
    setSelectedItems(prev => ({
      ...prev,
      [item.category]: prev[item.category]?.id === item.id ? null : item
    }));
  }

  // Whenever the logged-in user changes, refresh their closet items and outfits
  useEffect(() => {
    if (!currentUser?.user_id) {
      setItems([]);
      setOutfits([]);
      return;
    }
    loadItems(currentUser.user_id);
    loadOutfits(currentUser.user_id);
  }, [currentUser?.user_id]);

  // Keep nav state in sync if user edits the hash manually
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleHashChange = () =>
      setActivePage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Handle upload: remove background → upload to storage → insert DB row
  async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser?.user_id) {
      setMessage("Please log in before uploading items.");
      return;
    }
    if (!file) return;

    // Remove background via proxy with graceful fallback
    setMessage("Removing background…");
    let processedFile = file;
    try {
      processedFile = await removeBackgroundOnServer(file);
    } catch (err) {
      console.error(err);
      setMessage("Background removal failed, uploading original instead.");
    }

    // Upload processed file to Supabase Storage
    setMessage("Uploading to storage…");
    const filename = `${crypto.randomUUID()}-${processedFile.name}`;
    const { data: upload, error: upErr } = await supabase.storage
      .from("items")
      .upload(filename, processedFile, {
        cacheControl: "3600",
        upsert: false, // safer: don't overwrite an existing path
        contentType: processedFile.type || "image/png",
      });

    if (upErr) {
      console.error("upload error", upErr);
      setMessage("Upload failed: " + upErr.message);
      return;
    }

    // Persist public URL and metadata in items table
    const { data: pub } = supabase.storage.from("items").getPublicUrl(upload.path);
    const image_url = pub.publicUrl;

    const { error: dbErr } = await supabase.from("items").insert({
      name,
      category,
      color,
      image_url,
      user_id: currentUser.user_id,
    });
    if (dbErr) {
      setMessage("DB insert failed: " + dbErr.message);
      return;
    }

    // Reset form and refresh list
    setMessage("Added item with background removed!");
    setName("");
    setCategory("top");
    setColor("black");
    setFile(null);
    await loadItems(currentUser.user_id);
  }

  // ---------- Calendar + localStorage ----------

  function getFormalityColor(formality) {
    const colors = {
      formal: "#8B0000", // Dark red
      business: "#1E3A8A", // Dark blue
      casual: "#059669", // Green
    };
    return colors[formality] || colors.casual;
  }

  // Load events from localStorage
  function loadEventsFromStorage() {
    try {
      const stored = localStorage.getItem("wearhouse_events");
      if (stored) {
        const events = JSON.parse(stored);
        const calendarEvents = events.map((event) => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay || false,
          formality: event.formality || "casual",
          backgroundColor: getFormalityColor(event.formality || "casual"),
          borderColor: getFormalityColor(event.formality || "casual"),
          extendedProps: {
            formality: event.formality || "casual",
          },
        }));
        setCalendarEvents(calendarEvents);
        return calendarEvents;
      }
    } catch (error) {
      console.error("Error loading events from storage:", error);
    }
    return [];
  }

  // Save events to localStorage
  function saveEventsToStorage(events) {
    try {
      const eventsToSave = events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay || false,
        formality:
          event.extendedProps?.formality || event.formality || "casual",
      }));
      localStorage.setItem("wearhouse_events", JSON.stringify(eventsToSave));
    } catch (error) {
      console.error("Error saving events to storage:", error);
    }
  }

  // Load calendar events on mount
  useEffect(() => {
    loadEventsFromStorage();
  }, []);

  // Handle adding new event
  function handleAddEvent(e) {
    e.preventDefault();

    if (!newEventTitle || !newEventDate) {
      setMessage("❌ Please fill in at least the event title and date");
      return;
    }

    // Create event start datetime
    const startDate = new Date(newEventDate);
    if (newEventStartTime) {
      const [hours, minutes] = newEventStartTime.split(":").map(Number);
      startDate.setHours(hours, minutes || 0, 0, 0);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    // Create event end datetime
    let endDate = new Date(startDate);
    if (newEventEndTime) {
      const [hours, minutes] = newEventEndTime.split(":").map(Number);
      endDate.setHours(hours, minutes || 0, 0, 0);
    } else {
      // Default to 1 hour after start if no end time
      endDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    }

    const newEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      title: newEventTitle,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay: !newEventStartTime && !newEventEndTime,
      formality: newEventFormality,
      backgroundColor: getFormalityColor(newEventFormality),
      borderColor: getFormalityColor(newEventFormality),
      extendedProps: {
        formality: newEventFormality,
      },
    };

    const updatedEvents = [...calendarEvents, newEvent];
    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    const eventTitle = newEventTitle; // save before reset

    // Reset form
    setNewEventTitle("");
    setNewEventDate("");
    setNewEventStartTime("");
    setNewEventEndTime("");
    setNewEventFormality("casual");
    setShowAddEventModal(false);

    setMessage(`✅ Event "${eventTitle}" added successfully!`);
  }

  // Handle formality update
  function handleUpdateFormality(formality) {
    if (!selectedEvent) {
      return;
    }

    const updatedEvents = calendarEvents.map((event) => {
      if (event.id === selectedEvent.id) {
        return {
          ...event,
          formality: formality,
          backgroundColor: getFormalityColor(formality),
          borderColor: getFormalityColor(formality),
          extendedProps: {
            ...event.extendedProps,
            formality: formality,
          },
        };
      }
      return event;
    });

    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    setMessage(`✅ Updated formality to ${formality}`);
    setShowFormalityModal(false);
    setSelectedEvent(null);
  }

  // Handle event deletion
  function handleDeleteEvent() {
    if (!selectedEvent) {
      return;
    }

    const updatedEvents = calendarEvents.filter(
      (event) => event.id !== selectedEvent.id
    );
    setCalendarEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    setMessage(`✅ Event "${selectedEvent.title}" deleted`);
    setShowFormalityModal(false);
    setSelectedEvent(null);
  }

  // ---------- Weather + outfit suggestion ----------

  // Test weather API independently
  async function testWeather() {
    setMessage("Testing weather API...");
    console.log("Testing weather API...");

    try {
      const weather = await getWeather();
      console.log("Weather API Response:", weather);

      const weatherDetails = [
        `📍 Location: ${weather.location || "Unknown"}`,
        `🌡️ Temperature: ${weather.tempF}°F (${
          weather.tempC || "N/A"
        }°C)`,
        `🌤️ Condition: ${weather.condition}`,
        weather.description ? `📝 Description: ${weather.description}` : "",
        weather.humidity ? `💧 Humidity: ${weather.humidity}%` : "",
        weather.windSpeed ? `💨 Wind: ${weather.windSpeed} mph` : "",
        weather.feelsLike ? `🔥 Feels like: ${weather.feelsLike}°F` : "",
      ]
        .filter(Boolean)
        .join("\n");

      setMessage(`Weather API Test Success!\n${weatherDetails}`);

      const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
      if (!apiKey || weather.location === undefined) {
        console.warn("⚠️ Using MOCK data - API key not found in environment");
        setMessage(
          (prev) =>
            prev +
            "\n⚠️ Using MOCK data - Add VITE_WEATHER_API_KEY to .env file\n💡 Remember to restart the dev server after adding .env variables!"
        );
      } else {
        console.log(
          "✅ Using REAL API - Weather data fetched successfully"
        );
      }
    } catch (error) {
      console.error("Weather API test failed:", error);
      const errorMsg = error.message.includes("401")
        ? `❌ API Key Authentication Failed!\n\n${error.message}\n\n` +
          `💡 Troubleshooting:\n` +
          `• Double-check your API key in the .env file\n` +
          `• Make sure there are no extra spaces or quotes\n` +
          `• New API keys may take a few minutes to activate\n` +
          `• Verify your key at https://home.openweathermap.org/api_keys`
        : `Weather API Test Failed: ${error.message}\nCheck console for details.`;
      setMessage(errorMsg);
    }
  }

  // Generate outfit suggestion using real weather + local calendar events
  async function suggestOutfit(shouldSave = false) {
    setMessage("Generating...");

    try {
      const weather = await getWeather();

      // Find today's event from local calendar events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const todayEvents = calendarEvents.filter((event) => {
        const eventStart = new Date(event.start);
        return eventStart >= today && eventStart <= todayEnd;
      });

      let event = null;
      if (todayEvents.length > 0) {
        const firstEvent = todayEvents[0];
        event = {
          title: firstEvent.title,
          formality:
            firstEvent.extendedProps?.formality ||
            firstEvent.formality ||
            "casual",
          startTime: firstEvent.start,
        };
      } else {
        event = {
          title: "No scheduled events",
          formality: "casual",
        };
      }

      const result = generateOutfitSuggestion({
        items: displayItems,
        weather,
        event,
        calendarEvents,
      });

      setMessage(result.message);

      // If shouldSave is true, save the outfit to database
      if (shouldSave && result.success && result.outfit) {
        const outfitData = {
          top: result.outfit.top,
          bottom: result.outfit.bottom,
          shoes: result.outfit.shoes,
          outerwear: result.outfit.outerwear,
          weather: weather,
          event: event,
          category: event.formality || "casual",
        };
        await saveOutfit(outfitData);
      }
    } catch (error) {
      console.error("Error generating outfit suggestion:", error);
      setMessage(
        "Failed to generate outfit suggestion. Please try again."
      );
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setItems([]);
    setMessage("");
  }

  return (
    <div className="app-shell">
      <div className="app-inner">
        <header className="app-header">
          <div>
            <h1 className="app-title">WearHouse POC</h1>
          </div>
          <nav className="app-nav">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={activePage === link.id ? "page" : undefined}
                className={navLinkClassName(activePage === link.id)}
                onClick={(evt) => {
                  evt.preventDefault();
                  setActivePage(link.id);
                  updateLocationHash(link.id);
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
          {isLoggedIn && (
            <div className="session-bar">
              <span className="session-indicator logged-in">
                {`Logged in as ${currentUser?.user_email}`}
              </span>
              <button
                type="button"
                className="logout-button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </header>

        {isHome ? (
          <section className="card home-card">
            {!isLoggedIn && (
              <div className="login-alert">
                Log in to upload and save your own clothing items. Preview sample items below!
              </div>
            )}

            {/* Tab Navigation - Always show so guests can browse */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
                <button
                  onClick={() => setActiveTab("items")}
                  style={{
                    padding: "12px 24px",
                    border: "none",
                    background: activeTab === "items" ? "#4285F4" : "transparent",
                    color: activeTab === "items" ? "white" : "#666",
                    cursor: "pointer",
                    borderRadius: "8px 8px 0 0",
                    fontWeight: activeTab === "items" ? 600 : 400,
                    fontSize: "14px",
                  }}
                >
                  My Items
                </button>
                <button
                  onClick={() => setActiveTab("outfits")}
                  style={{
                    padding: "12px 24px",
                    border: "none",
                    background: activeTab === "outfits" ? "#4285F4" : "transparent",
                    color: activeTab === "outfits" ? "white" : "#666",
                    cursor: "pointer",
                    borderRadius: "8px 8px 0 0",
                    fontWeight: activeTab === "outfits" ? 600 : 400,
                    fontSize: "14px",
                  }}
                >
                  My Outfits ({displayOutfits.length})
                </button>
            </div>

            {/* Items Tab Content */}
            {activeTab === "items" && (
              <>
            {/* Upload form */}
            <form onSubmit={handleUpload} className="item-form">
              <input
                placeholder="Item name (e.g., Blue Oxford)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="top">top</option>
                <option value="bottom">bottom</option>
                <option value="outerwear">outerwear</option>
                <option value="shoes">shoes</option>
                <option value="accessory">accessory</option>
              </select>
              <input
                placeholder="Color (e.g., navy)"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFile(e.target.files?.[0] ?? null)
                }
                required
              />
              <button type="submit" disabled={!isLoggedIn}>
                Add Item
              </button>
            </form>

            {/* Weather + Outfit buttons */}
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={testWeather}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Test Weather API
              </button>
              <button
                onClick={() => suggestOutfit(false)}
                className="suggest-button"
                style={{ padding: "8px 16px" }}
              >
                Suggest Outfit (weather + calendar)
              </button>
              <button
                onClick={() => suggestOutfit(true)}
                style={{
                  backgroundColor: "#059669",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                disabled={!isLoggedIn}
                title={!isLoggedIn ? "Log in to save outfits" : "Generate and save outfit"}
              >
                Suggest & Save Outfit
              </button>
            </div>

            {/* Status / info message */}
            <div
              className="status-message"
              style={{
                whiteSpace: "pre-line",
                fontFamily: "system-ui, -apple-system, sans-serif",
                lineHeight: 1.6,
              }}
            >
              {message ||
                "Click 'Test Weather API' to verify your API key is working"}
            </div>

            {/* Calendar & Events */}
            <div
              style={{
                marginTop: 24,
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>Calendar & Events</h3>
              <button
                onClick={() => {
                  const today = new Date();
                  const dateStr = today.toISOString().split("T")[0];
                  setNewEventDate(dateStr);
                  setShowAddEventModal(true);
                }}
                style={{
                  backgroundColor: "#4285F4",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                ➕ Add Event
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={calendarEvents}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                height="auto"
                eventClick={(info) => {
                  const event = info.event;
                  const extendedProps = event.extendedProps || {};
                  const weather = extendedProps.weather;

                  setSelectedEvent({
                    id: event.id,
                    title: event.title,
                    formality: extendedProps.formality || "casual",
                  });

                  let eventDetails = `📅 ${event.title}\n`;
                  if (extendedProps.formality) {
                    eventDetails += `👔 Formality: ${extendedProps.formality}\n`;
                  }
                  if (extendedProps.location) {
                    eventDetails += `📍 Location: ${extendedProps.location}\n`;
                  }
                  if (weather) {
                    eventDetails += `🌤️ Weather: ${weather.tempF}°F ${weather.condition}\n`;
                  }
                  if (extendedProps.description) {
                    eventDetails += `📝 ${extendedProps.description}\n`;
                  }

                  eventDetails +=
                    "\n💡 Click a formality option below to change this event's formality level.";

                  setShowFormalityModal(true);
                  setMessage(eventDetails);
                  info.jsEvent.preventDefault();
                }}
                editable={false}
                selectable={false}
                dayMaxEvents={true}
                moreLinkClick="popover"
              />
            </div>

            {/* Formality Selection Modal */}
            {showFormalityModal && selectedEvent && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    padding: 24,
                    borderRadius: 8,
                    maxWidth: 400,
                    width: "90%",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Set Event Formality</h3>
                  <p>
                    <strong>{selectedEvent.title}</strong>
                  </p>
                  <p>
                    Current formality:{" "}
                    <strong>{selectedEvent.formality}</strong>
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexDirection: "column",
                      marginTop: 16,
                    }}
                  >
                    <button
                      onClick={() => handleUpdateFormality("casual")}
                      style={{
                        backgroundColor:
                          selectedEvent.formality === "casual"
                            ? "#059669"
                            : "#e5e7eb",
                        color:
                          selectedEvent.formality === "casual"
                            ? "white"
                            : "black",
                        padding: "12px",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      👕 Casual
                    </button>
                    <button
                      onClick={() => handleUpdateFormality("business")}
                      style={{
                        backgroundColor:
                          selectedEvent.formality === "business"
                            ? "#1E3A8A"
                            : "#e5e7eb",
                        color:
                          selectedEvent.formality === "business"
                            ? "white"
                            : "black",
                        padding: "12px",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      👔 Business
                    </button>
                    <button
                      onClick={() => handleUpdateFormality("formal")}
                      style={{
                        backgroundColor:
                          selectedEvent.formality === "formal"
                            ? "#8B0000"
                            : "#e5e7eb",
                        color:
                          selectedEvent.formality === "formal"
                            ? "white"
                            : "black",
                        padding: "12px",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      🎩 Formal
                    </button>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${selectedEvent.title}"?`
                            )
                          ) {
                            handleDeleteEvent();
                          }
                        }}
                        style={{
                          backgroundColor: "#dc3545",
                          color: "white",
                          padding: "12px",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          flex: 1,
                        }}
                      >
                        🗑️ Delete
                      </button>
                      <button
                        onClick={() => {
                          setShowFormalityModal(false);
                          setSelectedEvent(null);
                        }}
                        style={{
                          backgroundColor: "#6b7280",
                          color: "white",
                          padding: "12px",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          flex: 1,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add Event Modal */}
            {showAddEventModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    padding: 24,
                    borderRadius: 8,
                    maxWidth: 500,
                    width: "90%",
                    maxHeight: "90vh",
                    overflowY: "auto",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Add New Event</h3>
                  <form
                    onSubmit={handleAddEvent}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontWeight: "500",
                        }}
                      >
                        Event Title *
                      </label>
                      <input
                        type="text"
                        value={newEventTitle}
                        onChange={(e) =>
                          setNewEventTitle(e.target.value)
                        }
                        placeholder="e.g., Client Meeting"
                        required
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: 4,
                          border: "1px solid #ddd",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontWeight: "500",
                        }}
                      >
                        Date *
                      </label>
                      <input
                        type="date"
                        value={newEventDate}
                        onChange={(e) =>
                          setNewEventDate(e.target.value)
                        }
                        required
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: 4,
                          border: "1px solid #ddd",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: 4,
                            fontWeight: "500",
                          }}
                        >
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={newEventStartTime}
                          onChange={(e) =>
                            setNewEventStartTime(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: 4,
                            border: "1px solid #ddd",
                          }}
                        />
                        <small style={{ color: "#666" }}>
                          Leave empty for all-day
                        </small>
                      </div>

                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: 4,
                            fontWeight: "500",
                          }}
                        >
                          End Time
                        </label>
                        <input
                          type="time"
                          value={newEventEndTime}
                          onChange={(e) =>
                            setNewEventEndTime(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: 4,
                            border: "1px solid #ddd",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontWeight: "500",
                        }}
                      >
                        Formality Level
                      </label>
                      <select
                        value={newEventFormality}
                        onChange={(e) =>
                          setNewEventFormality(e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: 4,
                          border: "1px solid #ddd",
                        }}
                      >
                        <option value="casual">👕 Casual</option>
                        <option value="business">👔 Business</option>
                        <option value="formal">🎩 Formal</option>
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          backgroundColor: "#4285F4",
                          color: "white",
                          padding: "12px 24px",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          flex: 1,
                          fontWeight: "500",
                        }}
                      >
                        Add Event
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddEventModal(false);
                          setNewEventTitle("");
                          setNewEventDate("");
                          setNewEventStartTime("");
                          setNewEventEndTime("");
                          setNewEventFormality("casual");
                        }}
                        style={{
                          backgroundColor: "#6b7280",
                          color: "white",
                          padding: "12px 24px",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          flex: 1,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Manual outfit creation controls */}
            {isLoggedIn && (
              <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => setShowCreateOutfit(!showCreateOutfit)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: showCreateOutfit ? "#4285F4" : "#e5e7eb",
                    color: showCreateOutfit ? "white" : "#333",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {showCreateOutfit ? "Cancel Selection" : "Create Outfit Manually"}
                </button>
                {showCreateOutfit && (
                  <>
                    <span style={{ fontSize: 14, color: "#666" }}>
                      Click items below to select them for your outfit
                    </span>
                    <button
                      onClick={createOutfitManually}
                      disabled={!selectedItems.top && !selectedItems.bottom}
                      style={{
                        padding: "8px 16px",
                        backgroundColor: (!selectedItems.top && !selectedItems.bottom) ? "#ccc" : "#059669",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: (!selectedItems.top && !selectedItems.bottom) ? "not-allowed" : "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Save Outfit
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Selected items preview */}
            {showCreateOutfit && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: "#f0f4ff",
                borderRadius: 8,
                border: "1px solid #4285F4",
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Selected Items:</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
                  <span>Top: {selectedItems.top?.name || "None"}</span>
                  <span>Bottom: {selectedItems.bottom?.name || "None"}</span>
                  <span>Shoes: {selectedItems.shoes?.name || "None"}</span>
                  <span>Outerwear: {selectedItems.outerwear?.name || "None"}</span>
                </div>
              </div>
            )}

            {/* Items grid */}
            <h3>Your Items</h3>
            <div className="items-grid">
              {displayItems.map((it) => {
                const isSelected = selectedItems[it.category]?.id === it.id;
                return (
                  <div
                    key={it.id}
                    className="item-card"
                    onClick={() => showCreateOutfit && toggleItemSelection(it)}
                    style={{
                      cursor: showCreateOutfit ? "pointer" : "default",
                      border: isSelected ? "3px solid #4285F4" : undefined,
                      backgroundColor: isSelected ? "#f0f4ff" : undefined,
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={it.image_url}
                      alt={it.name}
                      className="item-card__image"
                    />
                    <div className="item-card__name">{it.name}</div>
                    <div className="item-card__meta">
                      {`${it.category} - ${it.color}`}
                    </div>
                    {isSelected && (
                      <div style={{ fontSize: 12, color: "#4285F4", fontWeight: 600, marginTop: 4 }}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}

            {/* Outfits Tab Content */}
            {activeTab === "outfits" && (
              <>
                {/* Filter Controls */}
                <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <label style={{ marginRight: 8, fontSize: 14, fontWeight: 500 }}>Category:</label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      style={{ padding: "6px 12px", borderRadius: 4, border: "1px solid #ddd" }}
                    >
                      <option value="all">All Categories</option>
                      <option value="casual">Casual</option>
                      <option value="formal">Formal</option>
                      <option value="work">Work</option>
                      <option value="athletic">Athletic</option>
                      <option value="party">Party</option>
                      <option value="date">Date</option>
                      <option value="travel">Travel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    style={{
                      padding: "6px 12px",
                      background: showFavoritesOnly ? "#4285F4" : "#f0f0f0",
                      color: showFavoritesOnly ? "white" : "black",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {showFavoritesOnly ? "★ Showing Favorites" : "☆ Show Favorites Only"}
                  </button>
                </div>

                {/* Outfits Grid */}
                <h3>My Saved Outfits</h3>
                {displayOutfits.length === 0 ? (
                  <p style={{ color: "#666", fontStyle: "italic" }}>
                    No saved outfits yet. Go to "My Items" tab and use "Suggest Outfit" or "Create Outfit Manually" to add some!
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                    {displayOutfits
                      .filter((outfit) => {
                        if (filterCategory !== "all" && outfit.category !== filterCategory) return false;
                        if (showFavoritesOnly && !outfit.is_favorite) return false;
                        return true;
                      })
                      .map((outfit) => (
                        <div
                          key={outfit.id}
                          style={{
                            border: "1px solid #ddd",
                            borderRadius: 12,
                            padding: 16,
                            backgroundColor: "#fafafa",
                          }}
                        >
                          {/* Outfit Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                            <div style={{ flex: 1 }}>
                              {editingOutfitId === outfit.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  <input
                                    type="text"
                                    value={editOutfitName}
                                    onChange={(e) => setEditOutfitName(e.target.value)}
                                    placeholder="Outfit name"
                                    style={{ padding: "6px 8px", fontSize: 14, border: "1px solid #ddd", borderRadius: 4 }}
                                  />
                                  <select
                                    value={editOutfitCategory}
                                    onChange={(e) => setEditOutfitCategory(e.target.value)}
                                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid #ddd", borderRadius: 4 }}
                                  >
                                    <option value="casual">Casual</option>
                                    <option value="formal">Formal</option>
                                    <option value="work">Work</option>
                                    <option value="athletic">Athletic</option>
                                    <option value="party">Party</option>
                                    <option value="date">Date</option>
                                    <option value="travel">Travel</option>
                                    <option value="other">Other</option>
                                  </select>
                                  <textarea
                                    value={editOutfitNotes}
                                    onChange={(e) => setEditOutfitNotes(e.target.value)}
                                    placeholder="Notes (optional)"
                                    rows={2}
                                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid #ddd", borderRadius: 4, resize: "vertical" }}
                                  />
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      onClick={() => saveOutfitEdits(outfit.id)}
                                      style={{ padding: "6px 12px", backgroundColor: "#059669", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      style={{ padding: "6px 12px", backgroundColor: "#6b7280", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span
                                      onClick={() => toggleFavorite(outfit.id, outfit.is_favorite)}
                                      style={{ cursor: "pointer", fontSize: 18 }}
                                    >
                                      {outfit.is_favorite ? "★" : "☆"}
                                    </span>
                                    <span style={{ fontWeight: 600, fontSize: 16 }}>{outfit.name}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                                    <span style={{
                                      backgroundColor: "#e5e7eb",
                                      padding: "2px 8px",
                                      borderRadius: 4,
                                      marginRight: 8,
                                    }}>
                                      {outfit.category || "casual"}
                                    </span>
                                    {new Date(outfit.created_at).toLocaleDateString()}
                                  </div>
                                  {outfit.notes && (
                                    <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontStyle: "italic" }}>
                                      {outfit.notes}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            {editingOutfitId !== outfit.id && (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => startEditingOutfit(outfit)}
                                  style={{ padding: "4px 8px", backgroundColor: "#4285F4", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm("Delete this outfit?")) deleteOutfit(outfit.id);
                                  }}
                                  style={{ padding: "4px 8px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Outfit Items */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                            {[
                              { label: "Top", item: outfit.top },
                              { label: "Bottom", item: outfit.bottom },
                              { label: "Shoes", item: outfit.shoes },
                              { label: "Outerwear", item: outfit.outerwear },
                            ].map(({ label, item }) => (
                              <div key={label} style={{ fontSize: 12 }}>
                                <div style={{ fontWeight: 500, color: "#666" }}>{label}:</div>
                                {item ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }}
                                    />
                                    <span>{item.name}</span>
                                  </div>
                                ) : (
                                  <span style={{ color: "#999" }}>None</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Weather/Event Context */}
                          {(outfit.weather_temp || outfit.event_title) && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee", fontSize: 12, color: "#666" }}>
                              {outfit.weather_temp && (
                                <div>🌤️ {outfit.weather_temp}°F - {outfit.weather_condition}</div>
                              )}
                              {outfit.event_title && (
                                <div>📅 {outfit.event_title} ({outfit.event_formality})</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </section>
        ) : (
          <AuthPage
            mode={activePage}
            onLogin={(profile) => {
              setCurrentUser(profile);
              setActivePage("home");
              updateLocationHash("home");
              setMessage("");
            }}
          />
        )}
      </div>
    </div>
  );
}

// Lightweight Supabase-backed auth prototype
function AuthPage({ mode, onLogin }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [closetSize, setClosetSize] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState("success");
  const [loading, setLoading] = useState(false);

  const title = isSignup ? "Create your WearHouse account" : "Welcome back";
  const cta = isSignup ? "Sign Up" : "Log In";

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("");
    setStatusTone("success");
    setLoading(true);

    try {
      if (isSignup) {
        // Signup writes a row into the legacy users table
        const closet = closetSize ? Number(closetSize) : null;
        const zip = zipCode ? Number(zipCode) : null;
        const emailValue = email.trim().toLowerCase();
        const { data, error } = await supabase
          .from("users")
          .insert({
            user_email: emailValue,
            user_password: password,
            user_closet: Number.isFinite(closet) ? closet : null,
            user_zip: Number.isFinite(zip) ? zip : null,
          })
          .select()
          .single();

        if (error) throw error;
        setStatusTone("success");
        setStatus(
          `Account created for ${data.user_email}. Use Log In to continue.`
        );
        setEmail("");
        setPassword("");
        setClosetSize("");
        setZipCode("");
      } else {
        // Login looks up the stored row using the raw credentials
        const emailValue = email.trim().toLowerCase();
        const { data, error } = await supabase
          .from("users")
          .select("user_id, user_email, user_closet, user_zip")
          .eq("user_email", emailValue)
          .eq("user_password", password)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setStatusTone("error");
          setStatus(
            "Email/password combination not found. Please try again."
          );
          return;
        }

        setStatusTone("success");
        setStatus(
          `Logged in as ${data.user_email}. Closet size: ${
            data.user_closet ?? "not set"
          }.`
        );
        onLogin?.({
          user_id: data.user_id,
          user_email: data.user_email ?? emailValue,
          user_closet: data.user_closet,
          user_zip: data.user_zip,
        });
      }
    } catch (err) {
      console.error(err);
      setStatusTone("error");
      setStatus(
        err.message ?? "Something went wrong while talking to Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card auth-card">
      <h2 className="auth-title">{title}</h2>
      <p className="auth-description">
        {isSignup
          ? "Store email, password, closet capacity, and zip directly inside the Supabase users table."
          : "Use the credentials you previously saved to verify the Supabase row exists."}
      </p>
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {isSignup && (
          <>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Closet size (optional number)"
              value={closetSize}
              onChange={(e) => setClosetSize(e.target.value)}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Zip code (optional number)"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
            />
          </>
        )}
        <button type="submit" disabled={loading}>
          {loading ? "Working..." : cta}
        </button>
      </form>
      {status && (
        <div
          className={`auth-status ${
            statusTone === "success" ? "is-success" : "is-error"
          }`}
        >
          {status}
        </div>
      )}
    </section>
  );
}
