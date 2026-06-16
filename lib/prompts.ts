// ─── Writing Rules ────────────────────────────────────────────────────────────

const NO_EMOJI_RULES = `
CRITICAL WRITING RULES - FOLLOW WITHOUT EXCEPTION:
- Do NOT use emojis of any kind
- Do NOT use special Unicode characters, bullet symbols, or decorative symbols
- Write like a real human professional, not an AI assistant
- Avoid corporate buzzwords: leverage, synergy, pivot, game-changer, rockstar, disruptive, ecosystem, holistic
- Use natural sentence structure with occasional sentence fragments for authenticity
- Vary paragraph length - mix short punchy sentences with longer explanatory ones
- Do not start multiple consecutive sentences with "I"
- Sound conversational and direct
`.trim();

const HUMAN_MODE_RULES = `
HUMAN MODE ACTIVE - ADDITIONAL AUTHENTICITY RULES:
- Use contractions liberally: don't, won't, can't, I've, it's, they're, we're
- Occasionally start a sentence with "And" or "But" for natural flow
- Include one or two subtly informal phrases per post: "honestly", "here's the thing", "look,", "real talk"
- Vary your punctuation naturally - not every sentence needs to be perfectly structured
- Write with the energy of someone who typed this on their laptop between meetings
- Do NOT add deliberate misspellings - just natural human writing rhythm
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRules(humanMode: boolean): string {
  return humanMode
    ? `${NO_EMOJI_RULES}\n\n${HUMAN_MODE_RULES}`
    : NO_EMOJI_RULES;
}

// ─── Visual Profile (for image personalization) ──────────────────────────────

export interface UserVisualProfile {
  positioning?: string | null;
  contentStyles?: string | null;
  industry?: string | null;
  name?: string | null;
}

/**
 * Derives a visual style direction block for image prompts based on the user's
 * profile. This ensures each user's images feel personal and on-brand.
 */
export function deriveVisualStyle(profile: UserVisualProfile): string {
  const parts: string[] = [];

  // Visual register from positioning
  const pos = (profile.positioning || "").toLowerCase();
  if (pos.includes("thought leader")) {
    parts.push("Visual register: bold editorial photography with striking compositions, strong directional lighting, and confident subjects.");
  } else if (pos.includes("industry expert") || pos.includes("technical")) {
    parts.push("Visual register: sharp, technical, detail-oriented imagery with precision and clarity - tools, environments, and close-up details relevant to the field.");
  } else if (pos.includes("storyteller") || pos.includes("mentor")) {
    parts.push("Visual register: warm cinematic storytelling scenes with natural lighting, human moments, and emotional depth.");
  } else if (pos.includes("innovator") || pos.includes("entrepreneur")) {
    parts.push("Visual register: dynamic, forward-looking compositions with energy, movement, and modern subjects.");
  } else {
    parts.push("Visual register: clean, professional editorial photography or modern flat illustration.");
  }

  // Composition style from content styles
  let styles: string[] = [];
  try {
    styles = profile.contentStyles ? JSON.parse(profile.contentStyles) : [];
  } catch { /* ignore */ }
  const stylesJoined = styles.join(" ").toLowerCase();

  if (stylesJoined.includes("narrative") || stylesJoined.includes("story") || stylesJoined.includes("behind the scenes")) {
    parts.push("Composition style: cinematic narrative scenes that tell a visual story, with depth and atmosphere.");
  } else if (stylesJoined.includes("how-to") || stylesJoined.includes("tips") || stylesJoined.includes("problem")) {
    parts.push("Composition style: clean, structured layouts with clear visual hierarchy - organized and instructive.");
  } else if (stylesJoined.includes("data") || stylesJoined.includes("case study") || stylesJoined.includes("list")) {
    parts.push("Composition style: infographic-inspired, precise, data-driven visual feel with geometric elements.");
  } else if (stylesJoined.includes("q&a") || stylesJoined.includes("question") || stylesJoined.includes("predict")) {
    parts.push("Composition style: thought-provoking, open compositions with visual tension and curiosity.");
  }

  // Industry-specific visual vocabulary
  const ind = (profile.industry || "").toLowerCase();
  if (ind.includes("tech") || ind.includes("software") || ind.includes("it ") || ind.includes("saas")) {
    parts.push("Industry visuals: circuit patterns, devices, code abstractions, digital interfaces, server rooms, developer workspaces.");
  } else if (ind.includes("finance") || ind.includes("banking") || ind.includes("invest")) {
    parts.push("Industry visuals: market trends, currency, financial instruments, trading floors, analytical dashboards.");
  } else if (ind.includes("health") || ind.includes("medical") || ind.includes("pharma")) {
    parts.push("Industry visuals: medical environments, lab equipment, wellness imagery, clinical precision.");
  } else if (ind.includes("educ") || ind.includes("learn") || ind.includes("train")) {
    parts.push("Industry visuals: learning environments, books, workshops, mentorship moments, knowledge sharing.");
  } else if (ind.includes("market") || ind.includes("advertis") || ind.includes("brand") || ind.includes("media")) {
    parts.push("Industry visuals: creative workspaces, campaign elements, brand materials, audience engagement.");
  } else if (ind.includes("design") || ind.includes("creative") || ind.includes("art")) {
    parts.push("Industry visuals: creative tools, design workspaces, color swatches, typography specimens, artistic processes.");
  } else if (ind.includes("consult") || ind.includes("manag") || ind.includes("strateg")) {
    parts.push("Industry visuals: strategy sessions, whiteboards, collaborative workspaces, decision-making moments.");
  } else if (ind.includes("real estate") || ind.includes("property") || ind.includes("construction")) {
    parts.push("Industry visuals: architectural elements, building materials, property spaces, urban landscapes.");
  } else if (ind) {
    parts.push(`Industry visuals: use recognizable objects, tools, environments, and scenarios specific to the ${profile.industry} field.`);
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

export function deriveAllowedPostTypes(contentStylesStr: string | null | undefined): string[] {
  const defaultTypes = ["thought-leadership", "tips", "story", "question", "listicle"];
  if (!contentStylesStr) return defaultTypes;
  try {
    const styles = JSON.parse(contentStylesStr);
    if (!Array.isArray(styles) || styles.length === 0) return defaultTypes;

    const allowed = new Set<string>();
    
    // Core safe defaults
    allowed.add("thought-leadership");
    
    const stylesJoined = styles.join(" ").toLowerCase();
    
    if (stylesJoined.includes("story") || stylesJoined.includes("behind the scenes") || stylesJoined.includes("lessons learned")) {
      allowed.add("story");
    }
    if (stylesJoined.includes("tips") || stylesJoined.includes("how-to") || stylesJoined.includes("problem agitation solution")) {
      allowed.add("tips");
    }
    if (stylesJoined.includes("list") || stylesJoined.includes("data") || stylesJoined.includes("case study")) {
      allowed.add("listicle");
    }
    if (stylesJoined.includes("q&a") || stylesJoined.includes("question") || stylesJoined.includes("predict")) {
      allowed.add("question");
    }

    if (allowed.size === 1) { 
       // Give them a mix but omit story to be safe if they didn't ask for it
       return ["thought-leadership", "tips", "question"];
    }
    return Array.from(allowed);
  } catch {
    return defaultTypes;
  }
}

// ─── Strategy Prompt ─────────────────────────────────────────────────────────

export interface PreviousWeekSummary {
  weekStart: string;
  weekTheme: string;
  weekFocus: string;
  postTitles: string[];
  postTypes: string[];
}

export function buildStrategyPrompt(
  profileContext: string,
  weekStart: Date,
  previousWeeks: PreviousWeekSummary[] = [],
  allowedTypes: string[] = ["thought-leadership", "tips", "story", "question", "listicle"]
): string {
  const weekLabel = weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let previousContext = "";
  if (previousWeeks.length > 0) {
    previousContext = `
