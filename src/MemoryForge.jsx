/**
 * MemoryForge v4
 *
 * NEW IN v4:
 *  - 5 Vibes × 4 Palettes (RETRO, MODERN, ARCADE, FANTASY, VAPORWAVE)
 *  - Animal Companions: Professor Croak, Finn, Scout, Bao, Pixel
 *    each with personality, dialogue, and SVG soul
 *  - Animal-driven AI chat (Gemini + per-animal voice)
 *  - Streak tracking (localStorage, per user)
 *  - Keyboard shortcuts in study (space=reveal, 1-3=rate)
 *  - Deck-scoped study sessions
 *  - Stats view + 90-day review heatmap
 *  - CSV import
 *  - First-run onboarding flow
 *  - All v3 UX fixes applied
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
// VIBES — each vibe defines chrome style + fonts
// ─────────────────────────────────────────────────────────────
const VIBES = {
  retro:     { name:"RETRO",     icon:"⊞", desc:"Windows 95 pixel art",     chrome:"pixel",     fontUI:"'Press Start 2P',monospace", fontContent:"'VT323',monospace",    contentSize:26, uiSize:8,  radius:0 },
  modern:    { name:"MODERN",    icon:"◉", desc:"Clean minimal contemporary",chrome:"soft",      fontUI:"'DM Sans',sans-serif",       fontContent:"'DM Mono',monospace",   contentSize:18, uiSize:13, radius:14 },
  arcade:    { name:"ARCADE",    icon:"▶", desc:"Pixel game UI, playful",    chrome:"arcade",    fontUI:"'Press Start 2P',monospace", fontContent:"'VT323',monospace",    contentSize:24, uiSize:7,  radius:0 },
  fantasy:   { name:"FANTASY",   icon:"⚔", desc:"Parchment scrolls, RPG",   chrome:"parchment", fontUI:"'Cinzel',serif",             fontContent:"'Crimson Text',serif", contentSize:22, uiSize:13, radius:4 },
  vaporwave: { name:"VAPORWAVE", icon:"◈", desc:"Neon grid aesthetic",       chrome:"neon",      fontUI:"'Press Start 2P',monospace", fontContent:"'VT323',monospace",    contentSize:24, uiSize:7,  radius:4 },
};

// PALETTES — 4 per vibe, each a full color map
const PALETTES = {
  retro: {
    digital: { name:"DIGITAL",   bg:"#DDE4CC", panel:"#FFFFFF", raised:"#F5F5EE", border:"#1144DD", shadow:"#1144DD", text:"#000055", textSub:"#4455AA", textHint:"#8899CC", accent:"#00CCFF", green:"#00FF88", pink:"#FF1155", gold:"#FFD600", purple:"#BB88FF", orange:"#FF7700", again:"#FF1155", hard:"#FF8800", good:"#0099FF", easy:"#00FF88", titlebar:"#1144DD" },
    forest:  { name:"FOREST",    bg:"#D4E8C2", panel:"#F0F7E8", raised:"#E4F0D4", border:"#1A5C2A", shadow:"#1A5C2A", text:"#0D2B10", textSub:"#3A6B40", textHint:"#7AAB7E", accent:"#44CC88", green:"#88EE44", pink:"#EE4444", gold:"#CCAA22", purple:"#7766BB", orange:"#CC7722", again:"#EE4444", hard:"#CC7722", good:"#44CC88", easy:"#88EE44", titlebar:"#1A5C2A" },
    stone:   { name:"STONE",     bg:"#E4DDD4", panel:"#F5F0EB", raised:"#EDE8E2", border:"#5A4A3A", shadow:"#5A4A3A", text:"#2A1A0A", textSub:"#7A6A5A", textHint:"#AAA090", accent:"#CC8855", green:"#88AA55", pink:"#CC5544", gold:"#CCAA44", purple:"#8877AA", orange:"#DD7733", again:"#CC5544", hard:"#DD7733", good:"#8877AA", easy:"#88AA55", titlebar:"#5A4A3A" },
    neon:    { name:"NEON",      bg:"#080812", panel:"#0F0F1E", raised:"#141428", border:"#FF0066", shadow:"#FF0066", text:"#EEEEFF", textSub:"#9999CC", textHint:"#444477", accent:"#00FFCC", green:"#00FF88", pink:"#FF0066", gold:"#FFEE00", purple:"#CC44FF", orange:"#FF8800", again:"#FF0066", hard:"#FF8800", good:"#00FFCC", easy:"#00FF88", titlebar:"#FF0066" },
  },
  modern: {
    sage:  { name:"SAGE",   bg:"#E8EDEA", panel:"#FFFFFF", raised:"#F4F7F5", border:"#3D6B5A", shadow:"rgba(61,107,90,0.15)", text:"#1A2E27", textSub:"#4A6B5F", textHint:"#8AADA0", accent:"#2ECC71", green:"#27AE60", pink:"#E74C3C", gold:"#F39C12", purple:"#9B59B6", orange:"#E67E22", again:"#E74C3C", hard:"#F39C12", good:"#3D6B5A", easy:"#27AE60", titlebar:"#3D6B5A" },
    ocean: { name:"OCEAN",  bg:"#EBF1F7", panel:"#FFFFFF", raised:"#F5F8FC", border:"#2C5282", shadow:"rgba(44,82,130,0.12)", text:"#1A2942", textSub:"#3A5A82", textHint:"#8AADCC", accent:"#3182CE", green:"#38A169", pink:"#E53E3E", gold:"#D69E2E", purple:"#805AD5", orange:"#DD6B20", again:"#E53E3E", hard:"#DD6B20", good:"#2C5282", easy:"#38A169", titlebar:"#2C5282" },
    slate: { name:"SLATE",  bg:"#F0F2F5", panel:"#FFFFFF", raised:"#F8F9FB", border:"#475569", shadow:"rgba(71,85,105,0.12)", text:"#0F172A", textSub:"#475569", textHint:"#94A3B8", accent:"#6366F1", green:"#22C55E", pink:"#EF4444", gold:"#EAB308", purple:"#A855F7", orange:"#F97316", again:"#EF4444", hard:"#F97316", good:"#475569", easy:"#22C55E", titlebar:"#475569" },
    warm:  { name:"WARM",   bg:"#F9F5EF", panel:"#FFFAF5", raised:"#FFF8F0", border:"#92400E", shadow:"rgba(146,64,14,0.12)", text:"#292524", textSub:"#78350F", textHint:"#B45309", accent:"#D97706", green:"#65A30D", pink:"#DC2626", gold:"#CA8A04", purple:"#7C3AED", orange:"#EA580C", again:"#DC2626", hard:"#EA580C", good:"#92400E", easy:"#65A30D", titlebar:"#92400E" },
  },
  arcade: {
    classic:  { name:"CLASSIC",  bg:"#1A1A2E", panel:"#16213E", raised:"#1E2A45", border:"#E94560", shadow:"#E94560", text:"#EAEAEA", textSub:"#A0B0C0", textHint:"#506070", accent:"#0F3460", green:"#4CAF50", pink:"#E94560", gold:"#FFD700", purple:"#7B2FBE", orange:"#FF6B6B", again:"#E94560", hard:"#FF6B6B", good:"#0F3460", easy:"#4CAF50", titlebar:"#E94560" },
    gameboy:  { name:"GAMEBOY",  bg:"#9BBC0F", panel:"#8BAC0F", raised:"#8BAC0F", border:"#306230", shadow:"#0F380F", text:"#0F380F", textSub:"#306230", textHint:"#4A7A30", accent:"#306230", green:"#0F380F", pink:"#8B0F0F", gold:"#8B7010", purple:"#4A306A", orange:"#6B3010", again:"#8B0F0F", hard:"#6B4010", good:"#306230", easy:"#0F380F", titlebar:"#306230" },
    crt:      { name:"CRT",      bg:"#0A0800", panel:"#111000", raised:"#181500", border:"#FFAA00", shadow:"#FF8800", text:"#FFCC44", textSub:"#AA7700", textHint:"#553300", accent:"#FF8800", green:"#88FF00", pink:"#FF4400", gold:"#FFCC00", purple:"#AA44FF", orange:"#FF6600", again:"#FF4400", hard:"#FF6600", good:"#FFAA00", easy:"#88FF00", titlebar:"#FFAA00" },
    rainbow:  { name:"RAINBOW",  bg:"#0A0A0A", panel:"#141414", raised:"#1E1E1E", border:"#FF4081", shadow:"#FF4081", text:"#FFFFFF", textSub:"#AAAAAA", textHint:"#444444", accent:"#00E5FF", green:"#69F0AE", pink:"#FF4081", gold:"#FFD740", purple:"#E040FB", orange:"#FF6D00", again:"#FF4081", hard:"#FF6D00", good:"#00E5FF", easy:"#69F0AE", titlebar:"#FF4081" },
  },
  fantasy: {
    parchment: { name:"PARCHMENT", bg:"#F5E6C8", panel:"#FFF8E7", raised:"#FFF3D5", border:"#8B4513", shadow:"rgba(139,69,19,0.3)", text:"#3B1F0A", textSub:"#7A4520", textHint:"#B8895A", accent:"#C8860A", green:"#4A7C30", pink:"#9B2335", gold:"#C8860A", purple:"#5D4E75", orange:"#B85C1A", again:"#9B2335", hard:"#B85C1A", good:"#8B4513", easy:"#4A7C30", titlebar:"#8B4513" },
    dungeon:   { name:"DUNGEON",   bg:"#1A1008", panel:"#241808", raised:"#2E2010", border:"#8B7355", shadow:"rgba(139,115,85,0.3)", text:"#D4B896", textSub:"#8B7355", textHint:"#554535", accent:"#C8960A", green:"#4A8040", pink:"#8B2530", gold:"#C8960A", purple:"#5D3E7A", orange:"#A85020", again:"#8B2530", hard:"#A85020", good:"#8B7355", easy:"#4A8040", titlebar:"#8B7355" },
    mystic:    { name:"MYSTIC",    bg:"#140825", panel:"#1E1040", raised:"#281550", border:"#7C3AED", shadow:"rgba(124,58,237,0.4)", text:"#E8D5FF", textSub:"#A880F0", textHint:"#5A3A8A", accent:"#A78BFA", green:"#34D399", pink:"#F472B6", gold:"#FCD34D", purple:"#7C3AED", orange:"#FB923C", again:"#F472B6", hard:"#FB923C", good:"#7C3AED", easy:"#34D399", titlebar:"#7C3AED" },
    forestkeep:{ name:"FOREST KEEP",bg:"#0A150A", panel:"#0F200F", raised:"#152815", border:"#2D6A4F", shadow:"rgba(45,106,79,0.4)", text:"#B7E4C7", textSub:"#4D9966", textHint:"#1B4332", accent:"#52B788", green:"#95D5B2", pink:"#E76F51", gold:"#E9C46A", purple:"#6C5CE7", orange:"#F4A261", again:"#E76F51", hard:"#F4A261", good:"#2D6A4F", easy:"#95D5B2", titlebar:"#2D6A4F" },
  },
  vaporwave: {
    purple: { name:"PURPLE DREAM", bg:"#1A0330", panel:"#240540", raised:"#2E0850", border:"#BF5AF2", shadow:"rgba(191,90,242,0.5)", text:"#F0E0FF", textSub:"#9966CC", textHint:"#5A3A7A", accent:"#FF6EC7", green:"#39FF14", pink:"#FF6EC7", gold:"#FFD700", purple:"#BF5AF2", orange:"#FF9A3C", again:"#FF6EC7", hard:"#FF9A3C", good:"#BF5AF2", easy:"#39FF14", titlebar:"#BF5AF2" },
    cyber:  { name:"CYBERPUNK",    bg:"#000D1A", panel:"#001A33", raised:"#002244", border:"#00F5FF", shadow:"rgba(0,245,255,0.4)", text:"#E0FAFF", textSub:"#00AACC", textHint:"#004455", accent:"#FFE600", green:"#39FF14", pink:"#FF2079", gold:"#FFE600", purple:"#BD00FF", orange:"#FF6600", again:"#FF2079", hard:"#FF6600", good:"#00F5FF", easy:"#39FF14", titlebar:"#00F5FF" },
    synth:  { name:"SYNTHWAVE",    bg:"#0D0021", panel:"#150032", raised:"#1D0045", border:"#FF2D55", shadow:"rgba(255,45,85,0.5)", text:"#FFE4F0", textSub:"#CC4488", textHint:"#661133", accent:"#00E5FF", green:"#39FF14", pink:"#FF2D55", gold:"#FFFC00", purple:"#CC44FF", orange:"#FF8C42", again:"#FF2D55", hard:"#FF8C42", good:"#CC44FF", easy:"#39FF14", titlebar:"#FF2D55" },
    pastel: { name:"PASTEL WAVE",  bg:"#1A0A2E", panel:"#230D3D", raised:"#2C1050", border:"#A78BFA", shadow:"rgba(167,139,250,0.4)", text:"#EDE9FE", textSub:"#8B5CF6", textHint:"#4C1D95", accent:"#F472B6", green:"#6EE7B7", pink:"#F472B6", gold:"#FDE68A", purple:"#A78BFA", orange:"#FCA5A5", again:"#F472B6", hard:"#FCA5A5", good:"#A78BFA", easy:"#6EE7B7", titlebar:"#A78BFA" },
  },
};

function buildTheme(config) {
  const vibe = VIBES[config.vibe] || VIBES.retro;
  const palGroup = PALETTES[config.vibe] || PALETTES.retro;
  const palKey = config.palette || Object.keys(palGroup)[0];
  const pal = palGroup[palKey] || Object.values(palGroup)[0];
  return { ...pal, ...vibe, borderLight: pal.border + "44" };
}

const DEFAULT_THEME = { vibe:"retro", palette:"digital" };
const ThemeCtx = createContext(buildTheme(DEFAULT_THEME));
const useC = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────
// ANIMAL COMPANIONS — personality data
// ─────────────────────────────────────────────────────────────
const COMPANIONS = {
  croak: {
    id: "croak", name: "Prof. Croak", species: "Frog",
    tagline: "Riveting scholarship! 🎓",
    color: "#5CB85C",
    specialty: "Explanations & Analogies",
    idle: ["Ribbit! Ready to enlighten you!", "Fascinating subject matter!", "My graduation cap is tingling!", "Shall we begin our scholarly session?"],
    correct: ["Excellent! The synapses fire!", "Ribbit ribbit — you've got it!", "A true academic triumph!", "My glasses are fogging from excitement!"],
    wrong: ["Fret not! Failure is merely pre-success.", "Even I failed my first pond quiz. Ribbit.", "Let's circle back to fundamentals.", "A scholarly setback — nothing more!"],
    done: ["Session concluded with distinction!", "You've earned a gold star, ribbit!", "Professor Croak is most pleased!", "Splendid scholarship today!"],
    aiPrompt: (front, back) => `You are Professor Croak, an enthusiastic scholarly frog with a graduation cap and bow tie. You explain flashcards with academic flair but genuine warmth. Use "Ribbit!" occasionally as punctuation (not too much). Give a clear 2-sentence explanation of the concept, then a memorable analogy, then one surprising related fact. Be concise and use markdown **bold** for key terms.\n\nFlashcard front: ${front}\nFlashcard back: ${back}`,
  },
  finn: {
    id: "finn", name: "Finn", species: "Shark",
    tagline: "Stay frosty, keep studying 🎧",
    color: "#607D8B",
    specialty: "Motivation & Hype",
    idle: ["yo what's up studier", "headphones on, brain engaged fr", "ready to vibe through some cards bro", "this deck ain't gonna learn itself"],
    correct: ["LETSGOOO 🔥", "clean. real clean.", "bro that was smooth", "shark wisdom: you already knew that"],
    wrong: ["nah we just vibin no cap", "miss today master tomorrow fr fr", "it's just a card bro shake it off", "even sharks swim wrong sometimes"],
    done: ["W session no cap", "that was a banger study sesh", "headphones off for a sec — respect.", "you put in the work. respect."],
    aiPrompt: (front, back) => `You are Finn, a chill bipedal shark who wears headphones and a bucket hat. You explain things in a relaxed, cool, slightly Gen-Z way. Be helpful but keep the vibe relaxed. Give a quick explanation, drop a cool analogy, end with something motivational. Keep it short. Use lowercase mostly.\n\nFlashcard front: ${front}\nFlashcard back: ${back}`,
  },
  scout: {
    id: "scout", name: "Scout", species: "Fox",
    tagline: "Adventure awaits, explorer! 🧭",
    color: "#FF7043",
    specialty: "Navigation & Discovery",
    idle: ["Ready for an expedition!", "The compass points to knowledge!", "Let's map out this deck together!", "Explorer's log: study session starting!"],
    correct: ["DISCOVERY! Mark it on the map!", "Another treasure found!", "Your knowledge map grows!", "That path is now cleared!"],
    wrong: ["Explorers get lost — that's how they find things!", "Uncharted territory — let's scout again!", "The best discoveries come from wrong turns!", "Mark this spot — we'll return!"],
    done: ["Expedition complete! What a haul!", "Knowledge territory: expanded!", "Adventure log updated. Well done!", "The map grows richer every session!"],
    aiPrompt: (front, back) => `You are Scout, an adventurous fox explorer with a compass and explorer vest. You frame learning as an exciting adventure with discovery metaphors. Give a 2-sentence explanation, then frame the concept as an "explorer finding something" analogy, then a "fun discovery" related fact. Be enthusiastic and use exploration language.\n\nFlashcard front: ${front}\nFlashcard back: ${back}`,
  },
  bao: {
    id: "bao", name: "Bao", species: "Panda",
    tagline: "Precision & methodology 📝",
    color: "#455A64",
    specialty: "Stats & Precision",
    idle: ["Systems nominal. Ready for review.", "I've analyzed your deck. Shall we proceed?", "Bamboo tea ready. Focus acquired.", "Data logged. Beginning study protocol."],
    correct: ["Accuracy confirmed. Interval extended.", "Pattern recognition: successful.", "Noted in the study ledger.", "Correct. Ease factor updating."],
    wrong: ["Error logged. Recalibrating.", "The algorithm will prioritize this.", "Noted. Additional repetitions scheduled.", "Data point recorded for optimization."],
    done: ["Session data compiled successfully.", "Review complete. Stats updated.", "Efficiency: satisfactory. Improvement identified.", "All data synchronized. Resume tomorrow."],
    aiPrompt: (front, back) => `You are Bao, a methodical panda with reading glasses and a bamboo pen. You give structured, precise explanations. Format your response as: 1) A clean 2-sentence definition, 2) A logical comparison or analogy, 3) A key related concept worth noting. Be thorough but concise. Use **bold** for technical terms.\n\nFlashcard front: ${front}\nFlashcard back: ${back}`,
  },
  pixel: {
    id: "pixel", name: "Pixel", species: "Polar Bear",
    tagline: "Cozy studying, one card at a time ☕",
    color: "#7986CB",
    specialty: "Comfort & Encouragement",
    idle: ["*sips tea* Hi there friend 🍵", "cozy study time? let's go~", "wrapped in a hoodie, ready to help", "you came back! that's the best part"],
    correct: ["aaaa you got it!! 🌟", "*happy bear noises*", "that was so good!! treat yourself", "look at you gooo 🐻"],
    wrong: ["hey hey, it's totally fine", "that one's sneaky, I'd miss it too", "*puts hoodie on you* we got this", "one more look and it'll stick~"],
    done: ["look how far you came today 🐾", "*warm hug* you did so well", "that deserved a cozy break honestly", "proud of you. seriously. ☕"],
    aiPrompt: (front, back) => `You are Pixel, a cozy polar bear in a hoodie who loves warm drinks and late-night study sessions. You explain things in a warm, encouraging, gentle way. Give a simple clear explanation in your own words, then a cozy/relatable analogy, then one small encouraging note. Keep it gentle and friendly, like a friend helping you study.\n\nFlashcard front: ${front}\nFlashcard back: ${back}`,
  },
};

// ─────────────────────────────────────────────────────────────
// ANIMAL SVG COMPONENTS — hand-crafted with soul
// ─────────────────────────────────────────────────────────────

function CroadSVG({ size = 80, mood = "idle" }) {
  // Professor Croak: green frog, graduation cap, round glasses, bow tie
  const eyeY = mood === "correct" ? 36 : mood === "wrong" ? 40 : 38;
  const mouthD = mood === "correct" ? "M30 62 Q40 72 50 62" : mood === "wrong" ? "M30 66 Q40 60 50 66" : "M31 63 Q40 70 49 63";
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} style={{ overflow:"visible", display:"block" }}>
      {/* Body */}
      <ellipse cx="50" cy="78" rx="30" ry="22" fill="#5CB85C"/>
      <ellipse cx="50" cy="82" rx="20" ry="14" fill="#A8D5A2"/>
      {/* Eye bumps */}
      <circle cx="34" cy="50" r="14" fill="#5CB85C"/>
      <circle cx="66" cy="50" r="14" fill="#5CB85C"/>
      {/* Eyes */}
      <circle cx="34" cy="50" r="9" fill="#fff"/>
      <circle cx="66" cy="50" r="9" fill="#fff"/>
      <circle cx="35" cy={eyeY+12} r="5" fill="#1A3A1A"/>
      <circle cx="67" cy={eyeY+12} r="5" fill="#1A3A1A"/>
      <circle cx="36" cy={eyeY+10} r="2" fill="white"/>
      <circle cx="68" cy={eyeY+10} r="2" fill="white"/>
      {/* Glasses */}
      <circle cx="34" cy="50" r="11" fill="none" stroke="#8B6914" strokeWidth="1.8"/>
      <circle cx="66" cy="50" r="11" fill="none" stroke="#8B6914" strokeWidth="1.8"/>
      <line x1="45" y1="50" x2="55" y2="50" stroke="#8B6914" strokeWidth="1.8"/>
      <line x1="23" y1="49" x2="26" y2="50" stroke="#8B6914" strokeWidth="1.8"/>
      <line x1="77" y1="49" x2="74" y2="50" stroke="#8B6914" strokeWidth="1.8"/>
      {/* Nose */}
      <circle cx="46" cy="60" r="2.5" fill="#3D8B3D"/>
      <circle cx="54" cy="60" r="2.5" fill="#3D8B3D"/>
      {/* Mouth */}
      <path d={mouthD} fill="none" stroke="#3D8B3D" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Graduation cap — board */}
      <rect x="27" y="28" width="46" height="5" fill="#1A1A1A" rx="1"/>
      {/* Cap top */}
      <rect x="36" y="16" width="28" height="14" fill="#1A1A1A" rx="2"/>
      {/* Tassel */}
      <line x1="73" y1="30" x2="79" y2="44" stroke="#F1C40F" strokeWidth="2.5"/>
      <circle cx="79" cy="47" r="4" fill="#F1C40F"/>
      <line x1="79" y1="47" x2="75" y2="54" stroke="#F1C40F" strokeWidth="1.5"/>
      <line x1="79" y1="47" x2="82" y2="54" stroke="#F1C40F" strokeWidth="1.5"/>
      {/* Bow tie */}
      <path d="M38 89 L43 85 L38 81Z" fill="#E74C3C"/>
      <path d="M62 89 L57 85 L62 81Z" fill="#E74C3C"/>
      <circle cx="50" cy="85" r="4" fill="#C0392B"/>
      {/* Arms with tiny book */}
      <ellipse cx="22" cy="84" rx="9" ry="6" fill="#5CB85C" transform="rotate(-25 22 84)"/>
      <ellipse cx="78" cy="84" rx="9" ry="6" fill="#5CB85C" transform="rotate(25 78 84)"/>
      <rect x="10" y="84" width="12" height="9" fill="#E74C3C" rx="1"/>
      <line x1="16" y1="84" x2="16" y2="93" stroke="#C0392B" strokeWidth="1.5"/>
      <line x1="12" y1="87" x2="16" y2="87" stroke="#B71C1C" strokeWidth="0.8"/>
      <line x1="12" y1="89" x2="16" y2="89" stroke="#B71C1C" strokeWidth="0.8"/>
    </svg>
  );
}

