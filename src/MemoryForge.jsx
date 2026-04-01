/**
 * MemoryForge — Supabase Edition
 * Aesthetic: Retro-Digital Brutalism (Windows 95 × Digital Paradise)
 *
 * SETUP CHECKLIST:
 *   1. npm install @supabase/supabase-js
 *   2. Copy .env.example → .env, fill in your Supabase project keys
 *   3. Run schema.sql in Supabase → SQL Editor
 *   4. Deploy supabase/functions/ask-gemini/index.ts  (see ask-gemini.ts)
 *   5. Set GEMINI_API_KEY in Supabase → Edge Functions → Secrets
 *   6. In Supabase → Auth → URL config, add your Vercel URL as redirect URL
 *   7. In Supabase → Auth → Providers, enable GitHub OAuth
 *
 * ARCHITECTURE:
 *   Browser → Supabase (Postgres + RLS auth)
 *   Browser → /functions/v1/ask-gemini → Gemini API
 *   The Gemini key NEVER reaches the client — lives only in Supabase secrets.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// SUPABASE CLIENT
// ============================================================

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ============================================================
// DB FIELD TRANSFORMERS (snake_case ↔ camelCase)
// ============================================================

function cardToDb(card, userId) {
  return {
    id: card.id,
    user_id: userId,
    deck_id: card.deckId,
    front: card.front,
    back: card.back,
    tags: card.tags,
    interval: card.interval,
    ease_factor: card.easeFactor,
    repetitions: card.repetitions,
    next_review: card.nextReview,
    last_review: card.lastReview,
    review_history: card.reviewHistory,
    created_at: card.createdAt,
  };
}

function dbToCard(row) {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    tags: row.tags || [],
    type: "text",
    imageUrl: null,
    occlusionBoxes: [],
    audioUrl: null,
    interval: row.interval || 1,
    easeFactor: row.ease_factor || 2.5,
    repetitions: row.repetitions || 0,
    nextReview: row.next_review,
    lastReview: row.last_review,
    reviewHistory: row.review_history || [],
    createdAt: row.created_at,
  };
}

function deckToDb(deck, userId) {
  return {
    id: deck.id,
    user_id: userId,
    name: deck.name,
    description: deck.description,
    color: deck.color,
    emoji: deck.emoji,
    created_at: deck.createdAt,
  };
}

function dbToDeck(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    color: row.color || "#0066FF",
    emoji: row.emoji || "📚",
    createdAt: row.created_at,
  };
}

// ============================================================
// SUPABASE SERVICE
// Replaces the old window.storage layer. Each method maps to
// a Supabase operation. RLS policies on the DB ensure users
// can only read/write their own rows.
// ============================================================

const DB = {
  async getCards() {
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(dbToCard);
  },

  async upsertCard(card) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("cards")
      .upsert(cardToDb(card, user.id), { onConflict: "id" });
    if (error) throw error;
  },

  async deleteCard(id) {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) throw error;
  },

  async getDecks() {
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(dbToDeck);
  },

  async upsertDeck(deck) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("decks")
      .upsert(deckToDb(deck, user.id), { onConflict: "id" });
    if (error) throw error;
  },

  /**
   * Calls the ask-gemini Edge Function.
   * The Gemini key lives in Supabase secrets — never in the client.
   */
  async askGemini(prompt) {
    const { data, error } = await supabase.functions.invoke("ask-gemini", {
      body: { prompt },
    });
    if (error) throw new Error(error.message || "Edge function error");
    return data.text;
  },
};

// ============================================================
// CARD ENGINE — SM-2 Algorithm
// ============================================================

const CardEngine = {
  /** SM-2: quality 0 (blackout) to 5 (perfect) */
  processReview(card, quality) {
    let { interval, easeFactor, repetitions } = card;
    if (quality < 3) {
      repetitions = 0;
      interval = 1;
    } else {
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * easeFactor);
      repetitions += 1;
      easeFactor = Math.max(
        1.3,
        easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
      );
    }
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    return {
      ...card,
      interval,
      easeFactor: Math.round(easeFactor * 100) / 100,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReview: new Date().toISOString(),
      reviewHistory: [...(card.reviewHistory || []), quality],
    };
  },

  getDueCards: (cards) => {
    const now = new Date();
    return cards.filter((c) => !c.nextReview || new Date(c.nextReview) <= now);
  },

  getWrongCards: (cards) =>
    cards.filter((c) => {
      const h = c.reviewHistory || [];
      return h.length > 0 && h[h.length - 1] < 3;
    }),

  createCard: (data) => ({
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    front: "", back: "", tags: [], type: "text",
    imageUrl: null, occlusionBoxes: [], audioUrl: null,
    interval: 1, easeFactor: 2.5, repetitions: 0,
    nextReview: null, lastReview: null,
    createdAt: new Date().toISOString(),
    reviewHistory: [], deckId: "",
    ...data,
  }),

  getMastery: (card) => {
    if (card.interval > 30) return { label: "MASTERED", color: "#00FF88" };
    if (card.interval > 7)  return { label: "FAMILIAR", color: "#00CCFF" };
    if (card.repetitions > 0) return { label: "LEARNING", color: "#FFD600" };
    return { label: "NEW", color: "#BB88FF" };
  },
};