PREVIOUS WEEKS CONTENT HISTORY (most recent first):
${previousWeeks
  .map(
    (w, i) => `
Week ${i + 1} - ${w.weekStart}:
  Theme: "${w.weekTheme}"
  Focus: "${w.weekFocus}"
  Posts: ${w.postTitles.map((t) => `"${t}"`).join(", ")}
  Types used: ${w.postTypes.join(", ")}`
  )
  .join("\n")}

IMPORTANT CONTINUITY RULES:
- Do NOT repeat the same weekly theme or focus from previous weeks
- Build upon the narrative arc - this week should feel like a natural progression
- Cover different angles, sub-topics, or fresh perspectives within the person's expertise
- If previous weeks were heavy on one post type, vary the mix this week
- Reference or build upon ideas from previous weeks to create a cohesive content journey
- Each week should deepen the audience's understanding of this person's expertise
`;
  }

  return `You are an expert LinkedIn content strategist. Create a personalized content strategy for the next 5 weekdays starting ${weekLabel}.

PROFESSIONAL PROFILE:
${profileContext}
${previousContext}
${NO_EMOJI_RULES}

Generate a content strategy as a JSON object with this EXACT structure:
{
  "weekTheme": "string (overarching theme - must be DIFFERENT from previous batches)",
  "weekFocus": "string (specific angle or narrative arc - must be a FRESH perspective)",
  "pillars": [
    {
      "name": "string (content pillar name)",
      "description": "string (what this pillar covers)",
      "percentage": number (% of posts, must sum to 100)
    }
  ],
  "audience": {
    "primaryAudience": "string",
    "painPoints": ["string"],
    "desiredOutcomes": ["string"]
  },
  "tone": {
    "voice": "string (e.g. 'Direct and confident')",
    "style": "string",
    "avoid": ["string"]
  },
  "postTypes": ${JSON.stringify(allowedTypes)},
  "postMix": {
    // Specify the percentage or count for each post type used from the postTypes array above. Use the exact string keys.
    ${allowedTypes.map(t => `"${t}": number`).join(",\n    ")}
  },
  "weeklyGoal": "string (what success looks like this week)",
  "callToAction": "string (the primary CTA to use this week)"
}