function FinnSVG({ size = 80, mood = "idle" }) {
  // Finn: bipedal shark, big headphones, bucket hat, one tooth
  const eyeShape = mood === "correct" ? "arc" : mood === "wrong" ? "flat" : "round";
  return (
    <svg viewBox="0 0 100 115" width={size} height={size * 1.15} style={{ overflow:"visible", display:"block" }}>
      {/* Body */}
      <ellipse cx="50" cy="72" rx="24" ry="30" fill="#78909C"/>
      {/* Belly */}
      <ellipse cx="50" cy="76" rx="14" ry="20" fill="#ECEFF1"/>
      {/* Dorsal fin */}
      <path d="M50 42 L60 55 L55 55Z" fill="#607D8B"/>
      {/* Head */}
      <ellipse cx="50" cy="48" rx="20" ry="18" fill="#78909C"/>
      {/* Side fins as arms */}
      <ellipse cx="26" cy="72" rx="8" ry="14" fill="#607D8B" transform="rotate(-15 26 72)"/>
      <ellipse cx="74" cy="72" rx="8" ry="14" fill="#607D8B" transform="rotate(15 74 72)"/>
      {/* Legs */}
      <ellipse cx="40" cy="99" rx="9" ry="7" fill="#607D8B"/>
      <ellipse cx="60" cy="99" rx="9" ry="7" fill="#607D8B"/>
      {/* Shoes */}
      <ellipse cx="40" cy="104" rx="10" ry="5" fill="#E53935"/>
      <ellipse cx="60" cy="104" rx="10" ry="5" fill="#E53935"/>
      {/* Eyes */}
      {eyeShape === "round" && <>
        <circle cx="42" cy="46" r="5" fill="#fff"/>
        <circle cx="58" cy="46" r="5" fill="#fff"/>
        <circle cx="43" cy="47" r="3" fill="#263238"/>
        <circle cx="59" cy="47" r="3" fill="#263238"/>
        <circle cx="44" cy="46" r="1.2" fill="white"/>
        <circle cx="60" cy="46" r="1.2" fill="white"/>
      </>}
      {eyeShape === "arc" && <>
        <path d="M38 47 Q42 41 46 47" fill="none" stroke="#263238" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M54 47 Q58 41 62 47" fill="none" stroke="#263238" strokeWidth="2.5" strokeLinecap="round"/>
      </>}
      {eyeShape === "flat" && <>
        <line x1="39" y1="46" x2="45" y2="46" stroke="#263238" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="55" y1="46" x2="61" y2="46" stroke="#263238" strokeWidth="2.5" strokeLinecap="round"/>
      </>}
      {/* Mouth — big shark grin with one tooth */}
      <path d="M38 57 Q50 67 62 57" fill="#ECEFF1" stroke="#455A64" strokeWidth="1.5"/>
      <path d="M38 57 Q50 63 62 57" fill="none" stroke="#455A64" strokeWidth="1.5"/>
      <rect x="47" y="57" width="6" height="5" fill="white" rx="1"/>
      {/* Headphones — ear cups */}
      <circle cx="30" cy="46" r="9" fill="#FF5722"/>
      <circle cx="30" cy="46" r="5" fill="#BF360C"/>
      <circle cx="70" cy="46" r="9" fill="#FF5722"/>
      <circle cx="70" cy="46" r="5" fill="#BF360C"/>
      {/* Headphone band */}
      <path d="M30 37 Q50 22 70 37" fill="none" stroke="#FF5722" strokeWidth="5" strokeLinecap="round"/>
      {/* Bucket hat */}
      <ellipse cx="50" cy="30" rx="22" ry="5" fill="#FFA726"/>
      <rect x="32" y="12" width="36" height="20" fill="#FFA726" rx="3"/>
      <ellipse cx="50" cy="12" rx="18" ry="4" fill="#FB8C00"/>
      {/* Hat line detail */}
      <line x1="32" y1="22" x2="68" y2="22" stroke="#FB8C00" strokeWidth="1.5"/>
    </svg>
  );
}

function ScoutSVG({ size = 80, mood = "idle" }) {
  // Scout: orange fox, pointed ears, explorer vest, bushy tail
  const eyeY = mood === "correct" ? -2 : mood === "wrong" ? 2 : 0;
  return (
    <svg viewBox="0 0 100 115" width={size} height={size * 1.15} style={{ overflow:"visible", display:"block" }}>
      {/* Tail */}
      <ellipse cx="72" cy="90" rx="16" ry="22" fill="#FF7043" transform="rotate(-20 72 90)"/>
      <ellipse cx="72" cy="90" rx="9" ry="14" fill="#FFCCBC" transform="rotate(-20 72 90)"/>
      <ellipse cx="68" cy="76" rx="7" ry="10" fill="#FFCCBC" transform="rotate(-20 68 76)"/>
      {/* Body */}
      <ellipse cx="46" cy="76" rx="22" ry="26" fill="#FF7043"/>
      {/* Explorer vest */}
      <ellipse cx="46" cy="78" rx="14" ry="18" fill="#5D4037"/>
      {/* Vest pockets */}
      <rect x="36" y="75" width="10" height="8" fill="#4E342E" rx="2"/>
      <rect x="49" y="75" width="10" height="8" fill="#4E342E" rx="2"/>
      <line x1="41" y1="75" x2="41" y2="83" stroke="#3E2723" strokeWidth="0.8"/>
      <line x1="54" y1="75" x2="54" y2="83" stroke="#3E2723" strokeWidth="0.8"/>
      {/* Vest buttons */}
      <circle cx="46" cy="70" r="1.5" fill="#795548"/>
      <circle cx="46" cy="76" r="1.5" fill="#795548"/>
      {/* Head */}
      <ellipse cx="46" cy="46" rx="20" ry="18" fill="#FF7043"/>
      {/* Muzzle */}
      <ellipse cx="46" cy="56" rx="10" ry="7" fill="#FFCCBC"/>
      {/* Ears */}
      <path d="M28 30 L22 10 L40 28Z" fill="#FF7043"/>
      <path d="M64 30 L70 10 L52 28Z" fill="#FF7043"/>
      <path d="M30 29 L25 14 L39 28Z" fill="#E91E63"/>
      <path d="M62 29 L67 14 L53 28Z" fill="#E91E63"/>
      {/* Eyes */}
      <circle cx="38" cy={44+eyeY} r="6" fill="#FFECB3"/>
      <circle cx="54" cy={44+eyeY} r="6" fill="#FFECB3"/>
      <circle cx="39" cy={45+eyeY} r="3.5" fill="#5D4037"/>
      <circle cx="55" cy={45+eyeY} r="3.5" fill="#5D4037"/>
      <circle cx="40" cy={44+eyeY} r="1.5" fill="white"/>
      <circle cx="56" cy={44+eyeY} r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="46" cy="54" rx="3.5" ry="2.5" fill="#5D4037"/>
      {/* Mouth */}
      {mood === "correct" ? <path d="M40 59 Q46 65 52 59" fill="none" stroke="#5D4037" strokeWidth="2" strokeLinecap="round"/> :
       mood === "wrong"   ? <path d="M40 62 Q46 58 52 62" fill="none" stroke="#5D4037" strokeWidth="2" strokeLinecap="round"/> :
       <path d="M40 60 Q46 64 52 60" fill="none" stroke="#5D4037" strokeWidth="2" strokeLinecap="round"/>}
      {/* Arms */}
      <ellipse cx="26" cy="74" rx="7" ry="12" fill="#FF7043" transform="rotate(-10 26 74)"/>
      <ellipse cx="66" cy="74" rx="7" ry="12" fill="#FF7043" transform="rotate(10 66 74)"/>
      {/* Compass on string */}
      <line x1="46" y1="64" x2="46" y2="72" stroke="#795548" strokeWidth="1.5"/>
      <circle cx="46" cy="74" r="5" fill="#FFECB3" stroke="#5D4037" strokeWidth="1.5"/>
      <line x1="46" y1="71" x2="46" y2="72" stroke="#E53935" strokeWidth="1.5"/>
      <line x1="43" y1="74" x2="44" y2="74" stroke="#1565C0" strokeWidth="1.5"/>
      {/* Legs */}
      <ellipse cx="38" cy="98" rx="8" ry="7" fill="#FF7043"/>
      <ellipse cx="54" cy="98" rx="8" ry="7" fill="#FF7043"/>
      <ellipse cx="38" cy="104" rx="9" ry="5" fill="#5D4037"/>
      <ellipse cx="54" cy="104" rx="9" ry="5" fill="#5D4037"/>
    </svg>
  );
}

