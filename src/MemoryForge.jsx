/**
 * MemoryForge v3
 *
 * NEW IN v3:
 *   - Google OAuth (replaces GitHub)
 *   - 6 color presets (Digital, Forest, Stone, Grayscale, Neon, Sunset)
 *     + fully custom HSL sliders — all saved per user profile in Supabase
 *   - Community "Discover" tab: publish your decks, import others'
 *
 * MIGRATION: run schema_v2.sql in Supabase SQL Editor to add
 *            the `profiles` and `published_decks` tables.
 */

import {
  useState, useEffect, useCallback, useRef,
  createContext, useContext, useMemo,
} from "react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────────────────────
// THEME SYSTEM
// Each preset is a full color map. Custom derives from HSL sliders.
// ─────────────────────────────────────────────────────────────

const DEFAULT_CUSTOM = { bH:220, bS:80, bL:35, bgH:80, bgS:20, bgL:83, aH:190 };

const PRESETS = {
  digital:   { name:"DIGITAL",   bg:"#DDE4CC", panel:"#FFFFFF", raised:"#F5F5EE", border:"#1144DD", text:"#000055", textSub:"#4455AA", textHint:"#8899CC", cyan:"#00CCFF", green:"#00FF88", pink:"#FF1155", gold:"#FFD600", purple:"#BB88FF", orange:"#FF7700", again:"#FF1155", hard:"#FF8800", good:"#0099FF", easy:"#00FF88" },
  forest:    { name:"FOREST",    bg:"#D4E8C2", panel:"#F0F7E8", raised:"#E4F0D4", border:"#1A5C2A", text:"#0D2B10", textSub:"#3A6B40", textHint:"#7AAB7E", cyan:"#44CC88", green:"#88EE44", pink:"#EE4444", gold:"#CCAA22", purple:"#7766BB", orange:"#CC7722", again:"#EE4444", hard:"#CC7722", good:"#44CC88", easy:"#88EE44" },
  stone:     { name:"STONE",     bg:"#E4DDD4", panel:"#F5F0EB", raised:"#EDE8E2", border:"#5A4A3A", text:"#2A1A0A", textSub:"#7A6A5A", textHint:"#AAA090", cyan:"#CC8855", green:"#88AA55", pink:"#CC5544", gold:"#CCAA44", purple:"#8877AA", orange:"#DD7733", again:"#CC5544", hard:"#DD7733", good:"#8877AA", easy:"#88AA55" },
  grayscale: { name:"GRAYSCALE", bg:"#E8E8E8", panel:"#FFFFFF", raised:"#F2F2F2", border:"#222222", text:"#111111", textSub:"#555555", textHint:"#AAAAAA", cyan:"#555555", green:"#777777", pink:"#222222", gold:"#888888", purple:"#444444", orange:"#333333", again:"#222222", hard:"#444444", good:"#666666", easy:"#888888" },
  neon:      { name:"NEON",      bg:"#080812", panel:"#0F0F1E", raised:"#141428", border:"#FF0066", text:"#EEEEFF", textSub:"#9999CC", textHint:"#444477", cyan:"#00FFCC", green:"#00FF88", pink:"#FF0066", gold:"#FFEE00", purple:"#CC44FF", orange:"#FF8800", again:"#FF0066", hard:"#FF8800", good:"#00FFCC", easy:"#00FF88" },
  sunset:    { name:"SUNSET",    bg:"#F5E4D0", panel:"#FFF8F0", raised:"#FAEEDD", border:"#CC4400", text:"#330A00", textSub:"#885533", textHint:"#BBAA99", cyan:"#FF8833", green:"#AACC44", pink:"#FF4488", gold:"#FFCC00", purple:"#AA5599", orange:"#FF6622", again:"#FF4488", hard:"#FF6622", good:"#FFCC00", easy:"#AACC44" },
};

function buildC(config) {
  if (config.preset !== "custom") {
    const p = PRESETS[config.preset] || PRESETS.digital;
    return { ...p, shadow: p.border };
  }
  const { bH, bS, bL, bgH, bgS, bgL, aH } = { ...DEFAULT_CUSTOM, ...config.custom };
  const border = `hsl(${bH},${bS}%,${bL}%)`;
  const isLight = bgL > 55;
  return {
    name:"CUSTOM",
    bg:`hsl(${bgH},${bgS}%,${bgL}%)`,
    panel: isLight ? "#FFFFFF" : "#101020",
    raised: isLight ? "#F8F8F5" : "#181828",
    border, shadow: border,
    text: isLight ? "#111122" : "#EEEEFF",
    textSub: isLight ? "#445566" : "#9999BB",
    textHint: isLight ? "#8899AA" : "#444466",
    cyan:   `hsl(${aH},100%,55%)`,
    green:  `hsl(${(aH+120)%360},100%,55%)`,
    pink:   `hsl(${(aH+240)%360},100%,50%)`,
    gold:   `hsl(${(aH+60)%360},100%,55%)`,
    purple: `hsl(${(aH+270)%360},80%,65%)`,
    orange: `hsl(${(aH+30)%360},100%,55%)`,
    again:  `hsl(${(aH+240)%360},100%,50%)`,
    hard:   `hsl(${(aH+30)%360},100%,55%)`,
    good:   `hsl(${aH},100%,55%)`,
    easy:   `hsl(${(aH+120)%360},100%,55%)`,
  };
}

// Default context value so components work even before provider mounts
const ThemeCtx = createContext(buildC({ preset:"digital", custom:DEFAULT_CUSTOM }));
const useC = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────
// DB FIELD TRANSFORMERS  (snake_case ↔ camelCase)
// ─────────────────────────────────────────────────────────────

function cardToDb(card, userId) {
  return {
    id: card.id, user_id: userId, deck_id: card.deckId,
    front: card.front, back: card.back, tags: card.tags,
    interval: card.interval, ease_factor: card.easeFactor,
    repetitions: card.repetitions, next_review: card.nextReview,
    last_review: card.lastReview, review_history: card.reviewHistory,
    created_at: card.createdAt,
  };
}

function dbToCard(row) {
  return {
    id: row.id, deckId: row.deck_id, front: row.front, back: row.back,
    tags: row.tags || [], type:"text", imageUrl:null, occlusionBoxes:[], audioUrl:null,
    interval: row.interval || 1, easeFactor: row.ease_factor || 2.5,
    repetitions: row.repetitions || 0, nextReview: row.next_review,
    lastReview: row.last_review, reviewHistory: row.review_history || [],
    createdAt: row.created_at,
  };
}

function deckToDb(deck, userId) {
  return {
    id: deck.id, user_id: userId, name: deck.name,
    description: deck.description, color: deck.color,
    emoji: deck.emoji, created_at: deck.createdAt,
  };
}