Return ONLY valid JSON. No markdown fences. No explanation. No emojis.`;
}

// ─── Posts Prompt ────────────────────────────────────────────────────────────

export function buildPostsPrompt(
  profileContext: string,
  weekTheme: string,
  weekFocus: string,
  postTypes: string[],
  strategy: object,
  humanMode: boolean = false,
  postCount: number = 5,
  allowedTypes: string[] = ["thought-leadership", "tips", "story", "question", "listicle"]
): string {
  const rules = getRules(humanMode);

  return `You are an expert LinkedIn ghostwriter. Create ${postCount} high-quality, original LinkedIn posts for the user's scheduled posting days.

PROFESSIONAL PROFILE:
${profileContext}

THEME: "${weekTheme}"
FOCUS: "${weekFocus}"
POST TYPES TO USE: ${postTypes.slice(0, postCount).join(", ")}
STRATEGY CONTEXT: ${JSON.stringify(strategy)}

${rules}

Generate exactly ${postCount} posts as a JSON array. Each post must follow this exact structure:
[
  {
    "title": "string (compelling hook - the opening line of the post, max 150 chars)",
    "body": "string (full post body, max 1300 characters, use line breaks for readability)",
    "hashtags": ["string", "string", "string", "string", "string"],
    "postType": "${allowedTypes.join("|")}",
    "imagePrompt": "string (a short 1-2 sentence visual concept - describe the SCENE or METAPHOR, not text to display. Example: 'A lighthouse beam cutting through fog at dawn, symbolizing guidance' NOT 'An image showing the words Leadership Matters')",
    "bestTimeToPost": "string (e.g. Tuesday 9am)",
    "callToAction": "string (the specific CTA embedded in this post)"
  }
]

Rules for each post:
- Each post must sound like it was written by the specific person in the profile above
- Vary the format: some with short paragraphs, some with numbered points, some as narrative
- Include a strong, specific call-to-action in each post body
- Do not use bullet points starting with dashes - use numbered lists or plain paragraphs
- Hashtags must be relevant, lowercase, no spaces (e.g. productmanagement, leadership)
- Image prompts must describe a scene or visual metaphor only - NEVER describe text or words that should appear in the image