function BaoSVG({ size = 80, mood = "idle" }) {
  // Bao: black/white panda, reading glasses, pencil behind ear
  const browAngle = mood === "wrong" ? -1 : mood === "correct" ? 1 : 0;
  return (
    <svg viewBox="0 0 100 110" width={size} height={size * 1.1} style={{ overflow:"visible", display:"block" }}>
      {/* Body */}
      <ellipse cx="50" cy="78" rx="28" ry="25" fill="white"/>
      <ellipse cx="50" cy="78" rx="28" ry="25" fill="none" stroke="#BDBDBD" strokeWidth="1"/>
      {/* Black arm patches */}
      <ellipse cx="24" cy="80" rx="10" ry="14" fill="#212121"/>
      <ellipse cx="76" cy="80" rx="10" ry="14" fill="#212121"/>
      {/* Paws */}
      <ellipse cx="21" cy="91" rx="9" ry="6" fill="#212121"/>
      <ellipse cx="79" cy="91" rx="9" ry="6" fill="#212121"/>
      {/* Bamboo pen in right arm */}
      <line x1="83" y1="78" x2="90" y2="68" stroke="#8BC34A" strokeWidth="3" strokeLinecap="round"/>
      <polygon points="90,68 93,65 87,66" fill="#4CAF50"/>
      {/* Head */}
      <circle cx="50" cy="44" r="24" fill="white"/>
      <circle cx="50" cy="44" r="24" fill="none" stroke="#BDBDBD" strokeWidth="1"/>
      {/* Ear patches */}
      <circle cx="30" cy="24" r="11" fill="#212121"/>
      <circle cx="70" cy="24" r="11" fill="#212121"/>
      <circle cx="30" cy="24" r="6" fill="#424242"/>
      <circle cx="70" cy="24" r="6" fill="#424242"/>
      {/* Eye patches */}
      <ellipse cx="38" cy="42" rx="10" ry="10" fill="#212121"/>
      <ellipse cx="62" cy="42" rx="10" ry="10" fill="#212121"/>
      {/* Eyes */}
      <circle cx="38" cy="42" r="6" fill="#fff"/>
      <circle cx="62" cy="42" r="6" fill="#fff"/>
      <circle cx="39" cy={43} r="3.5" fill="#0D0D0D"/>
      <circle cx="63" cy={43} r="3.5" fill="#0D0D0D"/>
      <circle cx="40" cy="42" r="1.5" fill="white"/>
      <circle cx="64" cy="42" r="1.5" fill="white"/>
      {/* Eyebrows showing mood */}
      <line x1="32" y1={33-browAngle*3} x2="44" y2={34+browAngle*3} stroke="#212121" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="56" y1={34+browAngle*3} x2="68" y2={33-browAngle*3} stroke="#212121" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Nose */}
      <ellipse cx="50" cy="52" rx="4" ry="3" fill="#212121"/>
      {/* Mouth */}
      {mood === "correct" ? <path d="M44 57 Q50 63 56 57" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round"/> :
       mood === "wrong"   ? <path d="M44 60 Q50 56 56 60" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round"/> :
       <path d="M44 58 Q50 63 56 58" fill="none" stroke="#212121" strokeWidth="2" strokeLinecap="round"/>}
      {/* Reading glasses */}
      <circle cx="38" cy="42" r="8" fill="none" stroke="#795548" strokeWidth="1.8"/>
      <circle cx="62" cy="42" r="8" fill="none" stroke="#795548" strokeWidth="1.8"/>
      <line x1="46" y1="42" x2="54" y2="42" stroke="#795548" strokeWidth="1.8"/>
      <line x1="28" y1="41" x2="30" y2="42" stroke="#795548" strokeWidth="1.8"/>
      <line x1="72" y1="41" x2="70" y2="42" stroke="#795548" strokeWidth="1.8"/>
      {/* Pencil behind ear */}
      <line x1="24" y1="26" x2="18" y2="18" stroke="#FDD835" strokeWidth="3" strokeLinecap="round"/>
      <line x1="18" y1="18" x2="16" y2="14" stroke="#FFCCBC" strokeWidth="2"/>
      <polygon points="16,14 14,10 20,13" fill="#F57F17"/>
      {/* Legs */}
      <ellipse cx="38" cy="100" rx="10" ry="8" fill="#212121"/>
      <ellipse cx="62" cy="100" rx="10" ry="8" fill="#212121"/>
    </svg>
  );
}

function PixelSVG({ size = 80, mood = "idle" }) {
  // Pixel: round polar bear, hoodie, mug, sleepy eyes
  const eyeOpen = mood === "correct" ? 3 : 1.5;
  return (
    <svg viewBox="0 0 100 115" width={size} height={size * 1.15} style={{ overflow:"visible", display:"block" }}>
      {/* Body — very round and soft */}
      <ellipse cx="50" cy="80" rx="32" ry="28" fill="#E8EAF6"/>
      {/* Hoodie body */}
      <ellipse cx="50" cy="83" rx="28" ry="22" fill="#7986CB"/>
      {/* Hoodie pocket */}
      <rect x="38" y="87" width="24" height="15" fill="#5C6BC0" rx="3"/>
      <line x1="50" y1="87" x2="50" y2="102" stroke="#3949AB" strokeWidth="1.5"/>
      {/* Hoodie strings */}
      <line x1="46" y1="72" x2="43" y2="80" stroke="#5C6BC0" strokeWidth="2"/>
      <line x1="54" y1="72" x2="57" y2="80" stroke="#5C6BC0" strokeWidth="2"/>
      <circle cx="43" cy="81" r="2.5" fill="#3949AB"/>
      <circle cx="57" cy="81" r="2.5" fill="#3949AB"/>
      {/* Arms */}
      <ellipse cx="20" cy="84" rx="10" ry="14" fill="#7986CB" transform="rotate(-15 20 84)"/>
      <ellipse cx="80" cy="84" rx="10" ry="14" fill="#7986CB" transform="rotate(15 80 84)"/>
      {/* Paws */}
      <circle cx="16" cy="95" r="8" fill="#E8EAF6"/>
      <circle cx="84" cy="95" r="8" fill="#E8EAF6"/>
      {/* Mug */}
      <rect x="74" y="84" width="16" height="14" fill="#FFCCBC" rx="2"/>
      <path d="M90 87 Q96 87 96 91 Q96 95 90 95" fill="none" stroke="#FFCCBC" strokeWidth="3"/>
      <rect x="76" y="86" width="12" height="3" fill="#FF8A65" rx="1"/>
      {/* Steam */}
      <path d="M78 82 Q79 78 78 74" fill="none" stroke="#B0BEC5" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M83 82 Q84 77 83 73" fill="none" stroke="#B0BEC5" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Head */}
      <circle cx="50" cy="44" r="28" fill="#FAFAFA"/>
      {/* Ears */}
      <circle cx="26" cy="22" r="11" fill="#FAFAFA"/>
      <circle cx="74" cy="22" r="11" fill="#FAFAFA"/>
      <circle cx="26" cy="22" r="6" fill="#FFB3BA"/>
      <circle cx="74" cy="22" r="6" fill="#FFB3BA"/>
      {/* Eyes — droopy/sleepy */}
      <ellipse cx="38" cy="44" rx="7" ry={eyeOpen+2} fill="#37474F"/>
      <ellipse cx="62" cy="44" rx="7" ry={eyeOpen+2} fill="#37474F"/>
      <ellipse cx="38" cy="44" rx="4" ry={eyeOpen} fill="white"/>
      <ellipse cx="62" cy="44" rx="4" ry={eyeOpen} fill="white"/>
      {/* Droopy eyelids */}
      <path d="M31 40 Q38 37 45 40" fill="#FAFAFA" stroke="#FAFAFA" strokeWidth="1"/>
      <path d="M55 40 Q62 37 69 40" fill="#FAFAFA" stroke="#FAFAFA" strokeWidth="1"/>
      {/* Sparkle in eye when correct */}
      {mood === "correct" && <>
        <circle cx="39" cy="43" r="1.5" fill="white"/>
        <circle cx="63" cy="43" r="1.5" fill="white"/>
      </>}
      {/* Nose */}
      <ellipse cx="50" cy="54" rx="4.5" ry="3" fill="#BDBDBD"/>
      {/* Mouth */}
      {mood === "correct" ? <path d="M43 61 Q50 68 57 61" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round"/> :
       mood === "wrong"   ? <path d="M43 64 Q50 60 57 64" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round"/> :
       <path d="M43 62 Q50 66 57 62" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round"/>}
      {/* Cheek blush */}
      <ellipse cx="32" cy="56" rx="7" ry="4" fill="#FFCDD2" opacity="0.7"/>
      <ellipse cx="68" cy="56" rx="7" ry="4" fill="#FFCDD2" opacity="0.7"/>
    </svg>
  );
}

const COMPANION_SVGS = { croak: CroadSVG, finn: FinnSVG, scout: ScoutSVG, bao: BaoSVG, pixel: PixelSVG };

function CompanionSVG({ id, size, mood }) {
  const Cmp = COMPANION_SVGS[id] || CroadSVG;
  return <Cmp size={size} mood={mood} />;
}

// ─────────────────────────────────────────────────────────────
// STREAK HELPERS (localStorage, keyed by user id)
// ─────────────────────────────────────────────────────────────
const Streak = {
  get: (uid) => {
    try { return JSON.parse(localStorage.getItem(`mf_streak_${uid}`) || '{"n":0,"last":"","best":0}'); }
    catch { return { n:0, last:"", best:0 }; }
  },
  update: (uid) => {
    const today = new Date().toDateString();
    const prev = Streak.get(uid);
    if (prev.last === today) return prev;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const n = prev.last === yesterday ? prev.n + 1 : 1;
    const data = { n, last:today, best:Math.max(prev.best||0, n) };
    localStorage.setItem(`mf_streak_${uid}`, JSON.stringify(data));
    return data;
  },
};

// ─────────────────────────────────────────────────────────────
// DB SERVICE (same as v3 + companion pref in profile)
// ─────────────────────────────────────────────────────────────
function cardToDb(card, userId) {
  return { id:card.id, user_id:userId, deck_id:card.deckId, front:card.front, back:card.back, tags:card.tags, interval:card.interval, ease_factor:card.easeFactor, repetitions:card.repetitions, next_review:card.nextReview, last_review:card.lastReview, review_history:card.reviewHistory, created_at:card.createdAt };
}
function dbToCard(row) {
  return { id:row.id, deckId:row.deck_id, front:row.front, back:row.back, tags:row.tags||[], type:"text", imageUrl:null, occlusionBoxes:[], audioUrl:null, interval:row.interval||1, easeFactor:row.ease_factor||2.5, repetitions:row.repetitions||0, nextReview:row.next_review, lastReview:row.last_review, reviewHistory:row.review_history||[], createdAt:row.created_at };
}
function deckToDb(deck, userId) {
  return { id:deck.id, user_id:userId, name:deck.name, description:deck.description, color:deck.color, emoji:deck.emoji, category_id:deck.categoryId||null, created_at:deck.createdAt };
}
function dbToDeck(row) {
  return { id:row.id, name:row.name, description:row.description||"", color:row.color||"#1144DD", emoji:row.emoji||"📚", categoryId:row.category_id||null, createdAt:row.created_at };
}
function categoryToDb(cat, userId) {
  return { id:cat.id, user_id:userId, name:cat.name, color:cat.color, emoji:cat.emoji, created_at:cat.createdAt };
}
function dbToCategory(row) {
  return { id:row.id, name:row.name, color:row.color||"#888888", emoji:row.emoji||"📁", createdAt:row.created_at };
}

const DB = {
  async getCards() { const { data, error } = await supabase.from("cards").select("*").order("created_at", { ascending:true }); if (error) throw error; return (data||[]).map(dbToCard); },
  async upsertCard(card) { const { data:{ user } } = await supabase.auth.getUser(); const { error } = await supabase.from("cards").upsert(cardToDb(card, user.id), { onConflict:"id" }); if (error) throw error; },
  async deleteCard(id) { const { error } = await supabase.from("cards").delete().eq("id", id); if (error) throw error; },
  async getDecks() { const { data, error } = await supabase.from("decks").select("*").order("created_at", { ascending:true }); if (error) throw error; return (data||[]).map(dbToDeck); },
  async upsertDeck(deck) { const { data:{ user } } = await supabase.auth.getUser(); const { error } = await supabase.from("decks").upsert(deckToDb(deck, user.id), { onConflict:"id" }); if (error) throw error; },
  async deleteDeck(id) { const { error } = await supabase.from("decks").delete().eq("id", id); if (error) throw error; },
  async getCategories() { const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending:true }); if (error) throw error; return (data||[]).map(dbToCategory); },
  async upsertCategory(cat) { const { data:{ user } } = await supabase.auth.getUser(); const { error } = await supabase.from("categories").upsert(categoryToDb(cat, user.id), { onConflict:"id" }); if (error) throw error; },
  async deleteCategory(id) { await supabase.from("decks").update({ category_id:null }).eq("category_id", id); const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
  async getProfile() { const { data } = await supabase.from("profiles").select("theme").single(); return data?.theme || null; },
  async saveProfile(theme) { const { data:{ user } } = await supabase.auth.getUser(); await supabase.from("profiles").upsert({ id:user.id, theme }, { onConflict:"id" }); },
  async publishDeck(deck, cards, username) {
    const { data:{ user } } = await supabase.auth.getUser();
    const cleanCards = cards.map(({ front, back, tags }) => ({ front, back, tags }));
    const { data:existing } = await supabase.from("published_decks").select("id").eq("user_id", user.id).eq("deck_name", deck.name).maybeSingle();
    const payload = { user_id:user.id, username, deck_name:deck.name, deck_description:deck.description||"", deck_emoji:deck.emoji, deck_color:deck.color, cards:cleanCards, card_count:cleanCards.length, published_at:new Date().toISOString() };
    if (existing?.id) { await supabase.from("published_decks").update(payload).eq("id", existing.id); return existing.id; }
    const id = `pub_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await supabase.from("published_decks").insert({ id, imports:0, ...payload });
    return id;
  },
  async getPublishedDecks(search="") { let q = supabase.from("published_decks").select("*").order("published_at",{ascending:false}); if (search) q=q.ilike("deck_name",`%${search}%`); const { data } = await q; return data||[]; },
  async importDeck(pub, userId, categoryId=null) {
    const newDeckId = `deck_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const newDeck = { id:newDeckId, user_id:userId, name:pub.deck_name, description:pub.deck_description||"", emoji:pub.deck_emoji||"📚", color:pub.deck_color||"#1144DD", category_id:categoryId, created_at:new Date().toISOString() };
    await supabase.from("decks").insert(newDeck);
    const newCards = (pub.cards||[]).map((c) => CardEngine.createCard({ front:c.front, back:c.back, tags:c.tags||[], deckId:newDeckId }));
    if (newCards.length) await supabase.from("cards").insert(newCards.map((c)=>cardToDb(c,userId)));
    await supabase.from("published_decks").update({ imports:(pub.imports||0)+1 }).eq("id", pub.id);
    return { deck:dbToDeck(newDeck), cards:newCards };
  },
  async askGemini(prompt) { const { data, error } = await supabase.functions.invoke("ask-gemini", { body:{ prompt } }); if (error) throw new Error(error.message||"Edge function error"); return data.text; },
};

