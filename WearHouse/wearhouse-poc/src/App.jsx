import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import "./App.css";

// Log environment variables for debugging
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('ANON:', import.meta.env.VITE_SUPABASE_ANON?.slice(0, 10) + '...');
console.log(import.meta.env)

// Initialize Supabase client with env configuration
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON
);

// Send image to proxy and return background-removed PNG as File
async function removeBackgroundOnServer(file) {
  const fd = new FormData();
  fd.append('file', file);

  const resp = await fetch('http://localhost:3001/remove-bg', {
    method: 'POST',
    body: fd,
  });

  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok || !ct.includes('image/png')) {
    // Throw readable error when remove.bg fails
    const txt = await resp.text();
    throw new Error(`remove-bg failed (${resp.status}): ${txt}`);
  }

  // Produce a new PNG File with transparent background
  const ab = await resp.arrayBuffer();
  const cleanedName = file.name.replace(/\.\w+$/, '') + '-nobg.png';
  return new File([ab], cleanedName, { type: 'image/png' });
}

// Provide mock weather data to exercise outfit rules
async function getMockWeather() {
  return { tempF: 55, condition: "Rain" };
}

// Provide mock calendar event to exercise outfit rules
async function getMockCalendarEvent() {
  return { title: "Client Presentation", formality: "formal" };
}

// Navigation tabs used for a simple hash-based router
const NAV_LINKS = [
  { id: "home", label: "Home" },
  { id: "signup", label: "Sign Up" },
  { id: "login", label: "Log In" },
];

// Cache ids so we can validate arbitrary hashes
const NAV_LINK_IDS = NAV_LINKS.map(link => link.id);

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
  // Manage UI state for navigation, items, form inputs, and status messages
  const [activePage, setActivePage] = useState(initialPage);
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("top");
  const [color, setColor] = useState("black");
  const [message, setMessage] = useState("");
  // Track the logged-in Supabase user so uploads/queries can be scoped
  const [currentUser, setCurrentUser] = useState(null);

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

  // Whenever the logged-in user changes, refresh their closet items
  useEffect(() => {
    if (!currentUser?.user_id) {
      setItems([]);
      return;
    }
    loadItems(currentUser.user_id);
  }, [currentUser?.user_id]);

  // Keep nav state in sync if user edits the hash manually
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleHashChange = () => setActivePage(pageFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Handle upload: remove background  -  upload to storage  -  insert DB row
  async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser?.user_id) {
      setMessage("Please log in before uploading items.");
      return;
    }
    if (!file) return;

    // Remove background via proxy with graceful fallback
    setMessage('Removing background.');
    let processedFile = file;
    try {
      processedFile = await removeBackgroundOnServer(file);
    } catch (err) {
      console.error(err);
      setMessage('Background removal failed, uploading original instead.');
    }

    // Upload processed file to Supabase Storage
    setMessage('Uploading to storage.');
    const filename = `${crypto.randomUUID()}-${processedFile.name}`;
    const { data: upload, error: upErr } = await supabase.storage
      .from('items')
      .upload(filename, processedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: processedFile.type || 'image/png',
      });
    // if (upErr) { setMessage('Upload failed: ' + upErr.message); return; }
    if (upErr) {
      console.error('upload error', upErr);
      setMessage('Upload failed: ' + upErr.message);
      return;
    }

    // Persist public URL and metadata in items table
    const { data: pub } = supabase.storage.from('items').getPublicUrl(upload.path);
    const image_url = pub.publicUrl;

    const { error: dbErr } = await supabase.from('items').insert({
      name, category, color, image_url, user_id: currentUser.user_id
    });
    if (dbErr) { setMessage('DB insert failed: ' + dbErr.message); return; }

    // Reset form and refresh list
    setMessage('Added item with background removed!');
    setName(''); setCategory('top'); setColor('black'); setFile(null);
    await loadItems(currentUser.user_id);
  }

  // Generate a simple outfit using mock weather/calendar and color rules
  async function suggestOutfit() {
    setMessage("Generating...");
    const weather = await getMockWeather();
    const event = await getMockCalendarEvent();

    const tops = items.filter(i => i.category === "top");
    const bottoms = items.filter(i => i.category === "bottom");

    if (!tops.length || !bottoms.length) {
      setMessage("Need at least one top and one bottom to suggest an outfit.");
      return;
    }

    // Prefer darker palette when cold/rainy/formal
    const preferDark = weather.tempF < 60 || weather.condition.includes("Rain") || event.formality === "formal";
    const colorOk = (c) => preferDark ? ["black", "navy", "gray", "brown"].includes(c.toLowerCase()) : true;

    // Choose first matching items or fall back to first available
    const top = tops.find(t => colorOk(t.color)) ?? tops[0];
    const bottom = bottoms.find(b => colorOk(b.color)) ?? bottoms[0];

    // Present recommendation summary in status line
    setMessage(
      `Weather ${weather.tempF} deg F ${weather.condition}; Event: ${event.title} (${event.formality}). ` +
      `Outfit - Top: ${top.name} (${top.color}), Bottom: ${bottom.name} (${bottom.color}).`
    );
  }

  const isHome = activePage === "home";
  const isLoggedIn = Boolean(currentUser?.user_id);

  function handleLogout() {
    setCurrentUser(null);
    setItems([]);
    setMessage('');
  }

  return (
    <div className="app-shell">
      <div className="app-inner">
        <header className="app-header">
          <div>
            <h1 className="app-title">WearHouse POC</h1>
          </div>
          <nav className="app-nav">
            {NAV_LINKS.map(link => (
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
                {`Logged in as ${currentUser.user_email}`}
              </span>
              <button type="button" className="logout-button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </header>

        {isHome ? (
          <section className="card home-card">
            {!isLoggedIn && (
              <div className="login-alert">
                Log in to upload clothing items and view your personal closet.
              </div>
            )}
            <form onSubmit={handleUpload} className="item-form">
              <input placeholder="Item name (e.g., Blue Oxford)" value={name} onChange={e => setName(e.target.value)} required />
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="top">top</option>
                <option value="bottom">bottom</option>
                <option value="outerwear">outerwear</option>
                <option value="shoes">shoes</option>
                <option value="accessory">accessory</option>
              </select>
              <input placeholder="Color (e.g., navy)" value={color} onChange={e => setColor(e.target.value)} />
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} required />
              <button type="submit" disabled={!isLoggedIn}>Add Item</button>
            </form>

            <button onClick={suggestOutfit} className="suggest-button">Suggest Outfit (uses weather + calendar mocks)</button>
            <div className="status-message">{message}</div>

            <h3>Your Items</h3>
            <div className="items-grid">
              {items.map(it => (
                <div key={it.id} className="item-card">
                  <img src={it.image_url} alt={it.name} className="item-card__image" />
                  <div className="item-card__name">{it.name}</div>
                  <div className="item-card__meta">{`${it.category} - ${it.color}`}</div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <AuthPage
            mode={activePage}
            onLogin={(profile) => {
              setCurrentUser(profile);
              setActivePage("home");
              updateLocationHash("home");
              setMessage('');
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
        setStatus(`Account created for ${data.user_email}. Use Log In to continue.`);
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
          setStatus("Email/password combination not found. Please try again.");
          return;
        }

        setStatusTone("success");
        setStatus(`Logged in as ${data.user_email}. Closet size: ${data.user_closet ?? "not set"}.`);
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
      setStatus(err.message ?? "Something went wrong while talking to Supabase.");
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
        <div className={`auth-status ${statusTone === "success" ? "is-success" : "is-error"}`}>
          {status}
        </div>
      )}
    </section>
  );
}