Return ONLY the JSON array. No markdown. No explanation. No emojis.`;
}

// ─── Single Image Brief Prompt ────────────────────────────────────────────────
// Reads a post and designs a content-aware, text-bearing image (quote/title card).
// Returns JSON: { headline, visual, palette, textPosition }.

export function buildImageBriefPrompt(
  title: string,
  body: string,
  postType: string,
  industry: string,
  userProfile?: UserVisualProfile
): string {
  const visualStyle = userProfile ? deriveVisualStyle(userProfile) : "";
  const profileBlock = visualStyle ? `\nUSER VISUAL PROFILE (personalize the image to match this person's brand):\n${visualStyle}\n` : "";

  // Mood-based palette guidance per post type
  const paletteSuggestions: Record<string, string> = {
    "thought-leadership": "deep indigo #3730A3, slate charcoal #1E293B, or rich emerald #065F46 with warm neutrals",
    "tips": "energetic teal #0D9488, coral #F97316, or vibrant amber #D97706 with clean whites",
    "story": "warm terracotta #C2410C, soft rose #BE185D, or golden ochre #B45309 with creamy neutrals",
    "question": "curious violet #7C3AED, deep teal #0F766E, or bold magenta #A21CAF with soft greys",
    "listicle": "fresh sage #4D7C0F, bright cyan #0891B2, or punchy blue #2563EB with crisp whites",
  };
  const moodHint = paletteSuggestions[postType] || "a unique, mood-appropriate palette with rich, distinctive colors";

  return `You are an art director for premium LinkedIn graphics. Read the LinkedIn post below and design a single square (1:1) feed image that visually represents THIS post's actual subject and message, with one short headline rendered on it as an elegant text overlay.

POST TITLE (hook): ${title}
POST BODY: ${body}
POST TYPE: ${postType}
INDUSTRY: ${industry || "business"}
${profileBlock}
Produce a brief as a JSON object with this EXACT structure:
{
  "headline": "string",
  "visual": "string",
  "palette": "string",
  "textPosition": "string"
}

FIELD DEFINITIONS AND CONSTRAINTS:
- "headline": The single most important hook or takeaway of THIS specific post, distilled to between 2 and 5 words and at most 28 characters total. Never more than 5 words. This is NOT the title - compress the core idea into your own words, never copy the title verbatim. Prefer short, common words; avoid any word longer than 12 letters and avoid long numbers, decimals, multi-digit percentages, currency, and dates, because they render incorrectly. Short numbers are fine, for example "3 Hiring Mistakes" or "80/20 Rule". If the post body is empty or very short, derive the headline from the title alone and do not invent facts. If postType is "question", make the headline a short, punchy version of the post's core question ending in a single question mark. Use Title Case. No quotation marks, no hashtags, no ending punctuation except that one question mark. This exact text is rendered on the image, so spell every word correctly.
- "visual": One concrete, vivid scene that depicts what THIS post is actually about - the real situation, action, object, person, or environment the post describes. If the post discusses a technical concept, tool, framework, or methodology, depict recognizable domain-specific imagery from the ${industry || "business"} field - actual tools, environments, objects, or scenarios that practitioners would immediately recognize, not a disconnected generic metaphor. Never use a generic office, boardroom, handshake, lightbulb, gear, chess piece, rocket, or upward arrow. Choose subjects that do NOT naturally contain text: prefer people, hands, objects, environments, or simplified abstract geometric forms. Commit to ONE visual register that matches the user's brand personality (clean editorial photography, cinematic storytelling, or modern flat vector illustration). Describe the subject, composition, lighting, and mood in vivid detail with specific colors and textures. State where clear negative space sits for the headline overlay. The visual scene MUST be the hero element - occupying at least 65-70 percent of the frame. Do NOT describe or reference any text, words, letters, numbers, logos, or signage inside the scene. At most 50 words, one single-line sentence.
- "palette": Describe a DISTINCTIVE colour mood and atmosphere that emotionally matches THIS specific post - for example "warm golden-hour light with deep teal shadows" or "moody cool blues lifted by one warm amber glow". Draw inspiration from rich colour stories like ${moodHint}, but express it as the lighting and atmosphere of a real scene, NOT as flat background fills. EVERY post must get a clearly DIFFERENT mood - never the same colours twice, and never plain grey-on-white. This guides the overall tone and the small headline panel; the scene's own natural colours should carry most of the frame. At most 30 words, one single-line sentence.
- "textPosition": Choose the BEST placement for the headline based on where the visual subject sits and where negative space naturally falls. Pick exactly one: "top-center", "bottom-center", "bottom-left", "center-left", or "overlay-center". Vary this based on the scene composition - do NOT always pick the same position.

GUARDRAILS:
- Use plain hyphens only, never em-dashes or en-dashes.
- Professional, human tone. No buzzwords.
- The "headline" is the ONLY text intended for the image. Do not invent any captions, subtext, labels, or secondary lines.
- The visual scene must be vivid, colorful, and visually rich - not a bland neutral-toned stock photo.

${NO_EMOJI_RULES}

All string values must be single-line plain text with no line breaks and no double-quote characters inside them. Do not include trailing commas. The response must be a single JSON object parseable by JSON.parse with no preprocessing.

Return ONLY valid JSON. No markdown fences. No explanation. No emojis. Use plain hyphens, never em-dashes.`;
}