function dbToDeck(row) {
  return {
    id: row.id, name: row.name, description: row.description || "",
    color: row.color || "#1144DD", emoji: row.emoji || "📚",
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// DB SERVICE
// ─────────────────────────────────────────────────────────────

const DB = {
  async getCards() {
    const { data, error } = await supabase.from("cards").select("*").order("created_at", { ascending:true });
    if (error) throw error;
    return (data||[]).map(dbToCard);
  },
  async upsertCard(card) {
    const { data:{ user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("cards").upsert(cardToDb(card, user.id), { onConflict:"id" });
    if (error) throw error;
  },
  async deleteCard(id) {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) throw error;
  },
  async getDecks() {
    const { data, error } = await supabase.from("decks").select("*").order("created_at", { ascending:true });
    if (error) throw error;
    return (data||[]).map(dbToDeck);
  },
  async upsertDeck(deck) {
    const { data:{ user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("decks").upsert(deckToDb(deck, user.id), { onConflict:"id" });
    if (error) throw error;
  },

  // Profile — stores theme config per user
  async getProfile() {
    const { data } = await supabase.from("profiles").select("theme").single();
    return data?.theme || null;
  },
  async saveProfile(theme) {
    const { data:{ user } } = await supabase.auth.getUser();
    await supabase.from("profiles").upsert({ id:user.id, theme }, { onConflict:"id" });
  },

  // Community publishing
  async publishDeck(deck, cards, username) {
    const { data:{ user } } = await supabase.auth.getUser();
    const cleanCards = cards.map(({ front, back, tags }) => ({ front, back, tags }));
    // Update existing publish if deck already published by this user
    const { data:existing } = await supabase.from("published_decks")
      .select("id").eq("user_id", user.id).eq("deck_name", deck.name).maybeSingle();
    const payload = {
      user_id:user.id, username,
      deck_name:deck.name, deck_description:deck.description || "",
      deck_emoji:deck.emoji, deck_color:deck.color,
      cards:cleanCards, card_count:cleanCards.length,
      published_at:new Date().toISOString(),
    };
    if (existing?.id) {
      await supabase.from("published_decks").update(payload).eq("id", existing.id);
      return existing.id;
    }
    const id = `pub_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await supabase.from("published_decks").insert({ id, imports:0, ...payload });
    return id;
  },
  async getPublishedDecks(search = "") {
    let q = supabase.from("published_decks").select("*").order("published_at", { ascending:false });
    if (search) q = q.ilike("deck_name", `%${search}%`);
    const { data } = await q;
    return data || [];
  },
  async importDeck(pub, userId) {
    const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const newDeck = {
      id:newDeckId, user_id:userId,
      name:pub.deck_name, description:pub.deck_description||"",
      emoji:pub.deck_emoji||"📚", color:pub.deck_color||"#1144DD",
      created_at:new Date().toISOString(),
    };
    await supabase.from("decks").insert(newDeck);
    const newCards = (pub.cards||[]).map((c) =>
      CardEngine.createCard({ front:c.front, back:c.back, tags:c.tags||[], deckId:newDeckId })
    );
    if (newCards.length) {
      await supabase.from("cards").insert(newCards.map((c) => cardToDb(c, userId)));
    }
    await supabase.from("published_decks")
      .update({ imports:(pub.imports||0)+1 }).eq("id", pub.id);
    return { deck:dbToDeck(newDeck), cards:newCards };
  },

  // Gemini proxy — key lives only in Supabase Edge Function secrets
  async askGemini(prompt) {
    const { data, error } = await supabase.functions.invoke("ask-gemini", { body:{ prompt } });
    if (error) throw new Error(error.message||"Edge function error");
    return data.text;
  },
};

// ─────────────────────────────────────────────────────────────
// CARD ENGINE — SM-2
// ─────────────────────────────────────────────────────────────

const CardEngine = {
  processReview(card, quality) {
    let { interval, easeFactor, repetitions } = card;
    if (quality < 3) { repetitions=0; interval=1; }
    else {
      if (repetitions===0) interval=1;
      else if (repetitions===1) interval=6;
      else interval=Math.round(interval*easeFactor);
      repetitions+=1;
      easeFactor=Math.max(1.3, easeFactor+0.1-(5-quality)*(0.08+(5-quality)*0.02));
    }
    const nextReview=new Date(); nextReview.setDate(nextReview.getDate()+interval);
    return { ...card, interval, easeFactor:Math.round(easeFactor*100)/100, repetitions,
      nextReview:nextReview.toISOString(), lastReview:new Date().toISOString(),
      reviewHistory:[...(card.reviewHistory||[]),quality] };
  },
  getDueCards:(cards) => { const now=new Date(); return cards.filter((c)=>!c.nextReview||new Date(c.nextReview)<=now); },
  getWrongCards:(cards) => cards.filter((c)=>{ const h=c.reviewHistory||[]; return h.length>0&&h[h.length-1]<3; }),
  createCard:(data)=>({
    id:`card_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    front:"",back:"",tags:[],type:"text",imageUrl:null,occlusionBoxes:[],audioUrl:null,
    interval:1,easeFactor:2.5,repetitions:0,nextReview:null,lastReview:null,
    createdAt:new Date().toISOString(),reviewHistory:[],deckId:"",...data,
  }),
  getMastery:(card)=>{
    if (card.interval>30) return { label:"MASTERED", color:"#00FF88" };
    if (card.interval>7)  return { label:"FAMILIAR", color:"#00CCFF" };
    if (card.repetitions>0) return { label:"LEARNING", color:"#FFD600" };
    return { label:"NEW", color:"#BB88FF" };
  },
};

// ─────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────

const SEED_DECKS = [
  { id:"deck_1", name:"Biology",  description:"Cell biology & genetics", color:"#00FF88", emoji:"🧬", createdAt:new Date().toISOString() },
  { id:"deck_2", name:"History",  description:"Key world events",        color:"#FFD600", emoji:"🏛",  createdAt:new Date().toISOString() },
  { id:"deck_3", name:"Math",     description:"Calculus & algebra",      color:"#00CCFF", emoji:"∑",   createdAt:new Date().toISOString() },
];
const SEED_CARDS = [
  CardEngine.createCard({ id:"c1", front:"What is mitosis?",          back:"Cell division producing two identical daughter cells.\n\nPhases: Prophase → Metaphase → Anaphase → Telophase", tags:["cell","division"], deckId:"deck_1", repetitions:3, interval:8 }),
  CardEngine.createCard({ id:"c2", front:"DNA stands for?",           back:"Deoxyribonucleic Acid\n\nThe double-helix molecule encoding all genetic information.", tags:["genetics"], deckId:"deck_1" }),
  CardEngine.createCard({ id:"c3", front:"Powerhouse of the cell?",   back:"The Mitochondria\n\nProduces ATP via cellular respiration.", tags:["cell","energy"], deckId:"deck_1", repetitions:6, interval:21 }),
  CardEngine.createCard({ id:"c4", front:"French Revolution began?",  back:"1789 — Storming of the Bastille, July 14th.", tags:["france"], deckId:"deck_2", repetitions:2, interval:6 }),
  CardEngine.createCard({ id:"c5", front:"Pythagorean Theorem",       back:"a² + b² = c²\n\nHypotenuse squared = sum of squares of the other two sides.", tags:["geometry"], deckId:"deck_3", repetitions:4, interval:14 }),
  CardEngine.createCard({ id:"c6", front:"Derivative of sin(x)?",     back:"cos(x)\n\nAnd d/dx[cos(x)] = −sin(x)", tags:["calculus"], deckId:"deck_3" }),
];

// ─────────────────────────────────────────────────────────────
// MARKDOWN
// ─────────────────────────────────────────────────────────────

const md = (text="") =>
  text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
      .replace(/\*(.*?)\*/g,"<em>$1</em>")
      .replace(/`(.*?)`/g,"<code>$1</code>")
      .replace(/\n/g,"<br/>");

// ─────────────────────────────────────────────────────────────
// REUSABLE PIXEL COMPONENTS  (all use useC() for live theming)
// ─────────────────────────────────────────────────────────────

/** Win — retro window panel with blue titlebar and hard shadow */
function Win({ title, children, controls=true, style={}, titleRight=null, titleBg=null }) {
  const C = useC();
  return (
    <div style={{ border:`2px solid ${C.border}`, boxShadow:`4px 4px 0 ${C.border}`, background:C.panel, ...style }}>
      <div style={{ background:titleBg||C.border, padding:"5px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, userSelect:"none" }}>
        <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:"#FFFFFF", letterSpacing:0.5, lineHeight:1 }}>{title}</span>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {titleRight}
          {controls && ["_","□","×"].map((s)=>(
            <span key={s} style={{ width:14,height:14,background:"#FFFFFF22",border:"1px solid #FFFFFF44",display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:9,color:"#FFFFFF",cursor:"default",lineHeight:1 }}>{s}</span>
          ))}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

/** PixelBtn — chunky border button with hover invert */
function PixelBtn({ children, onClick, color, bg="transparent", disabled=false, style={} }) {
  const C = useC();
  const col = color||C.border;
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, letterSpacing:0.5,
        color:hov?C.panel:col, background:hov?col:bg, border:`2px solid ${col}`,
        boxShadow:hov?"none":`3px 3px 0 ${col}`, transform:hov?"translate(2px,2px)":"none",
        padding:"10px 16px", cursor:disabled?"default":"pointer",
        transition:"all .12s ease", opacity:disabled?0.4:1, lineHeight:1.4, ...style }}>
      {children}
    </button>
  );
}

/** PixelTag — inline label badge */
function PixelTag({ children, color }) {
  const C = useC();
  const col = color||C.border;
  return (
    <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:col, border:`1.5px solid ${col}`, padding:"3px 7px", letterSpacing:0.5, lineHeight:1, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

/** SegmentBar — pixel-art progress bar */
function SegmentBar({ progress=0, color, segments=12, style={} }) {
  const C = useC();
  const col = color||C.border;
  const filled = Math.round((progress/100)*segments);
  return (
    <div style={{ display:"flex", gap:3, ...style }}>
      {Array.from({ length:segments }).map((_,i)=>(
        <div key={i} style={{ width:18, height:16, background:i<filled?col:"transparent", border:`1.5px solid ${col}`, transition:"background .2s ease" }} />
      ))}
    </div>
  );
}

/** ToggleBtn — ON/OFF switch */
function ToggleBtn({ value, onChange }) {
  const C = useC();
  return (
    <button onClick={()=>onChange(!value)} style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, border:`2px solid ${C.border}`, boxShadow:`2px 2px 0 ${C.border}`, background:value?C.border:"transparent", color:value?C.panel:C.border, padding:"5px 10px", cursor:"pointer", letterSpacing:0.5, lineHeight:1, transition:"all .12s" }}>
      {value?"ON":"OFF"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────

export default function MemoryForge() {
  const [session, setSession]           = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [view, setView]                 = useState("dashboard");
  const [decks, setDecks]               = useState([]);
  const [cards, setCards]               = useState([]);
  const [dataLoading, setDataLoading]   = useState(false);
  const [studyConfig, setStudyConfig]   = useState({ shuffle:true, wrongsOnly:false, reversed:false, limit:20 });
  const [editingCard, setEditingCard]   = useState(null);
  const [aiOpen, setAiOpen]             = useState(false);
  const [filterDeck, setFilterDeck]     = useState("all");
  const [themeConfig, setThemeConfig]   = useState({ preset:"digital", custom:DEFAULT_CUSTOM });
  const [navOpen, setNavOpen]           = useState(false);

  const C = useMemo(()=>buildC(themeConfig), [themeConfig]);
  const saveThemeRef = useRef(null);

  // Auth listener
  useEffect(()=>{
    supabase.auth.getSession().then(({ data:{ session } })=>{ setSession(session); setAuthLoading(false); });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,session)=>setSession(session));
    return ()=>subscription.unsubscribe();
  },[]);

  // Load data + profile after login
  useEffect(()=>{
    if (!session) return;
    (async()=>{
      setDataLoading(true);
      try {
        const [dbCards, dbDecks, profile] = await Promise.all([DB.getCards(), DB.getDecks(), DB.getProfile()]);
        if (profile) setThemeConfig(profile);
        if (dbDecks.length===0) {
          await Promise.all(SEED_DECKS.map((d)=>DB.upsertDeck(d)));
          await Promise.all(SEED_CARDS.map((c)=>DB.upsertCard(c)));
          setDecks(SEED_DECKS); setCards(SEED_CARDS);
        } else { setDecks(dbDecks); setCards(dbCards); }
      } catch(e) { console.error(e); }
      setDataLoading(false);
    })();
  },[session]);

  // Theme change — update state + debounced DB save
  const updateTheme = useCallback((newConfig)=>{
    setThemeConfig(newConfig);
    if (saveThemeRef.current) clearTimeout(saveThemeRef.current);
    saveThemeRef.current = setTimeout(()=>DB.saveProfile(newConfig), 800);
  },[]);

  // Card CRUD
  const updateCard = useCallback(async(updated)=>{
    setCards((prev)=>prev.map((c)=>c.id===updated.id?updated:c));
    try { await DB.upsertCard(updated); } catch(e){ console.error(e); }
  },[]);
  const createCard = useCallback(async(c)=>{
    setCards((prev)=>[...prev,c]);
    try { await DB.upsertCard(c); } catch(e){ console.error(e); }
  },[]);
  const deleteCard = useCallback(async(id)=>{
    setCards((prev)=>prev.filter((c)=>c.id!==id));
    try { await DB.deleteCard(id); } catch(e){ console.error(e); }
  },[]);

  // Publish a deck to community
  const publishDeck = useCallback(async(deck)=>{
    const deckCards = cards.filter((c)=>c.deckId===deck.id);
    const username  = session?.user?.user_metadata?.full_name
      || session?.user?.user_metadata?.user_name
      || session?.user?.email?.split("@")[0]
      || "anon";
    try { await DB.publishDeck(deck, deckCards, username); }
    catch(e){ console.error(e); }
  },[cards, session]);

  // Import a community deck
  const importDeck = useCallback(async(pub)=>{
    try {
      const { deck, cards:newCards } = await DB.importDeck(pub, session.user.id);
      setDecks((prev)=>[...prev,deck]);
      setCards((prev)=>[...prev,...newCards]);
    } catch(e){ console.error(e); }
  },[session]);

  const navTo = useCallback((v)=>{ setView(v); setAiOpen(false); },[]);

  // Wrap loader screens in provider so they pick up current theme
  if (authLoading) return <ThemeCtx.Provider value={C}><BootScreen label="AUTHENTICATING..." /></ThemeCtx.Provider>;
  if (!session)    return <ThemeCtx.Provider value={C}><AuthView /></ThemeCtx.Provider>;
  if (dataLoading) return <ThemeCtx.Provider value={C}><BootScreen label="LOADING DATA..." /></ThemeCtx.Provider>;

  const user = session.user;

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{ display:"flex", minHeight:"100vh", background:C.bg, fontFamily:"monospace", transition:"background .3s, color .3s" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
          *{box-sizing:border-box;margin:0;padding:0}
          ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border:2px solid ${C.bg}}
          input,textarea,select{font-family:monospace;background:${C.raised};border:2px solid ${C.border};color:${C.text};padding:8px 10px;font-size:13px;outline:none;border-radius:0}
          input:focus,textarea:focus,select:focus{box-shadow:3px 3px 0 ${C.border}}
          input[type=range]{border:none;background:none;padding:0;height:4px;box-shadow:none;cursor:pointer}
          @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
          @keyframes glitch{0%,100%{transform:none;filter:none}92%{transform:skewX(0)}94%{transform:skewX(-3deg);filter:hue-rotate(60deg)}96%{transform:skewX(3deg)}98%{transform:none}}
          .fade-in{animation:fadeUp .3s ease both}
          .blink{animation:blink 1.2s step-end infinite}
          .glitch{animation:glitch 4s infinite}

          /* ── RESPONSIVE LAYOUT ── */

          /* Sidebar: full on desktop, icon-rail on tablet, drawer on mobile */
          .mf-sidebar{ width:200px; flex-shrink:0; }
          .mf-sidebar-label{ display:block; }
          .mf-sidebar-logo-sub{ display:block; }
          .mf-view-pad{ padding:32px 40px; }
          .mf-stats-grid{ grid-template-columns:repeat(4,1fr); }
          .mf-preset-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
          .mf-two-col{ grid-template-columns:1fr 1fr; }
          .mf-discover-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); }
          .mf-card-max{ max-width:100%; }
          .mf-hamburger{ display:none; }
          .mf-nav-overlay{ display:none; }

          /* Wide screens (≥1440px) */
          @media(min-width:1440px){
            .mf-sidebar{ width:220px; }
            .mf-view-pad{ padding:40px 56px; }
            .mf-preset-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); }
            .mf-stats-grid{ grid-template-columns:repeat(4,1fr); }
          }

          /* Tablet (640–1023px) — collapse sidebar to 52px icon rail */
          @media(max-width:1023px) and (min-width:640px){
            .mf-sidebar{ width:52px; }
            .mf-sidebar-label{ display:none; }
            .mf-sidebar-logo-sub{ display:none; }
            .mf-view-pad{ padding:20px 24px; }
            .mf-stats-grid{ grid-template-columns:repeat(2,1fr); }
            .mf-preset-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
            .mf-two-col{ grid-template-columns:1fr; }
            .mf-discover-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
          }

          /* Mobile (< 640px) — hamburger + slide-in drawer */
          @media(max-width:639px){
            .mf-sidebar{ display:none; }
            .mf-hamburger{
              display:flex; align-items:center; gap:10px;
              position:fixed; top:0; left:0; right:0; z-index:200;
              background:${C.border}; padding:10px 16px;
              font-family:'Press Start 2P',monospace; font-size:9px; color:#FFF;
              border-bottom:2px solid ${C.border};
            }
            .mf-nav-open{
              display:flex; flex-direction:column;
              position:fixed; inset:0; z-index:300;
              background:${C.panel}; overflow-y:auto;
            }
            .mf-view-pad{ padding:60px 14px 24px; }
            .mf-stats-grid{ grid-template-columns:repeat(2,1fr); }
            .mf-preset-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
            .mf-two-col{ grid-template-columns:1fr; }
            .mf-discover-grid{ grid-template-columns:1fr; }
          }
        `}</style>

        {/* ── MOBILE HAMBURGER BAR ───────────────────────── */}
        <div className="mf-hamburger" onClick={()=>setNavOpen(true)}>
          <span style={{ fontSize:14 }}>☰</span>
          <span>MEMORYFORGE</span>
        </div>

        {/* ── MOBILE NAV DRAWER ──────────────────────────── */}
        {navOpen && (
          <div className="mf-nav-open">
            <div style={{ background:C.border, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:10, color:"#FFF" }}>MEMORYFORGE</div>
              <button onClick={()=>setNavOpen(false)} style={{ background:"none",border:"none",color:"#FFF",fontSize:22,cursor:"pointer" }}>×</button>
            </div>
            {[
              { id:"dashboard", label:"DASHBOARD", icon:"⬡" },
              { id:"study",     label:"STUDY.EXE", icon:"▶" },
              { id:"discover",  label:"DISCOVER",  icon:"◎" },
              { id:"creator",   label:"CREATOR",   icon:"✦" },
              { id:"library",   label:"LIBRARY",   icon:"⊞" },
              { id:"theme",     label:"⬡ THEME",   icon:"◈" },
            ].map((item)=>(
              <button key={item.id} onClick={()=>{ navTo(item.id); setNavOpen(false); }} style={{
                display:"block", width:"100%", textAlign:"left", padding:"16px 20px",
                fontFamily:"'Press Start 2P',monospace", fontSize:8, letterSpacing:0.5,
                color:view===item.id?C.panel:C.text, background:view===item.id?C.border:"transparent",
                border:"none", borderBottom:`1px solid ${C.border}30`, cursor:"pointer",
              }}>{item.icon} {item.label}</button>
            ))}
            <div style={{ padding:"16px 20px", marginTop:"auto", borderTop:`2px solid ${C.border}` }}>
              <div style={{ fontFamily:"monospace", fontSize:12, color:C.text, marginBottom:12 }}>
                {user.user_metadata?.full_name||user.email?.split("@")[0]||"USER"}
              </div>
              <button onClick={()=>supabase.auth.signOut()} style={{ fontFamily:"'Press Start 2P',monospace",fontSize:6,color:C.pink,border:`1.5px solid ${C.pink}`,background:"transparent",padding:"6px 10px",cursor:"pointer" }}>SIGN OUT</button>
            </div>
          </div>
        )}

        {/* ── SIDEBAR (tablet: icon rail / desktop: full) ─ */}
        <aside className="mf-sidebar" style={{ background:C.panel, borderRight:`2px solid ${C.border}`, display:"flex", flexDirection:"column", transition:"background .3s,border-color .3s,width .2s" }}>
          <div style={{ background:C.border, padding:"16px 14px" }}>
            <div className="glitch" style={{ fontFamily:"'Press Start 2P',monospace", fontSize:11, color:"#FFFFFF", lineHeight:1.6, letterSpacing:0.5 }}>M<span className="mf-sidebar-label">EMORY</span><br/>F<span className="mf-sidebar-label">ORGE</span></div>
            <div className="mf-sidebar-logo-sub" style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:"#AABBFF", marginTop:6 }}>SM-2 ENGINE v3.0</div>
          </div>
          <nav style={{ flex:1, padding:"12px 0" }}>
            {[
              { id:"dashboard", label:"DASHBOARD", icon:"⬡" },
              { id:"study",     label:"STUDY.EXE", icon:"▶" },
              { id:"discover",  label:"DISCOVER",  icon:"◎" },
              { id:"creator",   label:"CREATOR",   icon:"✦" },
              { id:"library",   label:"LIBRARY",   icon:"⊞" },
              { id:"theme",     label:"⬡ THEME",   icon:"◈" },
            ].map((item)=>(
              <button key={item.id} onClick={()=>navTo(item.id)} title={item.label} style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", textAlign:"left", padding:"11px 14px",
                fontFamily:"'Press Start 2P',monospace", fontSize:7, letterSpacing:0.5, lineHeight:1,
                color:view===item.id?C.panel:C.text, background:view===item.id?C.border:"transparent",
                border:"none", borderLeft:view===item.id?`4px solid ${C.cyan}`:"4px solid transparent",
                cursor:"pointer", transition:"all .12s", whiteSpace:"nowrap", overflow:"hidden",
              }}>
                <span style={{ flexShrink:0, fontSize:12 }}>{item.icon}</span>
                <span className="mf-sidebar-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ borderTop:`2px solid ${C.border}`, padding:"12px 14px" }}>
            <div className="mf-sidebar-label" style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:C.textSub, marginBottom:5 }}>LOGGED IN AS</div>
            <div className="mf-sidebar-label" style={{ fontFamily:"monospace", fontSize:11, color:C.text, marginBottom:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user.user_metadata?.full_name||user.email?.split("@")[0]||"USER"}
            </div>
            <button onClick={()=>supabase.auth.signOut()} title="Sign out" style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:C.pink, border:`1.5px solid ${C.pink}`, background:"transparent", padding:"5px 8px", cursor:"pointer" }}>
              <span className="mf-sidebar-label">SIGN OUT</span>
              <span style={{ display:"none" }} className="mf-sidebar-icon">⏻</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN ────────────────────────────────────────── */}
        <main style={{ flex:1, overflow:"auto", minWidth:0 }}>
          {view==="dashboard" && <DashboardView cards={cards} decks={decks} studyConfig={studyConfig} setStudyConfig={setStudyConfig} navTo={navTo} onPublish={publishDeck} />}
          {view==="study"     && <StudyView cards={cards} decks={decks} studyConfig={studyConfig} onCardUpdate={updateCard} aiOpen={aiOpen} setAiOpen={setAiOpen} />}
          {view==="discover"  && <DiscoverView onImport={importDeck} userId={user.id} />}
          {view==="creator"   && <CreatorView cards={cards} decks={decks} onCardCreate={createCard} onCardUpdate={updateCard} editingCard={editingCard} setEditingCard={setEditingCard} />}
          {view==="library"   && <LibraryView cards={cards} decks={decks} filterDeck={filterDeck} setFilterDeck={setFilterDeck} onDelete={deleteCard} onEdit={(c)=>{ setEditingCard(c); navTo("creator"); }} />}
          {view==="theme"     && <ThemeView themeConfig={themeConfig} onUpdate={updateTheme} />}
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// BOOT SCREEN
// ─────────────────────────────────────────────────────────────

function BootScreen({ label }) {
  const C = useC();
  const [seg, setSeg] = useState(0);
  useEffect(()=>{ const t=setInterval(()=>setSeg((s)=>Math.min(s+1,12)),90); return ()=>clearInterval(t); },[]);
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:20, color:C.border, marginBottom:20 }}>MEMORYFORGE</div>
        <SegmentBar progress={(seg/12)*100} style={{ justifyContent:"center", marginBottom:14 }} />
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:C.textSub, letterSpacing:1 }}>
          {label} <span className="blink">_</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUTH VIEW  (Google)
// ─────────────────────────────────────────────────────────────

function AuthView() {
  const C = useC();
  const [loading, setLoading] = useState(false);
  const [seg, setSeg] = useState(0);

  const signIn = async()=>{
    setLoading(true);
    const t = setInterval(()=>setSeg((s)=>Math.min(s+1,12)),80);
    await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:window.location.origin } });
    clearInterval(t);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <Win title="MEMORYFORGE.EXE — WELCOME" style={{ width:440 }} controls={false}>
        <div style={{ padding:"32px 28px", textAlign:"center" }}>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:18, color:C.border, lineHeight:1.6, marginBottom:6 }}>MEMORY<br/>FORGE</div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textSub, letterSpacing:1, marginBottom:28 }}>SM-2 SPACED REPETITION ENGINE</div>
          <div style={{ marginBottom:6 }}><SegmentBar progress={loading?(seg/12)*100:0} /></div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textSub, marginBottom:28, height:14 }}>
            {loading?<>CONNECTING... <span className="blink">_</span></>:"READY"}
          </div>
          <PixelBtn onClick={signIn} disabled={loading} style={{ width:"100%", display:"block", textAlign:"center" }}>
            {loading?"AUTHENTICATING...":"[ SIGN IN WITH GOOGLE ]"}
          </PixelBtn>
          <div style={{ borderTop:`2px solid ${C.border}`, margin:"24px 0", opacity:0.3 }} />
          <Win title="NOTE" controls={false} style={{ textAlign:"left" }}>
            <div style={{ padding:"14px 16px", fontFamily:"'VT323',monospace", fontSize:18, color:C.text, lineHeight:1.5 }}>
              "A WORLD INSIDE THE COMPUTER<br/>WHERE FORGETTING NEVER WAS."
            </div>
          </Win>
        </div>
      </Win>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────

function DashboardView({ cards, decks, studyConfig, setStudyConfig, navTo, onPublish }) {
  const C = useC();
  const due      = CardEngine.getDueCards(cards).length;
  const mastered = cards.filter((c)=>c.interval>30).length;
  const learned  = cards.filter((c)=>c.repetitions>0).length;
  const hour     = new Date().getHours();
  const greeting = ["MORNING","AFTERNOON","EVENING"][[0,12,17].findLastIndex((h)=>hour>=h)];
  const [publishing, setPublishing] = useState({});
  const [pubDone, setPubDone] = useState({});

  const handlePublish = async(deck)=>{
    setPublishing((p)=>({ ...p, [deck.id]:true }));
    await onPublish(deck);
    setPublishing((p)=>({ ...p, [deck.id]:false }));
    setPubDone((p)=>({ ...p, [deck.id]:true }));
    setTimeout(()=>setPubDone((p)=>({ ...p, [deck.id]:false })),2200);
  };

  return (
    <div className="mf-view-pad mf-card-max fade-in">
      <Win title={`${greeting} SESSION`} style={{ marginBottom:28 }}>
        <div style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ fontFamily:"'VT323',monospace", fontSize:32, color:C.text, lineHeight:1 }}>
            {due>0?<><span style={{ color:C.border }}>{due}</span> CARD{due!==1?"S":""} READY</>:"ALL CAUGHT UP!"}
          </div>
          <PixelBtn onClick={()=>navTo("study")} color={C.green}>START.EXE →</PixelBtn>
        </div>
      </Win>

      {/* Stats */}
      <div className="mf-stats-grid" style={{ display:"grid", gap:14, marginBottom:24 }}>
        {[
          { label:"DUE TODAY", val:due,         color:C.pink   },
          { label:"TOTAL",     val:cards.length, color:C.border },
          { label:"LEARNED",   val:learned,      color:C.cyan   },
          { label:"MASTERED",  val:mastered,     color:C.green  },
        ].map((s,i)=>(
          <Win key={i} title={s.label} controls={false} style={{ animation:`fadeUp .3s ease ${i*0.06}s both` }}>
            <div style={{ padding:"18px 20px" }}>
              <div style={{ fontFamily:"'VT323',monospace", fontSize:56, color:s.color, lineHeight:1 }}>{s.val}</div>
            </div>
          </Win>
        ))}
      </div>

      <div className="mf-two-col" style={{ display:"grid", gap:20 }}>
        {/* Session config */}
        <Win title="SESSION CONFIG">
          <div style={{ padding:"20px" }}>
            {[
              { key:"shuffle",    label:"SHUFFLE CARDS", desc:"Randomize order"    },
              { key:"wrongsOnly", label:"WRONGS ONLY",   desc:"Review failed cards" },
              { key:"reversed",   label:"REVERSE MODE",  desc:"Answer → Question"  },
            ].map((opt)=>(
              <div key={opt.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div>
                  <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.text, marginBottom:4 }}>{opt.label}</div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub }}>{opt.desc}</div>
                </div>
                <ToggleBtn value={studyConfig[opt.key]} onChange={(v)=>setStudyConfig((c)=>({ ...c,[opt.key]:v }))} />
              </div>
            ))}
            <div style={{ borderTop:`2px dashed ${C.border}30`, paddingTop:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.text }}>SESSION LIMIT</div>
                <div style={{ fontFamily:"'VT323',monospace", fontSize:22, color:C.border, lineHeight:1 }}>{studyConfig.limit}</div>
              </div>
              <input type="range" min={5} max={100} step={1} value={studyConfig.limit}
                onChange={(e)=>setStudyConfig((c)=>({ ...c,limit:+e.target.value }))}
                style={{ width:"100%", accentColor:C.border }} />
            </div>
          </div>
        </Win>

        {/* Decks with publish */}
        <Win title="DECKS">
          <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
            {decks.map((deck)=>{
              const dc = cards.filter((c)=>c.deckId===deck.id);
              const dueCount = CardEngine.getDueCards(dc).length;
              return (
                <div key={deck.id} style={{ border:`2px solid ${C.border}`, borderLeft:`5px solid ${deck.color}`, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <div style={{ cursor:"pointer", flex:1 }} onClick={()=>navTo("study")}>
                    <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:C.text, marginBottom:3 }}>{deck.name.toUpperCase()}</div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub }}>{dc.length} cards{dueCount>0?` · ${dueCount} due`:""}</div>
                  </div>
                  <PixelBtn onClick={()=>handlePublish(deck)} disabled={!!publishing[deck.id]}
                    color={pubDone[deck.id]?C.green:C.purple} style={{ padding:"6px 10px", fontSize:7 }}>
                    {pubDone[deck.id]?"✓ LIVE":publishing[deck.id]?"...":"PUBLISH"}
                  </PixelBtn>
                </div>
              );
            })}
            <PixelBtn onClick={()=>navTo("discover")} color={C.cyan} style={{ marginTop:6, textAlign:"center", display:"block" }}>
              BROWSE COMMUNITY →
            </PixelBtn>
          </div>
        </Win>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STUDY VIEW
// ─────────────────────────────────────────────────────────────

function StudyView({ cards, decks, studyConfig, onCardUpdate, aiOpen, setAiOpen }) {
  const C = useC();
  const [queue, setQueue]     = useState([]);
  const [idx, setIdx]         = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [done, setDone]       = useState(false);
  const [stats, setStats]     = useState({ again:0, hard:0, good:0, easy:0 });
  const [aiContent, setAiContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState("");
  const prevCardId = useRef(null);

  useEffect(()=>{
    let pool = studyConfig.wrongsOnly ? CardEngine.getWrongCards(cards) : CardEngine.getDueCards(cards);
    if (!pool.length) pool = [...cards];
    if (studyConfig.shuffle) pool = [...pool].sort(()=>Math.random()-.5);
    pool = pool.slice(0, studyConfig.limit);
    setQueue(pool); setIdx(0); setFlipped(false); setShowRate(false); setDone(false);
    setStats({ again:0,hard:0,good:0,easy:0 });
  },[]);

  const card = queue[idx];
  const progress = queue.length ? idx/queue.length : 0;

  useEffect(()=>{
    if (aiOpen && card?.id && card.id!==prevCardId.current) {
      prevCardId.current = card.id;
      askAI();
    }
  },[card?.id, aiOpen]);

  const askAI = async()=>{
    if (!card) return;
    setAiLoading(true); setAiContent(""); setAiError("");
    try {
      const text = await DB.askGemini(`You're a study tutor.\nFront: ${card.front}\nBack: ${card.back}\n\nProvide:\n1. Clear 2-sentence explanation\n2. A memorable analogy\n3. One interesting related fact\n\nBe concise, no headers.`);
      setAiContent(text);
    } catch(e){ setAiError(e.message||"AI request failed."); }
    setAiLoading(false);
  };

  const handleReveal = ()=>{ setFlipped(true); setShowRate(true); };
  const handleRate   = (quality, key)=>{
    if (!card) return;
    onCardUpdate(CardEngine.processReview(card, quality));
    setStats((s)=>({ ...s,[key]:s[key]+1 }));
    if (idx+1>=queue.length){ setDone(true); return; }
    setIdx((i)=>i+1); setFlipped(false); setShowRate(false);
  };

  if (done) {
    const total = Object.values(stats).reduce((a,b)=>a+b,0);
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:C.bg, padding:48 }} className="fade-in">
        <Win title="SESSION COMPLETE" style={{ width:520 }}>
          <div style={{ padding:"32px" }}>
            <div style={{ fontFamily:"'VT323',monospace", fontSize:48, color:C.green, textAlign:"center", marginBottom:8 }}>COMPLETE!</div>
            <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:C.textSub, textAlign:"center", marginBottom:28 }}>
              {total} CARDS REVIEWED · SAVED TO DATABASE
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:28 }}>
              {[{l:"AGAIN",v:stats.again,c:C.again},{l:"HARD",v:stats.hard,c:C.hard},{l:"GOOD",v:stats.good,c:C.good},{l:"EASY",v:stats.easy,c:C.easy}].map((s)=>(
                <Win key={s.l} title={s.l} controls={false}>
                  <div style={{ padding:"12px", textAlign:"center" }}>
                    <div style={{ fontFamily:"'VT323',monospace", fontSize:44, color:s.c, lineHeight:1 }}>{s.v}</div>
                  </div>
                </Win>
              ))}
            </div>
            <PixelBtn onClick={()=>window.location.reload()} color={C.green} style={{ width:"100%", display:"block", textAlign:"center" }}>[ STUDY AGAIN ]</PixelBtn>
          </div>
        </Win>
      </div>
    );
  }

  if (!card) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:C.bg }}>
      <Win title="NO CARDS" controls={false}><div style={{ padding:"28px 32px", fontFamily:"'VT323',monospace", fontSize:24, color:C.text }}>NO CARDS TO STUDY.<br/>CREATE SOME IN THE CREATOR TAB.</div></Win>
    </div>
  );

  const front   = studyConfig.reversed ? card.back  : card.front;
  const back    = studyConfig.reversed ? card.front : card.back;
  const deck    = decks.find((d)=>d.id===card.deckId);
  const mastery = CardEngine.getMastery(card);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.bg }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"36px 44px" }}>
        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {deck && <PixelTag color={deck.color||C.border}>{deck.name.toUpperCase()}</PixelTag>}
            {card.tags.map((tag)=><PixelTag key={tag} color={C.textSub}>{tag}</PixelTag>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:C.textSub }}>{idx+1}/{queue.length}</span>
            <PixelBtn onClick={()=>{ setAiOpen((o)=>!o); }} color={C.purple}>✦ AI TUTOR</PixelBtn>
          </div>
        </div>
        <div style={{ marginBottom:36 }}><SegmentBar progress={progress*100} segments={20} /></div>

        {/* Card flip */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ perspective:"1200px", width:"100%", maxWidth:600, height:280 }}>
            <div style={{ width:"100%", height:"100%", transformStyle:"preserve-3d", transition:"transform .55s cubic-bezier(.4,0,.2,1)", transform:flipped?"rotateY(180deg)":"none", position:"relative" }}>
              {/* Front */}
              <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" }}>
                <Win title={studyConfig.reversed?"! ANSWER":"? QUESTION"} controls={false}
                  titleRight={<PixelTag color={mastery.color}>{mastery.label}</PixelTag>}
                  style={{ height:"100%", cursor:!flipped?"pointer":"default", display:"flex", flexDirection:"column" }}>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"28px 40px", textAlign:"center" }}
                    onClick={!flipped?handleReveal:undefined}>
                    <div style={{ fontFamily:"'VT323',monospace", fontSize:26, lineHeight:1.55, color:C.text }}
                      dangerouslySetInnerHTML={{ __html:md(front) }} />
                    {!flipped&&<div style={{ marginTop:24, fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textHint, letterSpacing:1 }} className="blink">CLICK TO REVEAL</div>}
                  </div>
                </Win>
              </div>
              {/* Back */}
              <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg)" }}>
                <Win title="! ANSWER REVEALED" controls={false}
                  titleRight={<span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:C.cyan }}>INTERVAL: {card.interval}D</span>}
                  style={{ height:"100%", borderColor:C.green, boxShadow:`4px 4px 0 ${C.green}`, display:"flex", flexDirection:"column" }}>
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"28px 40px", textAlign:"center" }}>
                    <div style={{ fontFamily:"'VT323',monospace", fontSize:24, lineHeight:1.6, color:C.text }}
                      dangerouslySetInnerHTML={{ __html:md(back) }} />
                  </div>
                </Win>
              </div>
            </div>
          </div>

          {/* Rating buttons */}
          <div style={{ marginTop:28, minHeight:52, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {!showRate ? (
              <PixelBtn onClick={handleReveal} style={{ padding:"14px 40px" }}>[ REVEAL ANSWER ]</PixelBtn>
            ) : (
              <div style={{ display:"flex", gap:10, animation:"fadeUp .2s ease" }}>
                {[{label:"AGAIN",quality:1,key:"again",color:C.again},{label:"HARD",quality:2,key:"hard",color:C.hard},{label:"GOOD",quality:4,key:"good",color:C.good},{label:"EASY",quality:5,key:"easy",color:C.easy}].map((btn)=>(
                  <PixelBtn key={btn.key} color={btn.color} onClick={()=>handleRate(btn.quality,btn.key)}>{btn.label}</PixelBtn>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Sidebar */}
      {aiOpen && (
        <aside style={{ width:300, background:C.panel, borderLeft:`2px solid ${C.border}`, display:"flex", flexDirection:"column", animation:"fadeUp .25s ease" }}>
          <div style={{ background:C.purple, padding:"8px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:"#FFFFFF" }}>✦ AI TUTOR</span>
            <button onClick={()=>setAiOpen(false)} style={{ background:"none",border:"none",color:"#FFFFFF",fontSize:18,cursor:"pointer" }}>×</button>
          </div>
          <div style={{ padding:"10px 14px", borderBottom:`2px solid ${C.border}` }}>
            <PixelTag color={C.purple}>GEMINI 2.0 FLASH</PixelTag>
          </div>
          <div style={{ flex:1, padding:"16px 14px", overflowY:"auto" }}>
            {aiLoading && (
              <div>
                {[90,75,85,60,70].map((w,i)=>(
                  <div key={i} style={{ height:10,background:C.raised,border:`1px solid ${C.border}30`,marginBottom:8,width:`${w}%`,animation:`blink 1.4s ease ${i*0.15}s infinite` }} />
                ))}
                <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textSub, marginTop:12 }}>ASKING GEMINI... <span className="blink">_</span></div>
              </div>
            )}
            {aiError && !aiLoading && (
              <Win title="ERROR" controls={false} style={{ borderColor:C.pink }}>
                <div style={{ padding:"12px", fontFamily:"monospace", fontSize:11, color:C.pink, lineHeight:1.6 }}>{aiError}</div>
              </Win>
            )}
            {aiContent && !aiLoading && (
              <div style={{ fontFamily:"'VT323',monospace", fontSize:19, color:C.text, lineHeight:1.65, whiteSpace:"pre-wrap" }}>{aiContent}</div>
            )}
            {!aiContent && !aiLoading && !aiError && (
              <div style={{ fontFamily:"'VT323',monospace", fontSize:18, color:C.textSub, lineHeight:1.6 }}>AI EXPLANATION APPEARS HERE AUTOMATICALLY AS YOU STUDY.</div>
            )}
          </div>
          <div style={{ padding:"12px 14px", borderTop:`2px solid ${C.border}` }}>
            <PixelBtn onClick={askAI} disabled={aiLoading} color={C.purple} style={{ width:"100%", textAlign:"center", display:"block" }}>
              {aiLoading?"THINKING...":"↻ EXPLAIN THIS CARD"}
            </PixelBtn>
          </div>
        </aside>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DISCOVER VIEW  — browse and import community decks
// ─────────────────────────────────────────────────────────────

function DiscoverView({ onImport, userId }) {
  const C = useC();
  const [pubDecks, setPubDecks] = useState([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [importing, setImporting] = useState({});
  const [importDone, setImportDone] = useState({});

  useEffect(()=>{
    let alive = true;
    (async()=>{
      setLoading(true);
      const data = await DB.getPublishedDecks(search);
      if (alive) { setPubDecks(data); setLoading(false); }
    })();
    return ()=>{ alive=false; };
  },[search]);

  const handleImport = async(pub)=>{
    setImporting((p)=>({ ...p,[pub.id]:true }));
    await onImport(pub);
    setImporting((p)=>({ ...p,[pub.id]:false }));
    setImportDone((p)=>({ ...p,[pub.id]:true }));
    setTimeout(()=>setImportDone((p)=>({ ...p,[pub.id]:false })),2500);
  };

  return (
    <div className="mf-view-pad fade-in">
      <Win title="DISCOVER — COMMUNITY DECKS" style={{ marginBottom:20 }}>
        <div style={{ padding:"16px 20px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="SEARCH COMMUNITY DECKS..." style={{ flex:1, minWidth:160 }} />
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textSub, whiteSpace:"nowrap" }}>
            {pubDecks.length} PUBLISHED
          </span>
        </div>
      </Win>

      {loading ? (
        <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:8, color:C.textSub, padding:24 }}>
          LOADING... <span className="blink">_</span>
        </div>
      ) : pubDecks.length===0 ? (
        <Win title="EMPTY" controls={false}>
          <div style={{ padding:"28px", fontFamily:"'VT323',monospace", fontSize:22, color:C.textSub, lineHeight:1.5 }}>
            NO PUBLISHED DECKS YET.<br/>BE THE FIRST — HIT PUBLISH ON ANY DECK IN THE DASHBOARD.
          </div>
        </Win>
      ) : (
        <div className="mf-discover-grid" style={{ display:"grid", gap:14 }}>
          {pubDecks.map((pub)=>{
            const isOwn = pub.user_id===userId;
            return (
              <Win key={pub.id} title={pub.deck_name.toUpperCase().slice(0,22)} controls={false}
                style={{ borderLeft:`5px solid ${pub.deck_color||C.border}` }}>
                <div style={{ padding:"14px" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{pub.deck_emoji||"📚"}</div>
                  {pub.deck_description&&(
                    <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, marginBottom:10, lineHeight:1.5 }}>
                      {pub.deck_description.slice(0,80)}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
                    <PixelTag color={C.textSub}>{pub.card_count} CARDS</PixelTag>
                    <PixelTag color={C.cyan}>{pub.imports||0} IMPORTS</PixelTag>
                  </div>
                  <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:C.textHint, marginBottom:14 }}>
                    BY {(pub.username||"ANON").toUpperCase().slice(0,18)}
                  </div>
                  <PixelBtn
                    onClick={()=>!isOwn&&handleImport(pub)}
                    disabled={isOwn||!!importing[pub.id]||!!importDone[pub.id]}
                    color={isOwn?C.textHint:importDone[pub.id]?C.green:C.easy}
                    style={{ width:"100%", display:"block", textAlign:"center" }}>
                    {isOwn?"YOUR DECK":importing[pub.id]?"IMPORTING...":importDone[pub.id]?"✓ ADDED":"[ IMPORT ]"}
                  </PixelBtn>
                </div>
              </Win>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// THEME VIEW  — preset grid + custom HSL sliders
// ─────────────────────────────────────────────────────────────

function ThemeView({ themeConfig, onUpdate }) {
  const C = useC();
  const [saved, setSaved] = useState(false);
  const saveTimeRef = useRef(null);

  const selectPreset = (preset)=>{
    onUpdate({ ...themeConfig, preset });
    flash();
  };
  const updateSlider = (key, val)=>{
    onUpdate({ preset:"custom", custom:{ ...DEFAULT_CUSTOM, ...themeConfig.custom, [key]:+val } });
  };
  const flash = ()=>{
    setSaved(true);
    if (saveTimeRef.current) clearTimeout(saveTimeRef.current);
    saveTimeRef.current = setTimeout(()=>setSaved(false), 1600);
  };

  const SLIDERS = [
    { key:"bH",  label:"BORDER HUE",         min:0,  max:360, unit:"°" },
    { key:"bS",  label:"BORDER SATURATION",   min:0,  max:100, unit:"%" },
    { key:"bL",  label:"BORDER LIGHTNESS",    min:10, max:60,  unit:"%" },
    { key:"bgH", label:"BACKGROUND HUE",      min:0,  max:360, unit:"°" },
    { key:"bgS", label:"BACKGROUND SAT",      min:0,  max:50,  unit:"%" },
    { key:"bgL", label:"BACKGROUND LIGHT",    min:50, max:97,  unit:"%" },
    { key:"aH",  label:"ACCENT HUE",          min:0,  max:360, unit:"°" },
  ];

  const cur = { ...DEFAULT_CUSTOM, ...themeConfig.custom };

  return (
    <div className="mf-view-pad mf-card-max fade-in">
      {/* Header */}
      <Win title="⬡ THEME SETTINGS" style={{ marginBottom:24 }}>
        <div style={{ padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"'VT323',monospace", fontSize:26, color:C.text }}>CHOOSE YOUR COLOR SCHEME</div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:saved?C.green:C.textHint, transition:"color .3s" }}>
            {saved?"✓ SAVED TO PROFILE":"AUTO-SAVES TO PROFILE"}
          </div>
        </div>
      </Win>

      <Win title="PRESETS" style={{ marginBottom:24 }}>
        <div className="mf-preset-grid" style={{ padding:"16px", display:"grid" }}>
          {Object.entries(PRESETS).map(([key, preset])=>{
            const active = themeConfig.preset===key;
            return (
              <div key={key} onClick={()=>selectPreset(key)} style={{
                border:active?`3px solid ${preset.border}`:`2px solid ${preset.border}50`,
                boxShadow:active?`4px 4px 0 ${preset.border}`:"none",
                background:preset.bg, cursor:"pointer",
                transform:active?"translate(-2px,-2px)":"none",
                transition:"all .12s", overflow:"hidden",
              }}>
                {/* Mini titlebar */}
                <div style={{ background:preset.border, padding:"4px 8px", display:"flex", gap:4, alignItems:"center" }}>
                  <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:"#FFFFFF", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{preset.name}</div>
                  {[preset.cyan,preset.green,preset.pink].map((col,i)=>(
                    <div key={i} style={{ width:8, height:8, background:col, flexShrink:0 }} />
                  ))}
                </div>
                {/* Swatches + rating bars */}
                <div style={{ padding:"8px 10px" }}>
                  <div style={{ display:"flex", gap:4, marginBottom:5 }}>
                    {[preset.border,preset.cyan,preset.green,preset.gold,preset.pink,preset.purple].map((col,i)=>(
                      <div key={i} style={{ width:14, height:14, background:col }} />
                    ))}
                  </div>
                  <div style={{ fontFamily:"'VT323',monospace", fontSize:13, color:preset.text, marginBottom:4 }}>
                    AGAIN / HARD / GOOD / EASY
                  </div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[preset.again,preset.hard,preset.good,preset.easy].map((col,i)=>(
                      <div key={i} style={{ height:5, flex:1, background:col }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Custom tile */}
          {(()=>{
            const active = themeConfig.preset==="custom";
            return (
              <div onClick={()=>selectPreset("custom")} style={{
                border:active?`3px solid ${C.border}`:`2px solid ${C.textHint}50`,
                boxShadow:active?`4px 4px 0 ${C.border}`:"none",
                background:active?C.raised:C.panel, cursor:"pointer",
                transform:active?"translate(-2px,-2px)":"none",
                transition:"all .12s",
              }}>
                <div style={{ background:active?C.border:C.textHint, padding:"5px 10px" }}>
                  <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:6, color:"#FFFFFF" }}>CUSTOM</div>
                </div>
                <div style={{ padding:"10px 12px" }}>
                  {/* Rainbow hue bar as preview */}
                  <div style={{ height:16, background:"linear-gradient(to right,hsl(0,80%,55%),hsl(60,80%,55%),hsl(120,80%,55%),hsl(180,80%,55%),hsl(240,80%,55%),hsl(300,80%,55%),hsl(360,80%,55%))", border:`1px solid ${C.border}`, marginBottom:6 }} />
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, lineHeight:1.5 }}>Dial in your own colors below</div>
                </div>
              </div>
            );
          })()}
        </div>
      </Win>

      {/* Custom sliders */}
      {themeConfig.preset==="custom" && (
        <Win title="CUSTOM COLOR SLIDERS" style={{ animation:"fadeUp .25s ease" }}>
          <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:20 }}>
            {SLIDERS.map(({ key, label, min, max, unit })=>(
              <div key={key}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.text, letterSpacing:0.5 }}>{label}</div>
                  <div style={{ fontFamily:"'VT323',monospace", fontSize:22, color:C.border, lineHeight:1 }}>{cur[key]}{unit}</div>
                </div>
                {/* Hue rainbow preview bar */}
                {unit==="°" && (
                  <div style={{ height:8, marginBottom:6, background:"linear-gradient(to right,hsl(0,80%,55%),hsl(60,80%,55%),hsl(120,80%,55%),hsl(180,80%,55%),hsl(240,80%,55%),hsl(300,80%,55%),hsl(360,80%,55%))", border:`1px solid ${C.border}30` }} />
                )}
                <input type="range" min={min} max={max} step={1}
                  value={cur[key]}
                  onChange={(e)=>{ updateSlider(key,e.target.value); flash(); }}
                  style={{ width:"100%", accentColor:C.border }} />
              </div>
            ))}
          </div>
        </Win>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATOR VIEW
// ─────────────────────────────────────────────────────────────

function CreatorView({ decks, onCardCreate, onCardUpdate, editingCard, setEditingCard }) {
  const C = useC();
  const [front, setFront]   = useState(editingCard?.front||"");
  const [back, setBack]     = useState(editingCard?.back||"");
  const [deckId, setDeckId] = useState(editingCard?.deckId||decks[0]?.id||"");
  const [tagStr, setTagStr] = useState((editingCard?.tags||[]).join(", "));
  const [preview, setPreview] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSave = ()=>{
    if (!front.trim()||!back.trim()) return;
    const tags = tagStr.split(",").map((t)=>t.trim()).filter(Boolean);
    if (editingCard) { onCardUpdate({ ...editingCard,front,back,deckId,tags }); }
    else { onCardCreate(CardEngine.createCard({ front,back,deckId,tags })); setFront(""); setBack(""); setTagStr(""); }
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  const fStyle = { width:"100%", resize:"vertical", lineHeight:1.65, minHeight:110 };

  return (
    <div className="mf-view-pad mf-card-max fade-in">
      <Win title={editingCard?"EDIT CARD":"CREATE NEW CARD"} style={{ marginBottom:24 }}>
        <div style={{ padding:"18px 22px" }}>
          <div style={{ fontFamily:"'VT323',monospace", fontSize:22, color:C.textSub }}>
            {editingCard?"EDITING EXISTING CARD":"ADD A NEW FLASHCARD TO YOUR COLLECTION"}
          </div>
          <div style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textHint, marginTop:6 }}>
            SUPPORTS **BOLD**, *ITALIC*, `CODE`
          </div>
        </div>
      </Win>

      <div className="mf-two-col" style={{ display:"grid", gap:20, marginBottom:20 }}>
        {[{label:"FRONT — QUESTION",val:front,set:setFront,ph:"Enter the question..."},{label:"BACK — ANSWER",val:back,set:setBack,ph:"Enter the answer..."}].map((f)=>(
          <Win key={f.label} title={f.label} controls={false}>
            <div style={{ padding:"14px" }}>
              <textarea value={f.val} onChange={(e)=>f.set(e.target.value)} placeholder={f.ph} rows={6} style={fStyle} />
            </div>
          </Win>
        ))}
      </div>

      {preview && (
        <div className="mf-two-col" style={{ display:"grid", gap:20, marginBottom:20 }}>
          {[{label:"? PREVIEW FRONT",text:front},{label:"! PREVIEW BACK",text:back}].map((p)=>(
            <Win key={p.label} title={p.label} controls={false}>
              <div style={{ padding:"22px 24px", minHeight:100, display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center" }}>
                <div style={{ fontFamily:"'VT323',monospace", fontSize:22, lineHeight:1.55, color:C.text }}
                  dangerouslySetInnerHTML={{ __html:md(p.text)||`<span style="color:${C.textHint}">EMPTY</span>` }} />
              </div>
            </Win>
          ))}
        </div>
      )}

      <div className="mf-two-col" style={{ display:"grid", gap:20, marginBottom:24 }}>
        <Win title="DECK" controls={false}>
          <div style={{ padding:"14px" }}>
            <select value={deckId} onChange={(e)=>setDeckId(e.target.value)} style={{ width:"100%", cursor:"pointer" }}>
              {decks.map((d)=><option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
            </select>
          </div>
        </Win>
        <Win title="TAGS (COMMA-SEPARATED)" controls={false}>
          <div style={{ padding:"14px" }}>
            <input value={tagStr} onChange={(e)=>setTagStr(e.target.value)} placeholder="biology, cell, mitosis" style={{ width:"100%" }} />
          </div>
        </Win>
      </div>

      <div style={{ display:"flex", gap:12 }}>
        <PixelBtn onClick={handleSave} disabled={!front.trim()||!back.trim()} color={saved?C.green:C.border}>
          {saved?"✓ SAVED TO DB!":editingCard?"[ UPDATE CARD ]":"[ SAVE CARD ]"}
        </PixelBtn>
        <PixelBtn onClick={()=>setPreview((p)=>!p)} color={C.cyan}>{preview?"HIDE PREVIEW":"PREVIEW CARD"}</PixelBtn>
        {editingCard && <PixelBtn onClick={()=>setEditingCard(null)} color={C.textSub}>CANCEL</PixelBtn>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LIBRARY VIEW
// ─────────────────────────────────────────────────────────────

function LibraryView({ cards, decks, filterDeck, setFilterDeck, onDelete, onEdit }) {
  const C = useC();
  const [search, setSearch] = useState("");

  const visible = cards.filter((c)=>{
    const q = search.toLowerCase();
    const matchSearch = !q||c.front.toLowerCase().includes(q)||c.back.toLowerCase().includes(q)||c.tags.some((t)=>t.includes(q));
    const matchDeck   = filterDeck==="all"||c.deckId===filterDeck;
    return matchSearch && matchDeck;
  });

  return (
    <div className="mf-view-pad fade-in">
      <Win title="CARD LIBRARY" style={{ marginBottom:20 }}>
        <div style={{ padding:"16px 20px", display:"flex", gap:14, alignItems:"center" }}>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="SEARCH CARDS..." style={{ flex:1 }} />
          <select value={filterDeck} onChange={(e)=>setFilterDeck(e.target.value)} style={{ cursor:"pointer" }}>
            <option value="all">ALL DECKS</option>
            {decks.map((d)=><option key={d.id} value={d.id}>{d.name.toUpperCase()}</option>)}
          </select>
          <span style={{ fontFamily:"'Press Start 2P',monospace", fontSize:7, color:C.textSub, whiteSpace:"nowrap" }}>
            {visible.length}/{cards.length}
          </span>
        </div>
      </Win>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {visible.map((card)=>{
          const deck    = decks.find((d)=>d.id===card.deckId);
          const mastery = CardEngine.getMastery(card);
          return (
            <div key={card.id} style={{ background:C.panel, border:`2px solid ${C.border}`, display:"flex", alignItems:"center", gap:0, transition:"all .12s" }}
              onMouseEnter={(e)=>{ e.currentTarget.style.boxShadow=`3px 3px 0 ${C.border}`; e.currentTarget.style.transform="translate(-1px,-1px)"; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; }}>
              <div style={{ width:5, alignSelf:"stretch", background:deck?.color||C.border, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0, padding:"12px 14px" }}>
                <div style={{ fontFamily:"'VT323',monospace", fontSize:20, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}
                  dangerouslySetInnerHTML={{ __html:md(card.front.slice(0,80)) }} />
                <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:2 }}
                  dangerouslySetInnerHTML={{ __html:md(card.back.slice(0,60)+(card.back.length>60?"…":"")) }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 14px", flexShrink:0 }}>
                {deck && <PixelTag color={deck.color||C.border}>{deck.name.toUpperCase()}</PixelTag>}
                <PixelTag color={mastery.color}>{mastery.label}</PixelTag>
                <PixelBtn onClick={()=>onEdit(card)} color={C.cyan} style={{ padding:"6px 10px" }}>EDIT</PixelBtn>
                <PixelBtn onClick={()=>onDelete(card.id)} color={C.pink} style={{ padding:"6px 10px" }}>DEL</PixelBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