// ─────────────────────────────────────────────────────────────
// CARD ENGINE — SM-2
// ─────────────────────────────────────────────────────────────
const CardEngine = {
  processReview(card, quality) {
    let { interval, easeFactor, repetitions } = card;
    if (quality < 3) { repetitions=0; interval=1; }
    else { if (repetitions===0) interval=1; else if (repetitions===1) interval=6; else interval=Math.round(interval*easeFactor); repetitions+=1; easeFactor=Math.max(1.3,easeFactor+0.1-(5-quality)*(0.08+(5-quality)*0.02)); }
    const nextReview=new Date(); nextReview.setDate(nextReview.getDate()+interval);
    return { ...card, interval, easeFactor:Math.round(easeFactor*100)/100, repetitions, nextReview:nextReview.toISOString(), lastReview:new Date().toISOString(), reviewHistory:[...(card.reviewHistory||[]),quality] };
  },
  getDueCards:(cards) => { const now=new Date(); return cards.filter((c)=>!c.nextReview||new Date(c.nextReview)<=now); },
  getWrongCards:(cards) => cards.filter((c)=>{ const h=c.reviewHistory||[]; return h.length>0&&h[h.length-1]<3; }),
  createCard:(data)=>({ id:`card_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, front:"",back:"",tags:[],type:"text",imageUrl:null,occlusionBoxes:[],audioUrl:null,interval:1,easeFactor:2.5,repetitions:0,nextReview:null,lastReview:null,createdAt:new Date().toISOString(),reviewHistory:[],deckId:"",...data }),
  getMastery:(card)=>{ if(card.interval>30)return{label:"MASTERED",color:"#00FF88"}; if(card.interval>7)return{label:"FAMILIAR",color:"#00CCFF"}; if(card.repetitions>0)return{label:"LEARNING",color:"#FFD600"}; return{label:"NEW",color:"#BB88FF"}; },
};

const md = (text="") => text.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/`(.*?)`/g,"<code>$1</code>").replace(/\n/g,"<br/>");

// ─────────────────────────────────────────────────────────────
// VIBE-AWARE CHROME COMPONENTS
// ─────────────────────────────────────────────────────────────

function Panel({ title, children, controls=true, style={}, titleRight=null, titleBg=null }) {
  const C = useC();
  const chrome = C.chrome || "pixel";

  const wrapStyle = {
    pixel:     { border:`2px solid ${C.border}`, boxShadow:`4px 4px 0 ${C.border}`, background:C.panel, borderRadius:0 },
    soft:      { border:`1px solid ${C.border}22`, boxShadow:`0 4px 24px ${C.shadow}`, background:C.panel, borderRadius:C.radius },
    arcade:    { border:`3px solid ${C.border}`, boxShadow:`5px 5px 0 ${C.shadow}`, background:C.panel, borderRadius:0, outline:`1px solid ${C.border}44` },
    parchment: { border:`2px solid ${C.border}`, boxShadow:`3px 3px 0 ${C.border}44`, background:C.panel, borderRadius:C.radius },
    neon:      { border:`1px solid ${C.border}`, boxShadow:`0 0 14px ${C.border}66, inset 0 0 10px ${C.border}0A`, background:C.panel, borderRadius:C.radius },
  }[chrome] || {};

  const titleStyle = {
    pixel:     { background:titleBg||C.border, padding:"5px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, userSelect:"none" },
    soft:      { background:C.raised, padding:"12px 18px", borderBottom:`1px solid ${C.border}22`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, borderRadius:`${C.radius}px ${C.radius}px 0 0` },
    arcade:    { background:titleBg||C.border, padding:"6px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 },
    parchment: { background:`${C.border}18`, padding:"8px 14px", borderBottom:`1px solid ${C.border}44`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 },
    neon:      { background:`${C.border}18`, padding:"5px 14px", borderBottom:`1px solid ${C.border}44`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 },
  }[chrome] || {};

  const titleTextStyle = {
    pixel:     { fontFamily:C.fontUI, fontSize:C.uiSize, color:"#fff", letterSpacing:0.5, lineHeight:1 },
    soft:      { fontFamily:C.fontUI, fontSize:C.uiSize, color:C.textSub, fontWeight:600, letterSpacing:0.5 },
    arcade:    { fontFamily:C.fontUI, fontSize:C.uiSize-1, color:"#fff", letterSpacing:0.5, textShadow:"1px 1px 0 rgba(0,0,0,0.5)" },
    parchment: { fontFamily:C.fontUI, fontSize:C.uiSize, color:C.border, letterSpacing:2 },
    neon:      { fontFamily:C.fontUI, fontSize:C.uiSize, color:C.border, textShadow:`0 0 8px ${C.border}`, letterSpacing:1 },
  }[chrome] || {};

  const controlColor = chrome === "soft" || chrome === "parchment" ? C.textHint : "#FFFFFF88";

  return (
    <div style={{ ...wrapStyle, ...style }}>
      <div style={titleStyle}>
        <span style={titleTextStyle}>{title}</span>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {titleRight}
          {controls && chrome !== "soft" && chrome !== "parchment" && ["_","□","×"].map((s) => (
            <span key={s} style={{ width:14,height:14,background:"#FFFFFF22",border:"1px solid #FFFFFF44",display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:9,color:"#FFFFFF",cursor:"default",lineHeight:1 }}>{s}</span>
          ))}
          {controls && (chrome === "soft" || chrome === "parchment") && (
            <span style={{ width:12,height:12,background:C.border+"44",borderRadius:"50%",display:"inline-flex",cursor:"default" }}/>
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Btn({ children, onClick, color, disabled=false, style={} }) {
  const C = useC();
  const chrome = C.chrome || "pixel";
  const col = color || C.border;
  const [hov, setHov] = useState(false);

  const btnStyle = {
    pixel:     { fontFamily:C.fontUI, fontSize:C.uiSize, letterSpacing:0.5, color:hov?C.panel:col, background:hov?col:"transparent", border:`2px solid ${col}`, boxShadow:hov?"none":`3px 3px 0 ${col}`, transform:hov?"translate(2px,2px)":"none", padding:"10px 16px", cursor:disabled?"default":"pointer", transition:"all .1s ease", opacity:disabled?0.4:1, lineHeight:1.4 },
    soft:      { fontFamily:C.fontUI, fontSize:C.uiSize, fontWeight:600, color:hov?"#fff":col, background:hov?col:col+"18", border:`1.5px solid ${col}44`, borderRadius:C.radius, boxShadow:hov?`0 4px 16px ${col}44`:"none", transform:hov?"translateY(-1px)":"none", padding:"10px 20px", cursor:disabled?"default":"pointer", transition:"all .15s ease", opacity:disabled?0.4:1 },
    arcade:    { fontFamily:C.fontUI, fontSize:C.uiSize, letterSpacing:0.5, color:"#fff", background:hov?col+"EE":col, border:`2px solid ${col}`, boxShadow:hov?"none":`4px 4px 0 ${col}99`, transform:hov?"translate(2px,2px)":"none", padding:"8px 14px", cursor:disabled?"default":"pointer", transition:"all .1s", opacity:disabled?0.4:1, textShadow:"1px 1px 0 rgba(0,0,0,0.4)" },
    parchment: { fontFamily:C.fontUI, fontSize:C.uiSize, letterSpacing:1, color:hov?"#fff":col, background:hov?col:`${col}18`, border:`1.5px solid ${col}`, borderRadius:C.radius, boxShadow:hov?`2px 2px 0 ${col}44`:"none", padding:"9px 18px", cursor:disabled?"default":"pointer", transition:"all .15s", opacity:disabled?0.4:1 },
    neon:      { fontFamily:C.fontUI, fontSize:C.uiSize, letterSpacing:1, color:col, background:"transparent", border:`1px solid ${col}`, borderRadius:C.radius, boxShadow:hov?`0 0 16px ${col}88, inset 0 0 8px ${col}22`:`0 0 6px ${col}44`, padding:"9px 16px", cursor:disabled?"default":"pointer", transition:"all .15s", opacity:disabled?0.4:1, textShadow:hov?`0 0 8px ${col}`:"none" },
  }[chrome] || {};

  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...btnStyle, ...style }}>
      {children}
    </button>
  );
}

function Tag({ children, color }) {
  const C = useC();
  const col = color || C.border;
  const chrome = C.chrome || "pixel";
  return (
    <span style={{ fontFamily:C.fontUI, fontSize:chrome==="soft"?11:7, color:col, border:`1.5px solid ${col}`, borderRadius:chrome==="soft"?999:0, padding:chrome==="soft"?"3px 10px":"3px 7px", letterSpacing:0.5, lineHeight:1, whiteSpace:"nowrap", background:col+"11" }}>
      {children}
    </span>
  );
}

function Bar({ progress=0, color, segments=12, style={} }) {
  const C = useC();
  const col = color || C.border;
  const chrome = C.chrome || "pixel";
  if (chrome === "soft" || chrome === "parchment") {
    return (
      <div style={{ background:`${col}22`, borderRadius:999, height:8, overflow:"hidden", ...style }}>
        <div style={{ background:col, height:"100%", width:`${progress}%`, borderRadius:999, transition:"width .4s ease", boxShadow:chrome==="neon"?`0 0 8px ${col}`:undefined }} />
      </div>
    );
  }
  if (chrome === "neon") {
    return (
      <div style={{ background:`${col}22`, borderRadius:2, height:10, overflow:"hidden", border:`1px solid ${col}44`, ...style }}>
        <div style={{ background:col, height:"100%", width:`${progress}%`, transition:"width .4s ease", boxShadow:`0 0 8px ${col}` }} />
      </div>
    );
  }
  // pixel / arcade
  const filled = Math.round((progress/100)*segments);
  return (
    <div style={{ display:"flex", gap:3, ...style }}>
      {Array.from({ length:segments }).map((_,i)=>(
        <div key={i} style={{ width:18,height:16,background:i<filled?col:"transparent",border:`1.5px solid ${col}`,transition:"background .2s ease" }} />
      ))}
    </div>
  );
}

function Toggle({ value, onChange }) {
  const C = useC();
  const chrome = C.chrome || "pixel";
  if (chrome === "soft") {
    return (
      <div onClick={()=>onChange(!value)} style={{ width:44,height:24,borderRadius:99,background:value?C.border:`${C.border}30`,cursor:"pointer",transition:"background .2s",position:"relative",flexShrink:0 }}>
        <div style={{ position:"absolute",top:3,left:value?22:3,width:18,height:18,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
      </div>
    );
  }
  return (
    <button onClick={()=>onChange(!value)} style={{ fontFamily:C.fontUI, fontSize:7, border:`2px solid ${C.border}`, boxShadow:`2px 2px 0 ${C.border}`, background:value?C.border:"transparent", color:value?C.panel:C.border, padding:"5px 10px", cursor:"pointer", letterSpacing:0.5, lineHeight:1, transition:"all .12s" }}>
      {value?"ON":"OFF"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPANION SIDEBAR CHAT COMPONENT
// ─────────────────────────────────────────────────────────────
function CompanionPanel({ companionId, card, onClose }) {
  const C = useC();
  const companion = COMPANIONS[companionId] || COMPANIONS.croak;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("idle");
  const prevId = useRef(null);

  useEffect(() => {
    if (card?.id && card.id !== prevId.current) {
      prevId.current = card.id;
      fetchExplanation();
    }
  }, [card?.id]);

  const fetchExplanation = async () => {
    if (!card) return;
    setLoading(true); setText(""); setError(""); setMood("idle");
    try {
      const prompt = companion.aiPrompt(card.front, card.back);
      const result = await DB.askGemini(prompt);
      setText(result);
      setMood("correct");
    } catch (e) { setError(e.message || "AI unavailable"); setMood("wrong"); }
    setLoading(false);
  };

  const idleQuote = companion.idle[Math.floor(Math.random()*companion.idle.length)];

  return (
    <aside style={{ width:280, background:C.panel, borderLeft:`2px solid ${C.border}`, display:"flex", flexDirection:"column", animation:"fadeUp .25s ease", flexShrink:0 }}>
      {/* Header */}
      <div style={{ background:companion.color, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:32, height:32, overflow:"hidden", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
            <CompanionSVG id={companionId} size={36} mood={mood} />
          </div>
          <div>
            <div style={{ fontFamily:C.fontUI, fontSize:8, color:"#fff", lineHeight:1 }}>{companion.name}</div>
            <div style={{ fontFamily:"monospace", fontSize:10, color:"#ffffff99", marginTop:2 }}>{companion.species}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"#fff",fontSize:18,cursor:"pointer",lineHeight:1 }}>×</button>
      </div>
      {/* Tag */}
      <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}22` }}>
        <Tag color={companion.color}>{companion.specialty}</Tag>
      </div>
      {/* Content */}
      <div style={{ flex:1, padding:"14px", overflowY:"auto" }}>
        {loading && (
          <div>
            {[88,72,82,60,68].map((w,i)=>(
              <div key={i} style={{ height:10,background:C.raised,border:`1px solid ${C.border}22`,marginBottom:8,width:`${w}%`,animation:`blink 1.4s ease ${i*0.15}s infinite`,borderRadius:C.radius }} />
            ))}
            <div style={{ fontFamily:C.fontUI, fontSize:7, color:C.textSub, marginTop:10 }}>Thinking<span className="blink">...</span></div>
          </div>
        )}
        {error && !loading && (
          <div style={{ fontFamily:"monospace", fontSize:12, color:C.pink, lineHeight:1.6, padding:8, background:`${C.pink}11`, borderRadius:C.radius }}>{error}</div>
        )}
        {text && !loading && (
          <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-2, color:C.text, lineHeight:1.65, whiteSpace:"pre-wrap" }}
            dangerouslySetInnerHTML={{ __html:md(text) }} />
        )}
        {!text && !loading && !error && (
          <div>
            <div style={{ display:"flex", justifyContent:"center", margin:"12px 0" }}>
              <CompanionSVG id={companionId} size={70} mood="idle" />
            </div>
            <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-4, color:C.textSub, lineHeight:1.6, textAlign:"center" }}>
              {idleQuote}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding:"12px 14px", borderTop:`1px solid ${C.border}22` }}>
        <Btn onClick={fetchExplanation} disabled={loading} color={companion.color} style={{ width:"100%", textAlign:"center", display:"block" }}>
          {loading?"Thinking...":"↻ Explain this card"}
        </Btn>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING MODAL (first-run)