// ─── Carousel Slide Plan Prompt ───────────────────────────────────────────────
// Breaks ONE post into a cohesive multi-slide walkthrough (hook -> points -> CTA).
// Returns JSON: { palette, slides: [{ headline, visual, textPosition }] }.

export function buildCarouselPlanPrompt(
  title: string,
  body: string,
  postType: string,
  industry: string,
  count: number = 4,
  userProfile?: UserVisualProfile
): string {
  const visualStyle = userProfile ? deriveVisualStyle(userProfile) : "";
  const profileBlock = visualStyle ? `\nUSER VISUAL PROFILE (personalize the carousel to match this person's brand):\n${visualStyle}\n` : "";

  return `You are an expert LinkedIn carousel designer. Turn ONE LinkedIn post into a cohesive, visually stunning image carousel of up to ${count} slides that walks the reader through THIS post's actual content.

THE POST:
Title (hook): ${title}
Body: ${body}
Post type: ${postType}
Industry: ${industry || "business"}
${profileBlock}
YOUR JOB:
Read the post above and break ITS real content into slides. Do not invent a generic or unrelated metaphor - every slide must represent something the post actually says.

SLIDE ARC (must follow in this order):
- The FIRST slide is the HOOK: the single most important highlight or opening idea of the post.
- Every slide in between is ONE distinct key point from the post, in the SAME ORDER it appears in the body.
- The LAST slide is the TAKEAWAY or CALL TO ACTION that closes the post.

HOW MANY SLIDES:
- Produce between 2 and ${count} slides. Use ${count} only if the post genuinely has that many distinct points. If it has fewer, emit fewer (always at least a hook slide and a takeaway slide) rather than padding or repeating. If the body is empty or very short, build a minimal hook and takeaway from the title alone and do not invent facts, stats, or claims that are not in the post.

ONE SHARED LOOK (this is what makes it a cohesive set):
- Choose ONE distinctive colour mood and ONE visual style for the whole carousel - describe it as the lighting and atmosphere of real scenes (for example "warm sunrise tones with deep shadow contrast"), NOT as flat background fills. Pick a mood that matches the post's topic and energy, clearly different from a generic blue or grey. Describe it once in "palette" and let every slide share that same atmosphere while the scenes' own natural colours carry the frames.
- All slides share the SAME compositional grid and consistent headline placement. Vary only the subject and imagery per slide; keep type placement, margins, and visual rhythm identical across all slides.
- Modern, clean, premium, on-brand. Commit to ONE visual register for the whole set that matches the user's brand personality.
- The visual scene must be the hero of each slide - occupying at least 65% of the frame area. Headlines are elegant overlays, not the dominant element.

EACH SLIDE NEEDS:
- "headline": the ONLY text that should appear on that slide. Between 2 and 5 words, never more than 5, and at most 28 characters total. Punchy, spelled exactly, capturing that slide's one idea. Prefer short common words; avoid words longer than 12 letters and avoid long numbers, decimals, multi-digit percentages, currency, and dates. Use Title Case. No quotation marks, no hashtags, no emojis.
- "visual": ONE vivid single-line sentence describing a concrete scene, subject, or object drawn from the post's content that represents THIS slide's idea. If the post discusses technical concepts, depict domain-specific imagery from the ${industry || "business"} field. Choose subjects that do not naturally contain text, and prefer people, hands, objects, environments, or simplified abstract forms. Describe the scene with specific colors, textures, and lighting. Do NOT describe, spell, or reference any text, words, letters, or numbers to render. At most 50 words.
- "textPosition": choose the best headline placement for this slide's composition: "top-center", "bottom-center", "bottom-left", or "center-left". Keep it consistent across all slides in this carousel.

GUARDRAILS:
- Use plain hyphens only, never em-dashes or en-dashes.

${NO_EMOJI_RULES}

Return a JSON object with this EXACT structure (the "slides" array holds between 2 and ${count} objects):
{
  "palette": "string (the one shared colour mood and visual style described as scene lighting and atmosphere, reused by every slide)",
  "slides": [
    { "headline": "string (2-5 words, max 28 chars, the ONLY text on this slide)", "visual": "string (one vivid concrete scene from the post with specific details)", "textPosition": "string (top-center, bottom-center, bottom-left, or center-left)" }
  ]
}

All string values must be single-line plain text with no line breaks and no double-quote characters inside them. Do not include trailing commas. The response must be a single JSON object parseable by JSON.parse with no preprocessing.

Return ONLY valid JSON. No markdown fences. No explanation. No emojis. Use plain hyphens, never em-dashes.`;
}