// ============================================================
// SEED DATA — inserted into DB on first login
// ============================================================

const SEED_DECKS = [
  { id: "deck_1", name: "Biology", description: "Cell biology & genetics", color: "#00FF88", emoji: "🧬", createdAt: new Date().toISOString() },
  { id: "deck_2", name: "History", description: "Key world events", color: "#FFD600", emoji: "🏛", createdAt: new Date().toISOString() },
  { id: "deck_3", name: "Math", description: "Calculus & algebra", color: "#00CCFF", emoji: "∑", createdAt: new Date().toISOString() },
];

const SEED_CARDS = [
  CardEngine.createCard({ id: "c1", front: "What is mitosis?", back: "Cell division producing two identical daughter cells.\n\nPhases: Prophase → Metaphase → Anaphase → Telophase", tags: ["cell", "division"], deckId: "deck_1", repetitions: 3, interval: 8 }),
  CardEngine.createCard({ id: "c2", front: "DNA stands for?", back: "Deoxyribonucleic Acid\n\nThe double-helix molecule encoding all genetic information.", tags: ["genetics"], deckId: "deck_1" }),
  CardEngine.createCard({ id: "c3", front: "Powerhouse of the cell?", back: "The Mitochondria\n\nProduces ATP via cellular respiration through the Krebs cycle.", tags: ["cell", "energy"], deckId: "deck_1", repetitions: 6, interval: 21 }),
  CardEngine.createCard({ id: "c4", front: "French Revolution began?", back: "1789\n\nStorming of the Bastille — July 14th.", tags: ["france"], deckId: "deck_2", repetitions: 2, interval: 6 }),
  CardEngine.createCard({ id: "c5", front: "The Pythagorean Theorem", back: "a² + b² = c²\n\nFor right triangles: square of hypotenuse = sum of squares of other two sides.", tags: ["geometry"], deckId: "deck_3", repetitions: 4, interval: 14 }),
  CardEngine.createCard({ id: "c6", front: "Derivative of sin(x)?", back: "cos(x)\n\nAnd: d/dx[cos(x)] = −sin(x)", tags: ["calculus"], deckId: "deck_3" }),
];

// ============================================================
// MARKDOWN RENDERER (minimal)
// ============================================================

const md = (text = "") =>
  text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, `<code>$1</code>`)
    .replace(/\n/g, "<br/>");

// ============================================================
// DESIGN SYSTEM — Retro-Digital Brutalism
// ============================================================

const C = {
  // Backgrounds
  bg:      "#DDE4CC",   // cream sage — matches the image background
  panel:   "#FFFFFF",
  raised:  "#F5F5EE",
  // Structure
  border:  "#1144DD",   // cobalt blue — window chrome
  shadow:  "#1144DD",   // hard offset, same color
  // Typography
  text:    "#000055",
  textSub: "#4455AA",
  textHint:"#8899CC",
  // Vivid accent palette
  cyan:    "#00CCFF",
  green:   "#00FF88",
  pink:    "#FF1155",
  gold:    "#FFD600",
  purple:  "#BB88FF",
  orange:  "#FF7700",
  // Semantic
  again:   "#FF1155",
  hard:    "#FF8800",
  good:    "#0099FF",
  easy:    "#00FF88",
};

// ============================================================
// REUSABLE RETRO COMPONENTS
// ============================================================

/**
 * Window — reusable panel with blue titlebar + pixel shadow.
 * Every major UI surface uses this component.
 */