// ─────────────────────────────────────────────────────────────
function OnboardingModal({ userId, onDone, themeConfig, onTheme }) {
  const C = useC();
  const [step, setStep] = useState(0);
  const [chosenCompanion, setChosenCompanion] = useState("croak");
  const [chosenVibe, setChosenVibe] = useState("retro");

  const steps = [
    { title:"Welcome to MemoryForge!", body:"Your spaced-repetition study companion. Let's set you up in three quick steps." },
    { title:"Choose your companion", body:"Your companion lives in study mode, explains cards in their own voice, and cheers you on." },
    { title:"Pick your vibe", body:"Each vibe changes the whole look and feel. You can always change it later." },
  ];

  const handleDone = () => {
    onTheme({ ...themeConfig, vibe:chosenVibe, palette:Object.keys(PALETTES[chosenVibe])[0] });
    localStorage.setItem(`mf_onboarded_${userId}`, "1");
    localStorage.setItem(`mf_companion_${userId}`, chosenCompanion);
    onDone(chosenCompanion);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20 }}>
      <Panel title={`SETUP ${step+1}/3`} controls={false} style={{ width:"min(540px,100%)", animation:"fadeUp .3s ease" }}>
        <div style={{ padding:"28px 28px 20px" }}>
          <div style={{ fontFamily:C.fontUI, fontSize:step===0?12:10, color:C.border, marginBottom:10 }}>{steps[step].title}</div>
          <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-2, color:C.textSub, marginBottom:24, lineHeight:1.5 }}>{steps[step].body}</div>

          {step === 1 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
              {Object.values(COMPANIONS).map((c) => (
                <div key={c.id} onClick={()=>setChosenCompanion(c.id)}
                  style={{ cursor:"pointer", textAlign:"center", padding:"12px 6px", border:`2px solid ${chosenCompanion===c.id?c.color:C.border+"44"}`, background:chosenCompanion===c.id?`${c.color}18`:"transparent", borderRadius:C.radius, transition:"all .15s" }}>
                  <CompanionSVG id={c.id} size={52} mood="idle" />
                  <div style={{ fontFamily:C.fontUI, fontSize:6, color:chosenCompanion===c.id?c.color:C.textSub, marginTop:6, lineHeight:1.4 }}>{c.name}</div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:20 }}>
              {Object.entries(VIBES).map(([key, vibe]) => (
                <div key={key} onClick={()=>setChosenVibe(key)}
                  style={{ cursor:"pointer", textAlign:"center", padding:"12px 4px", border:`2px solid ${chosenVibe===key?C.border:C.border+"33"}`, background:chosenVibe===key?`${C.border}18`:"transparent", borderRadius:4, transition:"all .15s" }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{vibe.icon}</div>
                  <div style={{ fontFamily:C.fontUI, fontSize:6, color:C.textSub, lineHeight:1.4 }}>{vibe.name}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            {step > 0 && <Btn onClick={()=>setStep(s=>s-1)} color={C.textSub}>← Back</Btn>}
            {step < 2 && <Btn onClick={()=>setStep(s=>s+1)} color={C.border}>Next →</Btn>}
            {step === 2 && <Btn onClick={handleDone} color={C.green}>Start studying →</Btn>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BOOT + AUTH SCREENS
// ─────────────────────────────────────────────────────────────
function BootScreen({ label }) {
  const C = useC();
  const [seg, setSeg] = useState(0);
  useEffect(()=>{ const t=setInterval(()=>setSeg((s)=>Math.min(s+1,12)),90); return ()=>clearInterval(t); },[]);
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:C.fontUI, fontSize:18, color:C.border, marginBottom:20 }}>MEMORYFORGE</div>
        <Bar progress={(seg/12)*100} style={{ justifyContent:"center", marginBottom:14 }} />
        <div style={{ fontFamily:C.fontUI, fontSize:8, color:C.textSub, letterSpacing:1 }}>{label} <span className="blink">_</span></div>
      </div>
    </div>
  );
}

function AuthView() {
  const C = useC();
  const [loading, setLoading] = useState(false);
  const signIn = async () => { setLoading(true); await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo:window.location.origin } }); };
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <Panel title="MEMORYFORGE — SIGN IN" controls={false} style={{ width:440 }}>
        <div style={{ padding:"36px 32px", textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <CompanionSVG id="croak" size={80} mood="idle" />
          </div>
          <div style={{ fontFamily:C.fontUI, fontSize:16, color:C.border, lineHeight:1.6, marginBottom:6 }}>MEMORY FORGE</div>
          <div style={{ fontFamily:C.fontUI, fontSize:7, color:C.textSub, letterSpacing:1, marginBottom:28 }}>SM-2 SPACED REPETITION ENGINE</div>
          <Btn onClick={signIn} disabled={loading} color={C.border} style={{ width:"100%", display:"block", textAlign:"center" }}>
            {loading ? "Connecting..." : "Sign in with Google"}
          </Btn>
          <div style={{ fontFamily:C.fontContent, fontSize:16, color:C.textHint, marginTop:20, lineHeight:1.6 }}>
            "A world inside the computer<br/>where forgetting never was."
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD VIEW
// ─────────────────────────────────────────────────────────────
function DashboardView({ cards, decks, categories, studyConfig, setStudyConfig, navTo, onPublish, onCreateDeck, onUpdateDeck, onDeleteDeck, onCreateCategory, onDeleteCategory, streak, companionId, userId }) {
  const C = useC();
  const due      = CardEngine.getDueCards(cards).length;
  const mastered = cards.filter((c)=>c.interval>30).length;
  const learned  = cards.filter((c)=>c.repetitions>0).length;
  const hour     = new Date().getHours();
  const greeting = ["MORNING","AFTERNOON","EVENING"][[0,12,17].findLastIndex((h)=>hour>=h)];
  const companion = COMPANIONS[companionId] || COMPANIONS.croak;

  const [publishing, setPublishing] = useState({});
  const [pubDone, setPubDone]       = useState({});
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#00CCFF");
  const [showCatForm, setShowCatForm] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckCat, setNewDeckCat]   = useState("");
  const [newDeckColor, setNewDeckColor] = useState("#BB88FF");
  const [showDeckForm, setShowDeckForm] = useState(false);

  const CAT_COLORS = ["#FF1155","#FF7700","#FFD600","#00FF88","#00CCFF","#BB88FF","#FF88AA","#AACCFF"];

  const handlePublish = async (deck) => {
    setPublishing((p)=>({...p,[deck.id]:true}));
    await onPublish(deck);
    setPublishing((p)=>({...p,[deck.id]:false}));
    setPubDone((p)=>({...p,[deck.id]:true}));
    setTimeout(()=>setPubDone((p)=>({...p,[deck.id]:false})), 2200);
  };

  const handleCreateDeck = () => {
    if (!newDeckName.trim()) return;
    const deck = { id:`deck_${Date.now()}`, name:newDeckName.trim(), description:"", color:newDeckColor, emoji:"📚", categoryId:newDeckCat||null, createdAt:new Date().toISOString() };
    onCreateDeck(deck); setNewDeckName(""); setNewDeckCat(""); setShowDeckForm(false);
  };

  const decksByCategory = categories.map((cat)=>({ cat, decks:decks.filter((d)=>d.categoryId===cat.id) }));
  const uncategorized = decks.filter((d)=>!d.categoryId);

  const DeckRow = ({ deck }) => {
    const dc = cards.filter((c)=>c.deckId===deck.id);
    const dueCount = CardEngine.getDueCards(dc).length;
    return (
      <div style={{ border:`2px solid ${C.border}22`, borderLeft:`4px solid ${deck.color}`, display:"flex", alignItems:"center", gap:8, marginBottom:8, background:C.raised, borderRadius:C.radius, transition:"all .12s", overflow:"hidden" }}
        onMouseEnter={(e)=>{ e.currentTarget.style.boxShadow=`3px 3px 0 ${C.border}44`; e.currentTarget.style.transform="translate(-1px,-1px)"; }}
        onMouseLeave={(e)=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; }}>
        <div style={{ cursor:"pointer", flex:1, padding:"10px 14px" }} onClick={()=>{ setStudyConfig(c=>({...c,deckId:deck.id})); navTo("study"); }}>
          <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:3 }}>{deck.name}</div>
          <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub }}>
            {dc.length} cards · {dueCount > 0 ? <span style={{ color:C.pink }}>{dueCount} due</span> : <span style={{ color:C.green }}>all caught up</span>}
          </div>
        </div>
        <select value={deck.categoryId||""} onChange={(e)=>onUpdateDeck({...deck,categoryId:e.target.value||null})}
          style={{ fontFamily:"monospace", fontSize:11, border:"none", background:"transparent", color:C.textSub, cursor:"pointer", maxWidth:100 }}>
          <option value="">No category</option>
          {categories.map((cat)=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>)}
        </select>
        <div style={{ display:"flex", gap:4, padding:"0 10px" }}>
          <button onClick={()=>handlePublish(deck)} title="Publish" style={{ background:"none",border:"none",cursor:"pointer",padding:4,fontSize:14 }}>
            {pubDone[deck.id] ? "✓" : "☁"}
          </button>
          <button onClick={()=>onDeleteDeck(deck.id)} title="Delete" style={{ background:"none",border:"none",cursor:"pointer",padding:4,fontSize:14,color:C.pink }}>✕</button>
        </div>
      </div>
    );
  };

  return (
    <div className="mf-view-pad fade-in">
      {/* Header */}
      <Panel title={`${greeting} SESSION`} style={{ marginBottom:20 }}>
        <div style={{ padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <CompanionSVG id={companionId} size={52} mood={due>0?"idle":"correct"} />
            <div>
              <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize+2, color:C.text, lineHeight:1.2 }}>
                {due>0 ? <><span style={{ color:C.border, fontWeight:"bold" }}>{due}</span> card{due!==1?"s":""} ready for review</> : "All caught up — well done!"}
              </div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:C.textSub, marginTop:4 }}>
                {companion.idle[0]}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <Btn onClick={()=>{ setStudyConfig(c=>({...c,deckId:null})); navTo("study"); }} color={C.green}>▶ Study All</Btn>
            <Btn onClick={()=>navTo("creator")} color={C.accent}>+ New Card</Btn>
          </div>
        </div>
      </Panel>

      {/* Stats */}
      <div className="mf-stats-grid" style={{ display:"grid", gap:12, marginBottom:20 }}>
        {[
          { label:"DUE TODAY", val:due,         color:C.pink   },
          { label:"TOTAL CARDS", val:cards.length, color:C.border },
          { label:"LEARNED",   val:learned,      color:C.accent },
          { label:"MASTERED",  val:mastered,     color:C.green  },
        ].map((s,i)=>(
          <Panel key={i} title={s.label} controls={false} style={{ animation:`fadeUp .3s ease ${i*0.06}s both` }}>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ fontFamily:C.fontContent, fontSize:52, color:s.color, lineHeight:1 }}>{s.val}</div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Streak */}
      {streak.n > 0 && (
        <Panel title="STREAK" controls={false} style={{ marginBottom:20 }}>
          <div style={{ padding:"12px 18px", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontFamily:C.fontContent, fontSize:56, color:C.gold, lineHeight:1 }}>🔥{streak.n}</div>
            <div>
              <div style={{ fontFamily:C.fontUI, fontSize:9, color:C.text }}>DAY STREAK</div>
              <div style={{ fontFamily:"monospace", fontSize:12, color:C.textSub, marginTop:4 }}>Best: {streak.best} days</div>
            </div>
          </div>
        </Panel>
      )}

      <div className="mf-two-col" style={{ display:"grid", gap:20 }}>
        {/* Session config */}
        <Panel title="SESSION CONFIG">
          <div style={{ padding:"16px" }}>
            {[
              { key:"shuffle",    label:"Shuffle cards",  desc:"Randomize order"     },
              { key:"wrongsOnly", label:"Wrongs only",    desc:"Review failed cards" },
              { key:"reversed",   label:"Reverse mode",   desc:"Answer → Question"   },
            ].map((opt)=>(
              <div key={opt.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:3 }}>{opt.label}</div>
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub }}>{opt.desc}</div>
                </div>
                <Toggle value={studyConfig[opt.key]} onChange={(v)=>setStudyConfig(c=>({...c,[opt.key]:v}))} />
              </div>
            ))}
            <div style={{ borderTop:`1px dashed ${C.border}30`, paddingTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text }}>Session limit</div>
                <div style={{ fontFamily:C.fontContent, fontSize:28, color:C.border, lineHeight:1 }}>{studyConfig.limit}</div>
              </div>
              <input type="range" min={5} max={100} step={1} value={studyConfig.limit}
                onChange={(e)=>setStudyConfig(c=>({...c,limit:+e.target.value}))}
                style={{ width:"100%", accentColor:C.border }} />
            </div>
          </div>
        </Panel>

        {/* Decks */}
        <div>
          <Panel title="NEW DECK" controls={false} style={{ marginBottom:14 }}>
            {showDeckForm ? (
              <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                <input value={newDeckName} onChange={(e)=>setNewDeckName(e.target.value)}
                  placeholder="Deck name..." onKeyDown={(e)=>e.key==="Enter"&&handleCreateDeck()}
                  style={{ width:"100%", borderRadius:C.radius }} />
                <div style={{ display:"flex", gap:8 }}>
                  <select value={newDeckCat} onChange={(e)=>setNewDeckCat(e.target.value)} style={{ flex:1, cursor:"pointer", borderRadius:C.radius }}>
                    <option value="">No category</option>
                    {categories.map((cat)=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>)}
                  </select>
                  <div style={{ display:"flex", gap:4 }}>
                    {CAT_COLORS.slice(0,5).map((col)=>(
                      <div key={col} onClick={()=>setNewDeckColor(col)} style={{ width:22,height:22,background:col,border:newDeckColor===col?`2px solid ${C.text}`:`2px solid transparent`,cursor:"pointer",borderRadius:C.radius+1 }} />
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={handleCreateDeck} color={C.green} style={{ flex:1, textAlign:"center", display:"block" }}>Create</Btn>
                  <Btn onClick={()=>setShowDeckForm(false)} color={C.textSub}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ padding:"10px 14px" }}>
                <Btn onClick={()=>setShowDeckForm(true)} color={C.border} style={{ width:"100%", textAlign:"center", display:"block" }}>+ Add Deck</Btn>
              </div>
            )}
          </Panel>

          {/* New category */}
          <Panel title="NEW CATEGORY" controls={false} style={{ marginBottom:14 }}>
            {showCatForm ? (
              <div style={{ padding:"10px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                <input value={newCatName} onChange={(e)=>setNewCatName(e.target.value)} placeholder="Category name..." style={{ width:"100%", borderRadius:C.radius }} />
                <div style={{ display:"flex", gap:4 }}>
                  {CAT_COLORS.map((col)=>(
                    <div key={col} onClick={()=>setNewCatColor(col)} style={{ width:22,height:22,background:col,border:newCatColor===col?`2px solid ${C.text}`:"2px solid transparent",cursor:"pointer",borderRadius:C.radius+1 }} />
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={()=>{ if(newCatName.trim()){const cat={id:`cat_${Date.now()}`,name:newCatName.trim(),color:newCatColor,emoji:"📁",createdAt:new Date().toISOString()};onCreateCategory(cat);setNewCatName("");setShowCatForm(false);} }} color={C.green} style={{ flex:1, textAlign:"center", display:"block" }}>Create</Btn>
                  <Btn onClick={()=>setShowCatForm(false)} color={C.textSub}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ padding:"10px 14px" }}>
                <Btn onClick={()=>setShowCatForm(true)} color={C.purple} style={{ width:"100%", textAlign:"center", display:"block" }}>+ Add Category</Btn>
              </div>
            )}
          </Panel>

          {/* Deck list by category */}
          {decksByCategory.map(({ cat, decks:catDecks }) => (
            <Panel key={cat.id} title={`${cat.emoji} ${cat.name.toUpperCase()}`} controls={false}
              titleBg={cat.color+"CC"} style={{ marginBottom:12 }}
              titleRight={<button onClick={()=>onDeleteCategory(cat.id)} style={{ background:"none",border:"none",cursor:"pointer",color:"#fff",fontSize:14 }}>✕</button>}>
              <div style={{ padding:"10px 12px" }}>
                {catDecks.length === 0 ? (
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.textHint, padding:"6px 0" }}>No decks yet. Assign via deck dropdown.</div>
                ) : catDecks.map((deck)=><DeckRow key={deck.id} deck={deck}/>)}
              </div>
            </Panel>
          ))}

          {uncategorized.length > 0 && (
            <Panel title="UNCATEGORIZED" controls={false} style={{ marginBottom:12 }}>
              <div style={{ padding:"10px 12px" }}>
                {uncategorized.map((deck)=><DeckRow key={deck.id} deck={deck}/>)}
              </div>
            </Panel>
          )}

          {decks.length === 0 && (
            <Panel title="EMPTY" controls={false}>
              <div style={{ padding:"24px 20px", textAlign:"center" }}>
                <CompanionSVG id={companionId} size={64} mood="idle" />
                <div style={{ fontFamily:C.fontContent, fontSize:20, color:C.textSub, marginTop:12 }}>No decks yet. Create one above or browse the Discover tab!</div>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STUDY VIEW
// ─────────────────────────────────────────────────────────────
function StudyView({ cards, decks, studyConfig, onCardUpdate, companionOpen, setCompanionOpen, companionId, userId }) {
  const C = useC();
  const [queue, setQueue] = useState([]);
  const [idx, setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [done, setDone]   = useState(false);
  const [stats, setStats] = useState({ again:0, hard:0, good:0, easy:0 });
  const companion = COMPANIONS[companionId] || COMPANIONS.croak;

  useEffect(()=>{
    let pool = studyConfig.wrongsOnly ? CardEngine.getWrongCards(cards) : CardEngine.getDueCards(cards);
    if (!pool.length) pool = [...cards];
    if (studyConfig.deckId) pool = pool.filter(c=>c.deckId===studyConfig.deckId);
    if (!pool.length && studyConfig.deckId) pool = cards.filter(c=>c.deckId===studyConfig.deckId);
    if (studyConfig.shuffle) pool = [...pool].sort(()=>Math.random()-.5);
    pool = pool.slice(0, studyConfig.limit);
    setQueue(pool); setIdx(0); setFlipped(false); setShowRate(false); setDone(false); setStats({again:0,hard:0,good:0,easy:0});
  },[]);

  // Keyboard shortcuts
  useEffect(()=>{
    const handler = (e) => {
      if (e.key===" "||e.key==="Enter") { e.preventDefault(); if(!flipped) handleReveal(); }
      if (flipped && showRate) {
        if (e.key==="1") handleRate(1,"again");
        if (e.key==="2") handleRate(3,"hard");
        if (e.key==="3") handleRate(4,"good");
        if (e.key==="4") handleRate(5,"easy");
      }
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  }, [flipped, showRate, idx, queue]);

  const card = queue[idx];
  const progress = queue.length ? idx/queue.length : 0;

  const handleReveal = ()=>{ setFlipped(true); setShowRate(true); };
  const handleRate = (quality, key)=>{
    if (!card) return;
    onCardUpdate(CardEngine.processReview(card, quality));
    setStats(s=>({...s,[key]:s[key]+1}));
    if (idx+1>=queue.length){ setDone(true); Streak.update(userId); return; }
    setIdx(i=>i+1); setFlipped(false); setShowRate(false);
  };

  if (done) {
    const total = Object.values(stats).reduce((a,b)=>a+b,0);
    const doneMsg = companion.done[Math.floor(Math.random()*companion.done.length)];
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:C.bg, padding:48 }} className="fade-in">
        <Panel title="SESSION COMPLETE" style={{ width:520 }}>
          <div style={{ padding:"32px" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <CompanionSVG id={companionId} size={80} mood="correct" />
            </div>
            <div style={{ fontFamily:C.fontContent, fontSize:48, color:C.green, textAlign:"center", marginBottom:8 }}>Complete!</div>
            <div style={{ fontFamily:C.fontUI, fontSize:9, color:C.textSub, textAlign:"center", marginBottom:8 }}>
              {total} CARDS REVIEWED
            </div>
            <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-2, color:C.textSub, textAlign:"center", marginBottom:24, lineHeight:1.5 }}>
              "{doneMsg}"
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:24 }}>
              {[{l:"Again",v:stats.again,c:C.again},{l:"Hard",v:stats.hard,c:C.hard},{l:"Good",v:stats.good,c:C.good},{l:"Easy",v:stats.easy,c:C.easy}].map((s)=>(
                <Panel key={s.l} title={s.l} controls={false}>
                  <div style={{ padding:"12px", textAlign:"center" }}>
                    <div style={{ fontFamily:C.fontContent, fontSize:44, color:s.c, lineHeight:1 }}>{s.v}</div>
                  </div>
                </Panel>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={()=>window.location.reload()} color={C.border} style={{ flex:1, textAlign:"center", display:"block" }}>Study Again</Btn>
              <Btn onClick={()=>window.history.back()} color={C.green} style={{ flex:1, textAlign:"center", display:"block" }}>← Dashboard</Btn>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (!card) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:C.bg }}>
      <Panel title="NO CARDS" controls={false}>
        <div style={{ padding:"32px", textAlign:"center" }}>
          <CompanionSVG id={companionId} size={80} mood="idle" />
          <div style={{ fontFamily:C.fontContent, fontSize:24, color:C.text, marginTop:16, lineHeight:1.5 }}>
            No cards to study!<br/>Create some in the Creator tab.
          </div>
        </div>
      </Panel>
    </div>
  );

  const front   = studyConfig.reversed ? card.back  : card.front;
  const back    = studyConfig.reversed ? card.front : card.back;
  const deck    = decks.find((d)=>d.id===card.deckId);
  const mastery = CardEngine.getMastery(card);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.bg }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"clamp(16px,3vw,44px)" }}>
        {/* Top bar */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {deck && <Tag color={deck.color||C.border}>{deck.name.toUpperCase()}</Tag>}
            {card.tags.map((tag)=><Tag key={tag} color={C.textSub}>{tag}</Tag>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontFamily:C.fontUI, fontSize:8, color:C.textSub }}>{idx+1}/{queue.length}</span>
            <Btn onClick={()=>setCompanionOpen(o=>!o)} color={companion.color}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                <CompanionSVG id={companionId} size={20} mood="idle" />
                {companion.name}
              </div>
            </Btn>
          </div>
        </div>
        <div style={{ marginBottom:32 }}><Bar progress={progress*100} segments={20} /></div>

        {/* Card flip */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ perspective:"1200px", width:"100%", maxWidth:640 }}>
            <div style={{ width:"100%", minHeight:280, transformStyle:"preserve-3d", transition:"transform .55s cubic-bezier(.4,0,.2,1)", transform:flipped?"rotateY(180deg)":"none", position:"relative" }}>
              {/* Front */}
              <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" }}>
                <Panel title={studyConfig.reversed?"! ANSWER":"? QUESTION"} controls={false}
                  titleRight={<Tag color={mastery.color}>{mastery.label}</Tag>}
                  style={{ minHeight:280, cursor:!flipped?"pointer":"default", display:"flex", flexDirection:"column" }}>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"clamp(20px,4vw,40px)", textAlign:"center", minHeight:220 }}
                    onClick={!flipped?handleReveal:undefined}>
                    <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize, lineHeight:1.6, color:C.text }}
                      dangerouslySetInnerHTML={{ __html:md(front) }} />
                    {!flipped && <div style={{ marginTop:24, fontFamily:C.fontUI, fontSize:7, color:C.textHint, letterSpacing:1 }} className="blink">SPACE or click to reveal</div>}
                  </div>
                </Panel>
              </div>
              {/* Back */}
              <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg)" }}>
                <Panel title="! ANSWER REVEALED" controls={false}
                  titleRight={<span style={{ fontFamily:C.fontUI, fontSize:6, color:C.accent }}>INTERVAL: {card.interval}D</span>}
                  style={{ minHeight:280, borderColor:C.green, boxShadow:C.chrome==="neon"?`0 0 16px ${C.green}66`:`4px 4px 0 ${C.green}`, display:"flex", flexDirection:"column" }}>
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"clamp(20px,4vw,40px)", textAlign:"center", minHeight:220 }}>
                    <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize, lineHeight:1.6, color:C.text }}
                      dangerouslySetInnerHTML={{ __html:md(back) }} />
                  </div>
                </Panel>
              </div>
            </div>
          </div>

          {/* Rating */}
          <div style={{ marginTop:28, minHeight:60, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            {!showRate ? (
              <Btn onClick={handleReveal} color={C.border} style={{ padding:"14px 40px" }}>Reveal Answer</Btn>
            ) : (
              <>
                <div style={{ display:"flex", gap:10, animation:"fadeUp .2s ease", flexWrap:"wrap", justifyContent:"center" }}>
                  {[
                    {label:"Again", quality:1, key:"again", color:C.again},
                    {label:"Hard",  quality:2, key:"hard",  color:C.hard},
                    {label:"Good",  quality:4, key:"good",  color:C.good},
                    {label:"Easy",  quality:5, key:"easy",  color:C.easy},
                  ].map((btn, i)=>(
                    <Btn key={btn.key} color={btn.color} onClick={()=>handleRate(btn.quality,btn.key)}>
                      {btn.label}
                    </Btn>
                  ))}
                </div>
                <div style={{ fontFamily:C.fontUI, fontSize:6, color:C.textHint, letterSpacing:1 }}>
                  1 — Again · 2 — Hard · 3 — Good · 4 — Easy
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Companion sidebar */}
      {companionOpen && (
        <CompanionPanel companionId={companionId} card={card} onClose={()=>setCompanionOpen(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CREATOR VIEW
// ─────────────────────────────────────────────────────────────
function CreatorView({ cards, decks, onCardCreate, onCardUpdate, editingCard, setEditingCard }) {
  const C = useC();
  const [front, setFront] = useState(editingCard?.front||"");
  const [back, setBack]   = useState(editingCard?.back||"");
  const [tags, setTags]   = useState(editingCard?.tags?.join(",")||"");
  const [deckId, setDeckId] = useState(editingCard?.deckId||decks[0]?.id||"");
  const [saved, setSaved] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvImported, setCsvImported] = useState(false);
  const [tab, setTab] = useState("single"); // "single" | "csv"

  useEffect(()=>{ if(editingCard){setFront(editingCard.front);setBack(editingCard.back);setTags(editingCard.tags?.join(","));setDeckId(editingCard.deckId||"");} },[editingCard]);

  const handleSave = () => {
    if (!front.trim() || !back.trim()) return;
    const tagArr = tags.split(",").map(t=>t.trim()).filter(Boolean);
    if (editingCard) {
      onCardUpdate({ ...editingCard, front:front.trim(), back:back.trim(), tags:tagArr, deckId });
    } else {
      onCardCreate(CardEngine.createCard({ front:front.trim(), back:back.trim(), tags:tagArr, deckId }));
    }
    setSaved(true); setTimeout(()=>setSaved(false),1500);
    setFront(""); setBack(""); setTags(""); setEditingCard(null);
  };

  const handleCSVParse = () => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    const parsed = lines.map(line => {
      const idx = line.indexOf(",");
      if (idx === -1) return null;
      return { front: line.slice(0, idx).trim().replace(/^"|"$/g,""), back: line.slice(idx+1).trim().replace(/^"|"$/g,"") };
    }).filter(Boolean);
    setCsvPreview(parsed);
  };

  const handleCSVImport = () => {
    csvPreview.forEach(({front,back}) => {
      onCardCreate(CardEngine.createCard({ front, back, tags:[], deckId }));
    });
    setCsvImported(true); setCsvText(""); setCsvPreview([]);
    setTimeout(()=>setCsvImported(false),2000);
  };

  return (
    <div className="mf-view-pad fade-in">
      <Panel title={editingCard?"EDIT CARD":"CREATE CARDS"} style={{ marginBottom:16 }}>
        <div style={{ padding:"8px 14px", display:"flex", gap:8 }}>
          <Btn onClick={()=>setTab("single")} color={tab==="single"?C.border:C.textSub}>Single Card</Btn>
          <Btn onClick={()=>setTab("csv")} color={tab==="csv"?C.border:C.textSub}>CSV Import</Btn>
        </div>
      </Panel>

      {tab === "single" && (
        <Panel title={editingCard?"EDITING EXISTING CARD":"NEW CARD"}>
          <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:6 }}>FRONT (question)</div>
              <textarea value={front} onChange={e=>setFront(e.target.value)} rows={3} placeholder="What is the question or term?"
                style={{ width:"100%", resize:"vertical", borderRadius:C.radius }} />
            </div>
            <div>
              <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:6 }}>BACK (answer)</div>
              <textarea value={back} onChange={e=>setBack(e.target.value)} rows={3} placeholder="What is the answer or definition?"
                style={{ width:"100%", resize:"vertical", borderRadius:C.radius }} />
            </div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:6 }}>DECK</div>
                <select value={deckId} onChange={e=>setDeckId(e.target.value)} style={{ width:"100%", borderRadius:C.radius }}>
                  <option value="">No deck</option>
                  {decks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:6 }}>TAGS (comma-separated)</div>
                <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="biology, chapter-3" style={{ width:"100%", borderRadius:C.radius }} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <Btn onClick={handleSave} color={saved?C.green:C.border} style={{ minWidth:120 }}>
                {saved ? "✓ Saved!" : editingCard ? "Save Changes" : "+ Add Card"}
              </Btn>
              {editingCard && <Btn onClick={()=>{ setEditingCard(null); setFront(""); setBack(""); setTags(""); }} color={C.textSub}>Cancel</Btn>}
            </div>

            {/* Preview */}
            {(front||back) && (
              <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Panel title="FRONT PREVIEW" controls={false}>
                  <div style={{ padding:"14px 16px", fontFamily:C.fontContent, fontSize:C.contentSize-4, color:C.text, lineHeight:1.6 }}
                    dangerouslySetInnerHTML={{ __html:md(front)||"<span style='opacity:0.4'>Empty</span>" }} />
                </Panel>
                <Panel title="BACK PREVIEW" controls={false}>
                  <div style={{ padding:"14px 16px", fontFamily:C.fontContent, fontSize:C.contentSize-4, color:C.text, lineHeight:1.6 }}
                    dangerouslySetInnerHTML={{ __html:md(back)||"<span style='opacity:0.4'>Empty</span>" }} />
                </Panel>
              </div>
            )}
          </div>
        </Panel>
      )}

      {tab === "csv" && (
        <Panel title="CSV IMPORT">
          <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ fontFamily:"monospace", fontSize:12, color:C.textSub, background:C.raised, padding:"10px 14px", borderRadius:C.radius, lineHeight:1.8 }}>
              Format: <code>front text,back text</code> (one per line)<br/>
              Example: <code>What is mitosis?,Cell division producing two identical cells</code>
            </div>
            <div>
              <div style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text, marginBottom:6 }}>DECK</div>
              <select value={deckId} onChange={e=>setDeckId(e.target.value)} style={{ width:"100%", marginBottom:10, borderRadius:C.radius }}>
                <option value="">No deck</option>
                {decks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <textarea value={csvText} onChange={e=>{ setCsvText(e.target.value); setCsvPreview([]); }} rows={8} placeholder={"capital of France,Paris\nH2O formula,Water\nNewton's first law,An object in motion stays in motion..."} style={{ width:"100%", fontFamily:"monospace", borderRadius:C.radius }} />
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={handleCSVParse} color={C.accent} disabled={!csvText.trim()}>Preview ({csvText.trim().split("\n").filter(Boolean).length} cards)</Btn>
              {csvPreview.length > 0 && <Btn onClick={handleCSVImport} color={C.green}>{csvImported?"✓ Imported!": `Import ${csvPreview.length} Cards`}</Btn>}
            </div>
            {csvPreview.length > 0 && (
              <div style={{ maxHeight:300, overflowY:"auto" }}>
                {csvPreview.map((c,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:6, fontFamily:"monospace", fontSize:12 }}>
                    <div style={{ flex:1, padding:"6px 10px", background:C.raised, borderRadius:C.radius, color:C.text }}>{c.front}</div>
                    <div style={{ flex:1, padding:"6px 10px", background:C.raised, borderRadius:C.radius, color:C.textSub }}>{c.back}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Recent cards */}
      <div style={{ marginTop:20 }}>
        <Panel title={`ALL CARDS (${cards.length})`}>
          <div style={{ padding:"12px" }}>
            {cards.length === 0 ? (
              <div style={{ fontFamily:C.fontContent, fontSize:20, color:C.textHint, padding:"16px", textAlign:"center" }}>No cards yet. Create some above!</div>
            ) : cards.slice().reverse().slice(0,10).map((card)=>(
              <div key={card.id} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"8px 12px", background:C.raised, borderRadius:C.radius, border:`1px solid ${C.border}22` }}>
                <div style={{ flex:1, fontFamily:C.fontContent, fontSize:18, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{card.front}</div>
                <div style={{ flex:1, fontFamily:"monospace", fontSize:11, color:C.textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{card.back}</div>
                <button onClick={()=>setEditingCard(card)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:14 }}>✏</button>
              </div>
            ))}
          </div>
        </Panel>
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
  const filtered = cards.filter(c=>{
    const matchDeck = filterDeck==="all" || c.deckId===filterDeck;
    const matchSearch = !search || c.front.toLowerCase().includes(search.toLowerCase()) || c.back.toLowerCase().includes(search.toLowerCase());
    return matchDeck && matchSearch;
  });

  return (
    <div className="mf-view-pad fade-in">
      <Panel title="LIBRARY" style={{ marginBottom:16 }}>
        <div style={{ padding:"14px 16px", display:"flex", gap:12, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cards..." style={{ flex:1, minWidth:160, borderRadius:C.radius }} />
          <select value={filterDeck} onChange={e=>setFilterDeck(e.target.value)} style={{ minWidth:140, borderRadius:C.radius }}>
            <option value="all">All decks</option>
            {decks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </Panel>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length === 0 ? (
          <Panel title="EMPTY" controls={false}>
            <div style={{ padding:"24px", fontFamily:C.fontContent, fontSize:20, color:C.textHint, textAlign:"center" }}>No cards found.</div>
          </Panel>
        ) : filtered.map((card)=>{
          const deck = decks.find(d=>d.id===card.deckId);
          const mastery = CardEngine.getMastery(card);
          return (
            <div key={card.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.panel, border:`1px solid ${C.border}22`, borderLeft:`4px solid ${mastery.color}`, borderRadius:C.radius, transition:"all .1s" }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow=`2px 2px 0 ${C.border}44`}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none"}}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-4, color:C.text, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{card.front}</div>
                <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{card.back}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                {deck && <Tag color={deck.color||C.border}>{deck.name}</Tag>}
                <Tag color={mastery.color}>{mastery.label}</Tag>
                <span style={{ fontFamily:"monospace", fontSize:11, color:C.textHint }}>{card.interval}d</span>
                <button onClick={()=>onEdit(card)} style={{ background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:14 }}>✏</button>
                <button onClick={()=>onDelete(card.id)} style={{ background:"none",border:"none",cursor:"pointer",color:C.pink,fontSize:14 }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DISCOVER VIEW
// ─────────────────────────────────────────────────────────────
function DiscoverView({ onImport, userId, categories }) {
  const C = useC();
  const [pubDecks, setPubDecks] = useState([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [importing, setImporting] = useState({});
  const [importDone, setImportDone] = useState({});
  const [importCat, setImportCat] = useState({});

  useEffect(()=>{
    let alive = true;
    (async()=>{
      setLoading(true);
      const data = await DB.getPublishedDecks(search);
      if (alive) { setPubDecks(data); setLoading(false); }
    })();
    return ()=>{ alive=false; };
  },[search]);

  const handleImport = async (pub) => {
    setImporting(p=>({...p,[pub.id]:true}));
    await onImport(pub, importCat[pub.id]||null);
    setImporting(p=>({...p,[pub.id]:false}));
    setImportDone(p=>({...p,[pub.id]:true}));
    setTimeout(()=>setImportDone(p=>({...p,[pub.id]:false})),2500);
  };

  return (
    <div className="mf-view-pad fade-in">
      <Panel title="DISCOVER — COMMUNITY DECKS" style={{ marginBottom:20 }}>
        <div style={{ padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search community decks..." style={{ flex:1, minWidth:160, borderRadius:C.radius }} />
          <span style={{ fontFamily:C.fontUI, fontSize:8, color:C.textSub, whiteSpace:"nowrap" }}>{pubDecks.length} published</span>
        </div>
      </Panel>
      {loading ? (
        <div style={{ fontFamily:C.fontUI, fontSize:9, color:C.textSub, padding:24 }}>Loading<span className="blink">...</span></div>
      ) : pubDecks.length === 0 ? (
        <Panel title="EMPTY" controls={false}>
          <div style={{ padding:"28px", fontFamily:C.fontContent, fontSize:22, color:C.textSub, lineHeight:1.5 }}>
            No published decks yet.<br/>Be the first — hit the ☁ publish button on any deck.
          </div>
        </Panel>
      ) : (
        <div className="mf-discover-grid" style={{ display:"grid", gap:14 }}>
          {pubDecks.map((pub)=>{
            const isOwn = pub.user_id === userId;
            return (
              <Panel key={pub.id} title={pub.deck_name.toUpperCase().slice(0,22)} controls={false}
                style={{ borderLeft:`4px solid ${pub.deck_color||C.border}` }}>
                <div style={{ padding:"14px" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{pub.deck_emoji||"📚"}</div>
                  {pub.deck_description && <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, marginBottom:8, lineHeight:1.5 }}>{pub.deck_description}</div>}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                    <Tag color={C.textSub}>{pub.card_count} cards</Tag>
                    <Tag color={C.purple}>↓ {pub.imports||0} imports</Tag>
                    <Tag color={C.textHint}>by {pub.username||"anon"}</Tag>
                  </div>
                  {!isOwn && (
                    <>
                      <select value={importCat[pub.id]||""} onChange={e=>setImportCat(p=>({...p,[pub.id]:e.target.value}))}
                        style={{ width:"100%", marginBottom:8, borderRadius:C.radius }}>
                        <option value="">No category</option>
                        {categories.map(cat=><option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>)}
                      </select>
                      <Btn onClick={()=>handleImport(pub)} disabled={importing[pub.id]} color={importDone[pub.id]?C.green:C.border} style={{ width:"100%", textAlign:"center", display:"block" }}>
                        {importing[pub.id]?"Importing...":(importDone[pub.id]?"✓ Imported!":"Import Deck")}
                      </Btn>
                    </>
                  )}
                  {isOwn && <Tag color={C.textSub}>Your deck</Tag>}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS VIEW — heatmap + per-deck mastery
// ─────────────────────────────────────────────────────────────
function StatsView({ cards, decks, companionId }) {
  const C = useC();

  // Build 90-day heatmap from card lastReview dates
  const today = new Date();
  today.setHours(0,0,0,0);
  const days90 = Array.from({ length:90 }, (_,i) => {
    const d = new Date(today); d.setDate(d.getDate() - (89-i));
    return { date:d, key:d.toDateString(), count:0 };
  });
  cards.forEach(card => {
    if (!card.lastReview) return;
    const d = new Date(card.lastReview); d.setHours(0,0,0,0);
    const key = d.toDateString();
    const slot = days90.find(x=>x.key===key);
    if (slot) slot.count++;
  });
  const maxCount = Math.max(...days90.map(d=>d.count), 1);

  const totalReviews = cards.reduce((a,c)=>(a+(c.reviewHistory?.length||0)),0);
  const masteredCount = cards.filter(c=>c.interval>30).length;
  const avgEase = cards.length ? (cards.reduce((a,c)=>a+c.easeFactor,0)/cards.length).toFixed(2) : "—";
  const dueCount = CardEngine.getDueCards(cards).length;

  const deckStats = decks.map(deck => {
    const dc = cards.filter(c=>c.deckId===deck.id);
    return {
      ...deck, total:dc.length,
      mastered:dc.filter(c=>c.interval>30).length,
      learning:dc.filter(c=>c.repetitions>0&&c.interval<=30).length,
      due:CardEngine.getDueCards(dc).length,
    };
  }).filter(d=>d.total>0);

  const heatColor = (count) => {
    if (count === 0) return C.raised;
    const intensity = Math.min(count/maxCount, 1);
    return C.chrome==="neon" ? `${C.accent}${Math.round(30+intensity*200).toString(16).padStart(2,"0")}` : `${C.green}${Math.round(40+intensity*215).toString(16).padStart(2,"0")}`;
  };

  return (
    <div className="mf-view-pad fade-in">
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <CompanionSVG id={companionId} size={60} mood="idle" />
        <div>
          <div style={{ fontFamily:C.fontUI, fontSize:14, color:C.border, marginBottom:4 }}>Your Stats</div>
          <div style={{ fontFamily:"monospace", fontSize:12, color:C.textSub }}>
            {(COMPANIONS[companionId]||COMPANIONS.croak).idle[1]}
          </div>
        </div>
      </div>

      {/* Overview stats */}
      <div className="mf-stats-grid" style={{ display:"grid", gap:12, marginBottom:24 }}>
        {[
          { label:"Total Reviews", val:totalReviews, color:C.border },
          { label:"Due Today",     val:dueCount,     color:C.pink },
          { label:"Mastered",      val:masteredCount, color:C.green },
          { label:"Avg Ease",      val:avgEase,      color:C.gold },
        ].map((s,i)=>(
          <Panel key={i} title={s.label} controls={false}>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ fontFamily:C.fontContent, fontSize:46, color:s.color, lineHeight:1 }}>{s.val}</div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Heatmap */}
      <Panel title="90-DAY REVIEW ACTIVITY" style={{ marginBottom:20 }}>
        <div style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
            {days90.map((day,i) => (
              <div key={i} title={`${day.key}: ${day.count} cards`}
                style={{ width:14, height:14, background:heatColor(day.count), borderRadius:C.chrome==="soft"?3:0, border:`1px solid ${C.border}22`, cursor:"default", flexShrink:0, transition:"transform .1s" }}
                onMouseEnter={e=>e.currentTarget.style.transform="scale(1.3)"}
                onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
              />
            ))}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:12, alignItems:"center" }}>
            <span style={{ fontFamily:"monospace", fontSize:11, color:C.textHint }}>less</span>
            {[0,0.25,0.5,0.75,1].map((v,i)=>(
              <div key={i} style={{ width:14,height:14,background:heatColor(v*maxCount),borderRadius:C.chrome==="soft"?3:0,border:`1px solid ${C.border}22` }} />
            ))}
            <span style={{ fontFamily:"monospace", fontSize:11, color:C.textHint }}>more</span>
          </div>
        </div>
      </Panel>

      {/* Per-deck mastery */}
      {deckStats.length > 0 && (
        <Panel title="DECK MASTERY">
          <div style={{ padding:"14px" }}>
            {deckStats.map(deck => {
              const pct = deck.total ? Math.round((deck.mastered/deck.total)*100) : 0;
              return (
                <div key={deck.id} style={{ marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:10,height:10,background:deck.color,borderRadius:"50%" }} />
                      <span style={{ fontFamily:C.fontUI, fontSize:C.uiSize-1, color:C.text }}>{deck.name}</span>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <Tag color={C.green}>{deck.mastered} mastered</Tag>
                      <Tag color={deck.due>0?C.pink:C.green}>{deck.due} due</Tag>
                    </div>
                  </div>
                  <Bar progress={pct} color={deck.color} segments={20} />
                  <div style={{ fontFamily:"monospace", fontSize:11, color:C.textHint, marginTop:4 }}>
                    {deck.total} cards · {pct}% mastered
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// THEME VIEW — vibe + palette + companion picker
// ─────────────────────────────────────────────────────────────
function ThemeView({ themeConfig, onUpdate, companionId, setCompanionId, userId }) {
  const C = useC();
  const currentVibe = themeConfig.vibe || "retro";
  const currentPalette = themeConfig.palette || "digital";

  return (
    <div className="mf-view-pad fade-in">
      {/* Vibe selector */}
      <Panel title="CHOOSE YOUR VIBE" style={{ marginBottom:20 }}>
        <div style={{ padding:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:8 }}>
            {Object.entries(VIBES).map(([key, vibe]) => (
              <div key={key} onClick={()=>onUpdate({ ...themeConfig, vibe:key, palette:Object.keys(PALETTES[key])[0] })}
                style={{ cursor:"pointer", textAlign:"center", padding:"14px 8px", border:`2px solid ${currentVibe===key?C.border:C.border+"33"}`, background:currentVibe===key?`${C.border}18`:"transparent", borderRadius:C.radius, transition:"all .15s" }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{vibe.icon}</div>
                <div style={{ fontFamily:C.fontUI, fontSize:7, color:currentVibe===key?C.border:C.textSub, lineHeight:1.4 }}>{vibe.name}</div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:C.textHint, marginTop:4 }}>{vibe.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Palette selector */}
      <Panel title={`PALETTES — ${VIBES[currentVibe]?.name}`} style={{ marginBottom:20 }}>
        <div style={{ padding:"20px" }}>
          <div className="mf-preset-grid" style={{ display:"grid" }}>
            {Object.entries(PALETTES[currentVibe]||{}).map(([key, pal]) => {
              const isActive = currentPalette === key;
              return (
                <div key={key} onClick={()=>onUpdate({ ...themeConfig, palette:key })}
                  style={{ cursor:"pointer", border:`2px solid ${isActive?pal.border:pal.border+"44"}`, borderRadius:C.radius, overflow:"hidden", transition:"all .15s", transform:isActive?"scale(1.03)":"scale(1)" }}>
                  {/* Preview */}
                  <div style={{ background:pal.bg, padding:"10px 12px" }}>
                    <div style={{ background:pal.border, padding:"4px 8px", borderRadius:C.radius===0?0:4, marginBottom:6 }}>
                      <div style={{ fontFamily:"monospace", fontSize:10, color:"#fff" }}>Window</div>
                    </div>
                    <div style={{ display:"flex", gap:4 }}>
                      {[pal.green,pal.pink,pal.gold,pal.purple].map((col,i)=>(
                        <div key={i} style={{ width:12,height:12,background:col,borderRadius:C.radius===0?0:"50%" }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ background:pal.panel, padding:"8px 12px" }}>
                    <div style={{ fontFamily:VIBES[currentVibe]?.fontUI||"monospace", fontSize:8, color:pal.text }}>{pal.name}</div>
                    {isActive && <div style={{ fontFamily:"monospace", fontSize:10, color:pal.border, marginTop:2 }}>✓ Active</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* Companion selector */}
      <Panel title="CHOOSE YOUR COMPANION">
        <div style={{ padding:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
            {Object.values(COMPANIONS).map((companion) => {
              const isActive = companionId === companion.id;
              return (
                <div key={companion.id} onClick={()=>{ setCompanionId(companion.id); localStorage.setItem(`mf_companion_${userId}`, companion.id); }}
                  style={{ cursor:"pointer", textAlign:"center", padding:"14px 8px", border:`2px solid ${isActive?companion.color:C.border+"33"}`, background:isActive?`${companion.color}18`:"transparent", borderRadius:C.radius, transition:"all .15s" }}>
                  <CompanionSVG id={companion.id} size={60} mood={isActive?"correct":"idle"} />
                  <div style={{ fontFamily:C.fontUI, fontSize:7, color:isActive?companion.color:C.textSub, marginTop:8, lineHeight:1.4 }}>{companion.name}</div>
                  <div style={{ fontFamily:"monospace", fontSize:10, color:C.textHint, marginTop:3 }}>{companion.tagline}</div>
                  {isActive && <Tag color={companion.color} style={{ marginTop:6, display:"inline-block" }}>Active</Tag>}
                </div>
              );
            })}
          </div>
          {/* Companion preview */}
          <div style={{ marginTop:20, padding:"16px", background:C.raised, borderRadius:C.radius, display:"flex", gap:16, alignItems:"flex-start" }}>
            <CompanionSVG id={companionId} size={70} mood="idle" />
            <div>
              <div style={{ fontFamily:C.fontUI, fontSize:10, color:C.border, marginBottom:6 }}>
                {(COMPANIONS[companionId]||COMPANIONS.croak).name}
              </div>
              <div style={{ fontFamily:C.fontContent, fontSize:C.contentSize-2, color:C.text, lineHeight:1.6 }}>
                "{(COMPANIONS[companionId]||COMPANIONS.croak).idle[0]}"
              </div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:C.textSub, marginTop:8 }}>
                Specialty: {(COMPANIONS[companionId]||COMPANIONS.croak).specialty}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────
export default function MemoryForge() {
  const [session, setSession]           = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [view, setView]                 = useState("dashboard");
  const [decks, setDecks]               = useState([]);
  const [cards, setCards]               = useState([]);
  const [dataLoading, setDataLoading]   = useState(false);
  const [studyConfig, setStudyConfig]   = useState({ shuffle:true, wrongsOnly:false, reversed:false, limit:20, deckId:null });
  const [editingCard, setEditingCard]   = useState(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [filterDeck, setFilterDeck]     = useState("all");
  const [themeConfig, setThemeConfig]   = useState(DEFAULT_THEME);
  const [navOpen, setNavOpen]           = useState(false);
  const [categories, setCategories]     = useState([]);
  const [companionId, setCompanionId]   = useState("croak");
  const [streak, setStreak]             = useState({ n:0, last:"", best:0 });
  const [showOnboarding, setShowOnboarding] = useState(false);

  const C = useMemo(()=>buildTheme(themeConfig), [themeConfig]);
  const saveThemeRef = useRef(null);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ setSession(session); setAuthLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>setSession(session));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if (!session) return;
    const uid = session.user.id;
    // Load streak + companion from localStorage
    setStreak(Streak.get(uid));
    const savedCompanion = localStorage.getItem(`mf_companion_${uid}`);
    if (savedCompanion) setCompanionId(savedCompanion);
    // Check onboarding
    if (!localStorage.getItem(`mf_onboarded_${uid}`)) setShowOnboarding(true);

    (async()=>{
      setDataLoading(true);
      try {
        const [dbCards, dbDecks, dbCats, profile] = await Promise.all([
          DB.getCards(), DB.getDecks(), DB.getCategories(), DB.getProfile()
        ]);
        if (profile) setThemeConfig(profile);
        setDecks(dbDecks); setCards(dbCards); setCategories(dbCats);
      } catch(e) { console.error(e); }
      setDataLoading(false);
    })();
  },[session]);

  const updateTheme = useCallback((newConfig)=>{
    setThemeConfig(newConfig);
    if (saveThemeRef.current) clearTimeout(saveThemeRef.current);
    saveThemeRef.current = setTimeout(()=>DB.saveProfile(newConfig), 800);
  },[]);

  const updateCard = useCallback(async(updated)=>{ setCards(prev=>prev.map(c=>c.id===updated.id?updated:c)); try { await DB.upsertCard(updated); } catch(e){console.error(e);} },[]);
  const createCard = useCallback(async(c)=>{ setCards(prev=>[...prev,c]); try { await DB.upsertCard(c); } catch(e){console.error(e);} },[]);
  const deleteCard = useCallback(async(id)=>{ setCards(prev=>prev.filter(c=>c.id!==id)); try { await DB.deleteCard(id); } catch(e){console.error(e);} },[]);
  const createDeck = useCallback(async(deck)=>{ setDecks(prev=>[...prev,deck]); try { await DB.upsertDeck(deck); } catch(e){console.error(e);} },[]);
  const updateDeck = useCallback(async(updated)=>{ setDecks(prev=>prev.map(d=>d.id===updated.id?updated:d)); try { await DB.upsertDeck(updated); } catch(e){console.error(e);} },[]);
  const deleteDeck = useCallback(async(id)=>{ setDecks(prev=>prev.filter(d=>d.id!==id)); setCards(prev=>prev.filter(c=>c.deckId!==id)); try { await DB.deleteDeck(id); } catch(e){console.error(e);} },[]);
  const createCategory = useCallback(async(cat)=>{ setCategories(prev=>[...prev,cat]); try { await DB.upsertCategory(cat); } catch(e){console.error(e);} },[]);
  const updateCategory = useCallback(async(updated)=>{ setCategories(prev=>prev.map(c=>c.id===updated.id?updated:c)); try { await DB.upsertCategory(updated); } catch(e){console.error(e);} },[]);
  const deleteCategory = useCallback(async(id)=>{ setCategories(prev=>prev.filter(c=>c.id!==id)); setDecks(prev=>prev.map(d=>d.categoryId===id?{...d,categoryId:null}:d)); try { await DB.deleteCategory(id); } catch(e){console.error(e);} },[]);

  const publishDeck = useCallback(async(deck)=>{
    const deckCards = cards.filter(c=>c.deckId===deck.id);
    const username = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "anon";
    try { await DB.publishDeck(deck, deckCards, username); } catch(e){console.error(e);}
  },[cards, session]);

  const importDeck = useCallback(async(pub, categoryId=null)=>{
    try { const {deck,cards:newCards} = await DB.importDeck(pub, session.user.id, categoryId); setDecks(prev=>[...prev,deck]); setCards(prev=>[...prev,...newCards]); } catch(e){console.error(e);}
  },[session]);

  const navTo = useCallback((v)=>{ setView(v); setCompanionOpen(false); },[]);

  // After study session complete → update streak
  const onStudyDone = useCallback(()=>{ if(session) setStreak(Streak.update(session.user.id)); },[session]);

  if (authLoading) return <ThemeCtx.Provider value={C}><BootScreen label="AUTHENTICATING..." /></ThemeCtx.Provider>;
  if (!session)    return <ThemeCtx.Provider value={C}><AuthView /></ThemeCtx.Provider>;
  if (dataLoading) return <ThemeCtx.Provider value={C}><BootScreen label="LOADING DATA..." /></ThemeCtx.Provider>;

  const user = session.user;
  const vibe = VIBES[themeConfig.vibe] || VIBES.retro;

  // Google Fonts import based on vibe
  const fontImport = {
    retro:     "@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');",
    modern:    "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');",
    arcade:    "@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');",
    fantasy:   "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');",
    vaporwave: "@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');",
  }[themeConfig.vibe] || "";

  // Vibe-specific global effects
  const vibeEffects = {
    neon: `* { --glow: 0 0 8px ${C.border}44; } body { background-image: none; }`,
    parchment: `body { background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E"); }`,
    arcade: `body::before { content:''; position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px); pointer-events:none; z-index:9999; }`,
    vaporwave: `body::before { content:''; position:fixed; inset:0; background:linear-gradient(0deg, ${C.border}06 1px, transparent 1px), linear-gradient(90deg, ${C.border}06 1px, transparent 1px); background-size: 40px 40px; pointer-events:none; z-index:0; }`,
  }[C.chrome] || "";

  const navItems = [
    { id:"dashboard", label:"Dashboard",  icon:"🏠" },
    { id:"study",     label:"Study",      icon:"📖" },
    { id:"stats",     label:"Stats",      icon:"📊" },
    { id:"discover",  label:"Discover",   icon:"🧭" },
    { id:"creator",   label:"Creator",    icon:"✏️" },
    { id:"library",   label:"Library",    icon:"📚" },
    { id:"theme",     label:"Theme",      icon:"🎨" },
  ];

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{ display:"flex", minHeight:"100vh", background:C.bg, fontFamily:"monospace", transition:"background .3s, color .3s" }}>
        <style>{`
          ${fontImport}
          ${vibeEffects}
          @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
          *{box-sizing:border-box;margin:0;padding:0}
          ::-webkit-scrollbar{width:8px}
          ::-webkit-scrollbar-track{background:${C.bg}}
          ::-webkit-scrollbar-thumb{background:${C.border};border:2px solid ${C.bg};border-radius:4px}
          input,textarea,select{
            font-family:${C.chrome==="soft"?"inherit":"monospace"};
            background:${C.raised};border:${C.chrome==="soft"?`1px solid ${C.border}33`:`2px solid ${C.border}`};
            color:${C.text};padding:8px 10px;font-size:13px;outline:none;
            border-radius:${C.radius}px;
          }
          input:focus,textarea:focus,select:focus{
            border-color:${C.border};
            box-shadow:${C.chrome==="neon"?`0 0 8px ${C.border}88`:C.chrome==="soft"?`0 0 0 3px ${C.border}22`:`3px 3px 0 ${C.border}`};
          }
          input[type=range]{border:none;background:none;padding:0;height:4px;box-shadow:none;cursor:pointer;accent-color:${C.border}}
          @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
          @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          @keyframes glitch{0%,100%{transform:none;filter:none}92%{transform:skewX(0)}94%{transform:skewX(-3deg);filter:hue-rotate(60deg)}96%{transform:skewX(3deg)}98%{transform:none}}
          .fade-in{animation:fadeUp .3s ease both}
          .blink{animation:blink 1.2s step-end infinite}
          .bob{animation:bob 2s ease-in-out infinite}

          .mf-sidebar{width:200px;flex-shrink:0}
          .mf-sidebar-label{display:block}
          .mf-view-pad{padding:32px 40px}
          .mf-stats-grid{grid-template-columns:repeat(4,1fr)}
          .mf-preset-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
          .mf-two-col{grid-template-columns:1fr 1fr}
          .mf-discover-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
          .mf-hamburger{display:none}

          @media(min-width:1440px){
            .mf-sidebar{width:220px}
            .mf-view-pad{padding:40px 56px}
            .mf-preset-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
          }
          @media(max-width:1023px) and (min-width:640px){
            .mf-sidebar{width:52px}
            .mf-sidebar-label{display:none}
            .mf-view-pad{padding:20px 24px}
            .mf-stats-grid{grid-template-columns:repeat(2,1fr)}
            .mf-preset-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
            .mf-two-col{grid-template-columns:1fr}
            .mf-discover-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          }
          @media(max-width:639px){
            .mf-sidebar{display:none}
            .mf-hamburger{display:flex;align-items:center;gap:10px;position:fixed;top:0;left:0;right:0;z-index:200;background:${C.border};padding:10px 16px;font-family:${C.fontUI};font-size:9px;color:#FFF;border-bottom:2px solid ${C.border}}
            .mf-view-pad{padding:60px 14px 24px}
            .mf-stats-grid{grid-template-columns:repeat(2,1fr)}
            .mf-preset-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
            .mf-two-col{grid-template-columns:1fr}
            .mf-discover-grid{grid-template-columns:1fr}
          }
        `}</style>

        {/* Onboarding */}
        {showOnboarding && (
          <OnboardingModal userId={user.id} themeConfig={themeConfig} onTheme={updateTheme}
            onDone={(companion)=>{ setCompanionId(companion); setShowOnboarding(false); }} />
        )}

        {/* Mobile hamburger */}
        <div className="mf-hamburger" onClick={()=>setNavOpen(true)} style={{ cursor:"pointer" }}>
          <span style={{ fontSize:16 }}>☰</span>
          <span>MEMORYFORGE</span>
        </div>

        {/* Mobile nav drawer */}
        {navOpen && (
          <div style={{ position:"fixed",inset:0,background:C.panel,zIndex:300,overflowY:"auto",display:"flex",flexDirection:"column" }}>
            <div style={{ background:C.border, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:C.fontUI, fontSize:10, color:"#FFF" }}>MEMORYFORGE</div>
              <button onClick={()=>setNavOpen(false)} style={{ background:"none",border:"none",color:"#FFF",fontSize:22,cursor:"pointer" }}>×</button>
            </div>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>{ navTo(item.id); setNavOpen(false); }} style={{ display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",padding:"16px 20px",fontFamily:C.fontUI,fontSize:8,letterSpacing:0.5,color:view===item.id?"#fff":C.text,background:view===item.id?C.border:"transparent",border:"none",borderBottom:`1px solid ${C.border}30`,cursor:"pointer" }}>
                <span style={{ fontSize:16 }}>{item.icon}</span> {item.label}
              </button>
            ))}
            <div style={{ padding:"16px 20px",marginTop:"auto",borderTop:`2px solid ${C.border}` }}>
              <div style={{ fontFamily:"monospace",fontSize:12,color:C.text,marginBottom:10 }}>{user.user_metadata?.full_name||user.email?.split("@")[0]||"USER"}</div>
              <button onClick={()=>supabase.auth.signOut()} style={{ fontFamily:C.fontUI,fontSize:6,color:C.pink,border:`1.5px solid ${C.pink}`,background:"transparent",padding:"6px 10px",cursor:"pointer",borderRadius:C.radius }}>Sign Out</button>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className="mf-sidebar" style={{ background:C.panel, borderRight:`${C.chrome==="neon"?"1px":"2px"} solid ${C.border}`, display:"flex", flexDirection:"column", boxShadow:C.chrome==="neon"?`2px 0 12px ${C.border}44`:undefined, transition:"background .3s, border-color .3s, width .2s", zIndex:10 }}>
          {/* Logo */}
          <div style={{ background:C.border, padding:"14px 12px", boxShadow:C.chrome==="neon"?`0 0 12px ${C.border}88`:undefined }}>
            <div style={{ fontFamily:C.fontUI, fontSize:10, color:"#FFFFFF", lineHeight:1.8, letterSpacing:0.5 }} className={C.chrome==="pixel"||C.chrome==="arcade"?"glitch":undefined}>
              MEMORY<br/>FORGE
            </div>
            <div className="mf-sidebar-label" style={{ fontFamily:C.fontUI, fontSize:5, color:"#FFFFFF99", marginTop:5 }}>v4 · {vibe.name}</div>
          </div>

          {/* Companion mini in sidebar */}
          <div className="mf-sidebar-label" style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}33`, display:"flex", alignItems:"center", gap:8 }}>
            <div className="bob">
              <CompanionSVG id={companionId} size={36} mood="idle" />
            </div>
            <div style={{ fontFamily:C.fontUI, fontSize:6, color:C.textSub, lineHeight:1.6 }}>
              {(COMPANIONS[companionId]||COMPANIONS.croak).name}
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"8px 0" }}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>navTo(item.id)} title={item.label}
                style={{ display:"flex", alignItems:"center", gap:10, width:"100%", textAlign:"left", padding:"10px 14px", fontFamily:C.fontUI, fontSize:7, letterSpacing:0.5, lineHeight:1, color:view===item.id?"#FFFFFF":C.text, background:view===item.id?C.border:"transparent", border:"none", borderLeft:view===item.id?`4px solid ${C.accent}`:"4px solid transparent", cursor:"pointer", transition:"all .12s", whiteSpace:"nowrap", overflow:"hidden" }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
                <span className="mf-sidebar-label">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User + signout */}
          <div style={{ borderTop:`${C.chrome==="neon"?"1px":"2px"} solid ${C.border}`, padding:"12px 14px" }}>
            <div className="mf-sidebar-label" style={{ fontFamily:"monospace", fontSize:11, color:C.text, marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user.user_metadata?.full_name||user.email?.split("@")[0]||"USER"}
            </div>
            {streak.n>0 && <div className="mf-sidebar-label" style={{ fontFamily:"monospace",fontSize:11,color:C.gold,marginBottom:8 }}>🔥 {streak.n} day streak</div>}
            <button onClick={()=>supabase.auth.signOut()} title="Sign out" style={{ fontFamily:C.fontUI, fontSize:6, color:C.pink, border:`1.5px solid ${C.pink}`, background:"transparent", padding:"5px 8px", cursor:"pointer", borderRadius:C.radius }}>
              <span className="mf-sidebar-label">Sign Out</span>
              <span style={{ display:"none" }}>⏻</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex:1, overflow:"auto", minWidth:0, position:"relative", zIndex:1 }}>
          {view==="dashboard" && <DashboardView cards={cards} decks={decks} categories={categories} studyConfig={studyConfig} setStudyConfig={setStudyConfig} navTo={navTo} onPublish={publishDeck} onCreateDeck={createDeck} onUpdateDeck={updateDeck} onDeleteDeck={deleteDeck} onCreateCategory={createCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} streak={streak} companionId={companionId} userId={user.id} />}
          {view==="study"     && <StudyView cards={cards} decks={decks} studyConfig={studyConfig} onCardUpdate={updateCard} companionOpen={companionOpen} setCompanionOpen={setCompanionOpen} companionId={companionId} userId={user.id} />}
          {view==="stats"     && <StatsView cards={cards} decks={decks} companionId={companionId} />}
          {view==="discover"  && <DiscoverView onImport={importDeck} userId={user.id} categories={categories} />}
          {view==="creator"   && <CreatorView cards={cards} decks={decks} onCardCreate={createCard} onCardUpdate={updateCard} editingCard={editingCard} setEditingCard={setEditingCard} />}
          {view==="library"   && <LibraryView cards={cards} decks={decks} filterDeck={filterDeck} setFilterDeck={setFilterDeck} onDelete={deleteCard} onEdit={(c)=>{ setEditingCard(c); navTo("creator"); }} />}
          {view==="theme"     && <ThemeView themeConfig={themeConfig} onUpdate={updateTheme} companionId={companionId} setCompanionId={setCompanionId} userId={user.id} />}
        </main>
      </div>
    </ThemeCtx.Provider>
  );
}