// ─── Single Post Regeneration ─────────────────────────────────────────────────

export function buildSinglePostPrompt(
  profileContext: string,
  title: string,
  postType: string,
  theme: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);

  return `You are an expert LinkedIn ghostwriter. Regenerate a single LinkedIn post with a fresh perspective.

PROFESSIONAL PROFILE:
${profileContext}

POST TOPIC: ${title}
POST TYPE: ${postType}
THEME: ${theme}

${rules}

Generate the post as a JSON object:
{
  "title": "string (compelling opening hook, max 150 chars)",
  "body": "string (full post body, max 1300 characters, use line breaks for readability)",
  "hashtags": ["string", "string", "string", "string", "string"],
  "imagePrompt": "string (short visual concept - describe a scene or metaphor, NO text/words to render)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}

// ─── Variant Post Prompt (A/B Testing) ───────────────────────────────────────

const VARIANT_STYLES: Record<string, string> = {
  "Bold & Direct": `STYLE: Bold & Direct
- Open with a strong, declarative statement or contrarian take
- Use confident, assertive language throughout
- Short, punchy paragraphs (1-2 sentences max)
- End with a direct challenge or provocative question
- Tone: commanding, no hedging, no "I think" - state it as fact`,

  "Personal Story": `STYLE: Personal Story
- Open with a first-person anecdote or a specific moment in time ("Last Tuesday, I...")
- Build a narrative arc: setup → tension → insight
- Use conversational, reflective tone
- Include a personal lesson or vulnerability
- End with how this experience changed your perspective`,

  "Practical & Tactical": `STYLE: Practical & Tactical
- Lead with the specific problem this solves
- Use numbered steps or a clear framework
- Include concrete examples, numbers, or tools
- Every sentence should be actionable - no fluff
- End with a quick-win the reader can apply today`,
};

export const VARIANT_STYLE_NAMES = Object.keys(VARIANT_STYLES);

export function buildVariantPostPrompt(
  profileContext: string,
  title: string,
  postType: string,
  theme: string,
  variantStyle: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);
  const styleInstructions = VARIANT_STYLES[variantStyle] ?? "";

  return `You are an expert LinkedIn ghostwriter. Create a LinkedIn post with a specific style and voice.

PROFESSIONAL PROFILE:
${profileContext}

POST TOPIC: ${title}
POST TYPE: ${postType}
THEME: ${theme}

${styleInstructions}

${rules}