function Win({ title, children, controls = true, style = {}, titleRight = null }) {
  return (
    <div style={{
      border: `2px solid ${C.border}`,
      boxShadow: `4px 4px 0 ${C.shadow}`,
      background: C.panel,
      ...style,
    }}>
      {/* Titlebar */}
      <div style={{
        background: C.border,
        padding: "5px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        userSelect: "none",
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 8,
          color: "#FFFFFF",
          letterSpacing: 0.5,
          lineHeight: 1,
        }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {titleRight}
          {controls && (
            <>
              {["_", "□", "×"].map((s) => (
                <span key={s} style={{
                  width: 14, height: 14,
                  background: "#FFFFFF22",
                  border: "1px solid #FFFFFF44",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "monospace", fontSize: 9, color: "#FFFFFF",
                  cursor: "default", lineHeight: 1,
                }}>{s}</span>
              ))}
            </>
          )}
        </div>
      </div>
      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

/**
 * PixelBtn — retro dialog button with chunky border and hover lift.
 */
function PixelBtn({ children, onClick, color = C.border, bg = "transparent", disabled = false, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        letterSpacing: 0.5,
        color: hover ? C.panel : color,
        background: hover ? color : bg,
        border: `2px solid ${color}`,
        boxShadow: hover ? "none" : `3px 3px 0 ${color}`,
        transform: hover ? "translate(2px,2px)" : "none",
        padding: "10px 16px",
        cursor: disabled ? "default" : "pointer",
        transition: "all .12s ease",
        opacity: disabled ? 0.4 : 1,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * PixelTag — inline badge for deck/mastery labels.
 */
function PixelTag({ children, color = C.border }) {
  return (
    <span style={{
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 7,
      color,
      border: `1.5px solid ${color}`,
      padding: "3px 7px",
      letterSpacing: 0.5,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

/**
 * SegmentBar — pixel-art segmented loading/progress bar.
 */
function SegmentBar({ progress = 0, color = C.border, segments = 12, style = {} }) {
  const filled = Math.round((progress / 100) * segments);
  return (
    <div style={{ display: "flex", gap: 3, ...style }}>
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} style={{
          width: 18, height: 16,
          background: i < filled ? color : "transparent",
          border: `1.5px solid ${color}`,
          transition: "background .2s ease",
        }} />
      ))}
    </div>
  );
}

/**
 * Toggle — retro on/off switch styled as a checkbox button.
 */
function ToggleBtn({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 7,
      border: `2px solid ${C.border}`,
      boxShadow: `2px 2px 0 ${C.border}`,
      background: value ? C.border : "transparent",
      color: value ? C.panel : C.border,
      padding: "5px 10px",
      cursor: "pointer",
      letterSpacing: 0.5,
      lineHeight: 1,
      transition: "all .12s",
    }}>
      {value ? "ON" : "OFF"}
    </button>
  );
}

// ============================================================
// ROOT APP
// ============================================================

export default function MemoryForge() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [decks, setDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [studyConfig, setStudyConfig] = useState({ shuffle: true, wrongsOnly: false, reversed: false, limit: 20 });
  const [editingCard, setEditingCard] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [filterDeck, setFilterDeck] = useState("all");

  // ── Auth listener ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data after login ──────────────────────────────────
  useEffect(() => {
    if (!session) return;
    (async () => {
      setDataLoading(true);
      try {
        const [dbCards, dbDecks] = await Promise.all([DB.getCards(), DB.getDecks()]);
        if (dbDecks.length === 0) {
          // First-time user: seed sample data
          await Promise.all(SEED_DECKS.map((d) => DB.upsertDeck(d)));
          await Promise.all(SEED_CARDS.map((c) => DB.upsertCard(c)));
          setDecks(SEED_DECKS);
          setCards(SEED_CARDS);
        } else {
          setDecks(dbDecks);
          setCards(dbCards);
        }
      } catch (e) {
        console.error("Data load error:", e);
      }
      setDataLoading(false);
    })();
  }, [session]);

  // ── Card CRUD (update DB + local state) ───────────────────
  const updateCard = useCallback(async (updated) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    try { await DB.upsertCard(updated); } catch (e) { console.error(e); }
  }, []);

  const createCard = useCallback(async (c) => {
    setCards((prev) => [...prev, c]);
    try { await DB.upsertCard(c); } catch (e) { console.error(e); }
  }, []);

  const deleteCard = useCallback(async (id) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    try { await DB.deleteCard(id); } catch (e) { console.error(e); }
  }, []);

  const navTo = useCallback((v) => { setView(v); setAiOpen(false); }, []);
  const signOut = () => supabase.auth.signOut();

  // ── Screens ────────────────────────────────────────────────
  if (authLoading) return <BootScreen label="AUTHENTICATING..." />;
  if (!session)    return <AuthView />;
  if (dataLoading) return <BootScreen label="LOADING CARDS..." />;

  const user = session.user;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border:2px solid ${C.bg}}
        input,textarea,select{font-family:monospace;background:${C.raised};border:2px solid ${C.border};color:${C.text};padding:8px 10px;font-size:13px;outline:none;border-radius:0}
        input:focus,textarea:focus,select:focus{box-shadow:3px 3px 0 ${C.border}}
        @keyframes scanline{0%{background-position:0 0}100%{background-position:0 100%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes glitch{0%,100%{transform:none;filter:none}92%{transform:skewX(0)}94%{transform:skewX(-3deg);filter:hue-rotate(60deg)}96%{transform:skewX(3deg)}98%{transform:none}}
        .fade-in{animation:fadeUp .3s ease both}
        .blink{animation:blink 1.2s step-end infinite}
        .glitch{animation:glitch 4s infinite}
      `}</style>

      {/* ── SIDEBAR ────────────────────────────────────────── */}
      <aside style={{ width: 200, flexShrink: 0, background: C.panel, borderRight: `2px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
        {/* Logo */}
        <div style={{ background: C.border, padding: "16px 14px", borderBottom: `2px solid ${C.border}` }}>
          <div className="glitch" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#FFFFFF", lineHeight: 1.6, letterSpacing: 0.5 }}>
            MEMORY<br/>FORGE
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#AABBFF", marginTop: 6, letterSpacing: 0.5 }}>
            SM-2 ENGINE v2.0
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {[
            { id: "dashboard", label: "DASHBOARD" },
            { id: "study",     label: "STUDY.EXE"  },
            { id: "creator",   label: "CREATOR"    },
            { id: "library",   label: "LIBRARY"    },
          ].map((item) => (
            <button key={item.id} onClick={() => navTo(item.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "11px 16px",
              fontFamily: "'Press Start 2P', monospace", fontSize: 7,
              letterSpacing: 0.5, lineHeight: 1,
              color: view === item.id ? C.panel : C.text,
              background: view === item.id ? C.border : "transparent",
              border: "none",
              borderLeft: view === item.id ? `4px solid ${C.cyan}` : "4px solid transparent",
              cursor: "pointer",
              transition: "all .12s",
            }}>
              {item.label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: `2px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: C.textSub, marginBottom: 6, letterSpacing: 0.5 }}>LOGGED IN AS</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: C.text, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.user_metadata?.user_name || user.email?.split("@")[0] || "USER"}
          </div>
          <button onClick={signOut} style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 6,
            color: C.pink, border: `1.5px solid ${C.pink}`,
            background: "transparent", padding: "5px 8px", cursor: "pointer",
            letterSpacing: 0.3,
          }}>SIGN OUT</button>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {view === "dashboard" && <DashboardView cards={cards} decks={decks} studyConfig={studyConfig} setStudyConfig={setStudyConfig} navTo={navTo} />}
        {view === "study"     && <StudyView cards={cards} decks={decks} studyConfig={studyConfig} onCardUpdate={updateCard} aiOpen={aiOpen} setAiOpen={setAiOpen} />}
        {view === "creator"   && <CreatorView cards={cards} decks={decks} onCardCreate={createCard} onCardUpdate={updateCard} editingCard={editingCard} setEditingCard={setEditingCard} />}
        {view === "library"   && <LibraryView cards={cards} decks={decks} filterDeck={filterDeck} setFilterDeck={setFilterDeck} onDelete={deleteCard} onEdit={(c) => { setEditingCard(c); navTo("creator"); }} />}
      </main>
    </div>
  );
}

// ============================================================
// BOOT SCREEN
// ============================================================

function BootScreen({ label }) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg((s) => Math.min(s + 1, 12)), 90);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 20, color: C.border, marginBottom: 20 }}>
          MEMORYFORGE
        </div>
        <SegmentBar progress={(seg / 12) * 100} style={{ justifyContent: "center", marginBottom: 14 }} />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.textSub, letterSpacing: 1 }}>
          {label} <span className="blink">_</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUTH VIEW
// ============================================================

function AuthView() {
  const [loading, setLoading] = useState(false);
  const [seg, setSeg] = useState(0);

  const signIn = async () => {
    setLoading(true);
    const t = setInterval(() => setSeg((s) => Math.min(s + 1, 12)), 80);
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: window.location.origin },
    });
    clearInterval(t);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Win title="MEMORYFORGE.EXE — WELCOME" style={{ width: 420 }} controls={false}>
        <div style={{ padding: "32px 28px", textAlign: "center" }}>
          {/* Title */}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 18, color: C.border, lineHeight: 1.6, marginBottom: 6 }}>
            MEMORY<br/>FORGE
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSub, letterSpacing: 1, marginBottom: 28 }}>
            SM-2 SPACED REPETITION ENGINE
          </div>

          {/* Loading bar */}
          <div style={{ marginBottom: 6 }}>
            <SegmentBar progress={loading ? (seg / 12) * 100 : 0} />
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSub, marginBottom: 28, height: 14 }}>
            {loading ? <>CONNECTING... <span className="blink">_</span></> : "READY"}
          </div>

          {/* Sign in */}
          <PixelBtn onClick={signIn} disabled={loading} style={{ width: "100%", justifyContent: "center", display: "block" }}>
            {loading ? "AUTHENTICATING..." : "[ SIGN IN WITH GITHUB ]"}
          </PixelBtn>

          {/* Divider */}
          <div style={{ borderTop: `2px solid ${C.border}`, margin: "24px 0", opacity: 0.3 }} />

          {/* Tagline */}
          <Win title="NOTE" controls={false} style={{ textAlign: "left" }}>
            <div style={{ padding: "14px 16px", fontFamily: "'VT323', monospace", fontSize: 18, color: C.text, lineHeight: 1.5 }}>
              "A WORLD INSIDE THE COMPUTER<br/>WHERE FORGETTING NEVER WAS."
            </div>
          </Win>
        </div>
      </Win>
    </div>
  );
}

// ============================================================
// DASHBOARD VIEW
// ============================================================

function DashboardView({ cards, decks, studyConfig, setStudyConfig, navTo }) {
  const due = CardEngine.getDueCards(cards).length;
  const mastered = cards.filter((c) => c.interval > 30).length;
  const learned = cards.filter((c) => c.repetitions > 0).length;
  const hour = new Date().getHours();
  const greeting = ["MORNING", "AFTERNOON", "EVENING"][[0, 12, 17].findLastIndex((h) => hour >= h)];

  const stats = [
    { label: "DUE TODAY", val: due,          color: C.pink   },
    { label: "TOTAL",     val: cards.length,  color: C.border },
    { label: "LEARNED",   val: learned,       color: C.cyan   },
    { label: "MASTERED",  val: mastered,      color: C.green  },
  ];

  return (
    <div style={{ padding: "40px 44px", maxWidth: 1020 }} className="fade-in">
      {/* Header */}
      <Win title={`${greeting} SESSION`} style={{ marginBottom: 28 }}>
        <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 36, color: C.text, lineHeight: 1 }}>
            {due > 0
              ? <><span style={{ color: C.border }}>{due}</span> CARD{due !== 1 ? "S" : ""} READY FOR REVIEW</>
              : "ALL CAUGHT UP — WELL DONE"}
          </div>
          <PixelBtn onClick={() => navTo("study")} color={C.green} style={{ flexShrink: 0 }}>
            START.EXE →
          </PixelBtn>
        </div>
      </Win>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {stats.map((s, i) => (
          <Win key={i} title={s.label} controls={false} style={{ animation: `fadeUp .3s ease ${i * 0.06}s both` }}>
            <div style={{ padding: "18px 20px" }}>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 56, color: s.color, lineHeight: 1, marginBottom: 2 }}>
                {s.val}
              </div>
            </div>
          </Win>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Session config */}
        <Win title="SESSION CONFIG">
          <div style={{ padding: "20px" }}>
            {[
              { key: "shuffle",    label: "SHUFFLE CARDS",  desc: "Randomize order"         },
              { key: "wrongsOnly", label: "WRONGS ONLY",    desc: "Review failed cards"      },
              { key: "reversed",   label: "REVERSE MODE",   desc: "Answer → Question"        },
            ].map((opt) => (
              <div key={opt.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.text, marginBottom: 4, letterSpacing: 0.5 }}>{opt.label}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: C.textSub }}>{opt.desc}</div>
                </div>
                <ToggleBtn value={studyConfig[opt.key]} onChange={(v) => setStudyConfig((c) => ({ ...c, [opt.key]: v }))} />
              </div>
            ))}
            <div style={{ borderTop: `2px dashed ${C.border}30`, paddingTop: 16, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.text, letterSpacing: 0.5 }}>SESSION LIMIT</div>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: C.border, lineHeight: 1 }}>{studyConfig.limit}</div>
              </div>
              <input type="range" min={5} max={100} step={1} value={studyConfig.limit}
                onChange={(e) => setStudyConfig((c) => ({ ...c, limit: +e.target.value }))}
                style={{ width: "100%", accentColor: C.border, height: 4, border: "none", background: "none", padding: 0 }} />
            </div>
          </div>
        </Win>

        {/* Deck list */}
        <Win title="DECKS">
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {decks.map((deck) => {
              const dc = cards.filter((c) => c.deckId === deck.id);
              const dueCount = CardEngine.getDueCards(dc).length;
              return (
                <div key={deck.id} onClick={() => navTo("study")} style={{
                  border: `2px solid ${C.border}`,
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all .12s",
                  borderLeft: `5px solid ${deck.color}`,
                }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `3px 3px 0 ${C.border}`; e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                  <div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.text, marginBottom: 4 }}>{deck.name.toUpperCase()}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: C.textSub }}>{dc.length} cards</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {dueCount > 0 && <PixelTag color={C.pink}>{dueCount} DUE</PixelTag>}
                  </div>
                </div>
              );
            })}
          </div>
        </Win>
      </div>
    </div>
  );
}

// ============================================================
// STUDY VIEW
// ============================================================

function StudyView({ cards, decks, studyConfig, onCardUpdate, aiOpen, setAiOpen }) {
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const prevCardId = useRef(null);

  useEffect(() => {
    let pool = studyConfig.wrongsOnly ? CardEngine.getWrongCards(cards) : CardEngine.getDueCards(cards);
    if (!pool.length) pool = [...cards];
    if (studyConfig.shuffle) pool = [...pool].sort(() => Math.random() - 0.5);
    pool = pool.slice(0, studyConfig.limit);
    setQueue(pool);
    setIdx(0); setFlipped(false); setShowRate(false); setDone(false);
  }, []);

  const card = queue[idx];
  const progress = queue.length ? idx / queue.length : 0;

  // Auto-call AI when card changes and sidebar is open
  useEffect(() => {
    if (aiOpen && card?.id && card.id !== prevCardId.current) {
      prevCardId.current = card.id;
      askAI();
    }
  }, [card?.id, aiOpen]);

  const askAI = async () => {
    if (!card) return;
    setAiLoading(true); setAiContent(""); setAiError("");
    try {
      const text = await DB.askGemini(
        `You're a study tutor. Flashcard:\nFront: ${card.front}\nBack: ${card.back}\n\nProvide:\n1. Clear 2-sentence explanation\n2. A memorable analogy\n3. One interesting related fact\n\nBe concise, no headers.`
      );
      setAiContent(text);
    } catch (e) {
      setAiError(e.message || "AI request failed.");
    }
    setAiLoading(false);
  };

  const handleReveal = () => { setFlipped(true); setShowRate(true); };

  const handleRate = (quality, key) => {
    if (!card) return;
    onCardUpdate(CardEngine.processReview(card, quality));
    setStats((s) => ({ ...s, [key]: s[key] + 1 }));
    if (idx + 1 >= queue.length) { setDone(true); return; }
    setIdx((i) => i + 1);
    setFlipped(false); setShowRate(false);
  };

  if (done) {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, padding: 48 }} className="fade-in">
        <Win title="SESSION COMPLETE — RESULTS" style={{ width: 520 }}>
          <div style={{ padding: "32px" }}>
            <div style={{ fontFamily: "'VT323', monospace", fontSize: 48, color: C.green, textAlign: "center", marginBottom: 6 }}>
              COMPLETE!
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.textSub, textAlign: "center", marginBottom: 28, letterSpacing: 1 }}>
              {total} CARDS REVIEWED · SAVED TO DATABASE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28 }}>
              {[
                { l: "AGAIN", v: stats.again, c: C.again },
                { l: "HARD",  v: stats.hard,  c: C.hard  },
                { l: "GOOD",  v: stats.good,  c: C.good  },
                { l: "EASY",  v: stats.easy,  c: C.easy  },
              ].map((s) => (
                <Win key={s.l} title={s.l} controls={false}>
                  <div style={{ padding: "12px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: 44, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  </div>
                </Win>
              ))}
            </div>
            <PixelBtn onClick={() => window.location.reload()} color={C.green} style={{ width: "100%", display: "block", textAlign: "center" }}>
              [ STUDY AGAIN ]
            </PixelBtn>
          </div>
        </Win>
      </div>
    );
  }

  if (!card) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg }}>
        <Win title="WARNING: NO CARDS" controls={false}>
          <div style={{ padding: "28px 32px", fontFamily: "'VT323', monospace", fontSize: 24, color: C.text }}>
            NO CARDS TO STUDY.<br />CREATE SOME IN CREATOR TAB.
          </div>
        </Win>
      </div>
    );
  }

  const front = studyConfig.reversed ? card.back : card.front;
  const back  = studyConfig.reversed ? card.front : card.back;
  const deck  = decks.find((d) => d.id === card.deckId);
  const mastery = CardEngine.getMastery(card);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "36px 44px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {deck && <PixelTag color={deck.color || C.border}>{deck.name.toUpperCase()}</PixelTag>}
            {card.tags.map((tag) => <PixelTag key={tag} color={C.textSub}>{tag}</PixelTag>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.textSub }}>{idx + 1}/{queue.length}</span>
            <PixelBtn onClick={() => { setAiOpen((o) => !o); if (!aiOpen) askAI(); }} color={C.purple}>
              ✦ AI TUTOR
            </PixelBtn>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 36 }}>
          <SegmentBar progress={progress * 100} style={{ width: "100%" }} segments={20} />
        </div>

        {/* Card — 3D flip between two "dialog windows" */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ perspective: "1200px", width: "100%", maxWidth: 600, height: 280 }}>
            <div style={{
              width: "100%", height: "100%",
              transformStyle: "preserve-3d",
              transition: "transform .55s cubic-bezier(.4,0,.2,1)",
              transform: flipped ? "rotateY(180deg)" : "none",
              position: "relative",
            }}>
              {/* FRONT */}
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                <Win title={studyConfig.reversed ? "! ANSWER" : "? QUESTION"} controls={false}
                  titleRight={<PixelTag color={mastery.color}>{mastery.label}</PixelTag>}
                  style={{ height: "100%", cursor: !flipped ? "pointer" : "default", display: "flex", flexDirection: "column" }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 40px", textAlign: "center" }}
                    onClick={!flipped ? handleReveal : undefined}>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: 26, lineHeight: 1.55, color: C.text }}
                      dangerouslySetInnerHTML={{ __html: md(front) }} />
                    {!flipped && (
                      <div style={{ marginTop: 24, fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textHint, letterSpacing: 1 }}
                        className="blink">
                        CLICK TO REVEAL
                      </div>
                    )}
                  </div>
                </Win>
              </div>
              {/* BACK */}
              <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <Win title="! ANSWER REVEALED"
                  titleRight={<span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: C.cyan, letterSpacing: 0.5 }}>INTERVAL: {card.interval}D</span>}
                  controls={false}
                  style={{ height: "100%", borderColor: C.green, boxShadow: `4px 4px 0 ${C.green}`, display: "flex", flexDirection: "column" }}
                >
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 40px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'VT323', monospace", fontSize: 24, lineHeight: 1.6, color: C.text }}
                      dangerouslySetInnerHTML={{ __html: md(back) }} />
                  </div>
                </Win>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ marginTop: 28, minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!showRate ? (
              <PixelBtn onClick={handleReveal} color={C.border} style={{ padding: "14px 40px" }}>
                [ REVEAL ANSWER ]
              </PixelBtn>
            ) : (
              <div style={{ display: "flex", gap: 10, animation: "fadeUp .2s ease" }}>
                {[
                  { label: "AGAIN", quality: 1, key: "again", color: C.again  },
                  { label: "HARD",  quality: 2, key: "hard",  color: C.hard   },
                  { label: "GOOD",  quality: 4, key: "good",  color: C.good   },
                  { label: "EASY",  quality: 5, key: "easy",  color: C.easy   },
                ].map((btn) => (
                  <PixelBtn key={btn.key} color={btn.color} onClick={() => handleRate(btn.quality, btn.key)}>
                    {btn.label}
                  </PixelBtn>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Sidebar ──────────────────────────────────────── */}
      {aiOpen && (
        <aside style={{
          width: 300, background: C.panel,
          borderLeft: `2px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          animation: "fadeUp .25s ease",
        }}>
          {/* Header */}
          <div style={{ background: C.purple, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#FFFFFF" }}>✦ AI TUTOR</span>
            <button onClick={() => setAiOpen(false)} style={{ background: "none", border: "none", color: "#FFFFFF", fontSize: 16, cursor: "pointer" }}>×</button>
          </div>

          {/* Model badge */}
          <div style={{ padding: "10px 14px", borderBottom: `2px solid ${C.border}` }}>
            <PixelTag color={C.purple}>GEMINI 2.0 FLASH</PixelTag>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: "16px 14px", overflowY: "auto" }}>
            {aiLoading && (
              <div>
                {[90, 75, 85, 60, 70].map((w, i) => (
                  <div key={i} style={{ height: 10, background: C.raised, border: `1px solid ${C.border}30`, marginBottom: 8, width: `${w}%`,
                    animation: `blink 1.4s ease ${i * 0.15}s infinite` }} />
                ))}
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSub, marginTop: 12 }}>
                  ASKING GEMINI... <span className="blink">_</span>
                </div>
              </div>
            )}
            {aiError && !aiLoading && (
              <Win title="ERROR" controls={false} style={{ borderColor: C.pink }}>
                <div style={{ padding: "12px", fontFamily: "monospace", fontSize: 11, color: C.pink, lineHeight: 1.6 }}>{aiError}</div>
              </Win>
            )}
            {aiContent && !aiLoading && (
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 19, color: C.text, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {aiContent}
              </div>
            )}
            {!aiContent && !aiLoading && !aiError && (
              <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: C.textSub, lineHeight: 1.6 }}>
                AI EXPLANATION WILL APPEAR HERE WHEN YOU NAVIGATE BETWEEN CARDS.
              </div>
            )}
          </div>

          {/* Re-ask button */}
          <div style={{ padding: "12px 14px", borderTop: `2px solid ${C.border}` }}>
            <PixelBtn onClick={askAI} disabled={aiLoading} color={C.purple} style={{ width: "100%", textAlign: "center", display: "block" }}>
              {aiLoading ? "THINKING..." : "↻ EXPLAIN THIS CARD"}
            </PixelBtn>
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================
// CREATOR VIEW
// ============================================================

function CreatorView({ decks, onCardCreate, onCardUpdate, editingCard, setEditingCard }) {
  const [front, setFront] = useState(editingCard?.front || "");
  const [back, setBack] = useState(editingCard?.back || "");
  const [deckId, setDeckId] = useState(editingCard?.deckId || decks[0]?.id || "");
  const [tagStr, setTagStr] = useState((editingCard?.tags || []).join(", "));
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!front.trim() || !back.trim()) return;
    const tags = tagStr.split(",").map((t) => t.trim()).filter(Boolean);
    if (editingCard) {
      onCardUpdate({ ...editingCard, front, back, deckId, tags });
    } else {
      onCardCreate(CardEngine.createCard({ front, back, deckId, tags }));
      setFront(""); setBack(""); setTagStr("");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const labelStyle = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 7, color: C.textSub,
    letterSpacing: 1, display: "block", marginBottom: 8,
  };
  const fieldStyle = { width: "100%", resize: "vertical", lineHeight: 1.65, minHeight: 110 };

  return (
    <div style={{ padding: "40px 44px", maxWidth: 900 }} className="fade-in">
      <Win title={editingCard ? "EDIT CARD" : "CREATE NEW CARD"} style={{ marginBottom: 24 }}>
        <div style={{ padding: "24px" }}>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: C.textSub, marginBottom: 6 }}>
            {editingCard ? "EDITING EXISTING CARD" : "ADD A NEW FLASHCARD TO YOUR COLLECTION"}
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textHint, letterSpacing: 0.5 }}>
            SUPPORTS **BOLD**, *ITALIC*, AND `CODE` FORMATTING
          </div>
        </div>
      </Win>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {[
          { label: "FRONT — QUESTION", val: front, set: setFront, ph: "Enter the question or prompt..." },
          { label: "BACK — ANSWER",    val: back,  set: setBack,  ph: "Enter the answer..." },
        ].map((f) => (
          <Win key={f.label} title={f.label} controls={false}>
            <div style={{ padding: "14px" }}>
              <textarea value={f.val} onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph} rows={6} style={fieldStyle} />
            </div>
          </Win>
        ))}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {[{ label: "? QUESTION PREVIEW", text: front }, { label: "! ANSWER PREVIEW", text: back }].map((p) => (
            <Win key={p.label} title={p.label} controls={false}>
              <div style={{ padding: "22px 24px", minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 22, lineHeight: 1.55, color: C.text }}
                  dangerouslySetInnerHTML={{ __html: md(p.text) || `<span style="color:${C.textHint}">EMPTY</span>` }} />
              </div>
            </Win>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <Win title="DECK" controls={false}>
          <div style={{ padding: "14px" }}>
            <select value={deckId} onChange={(e) => setDeckId(e.target.value)} style={{ width: "100%", cursor: "pointer" }}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
            </select>
          </div>
        </Win>
        <Win title="TAGS" controls={false}>
          <div style={{ padding: "14px" }}>
            <input value={tagStr} onChange={(e) => setTagStr(e.target.value)}
              placeholder="biology, cell, mitosis" style={{ width: "100%" }} />
          </div>
        </Win>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <PixelBtn onClick={handleSave} disabled={!front.trim() || !back.trim()} color={saved ? C.green : C.border}>
          {saved ? "✓ SAVED TO DB!" : editingCard ? "[ UPDATE CARD ]" : "[ SAVE CARD ]"}
        </PixelBtn>
        <PixelBtn onClick={() => setPreview((p) => !p)} color={C.cyan}>
          {preview ? "HIDE PREVIEW" : "PREVIEW CARD"}
        </PixelBtn>
        {editingCard && (
          <PixelBtn onClick={() => setEditingCard(null)} color={C.textSub}>CANCEL</PixelBtn>
        )}
      </div>
    </div>
  );
}

// ============================================================
// LIBRARY VIEW
// ============================================================

function LibraryView({ cards, decks, filterDeck, setFilterDeck, onDelete, onEdit }) {
  const [search, setSearch] = useState("");

  const visible = cards.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q));
    const matchDeck = filterDeck === "all" || c.deckId === filterDeck;
    return matchSearch && matchDeck;
  });

  return (
    <div style={{ padding: "40px 44px" }} className="fade-in">
      <Win title="CARD LIBRARY" style={{ marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "center" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH CARDS..." style={{ flex: 1 }} />
          <select value={filterDeck} onChange={(e) => setFilterDeck(e.target.value)} style={{ cursor: "pointer" }}>
            <option value="all">ALL DECKS</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}
          </select>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSub, whiteSpace: "nowrap", letterSpacing: 0.5 }}>
            {visible.length}/{cards.length} CARDS
          </span>
        </div>
      </Win>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((card) => {
          const deck = decks.find((d) => d.id === card.deckId);
          const mastery = CardEngine.getMastery(card);
          return (
            <div key={card.id} style={{
              background: C.panel,
              border: `2px solid ${C.border}`,
              display: "flex", alignItems: "center", gap: 14,
              transition: "all .12s",
            }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `3px 3px 0 ${C.border}`; e.currentTarget.style.transform = "translate(-1px,-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
              {/* Deck color stripe */}
              <div style={{ width: 5, alignSelf: "stretch", background: deck?.color || C.border, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, padding: "12px 0" }}>
                <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  dangerouslySetInnerHTML={{ __html: md(card.front.slice(0, 80)) }} />
                <div style={{ fontFamily: "monospace", fontSize: 11, color: C.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}
                  dangerouslySetInnerHTML={{ __html: md(card.back.slice(0, 60) + (card.back.length > 60 ? "…" : "")) }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 12px 0", flexShrink: 0 }}>
                {deck && <PixelTag color={deck.color || C.border}>{deck.name.toUpperCase()}</PixelTag>}
                <PixelTag color={mastery.color}>{mastery.label}</PixelTag>
                <PixelBtn onClick={() => onEdit(card)} color={C.cyan} style={{ padding: "6px 10px" }}>EDIT</PixelBtn>
                <PixelBtn onClick={() => onDelete(card.id)} color={C.pink} style={{ padding: "6px 10px" }}>DEL</PixelBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
