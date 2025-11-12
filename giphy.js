// ===================== GIPHY API Helper =====================

const GIPHY_KEY = "bCn5Jvx2ZOepneH6fMteNoX31hVfqX25";
const BASE_URL = "https://api.giphy.com/v1";
import { convoAlert } from "./convoAlerts.js";

/**
 * 🔥 Trending GIFs ή Stickers
 * @param {"gifs" | "stickers"} type
 * @returns Promise<Array>
 */
export async function fetchTrending(type = "gifs") {
  try {
    const res = await fetch(`${BASE_URL}/${type}/trending?api_key=${GIPHY_KEY}&limit=60&rating=pg`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("❌ Giphy trending error:", err);
    return [];
  }
}

/**
 * 🔍 Αναζήτηση GIFs ή Stickers (υποστηρίζει και ελληνικά)
 * @param {"gifs" | "stickers"} type
 * @param {string} query
 * @returns Promise<Array>
 */
export async function searchGiphy(type = "gifs", query = "") {
  if (!query.trim()) return fetchTrending(type);

  const isGreek = /[\u0370-\u03FF]/.test(query);

  // === Transliteration για fallback ===
  function greekToLatin(str) {
    const map = {
      α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z",
      η: "i", ή: "i", θ: "th", ι: "i", ί: "i", κ: "k", λ: "l", μ: "m",
      ν: "n", ξ: "x", ο: "o", ό: "o", π: "p", ρ: "r", σ: "s", ς: "s",
      τ: "t", υ: "y", ύ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o", ώ: "o",
    };
    return str
      .toLowerCase()
      .split("")
      .map((ch) => map[ch] || ch)
      .join("");
  }

  try {
    // 1️⃣ Κανονική αναζήτηση UTF-8 (π.χ. "ψάλτης")
    const res = await fetch(
      `${BASE_URL}/${type}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=60&rating=pg`
    );
    const data = await res.json();

    // Αν βρήκε αποτελέσματα → τέλος
    if (data.data && data.data.length > 0) return data.data;

    // 2️⃣ Fallback σε λατινικό (π.χ. "psaltis")
    if (isGreek) {
      const latinQuery = greekToLatin(query);
      const res2 = await fetch(
        `${BASE_URL}/${type}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(latinQuery)}&limit=60&rating=pg`
      );
      const data2 = await res2.json();
      return data2.data || [];
    }

    // 3️⃣ Αν δεν βρέθηκε τίποτα
    return [];
  } catch (err) {
    console.error("❌ Giphy search error:", err);
    return [];
  }
}
/**
 * 🌍 Smart Hybrid Giphy Search (Greek + English)
 * Συνδυάζει αποτελέσματα για πλουσιότερη εμπειρία, τύπου Messenger/Discord
 */
export async function searchGiphyHybrid(type = "gifs", query = "") {
  if (!query.trim()) return fetchTrending(type);

  const isGreek = /[\u0370-\u03FF]/.test(query);
  const greekToLatin = (str) => str
    .toLowerCase()
    .replace(/[άα]/g, "a")
    .replace(/[β]/g, "v")
    .replace(/[γ]/g, "g")
    .replace(/[δ]/g, "d")
    .replace(/[εέ]/g, "e")
    .replace(/[ζ]/g, "z")
    .replace(/[ηή]/g, "i")
    .replace(/[θ]/g, "th")
    .replace(/[ιί]/g, "i")
    .replace(/[κ]/g, "k")
    .replace(/[λ]/g, "l")
    .replace(/[μ]/g, "m")
    .replace(/[ν]/g, "n")
    .replace(/[ξ]/g, "x")
    .replace(/[οό]/g, "o")
    .replace(/[π]/g, "p")
    .replace(/[ρ]/g, "r")
    .replace(/[σς]/g, "s")
    .replace(/[τ]/g, "t")
    .replace(/[υύ]/g, "y")
    .replace(/[φ]/g, "f")
    .replace(/[χ]/g, "ch")
    .replace(/[ψ]/g, "ps")
    .replace(/[ωώ]/g, "o");

  const queries = [query];
  if (isGreek) queries.push(greekToLatin(query));

  try {
    const [elRes, enRes] = await Promise.all([
      fetch(`${BASE_URL}/${type}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=40&rating=pg&lang=el`),
      fetch(`${BASE_URL}/${type}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(queries.at(-1))}&limit=40&rating=pg&lang=en`)
    ]);

    const elData = (await elRes.json()).data || [];
    const enData = (await enRes.json()).data || [];

    // === Συνένωση χωρίς duplicates (με βάση το id του Giphy) ===
    const merged = [...elData, ...enData].filter(
      (v, i, arr) => arr.findIndex((x) => x.id === v.id) === i
    );

    return merged;
  } catch (err) {
    console.error("❌ Giphy hybrid search error:", err);
    return [];
  }
}