Generate the post as a JSON object:
{
  "title": "string (compelling opening hook matching the style above, max 150 chars)",
  "body": "string (full post body, max 1300 characters, use line breaks for readability)",
  "hashtags": ["string", "string", "string", "string", "string"],
  "imagePrompt": "string (short visual concept - describe a scene or metaphor, NO text/words to render)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}

// ─── Content Repurposing ─────────────────────────────────────────────────────

const REPURPOSE_FORMATS: Record<string, { instructions: string; jsonShape: string }> = {
  "twitter-thread": {
    instructions: `FORMAT: Twitter/X Thread
- Break the content into 3-5 tweets
- Each tweet must be under 280 characters
- First tweet must be a strong hook that stands alone
- Number each tweet (1/N format)
- Maintain thread coherence - each tweet should flow naturally to the next
- Last tweet should have a CTA or key takeaway
- Include 1-2 relevant hashtags only in the last tweet`,
    jsonShape: `{ "tweets": ["string (tweet 1 - max 280 chars)", "string (tweet 2)", "..."] }`,
  },

  "blog-post": {
    instructions: `FORMAT: Blog Post
- Expand the LinkedIn post into a 600-800 word article
- Include a compelling title (H1) and 2-3 subheadings (H2 - prefix with ##)
- Write an engaging introduction paragraph (2-3 sentences)
- Develop each section with depth, examples, and practical insights
- Write a conclusion with a clear takeaway or CTA
- Use SEO-friendly language and natural keyword placement
- Do NOT use bullet points - use flowing paragraphs`,
    jsonShape: `{ "title": "string (SEO-friendly blog title)", "content": "string (full article with ## for H2 headings)" }`,
  },

  "email-newsletter": {
    instructions: `FORMAT: Email Newsletter Section
- Create a subject line (max 50 chars, compelling, no clickbait)
- Create a preview text (max 90 chars, complements the subject)
- Write the body as 2-3 paragraphs suitable for email
- Include a clear CTA (call-to-action) with specific action text
- Tone should be slightly more personal than LinkedIn - like writing to a subscriber
- Keep total body under 300 words`,
    jsonShape: `{ "subjectLine": "string (max 50 chars)", "previewText": "string (max 90 chars)", "body": "string (2-3 paragraphs)", "cta": "string (call-to-action text)" }`,
  },
};

export const REPURPOSE_FORMAT_NAMES = Object.keys(REPURPOSE_FORMATS);

export function buildRepurposePrompt(
  profileContext: string,
  postTitle: string,
  postBody: string,
  hashtags: string[],
  targetFormat: string,
  humanMode: boolean = false
): string {
  const rules = getRules(humanMode);
  const fmt = REPURPOSE_FORMATS[targetFormat];
  if (!fmt) throw new Error(`Unknown repurpose format: ${targetFormat}`);

  return `You are an expert content repurposing specialist. Convert the following LinkedIn post into a different format.

PROFESSIONAL PROFILE:
${profileContext}

ORIGINAL LINKEDIN POST:
Title: ${postTitle}
Body: ${postBody}
Hashtags: ${hashtags.map((h) => `#${h}`).join(" ")}

${fmt.instructions}

${rules}

Generate the repurposed content as a JSON object:
${fmt.jsonShape}

Return ONLY valid JSON. No markdown fences. No explanation. No emojis.`;
}

// ─── Newsletter Prompt ────────────────────────────────────────────────────────

export function buildNewsletterPrompt(
  profileContext: string,
  pillars: object[],
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  });

  return `You are an expert newsletter writer for LinkedIn professionals. Create a compelling ${monthName} ${year} LinkedIn newsletter.

PROFESSIONAL PROFILE:
${profileContext}

CONTENT PILLARS:
${JSON.stringify(pillars, null, 2)}

${NO_EMOJI_RULES}

Generate a full newsletter as a JSON object:
{
  "title": "string (newsletter name or edition title)",
  "subject": "string (email subject line, compelling, max 60 chars)",
  "intro": {
    "hook": "string (attention-grabbing opening paragraph, 2-3 sentences)",
    "preview": "string (what readers will get from this edition)"
  },
  "sections": [
    {
      "heading": "string",
      "content": "string (2-3 paragraphs of valuable insights, written like a human expert)",
      "keyTakeaway": "string (one sentence the reader should remember)"
    },
    {
      "heading": "string",
      "content": "string",
      "keyTakeaway": "string"
    },
    {
      "heading": "string",
      "content": "string",
      "keyTakeaway": "string"
    }
  ],
  "featuredInsight": {
    "quote": "string (a powerful insight or real stat, not a platitude)",
    "context": "string (why this matters)"
  },
  "cta": {
    "heading": "string",
    "text": "string (what action to take and why)",
    "action": "string (specific next step)"
  },
  "signoff": "string (personal, warm sign-off - 1-2 sentences)"
}

Return ONLY valid JSON. No markdown. No explanation. No emojis.`;
}
