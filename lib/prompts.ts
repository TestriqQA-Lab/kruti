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
- Keep it understated: simple short paragraphs, a small line gap between them, no hype
`.trim();

// AI MODE = the opposite of Human Mode. Polished, scannable, emoji-led,
// high-engagement LinkedIn style. Used ONLY when humanMode is OFF.
const AI_MODE_RULES = `
AI MODE ACTIVE - POLISHED, HIGH-ENGAGEMENT LINKEDIN STYLE:
- This is the energetic, scannable AI style (NOT the understated human style)
- Open with a punchy one-line hook led by a single relevant emoji (e.g. 🚀, 💡, 🎯)
- Use short, scannable lines with generous line breaks between thoughts
- For any list of points or achievements, put each on its own line starting with a ✅ checkmark
- Use a few tasteful, relevant emojis throughout (4-8 total — never spammy, never random)
- Build momentum and END the body with a short engagement question that invites comments (you may add 👇)
- Confident, upbeat and shareable tone
- Still avoid the most obvious corporate buzzwords (synergy, leverage, game-changer) — stay punchy but genuine
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRules(humanMode: boolean): string {
  return humanMode
    ? `${NO_EMOJI_RULES}\n\n${HUMAN_MODE_RULES}`
    : NO_EMOJI_RULES;
}

// Post-style rules. Human mode = understated, no-emoji, human voice.
// AI mode (humanMode OFF) = polished emoji + ✅ checkmark + engagement-question
// style. This is what makes the two post examples look different.
function getPostRules(humanMode: boolean): string {
  return humanMode
    ? `${NO_EMOJI_RULES}\n\n${HUMAN_MODE_RULES}`
    : AI_MODE_RULES;
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
Week ${i + 1} — ${w.weekStart}:
  Theme: "${w.weekTheme}"
  Focus: "${w.weekFocus}"
  Posts: ${w.postTitles.map((t) => `"${t}"`).join(", ")}
  Types used: ${w.postTypes.join(", ")}`
  )
  .join("\n")}

IMPORTANT CONTINUITY RULES:
- Do NOT repeat the same weekly theme or focus from previous weeks
- Build upon the narrative arc — this week should feel like a natural progression
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
  "weekTheme": "string (overarching theme — must be DIFFERENT from previous batches)",
  "weekFocus": "string (specific angle or narrative arc — must be a FRESH perspective)",
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
  const rules = getPostRules(humanMode);

  // Mode-aware formatting + hashtag guidance — this is what makes Human and
  // AI posts visibly different.
  const formatRule = humanMode
    ? `- Do NOT use emojis or decorative/symbol bullets — write plain, natural paragraphs (numbered lists are fine)
- Keep it understated and human; no hype
- Do NOT use hashtags: set the "hashtags" field to an empty array []`
    : `- Open the hook with a single relevant emoji (e.g. 🚀, 💡, 🎯)
- When listing achievements or points, put each on its own line prefixed with a ✅ checkmark
- Use a few tasteful, relevant emojis (4-8 total, never spammy)
- END the body with a short engagement question inviting comments (you may add 👇)
- Provide 3-5 relevant lowercase hashtags (no spaces) in the "hashtags" field`;

  const closing = humanMode
    ? "Return ONLY the JSON array. No markdown. No explanation. No emojis."
    : "Return ONLY the JSON array. No markdown. No explanation.";

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
    "imagePrompt": "string (a short 1-2 sentence visual concept — describe the SCENE or METAPHOR, not text to display. Example: 'A lighthouse beam cutting through fog at dawn, symbolizing guidance' NOT 'An image showing the words Leadership Matters')",
    "bestTimeToPost": "string (e.g. Tuesday 9am)",
    "callToAction": "string (the specific CTA embedded in this post)"
  }
]

Rules for each post:
- Each post must sound like it was written by the specific person in the profile above
- Vary the format across the set (short paragraphs, numbered points, narrative)
- Include a strong, specific call-to-action in each post body
${formatRule}
- Image prompts must describe a scene or visual metaphor only — NEVER describe text or words that should appear in the image

${closing}`;
}

// ─── Single Post Regeneration ─────────────────────────────────────────────────

export function buildSinglePostPrompt(
  profileContext: string,
  title: string,
  postType: string,
  theme: string,
  humanMode: boolean = false
): string {
  const rules = getPostRules(humanMode);

  const styleRule = humanMode
    ? `- Do NOT use emojis or symbol bullets — plain, natural, human paragraphs
- Do NOT use hashtags: set the "hashtags" field to an empty array []`
    : `- Open with a relevant emoji hook, use ✅ checkmark bullets for any list, sprinkle a few tasteful emojis, and END with an engagement question (you may add 👇)
- Provide 3-5 relevant lowercase hashtags in the "hashtags" field`;

  const closing = humanMode
    ? "Return ONLY valid JSON. No markdown. No explanation. No emojis."
    : "Return ONLY valid JSON. No markdown. No explanation.";

  return `You are an expert LinkedIn ghostwriter. Regenerate a single LinkedIn post with a fresh perspective.

PROFESSIONAL PROFILE:
${profileContext}

POST TOPIC: ${title}
POST TYPE: ${postType}
THEME: ${theme}

${rules}

STYLE FOR THIS POST:
${styleRule}

Generate the post as a JSON object:
{
  "title": "string (compelling opening hook, max 150 chars)",
  "body": "string (full post body, max 1300 characters, use line breaks for readability)",
  "hashtags": ["string", "string", "string", "string", "string"],
  "imagePrompt": "string (short visual concept — describe a scene or metaphor, NO text/words to render)"
}

${closing}`;
}

// ─── Variant Post Prompt (A/B Testing) ───────────────────────────────────────

const VARIANT_STYLES: Record<string, string> = {
  "Bold & Direct": `STYLE: Bold & Direct
- Open with a strong, declarative statement or contrarian take
- Use confident, assertive language throughout
- Short, punchy paragraphs (1-2 sentences max)
- End with a direct challenge or provocative question
- Tone: commanding, no hedging, no "I think" — state it as fact`,

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
- Every sentence should be actionable — no fluff
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
  "imagePrompt": "string (short visual concept — describe a scene or metaphor, NO text/words to render)"
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
- Maintain thread coherence — each tweet should flow naturally to the next
- Last tweet should have a CTA or key takeaway
- Include 1-2 relevant hashtags only in the last tweet`,
    jsonShape: `{ "tweets": ["string (tweet 1 — max 280 chars)", "string (tweet 2)", "..."] }`,
  },

  "blog-post": {
    instructions: `FORMAT: Blog Post
- Expand the LinkedIn post into a 600-800 word article
- Include a compelling title (H1) and 2-3 subheadings (H2 — prefix with ##)
- Write an engaging introduction paragraph (2-3 sentences)
- Develop each section with depth, examples, and practical insights
- Write a conclusion with a clear takeaway or CTA
- Use SEO-friendly language and natural keyword placement
- Do NOT use bullet points — use flowing paragraphs`,
    jsonShape: `{ "title": "string (SEO-friendly blog title)", "content": "string (full article with ## for H2 headings)" }`,
  },

  "email-newsletter": {
    instructions: `FORMAT: Email Newsletter Section
- Create a subject line (max 50 chars, compelling, no clickbait)
- Create a preview text (max 90 chars, complements the subject)
- Write the body as 2-3 paragraphs suitable for email
- Include a clear CTA (call-to-action) with specific action text
- Tone should be slightly more personal than LinkedIn — like writing to a subscriber
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