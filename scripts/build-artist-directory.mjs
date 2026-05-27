import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function normalizeArtistName(value) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\bmembers?\.?$/giu, "")
    .replace(/^[\s,;/&-]+|[\s,;/&-]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

function normalizeArtistLookup(value) {
  return normalizeArtistName(value)
    .replace(/[.()'’]/gu, " ")
    .replace(/[-–—]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanupArtistToken(value) {
  return value
    .replace(/^and\s+/iu, "")
    .replace(/^[\s,;/&-]+|[\s,;/&-]+$/gu, "")
    .replace(/\bmembers?\.?$/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function splitArtistCredits(value) {
  return [
    ...new Set(
      value
        .split(/\s*(?:,|\/|&| x | feat\.? | ft\.? | featuring | with | and )\s*/giu)
        .map(cleanupArtistToken)
        .filter(Boolean),
    ),
  ];
}

function createArtistId(value) {
  const hash = createHash("sha1").update(normalizeArtistName(value)).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

function slugifyArtistName(value) {
  const slug = normalizeArtistName(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return slug || "artist";
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeoutMs)),
  ]);
}

function wait(timeoutMs) {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

const manualTitles = {
  "a r rahman": "A. R. Rahman",
  "drake": "Drake_(musician)",
  "g v prakash": "G._V._Prakash_Kumar",
  "hariharan": "Hariharan_(singer)",
  "javed mohsin": "Javed–Mohsin",
  "jubin nautiyal": "Jubin Nautiyal",
  "karan aujla": "Karan Aujla",
  "rosa linn": "Rosa_Linn",
  "raye": "Raye_(singer)",
  "sachin jigar": "Sachin–Jigar",
  "sachet parampara": "Sachet–Parampara",
  "the kid laroi": "The_Kid_Laroi",
  "vishal mishra": "Vishal_Mishra_(composer)",
  "one direction": "One_Direction",
  "sidhu moose wala": "Sidhu_Moose_Wala",
  "shreya ghoshal": "Shreya_Ghoshal",
  "tanishk bagchi": "Tanishk_Bagchi",
  "chinmayi": "Chinmayi_Sripada",
};

const manualProfiles = {
  "amir ameer": {
    bio: "Amir Ameer is a Kashmiri singer-songwriter and composer associated with melodic, emotionally led releases across the modern independent catalog.",
  },
  "faheem abdullah": {
    bio: "Faheem Abdullah is a Kashmiri singer-songwriter whose releases blend intimate writing with a soft contemporary Hindi-Urdu sound.",
  },
  "hansika pareek": {
    bio: "Hansika Pareek is an Indian vocalist and songwriter featured on recent Hindi releases in the catalog.",
  },
  "javed mohsin": {
    bio: "Javed–Mohsin is the Indian composer duo of Javed Akhtar and Mohsin Shaikh, known for Hindi film and pop-forward soundtrack releases.",
  },
  "jind universe": {
    bio: "Jind Universe is a Punjabi music act known for collaboration-led independent singles and upbeat romantic releases.",
  },
  "khan saab": {
    bio: "Khan Saab is a Punjabi singer known for soulful romantic records and collaboration-driven independent singles.",
  },
  "navjot ahuja": {
    bio: "Navjot Ahuja is a Punjabi vocalist featured on modern independent catalog releases.",
  },
  "parampara tandon": {
    bio: "Parampara Tandon is an Indian playback singer whose work spans Hindi film soundtracks, romantic singles, and devotional-pop releases.",
  },
  "rauhan malik": {
    bio: "Rauhan Malik is an Indian singer-songwriter and composer working across contemporary Hindi romantic and independent releases.",
  },
  "sachet parampara": {
    bio: "Sachet–Parampara is the Indian composer and vocalist duo of Sachet Tandon and Parampara Tandon, known for Hindi soundtrack hits and devotional-pop crossovers.",
  },
  "sachin jigar": {
    bio: "Sachin–Jigar is the Indian composer duo of Sachin Sanghvi and Jigar Saraiya, known for Bollywood soundtracks, pop crossovers, and hook-led chart records.",
  },
  "sandeep aulakh": {
    bio: "Sandeep Aulakh is a Punjabi lyricist and songwriter whose credits lean toward folk-rooted and romantic releases.",
  },
  "the rish": {
    bio: "The Rish is an Indian singer-songwriter and producer working across romantic pop and soundtrack-led releases.",
  },
  "yuvraj tung": {
    bio: "Yuvraj Tung is a Punjabi vocalist and performer featured on modern independent releases.",
  },
};

async function fetchJsonWithRetry(url, label, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await withTimeout(
        fetch(url, {
          headers: {
            "user-agent": "birvana-artist-directory/1.0",
          },
        }),
        15000,
        label,
      );

      if (response.ok) {
        return response.json();
      }

      if ((response.status >= 500 || response.status === 429) && attempt < attempts) {
        await wait(450 * attempt);
        continue;
      }

      return null;
    } catch (error) {
      if (attempt < attempts) {
        await wait(450 * attempt);
        continue;
      }

      throw error;
    }
  }

  return null;
}

async function fetchWikipediaSummary(title) {
  const payload = await fetchJsonWithRetry(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    `summary ${title}`,
  );

  if (!payload) {
    return null;
  }

  if (payload.type === "disambiguation" || typeof payload.title !== "string") {
    return null;
  }

  let imageUrl = payload.thumbnail?.source ?? null;

  if (!imageUrl) {
    const imagePayload = await fetchJsonWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(
        payload.title,
      )}&format=json&pithumbsize=600`,
      `page image ${payload.title}`,
    );
    const pages = imagePayload?.query?.pages ? Object.values(imagePayload.query.pages) : [];
    const firstPage = pages[0];
    imageUrl = firstPage?.thumbnail?.source ?? null;
  }

  return {
    title: payload.title,
    bio:
      typeof payload.extract === "string" && payload.extract.trim()
        ? payload.extract.trim()
        : null,
    imageUrl,
    sourceUrl: payload.content_urls?.desktop?.page ?? null,
  };
}

function scoreSearchResult(name, title) {
  const normalizedName = normalizeArtistLookup(name);
  const normalizedTitle = normalizeArtistLookup(title);

  if (normalizedTitle === normalizedName) {
    return 100;
  }

  if (normalizedTitle.startsWith(normalizedName)) {
    return 80;
  }

  if (normalizedTitle.includes(normalizedName)) {
    return 60;
  }

  return 0;
}

function scoreDeezerResult(name, title) {
  const normalizedName = normalizeArtistLookup(name);
  const normalizedTitle = normalizeArtistLookup(title);

  if (normalizedTitle === normalizedName) {
    return 100;
  }

  if (normalizedTitle.startsWith(normalizedName) || normalizedName.startsWith(normalizedTitle)) {
    return 80;
  }

  if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) {
    return 60;
  }

  return 0;
}

async function fetchDeezerArtist(name) {
  const payload = await fetchJsonWithRetry(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`,
    `deezer ${name}`,
  );

  if (!payload) {
    return null;
  }

  const results = Array.isArray(payload?.data) ? payload.data : [];

  if (!results.length) {
    return null;
  }

  const [best] = results
    .map((result) => ({
      name: typeof result.name === "string" ? result.name : name,
      score: scoreDeezerResult(name, typeof result.name === "string" ? result.name : ""),
      picture:
        result.picture_medium ??
        result.picture_big ??
        result.picture_xl ??
        result.picture ??
        null,
      link: result.link ?? null,
    }))
    .sort((a, b) => b.score - a.score);

  if (!best || best.score === 0) {
    return null;
  }

  return {
    imageUrl: best.picture,
    sourceUrl: best.link,
    sourceLabel: best.name,
  };
}

function mergeArtistMetadata(name, base, manual, deezer) {
  return {
    name,
    wikipediaTitle: base?.wikipediaTitle ?? manual?.wikipediaTitle ?? null,
    bio: manual?.bio ?? base?.bio ?? null,
    imageUrl: manual?.imageUrl ?? base?.imageUrl ?? deezer?.imageUrl ?? null,
    sourceUrl: manual?.sourceUrl ?? base?.sourceUrl ?? deezer?.sourceUrl ?? null,
    sourceLabel: manual?.sourceLabel ?? base?.sourceLabel ?? deezer?.sourceLabel ?? null,
  };
}

async function searchWikipediaTitle(name) {
  const searchTerms = [
    manualTitles[normalizeArtistLookup(name)] ?? name,
    `${name} singer`,
    `${name} musician`,
    `${name} songwriter`,
    `${name} band`,
  ];

  for (const term of searchTerms) {
    const payload = await fetchJsonWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term,
      )}&utf8=1&format=json&srlimit=5`,
      `search ${term}`,
    );

    if (!payload) {
      continue;
    }

    const results = Array.isArray(payload?.query?.search) ? payload.query.search : [];

    if (!results.length) {
      continue;
    }

    const [best] = results
      .map((result) => ({
        title: result.title,
        score: scoreSearchResult(name, result.title),
      }))
      .sort((a, b) => b.score - a.score);

    if (best?.title && best.score > 0) {
      return best.title;
    }
  }

  return null;
}

async function fetchArtistMetadata(name) {
  const manual = manualProfiles[normalizeArtistLookup(name)] ?? null;
  const preferredTitle = manualTitles[normalizeArtistLookup(name)] ?? name;
  const deezer = await fetchDeezerArtist(name);

  for (const directTitle of [...new Set([preferredTitle, name])]) {
    const direct = await fetchWikipediaSummary(directTitle);

    if (direct && scoreSearchResult(name, direct.title) > 0) {
      return mergeArtistMetadata(
        name,
        {
          wikipediaTitle: direct.title,
          bio: direct.bio,
          imageUrl: direct.imageUrl,
          sourceUrl: direct.sourceUrl,
          sourceLabel: direct.title,
        },
        manual,
        deezer,
      );
    }
  }

  const searchedTitle = await searchWikipediaTitle(name);

  if (!searchedTitle) {
    return mergeArtistMetadata(name, null, manual, deezer);
  }

  const summary = await fetchWikipediaSummary(searchedTitle);

  if (!summary || scoreSearchResult(name, summary.title) === 0) {
    return mergeArtistMetadata(
      name,
      {
        wikipediaTitle: searchedTitle,
        bio: null,
        imageUrl: null,
        sourceUrl: null,
        sourceLabel: searchedTitle,
      },
      manual,
      deezer,
    );
  }

  return mergeArtistMetadata(
    name,
    {
      wikipediaTitle: summary.title,
      bio: summary.bio,
      imageUrl: summary.imageUrl,
      sourceUrl: summary.sourceUrl,
      sourceLabel: summary.title,
    },
    manual,
    deezer,
  );
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: songs, error } = await supabase
  .from("songs")
  .select("artist_display,status,audio_path")
  .eq("status", "ready")
  .not("audio_path", "is", null);

if (error) {
  throw error;
}

const artistNames = [
  ...new Set(
    (songs ?? [])
      .flatMap((song) => splitArtistCredits(song.artist_display ?? ""))
      .filter(Boolean),
  ),
].sort((a, b) => a.localeCompare(b));

const slugRegistry = new Map();

const metadata = await mapWithConcurrency(artistNames, 3, async (name) => {
  const id = createArtistId(name);
  const baseSlug = slugifyArtistName(name);
  const existingOwner = slugRegistry.get(baseSlug);
  const slug = !existingOwner || existingOwner === id ? baseSlug : `${baseSlug}-${id.slice(0, 8)}`;

  slugRegistry.set(slug, id);

  try {
    const details = await fetchArtistMetadata(name);
    return {
      id,
      slug,
      name,
      bio: details.bio,
      imageUrl: details.imageUrl,
      sourceUrl: details.sourceUrl,
      sourceLabel: details.sourceLabel,
      wikipediaTitle: details.wikipediaTitle,
    };
  } catch (fetchError) {
    console.warn(`Metadata fetch failed for ${name}:`, fetchError.message);
    return {
      id,
      slug,
      name,
      bio: null,
      imageUrl: null,
      sourceUrl: null,
      sourceLabel: null,
      wikipediaTitle: null,
    };
  }
});

const outputPath = path.join(process.cwd(), "src", "data", "artist-directory.generated.json");
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

console.log(`Generated ${metadata.length} artist records -> ${outputPath}`);
