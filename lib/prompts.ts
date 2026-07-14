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
  headline?: string | null; // the person's actual ROLE (e.g. "SEO Analyst") - drives the imagery
}

/**
 * Derives a visual style direction block for image prompts based on the user's
 * profile. The subject vocabulary is driven by the person's actual ROLE (their
 * headline/title), NOT a generic industry stereotype, so images match what they
 * really do - an SEO analyst and a backend engineer in "technology" get different
 * imagery. This keeps each user's images personal, on-brand, and role-accurate.
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
    parts.push("Visual register: dynamic, confident compositions with energy and momentum, grounded in real, believable scenes.");
  } else {
    parts.push("Visual register: clean, professional editorial photography or simple flat illustration.");
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

  // Subject vocabulary from the person's actual ROLE (their headline/title), NOT a
  // generic industry stereotype. Two people in the same industry - say an SEO analyst
  // and a backend engineer, both in "technology" - do completely different work, so the
  // imagery must follow what THIS person actually does, never the field's cliche.
  const role = (profile.headline || "").trim();
  const industry = (profile.industry || "").trim();
  if (role) {
    parts.push(
      `Subject vocabulary: build the imagery from the real tools, screens, artifacts, and day-to-day scenarios of THIS person's actual role - "${role}". Do NOT default to a generic ${industry || "industry"} stereotype (for example circuit boards, chips, or wires just because the field is technology); show what this specific role genuinely works with.`
    );
  } else if (industry) {
    parts.push(
      `Subject vocabulary: use objects, tools, and scenarios that match what a ${industry} professional actually does day to day, matched to their real work rather than a generic stereotype of the field.`
    );
  }

  return parts.length > 0 ? parts.join("\n") : "";
}

export const ALL_POST_TYPES = ["thought-leadership", "tips", "story", "question", "listicle"];

// Explicit map: each onboarding content style -> the post type(s) it should
// produce. Keys are lowercased for case-insensitive matching against the stored
// style labels. This is the ONLY source of which post types are allowed, so the
// user's onboarding selection is respected strictly - no extra types are added.
const STYLE_TO_POST_TYPES: Record<string, string[]> = {
  "problem agitation solution": ["tips"],
  "narrative / story": ["story"],
  "list / tips": ["listicle", "tips"],
  "data-driven insights": ["listicle"],
  "personal story": ["story"],
  "case study": ["listicle"],
  "how-to / tutorial": ["tips"],
  "motivational": ["thought-leadership"],
  "contrarian take": ["thought-leadership"],
  "q&a format": ["question"],
  "behind the scenes": ["story"],
  "predictions & trends": ["thought-leadership"],
  "lessons learned": ["story"],
  "social proof / results": ["listicle"],
};

// One concrete writing directive per onboarding content style. This is what makes
// the user's ACTUAL selection drive each post: instead of flattening 14 styles into
// 5 coarse post types, each post is written genuinely in the style the user picked.
// Keys are lowercased to match the stored style labels case-insensitively.
export const STYLE_DIRECTIVES: Record<string, string> = {
  "behind the scenes": "Take the reader inside a real process - show the messy middle, the decision, the trade-off, not a polished result. Do NOT open with a statistic.",
  "contrarian take": "Challenge a widely held belief in this field; lead with the counter-position and defend it. Open with the claim, not a number.",
  "personal story": "Tell one specific first-person moment with a turn and a lesson. Open with the scene, not a number.",
  "narrative / story": "Use a narrative arc - setup, tension, resolution - anchored in a concrete situation. Open with the scene, not a number.",
  "lessons learned": "Frame around a mistake or hard-won lesson and the principle it taught. Open with the moment, not a number.",
  "data-driven insights": "Build the post around ONE notable figure from the brief and the practitioner 'so what' behind it. A number here is appropriate.",
  "case study": "Walk through one real situation: problem, what was done, outcome. A specific result is fine but the story carries it.",
  "social proof / results": "Center a concrete result or outcome and what made it possible. A result figure is fine; do not stack multiple stats.",
  "how-to / tutorial": "Give a clear, ordered, do-this-next set of steps the reader can act on today.",
  "problem agitation solution": "Name the painful problem sharply, sit in it briefly, then deliver a concrete fix.",
  "motivational": "Land one earned, specific point of conviction grounded in real practice - no platitudes, no inspirational filler.",
  "predictions & trends": "Make one defensible forward-looking claim about where this field is heading and why.",
  "q&a format": "Pose one real question this audience actually asks, then answer it with practitioner depth.",
  "list / tips": "Give a tight numbered set of genuinely useful, non-obvious tips.",
};

/**
 * Returns the user's literal selected style labels (order preserved), e.g.
 * ["Contrarian Take", "Behind the Scenes"]. Safe against null and malformed JSON.
 */
export function parseSelectedStyles(contentStylesStr: string | null | undefined): string[] {
  if (!contentStylesStr) return [];
  try {
    const v = JSON.parse(contentStylesStr);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * The single source of truth for which style each post in a batch is written in.
 * Cycles the user's literal selected styles round-robin (falling back to the coarse
 * post types only when no styles are stored). buildPostsPrompt uses this to build the
 * per-post plan, and the posts route uses the SAME assignment to persist each post's
 * style - so the badge shown to the user matches the style the post was written in.
 */
export function assignPostStyles(
  selectedStyles: string[],
  postTypes: string[],
  postCount: number
): string[] {
  const rotation = selectedStyles.length > 0 ? selectedStyles : postTypes;
  return Array.from({ length: postCount }, (_, i) =>
    rotation.length > 0 ? rotation[i % rotation.length] : "thought-leadership"
  );
}

/**
 * Map the user's selected onboarding content styles to the LinkedIn post types
 * that may be generated. Returns ONLY the types for the styles the user actually
 * selected (deduplicated) - nothing extra is ever added. If no styles are stored
 * or none are recognized, falls back to all types as a safe default.
 */
export function deriveAllowedPostTypes(contentStylesStr: string | null | undefined): string[] {
  if (!contentStylesStr) return ALL_POST_TYPES;

  let styles: unknown;
  try {
    styles = JSON.parse(contentStylesStr);
  } catch {
    return ALL_POST_TYPES;
  }
  if (!Array.isArray(styles) || styles.length === 0) return ALL_POST_TYPES;

  const allowed = new Set<string>();
  for (const style of styles) {
    const types = STYLE_TO_POST_TYPES[String(style).trim().toLowerCase()];
    if (types) types.forEach((t) => allowed.add(t));
  }

  // Only fall back to the full set if nothing mapped (e.g. unrecognized labels),
  // so we never end up with zero allowed types.
  return allowed.size > 0 ? Array.from(allowed) : ALL_POST_TYPES;
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

CONTINUITY RULES (read the history above carefully before deciding this week):
- Same overarching journey, new chapter: the weekTheme and weekFocus must be a topic not yet covered and clearly DIFFERENT from every previous week listed (not a reworded version of one already used), but they should advance the same audience relationship rather than reset it.
- Treat the weeks above as one ongoing arc. This week should read like the natural next chapter, deepening the audience's understanding.
- Pick a fresh angle, sub-topic, or stage of the journey within this person's expertise that the previous weeks have not yet covered.
- Look at the post types already used. If recent weeks leaned heavily on one or two types, deliberately rebalance the mix this week so the feed does not feel repetitive.
- It is good to occasionally reference or build on an idea from a previous week, but never to repeat it.
`;
  }

  return `You are one of the most sought-after LinkedIn content strategists in the world. Founders and senior operators pay you to turn their raw expertise into a weekly content plan that builds genuine authority and pipeline. You do not produce generic "post 3x a week about your industry" advice. Every plan you build is engineered around the specific human in front of you - their positioning, their goals, the exact pains their audience feels, and the voice they actually speak in.

Your task: design a sharp, personalized content strategy for the next 5 weekdays starting ${weekLabel}, built end to end around THIS person.

PROFESSIONAL PROFILE:
${profileContext}
${previousContext}
BEFORE WRITING (think through these, but output ONLY the final JSON - never print your reasoning):
1. Positioning first. Read the Content positioning, Headline, Summary and Skills. The whole week must reinforce how this person wants to be seen (for example a Thought Leader earns a point-of-view-led plan, an Industry Expert earns a credibility-and-proof-led plan). Do not drift into generic motivation.
2. Anchor to goals. Tie weekTheme, weeklyGoal and callToAction directly to this person's stated LinkedIn goals. The week should visibly move them toward those goals, not just "get engagement".
3. Audience pain over topic dumps. Identify the real, specific problems and desired outcomes of the stated target audience - the things that keep them up at night and the wins they want. Every pillar must map to a real pain or aspiration of THIS audience, expressed in concrete language, never vague filler like "stay relevant" or "grow your career".
4. Lean on their actual expertise. The pillars must draw on the person's specific Skills, Industry and experience so the week can only have been planned for them - someone in a different field could not reuse it.
5. Voice and tone are non-negotiable. The tone block must reflect this person's real voice. Honor the VOICE AND TONE direction stated in the profile above, and reconcile it with the Content positioning. The tone.voice and tone.style you set will steer every post that gets written this week, so make them specific and true to this person, not a generic "professional and engaging".
6. Make the week cohesive. The pillars, post mix and theme should feel like one intentional arc for the week, not five unrelated topics. The weekFocus is the through-line that connects them.
7. Choose post types from the allowed set only, weighting them toward what best serves this person's positioning and this week's focus.

QUALITY BAR:
- Specific over generic. Anything you write here could only fit THIS person and THIS audience. If a line would fit any random professional, rewrite it.
- Concrete pains and outcomes, in the audience's own words.
- A point of view, not a syllabus. The week should take a stance worth following.
- No fabrication: do not invent credentials, employers, results, or numbers that are not implied by the profile. Set direction here; the actual facts and stats come later from research.

${NO_EMOJI_RULES}

Generate the content strategy as a JSON object with this EXACT structure:
{
  "weekTheme": "string (the overarching theme for the week, tied to this person's positioning and goals - must be DIFFERENT from any previous week)",
  "weekFocus": "string (the specific angle or narrative arc that connects the week - a FRESH perspective, not a reworded previous focus)",
  "pillars": [
    {
      "name": "string (content pillar name, grounded in this person's expertise)",
      "description": "string (what this pillar covers and which specific audience pain or desired outcome it serves)",
      "percentage": number (percent of posts for this pillar, all pillar percentages must sum to 100)
    }
  ],
  "audience": {
    "primaryAudience": "string (the specific target audience for this week)",
    "painPoints": ["string (a real, concrete problem this audience faces)"],
    "desiredOutcomes": ["string (a specific outcome this audience wants)"]
  },
  "tone": {
    "voice": "string (this person's actual voice, reflecting their positioning and the profile's stated tone, e.g. 'Direct and confident, with hard-won practitioner credibility')",
    "style": "string (how the posts should read in practice, e.g. 'Plain-spoken, example-led, one strong idea per post')",
    "avoid": ["string (specific things to avoid that would break this person's voice or credibility)"]
  },
  "postTypes": ${JSON.stringify(allowedTypes)},
  "postMix": {
    ${allowedTypes.map((t) => `"${t}": number`).join(",\n    ")}
  },
  "weeklyGoal": "string (what success looks like this week, tied directly to this person's LinkedIn goals)",
  "callToAction": "string (the primary call-to-action to carry through the week, serving the weekly goal)"
}

For "postMix": each value is a percentage (0-100), and all postMix values must sum to 100. Use the exact string keys shown.

All string values must be single-line plain text with no double-quote characters inside them. Do not include trailing commas. The output must parse with JSON.parse.

Return ONLY valid JSON. No markdown fences. No explanation. No emojis.`;
}

// ─── Posts Prompt ────────────────────────────────────────────────────────────

export function buildPostsPrompt(
  profileContext: string,
  weekTheme: string,
  weekFocus: string,
  postTypes: string[],
  strategy: object,
  humanMode: boolean = true,
  postCount: number = 5,
  allowedTypes: string[] = ["thought-leadership", "tips", "story", "question", "listicle"],
  researchBrief: string = "",
  selectedStyles: string[] = []
): string {
  const rules = getRules(humanMode);

  // Per-post style plan: assign each post a distinct style the user actually chose
  // (e.g. "Behind the Scenes", "Contrarian Take") so the batch reads as different
  // shapes, not one repeated post type. Uses the shared assignPostStyles so the saved
  // post.style (set in the route) matches what the writer was told for each post.
  const perPostStyles = assignPostStyles(selectedStyles, postTypes, postCount);
  const perPostPlan = perPostStyles
    .map((style, i) => {
      const directive = STYLE_DIRECTIVES[String(style).trim().toLowerCase()] ?? "";
      return `Post ${i + 1} - STYLE: ${style}${directive ? ` - ${directive}` : ""}`;
    })
    .join("\n");

  const researchBlock = researchBrief.trim()
    ? `RESEARCH BRIEF (real, current, verified facts gathered for this batch - your source of truth):
${researchBrief.trim()}

HOW TO USE THE RESEARCH BRIEF:
- Ground the posts in the specific facts, mechanisms, examples, and expert interpretation above. Most posts should make their point qualitatively; reach for a number only when it is genuinely the sharpest way to make THIS post's point. What separates an expert post from filler is sharp insight and concrete detail, not the presence of a statistic.
- Use stats and facts only as they appear in the brief. Do NOT round, inflate, reshape, or "improve" any number.
- Do NOT invent statistics, studies, dates, company names, or quotes that are not in the brief. If you want to make a point the brief does not support with a number, make it qualitatively instead - never with a fabricated figure.
- If a heading in the brief says no reliable current data was found, treat that area as having no usable numbers and make the point qualitatively.
- You do not need to cram every fact in. Pick the few most relevant, surprising, or useful points for this person's audience and build real insight around them.
- Add this person's own expert interpretation on top of the facts - the "so what" and "what to do about it" that only a practitioner in their field would know.
- Do not name a specific source or report unless the brief names it. When you reference a finding, paraphrase it in plain language (for example, research from last year found...) rather than inventing a precise citation string.`
    : `NO RESEARCH BRIEF WAS PROVIDED FOR THIS BATCH:
- Write from genuine, specific domain expertise in this person's field.
- Because there is no brief this batch, do not present ANY statistic, percentage, study, or dated claim as sourced. Speak from mechanism, real-world scenarios, and lived practitioner detail only.
- Do NOT fabricate statistics, studies, percentages, dates, or named sources to sound authoritative. If you cannot cite a real figure, make the point qualitatively with concrete, hard-won detail instead.`;

  return `You are a world-class LinkedIn ghostwriter writing AS the specific person described in the profile below. You are not a generic AI assistant - you are this person's voice. Every post must read like a sharp, credible human expert in their field wrote it in their own tone, for the exact audience they care about. Create ${postCount} original, genuinely valuable LinkedIn posts for their scheduled posting days.

PROFESSIONAL PROFILE (write in THIS person's voice, tone, and positioning - match their tone preferences exactly):
${profileContext}

THEME: "${weekTheme}"
FOCUS: "${weekFocus}"

PER-POST STYLE PLAN (write each post genuinely in its assigned style - the ${postCount} posts must read as clearly DIFFERENT shapes, not the same template with different words):
${perPostPlan}

Use the tone.voice, tone.style and tone.avoid fields from the strategy below as hard constraints on how this week's posts read - the avoid list names things you must NOT do.
STRATEGY CONTEXT: ${JSON.stringify(strategy)}

${researchBlock}

WHAT MAKES THESE POSTS EXPERT-LEVEL (this is the whole point - do not skip):
- Voice: Write exactly as this person would speak - their tone, their level of formality, their personality from the profile. If the profile specifies tone preferences (professional, conversational, inspirational, educational), honor them precisely. A reader who knows this person should recognize them in the writing.
- Audience-first: Every post must give the target audience something real - a sharper way to think about a problem they have, a concrete tactic, a non-obvious insight, or a useful reframe. Never write to impress; write to be useful.
- Specificity over fluff: Use concrete details, real situations, named tools or methods, and - only where it genuinely sharpens the point - a relevant figure from the brief, and precise language. Replace every vague generality ("companies are struggling", "AI is changing everything") with a specific, grounded claim.
- One idea per post: Each post makes ONE clear point and earns it. No grab-bag of disconnected thoughts.
- Hook: The first line (title) must make the second line unavoidable. Choose an opener that fits THIS post's assigned style - a concrete scene, a blunt defensible claim, a confession, a contrarian assertion, a specific moment in time, or a question reframed as a statement. At most ONE post in this whole batch may open with a statistic, and only when a number is genuinely the sharpest opener for its assigned style; every other post must open a different way. Banned openers: "In today's [x] world", "Let that sink in", "Read that again", "Most people get this wrong", "Unpopular opinion", "I'll be honest", and any standalone rhetorical question.
- Vary the opening device across the ${postCount} posts. Never reuse the same stock phrase ("here's the thing", "real talk", "let's be honest") more than once in the whole batch.
- Real CTA: End by asking about the reader's own experience with the specific thing this post covered, or by giving them one concrete thing to try. Banned CTAs: "What's your take", "Curious to hear your thoughts", "Agree?", "Comment below", "Let me know your thoughts", "Drop a comment". A good CTA could not be pasted onto a different post.
- No motivational filler: Cut platitudes, inspirational-poster lines, and empty positivity. If a sentence would survive on any post in any industry, rewrite it to be specific to this person and topic.

${rules}

Generate exactly ${postCount} posts as a JSON array. Each post must follow this exact structure:
[
  {
    "title": "string (scroll-stopping hook - the opening line of the post, specific and concrete, max 150 chars)",
    "body": "string (full post body, max 1300 characters, one clear idea, grounded in real specifics)",
    "hashtags": ["string", "string", "string", "string", "string"],
    "postType": "${allowedTypes.join("|")}",
    "imagePrompt": "string (a short 1-2 sentence visual concept - describe the SCENE or METAPHOR, not text to display. Example: 'A lighthouse beam cutting through fog at dawn, symbolizing guidance' NOT 'An image showing the words Leadership Matters')",
    "bestTimeToPost": "string (e.g. Tuesday 9am)",
    "callToAction": "string (the specific, natural CTA embedded in this post)"
  }
]

Rules for each post:
- Each post must sound like it was written by the specific person in the profile above, in their tone and voice - not by an AI.
- Build each post on real, specific substance: facts and examples from the research brief where one is provided, plus this person's expert interpretation. Never use a stat or source that is not in the brief.
- If you quote any phrase from the research brief inside a post, paraphrase it - never reproduce double-quote characters inside any JSON string value.
- Vary the format: some with short paragraphs, some with numbered points, some as narrative. Write each post genuinely in the style assigned to it in the per-post style plan above, so the batch reads as different shapes.
- Include a strong, specific, natural call-to-action in each post body - not generic engagement bait.
- Do not use bullet points starting with dashes - use numbered lists or plain paragraphs.
- Hashtags must be relevant, lowercase, no spaces (e.g. productmanagement, leadership).
- Image prompts must describe a scene or visual metaphor only - NEVER describe text or words that should appear in the image.

All string values must be single-line plain text with no double-quote characters inside them. In the "body" field, emit any line breaks as escaped \\n, not as raw newlines. Do not include trailing commas. The output must parse with JSON.parse.

Return ONLY the JSON array. No markdown. No explanation. No emojis.`;
}

// ─── Research Brief Prompt (Google Search grounding) ──────────────────────────
// One call per batch, sent to gemini-2.5-flash WITH the Google Search grounding
// tool enabled (use generateGroundedText, NOT generateText). Returns FREE-FORM
// TEXT (not JSON) - do NOT route this through parseJSON. The resulting brief is
// passed into buildPostsPrompt so the writer is grounded in real, current facts.

export function buildResearchPrompt(
  weekTheme: string,
  weekFocus: string,
  pillars: object[],
  industry: string,
  targetAudience: string,
  today: string = new Date().toISOString().slice(0, 10)
): string {
  const pillarLines = (pillars as Array<{ name?: string; description?: string }>)
    .map((p) => `- ${p?.name ?? "Pillar"}: ${p?.description ?? ""}`.trim())
    .join("\n");

  return `You are a sharp research analyst preparing a fact-pack for an expert LinkedIn writer in the ${industry || "business"} field. Use Google Search to research the topic on the live web, then write a concise RESEARCH BRIEF the writer will use to ground a week of posts in real, current, credible information.

Today's date is ${today}. "Recent" and "current" mean within roughly 18 months of this date. Do not present older information as current.

WHAT THE WRITER IS COVERING THIS WEEK
Industry: ${industry || "Not specified"}
Target audience: ${targetAudience || "professionals in this industry"}
Week theme: "${weekTheme}"
Week focus / angle: "${weekFocus}"
Content pillars:
${pillarLines || "- (none specified)"}

YOUR JOB
Search the web now for the most relevant, recent, and credible information on this theme, focus, and pillars as they relate to the ${industry || "business"} field and to ${targetAudience || "this audience"}. Then synthesize what you find into a tight brief.

Organize the brief under these headings (use these exact plain-text headings, no markdown styling needed):

KEY FACTS
- The most important, currently-true facts a knowledgeable expert in this field would cite. Concrete and specific, not generic.

EXPERT TALKING POINTS
- 4 to 8 sharp, non-obvious angles, contrarian takes, or "what most people miss" insights an expert in this field would actually voice on this theme. These are the spine of strong posts.

CONCRETE EXAMPLES
- Real-world examples, named companies, products, people, case studies, or scenarios that the writer can reference specifically (not invented or hypothetical).

COMMON MISCONCEPTIONS
- Widely-believed but wrong or oversimplified ideas in this area that an expert could correct to sound credible.

RECENT DEVELOPMENTS
- News, launches, regulatory or market shifts, or notable events from roughly the last 18 months that are relevant to the theme. Include the rough timing of each.

STATISTICS AND DATA (optional - include at most 2 or 3, and only if a genuinely notable, well-sourced figure exists; otherwise skip this section entirely)
- Real numbers, percentages, survey results, or benchmarks you found via search. After each, add a rough date or time frame in parentheses (for example "(2024 report)", "(as of early 2025)") and name the source or type of source. Only include numbers you actually found in search results. If you cannot find a credible figure for a point, leave the number out rather than estimating.

STRICT RULES
- Only include facts, numbers, examples, and developments you actually found through search. Do NOT fabricate, estimate, or fill gaps from general knowledge. It is better to write less than to invent anything.
- Every statistic must have a rough date or time frame and a named source or source type. If you are not confident a figure is real and current, omit it.
- If search returns little credible material for a heading, write "No reliable current data found" under that heading rather than filling it from general knowledge.
- Keep the entire brief under 350 words. Favor the 8 to 12 most usable, specific, recent facts over completeness. This is a working fact-pack for a writer, not an essay. No introduction, no conclusion, no filler, no sales language.
- Stay tightly relevant to the theme, focus, pillars, industry, and audience above. Discard anything tangential.
- Write in plain text. Use plain hyphens, never em-dashes or en-dashes. Do not use emojis.

Output ONLY the research brief under the headings above. Do not add commentary before or after it.`;
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

  return `You are an art director for high-performing LinkedIn graphics. Read the LinkedIn post below and design a single square (1:1) feed image that EXPLAINS this post - a viewer should grasp the post's core message and context from the image alone, from its visual and its on-image text together. Think like an editorial / infographic designer, not a stock-photo picker: choose a visual concept that genuinely communicates THIS post's point, then render a strong, readable headline plus 2-3 short supporting points as clean, well-designed on-image text. This is a scroll-stopping, intentionally designed graphic that does real visual storytelling, NOT a bare illustration and NOT a plain stock photo with a caption. CHOOSE THE VISUAL STYLE THAT BEST COMMUNICATES THIS POST - it MUST vary from post to post. Depending on the topic, pick a realistic / photographic scene, a bold flat illustration or friendly animated / cartoon style, a clean infographic / chart / diagram, an editorial concept, or a futuristic / conceptual look when the topic is genuinely about the future or technology. There is NO default look: do NOT make every image realistic, and do NOT make every image futuristic. Match the register to the content.

POST TITLE (hook): ${title}
POST BODY: ${body}
POST TYPE: ${postType}
ROLE (base the imagery on what THIS person actually does): ${userProfile?.headline || "professional"}
FIELD (broad context only - do NOT base the imagery on this): ${industry || "business"}
${profileBlock}
Produce a brief as a JSON object with this EXACT structure:
{
  "headline": "string",
  "subpoints": ["string", "string"],
  "visual": "string",
  "palette": "string",
  "textPosition": "string"
}

FIELD DEFINITIONS AND CONSTRAINTS:
- "headline": The post's core message as a bold, communicative headline that a viewer reads first and immediately understands - NOT a tiny secondary caption. Distil the post's main takeaway into your own words, between 3 and 7 words and at most 42 characters total. State the specific point or outcome of THIS post (a concrete claim, for example "Why Senior Hires Quit In 90 Days" or "Cut Onboarding From 30 Days To 5"), not a vague label. This is NOT the title - never copy the title verbatim. Prefer short, common words; avoid any word longer than 12 letters and avoid long numbers, decimals, multi-digit percentages, currency, and dates, because they render incorrectly. Short numbers are fine, for example "3 Hiring Mistakes" or "80/20 Rule". If the post body is empty or very short, derive the headline from the title alone and do not invent facts. If postType is "question", make the headline a short, punchy version of the post's core question ending in a single question mark. Use Title Case. No quotation marks, no hashtags, no ending punctuation except that one question mark. This exact text is rendered large on the image, so spell every word correctly.
- "subpoints": An array of 2 or 3 short supporting points that, together with the headline, let a viewer understand the post's context at a glance - the key facts, steps, stats, or contrasts the post is built on. Each is its own string, 2 to 5 words and at most 32 characters, Title Case or a short real label, spelled exactly. Draw them ONLY from the post (never invent facts, stats, or claims): for a list or steps post use the actual steps; for a data post use the few real figures; for a comparison use the two sides; for a story or opinion post use the key beats or contrasts (for example ["Slow Feedback Loops", "No Clear Owner", "Skipped The Why"] or ["Before: 30 Days", "After: 5 Days", "70% Faster"]). These render as bold, legible on-image labels under or beside the headline, creating the reading path a strong LinkedIn graphic uses. Provide 2 to 3 (never more than 3); use an empty array [] only if the post genuinely supports only the headline. No ending punctuation, no quotation marks, no hashtags. Keep each tight and scannable - never a sentence or a paragraph.
- "visual": Describe the BEST GRAPHIC CONCEPT to EXPLAIN THIS post's core point - think like an art director choosing the right medium for THIS message, NOT a stock-photo picker. First decide the STYLE that communicates THIS content best and NAME it explicitly at the start of the sentence: (a) a clean infographic, chart, graph, comparison, or diagram when the post has any numbers, steps, stages, lists, or contrasts (with realistic figures and only short real labels from the post, never invented); (b) a clear process / flow diagram or an annotated UI or device mockup for a how-to or product point; (c) a bold flat illustration or a friendly animated / cartoon scene for a conceptual, contrarian, or human idea; (d) a realistic editorial photo scene for a story or people-centered post; (e) a futuristic or conceptual rendering ONLY when the post is genuinely about the future or technology. VARY this choice across posts - do not default to realistic and do not default to futuristic. Build it around THIS person's actual ROLE (from their headline) and the post's topic, never a generic stereotype of their field (no chips or wires just because the field is technology). The visual must do real storytelling so the message is clear even before reading the text, and it must leave clean space for the headline and the 2-3 supporting labels so the text is legible, not crowded - never an empty, text-free, or decorative-only illustration. Name the specific key elements and the few short real labels worth showing. At most 60 words, one single-line sentence.
- "palette": Choose a REALISTIC colour palette that genuinely matches THIS post's subject and mood - derive it from the real-world colours of the actual topic (for example a hiring post leans warm human office tones, a finance post grounded navy, forest, or paper tones, a burnout post muted and desaturated, a sustainability post natural greens and earth). Express it as the lighting and atmosphere of a real scene, not flat background fills. EVERY post must get a clearly DIFFERENT, realistic palette - never the same colours twice, and do NOT default to a cool blue, teal, or neon "tech" palette unless the post is genuinely about technology or the future. Avoid plain grey-on-white. At most 30 words, one single-line sentence.
- "textPosition": Choose the BEST placement for the headline based on where the visual subject sits and where negative space naturally falls. Pick exactly one: "top-center", "bottom-center", "bottom-left", "center-left", or "overlay-center". Vary this based on the scene composition - do NOT always pick the same position.

GUARDRAILS:
- Use plain hyphens only, never em-dashes or en-dashes.
- Professional, human tone. No buzzwords.
- The image must EXPLAIN the post: visual plus text together should make the core message and context clear at a glance. It must be rich and intentional, never bare, blank, or text-free.
- TEXT MUST BE CLEARLY VISIBLE AND INFORMATIVE: the headline reads as the bold, dominant message and the 2-3 subpoints read as legible supporting labels, so the post's context is grasped at a glance. This is the right amount of text - NOT a tiny faded caption, and NOT a wall of text, paragraphs, body copy, or a cluttered poster. A strong headline plus a few short key points, cleanly laid out with clear hierarchy.
- STYLE VARIES BY CONTENT: choose realistic, illustrated / cartoon, infographic, editorial, or futuristic strictly by what best explains THIS post, and make it differ from other posts. Never lock to one look. Do NOT make every post realistic, and use a futuristic / neon / sci-fi treatment only when the post is genuinely about the future or technology.
- The visual must be visually rich and appropriately colourful for the subject - a designed graphic that communicates, never a bland grey stock photo, never bare or empty, and never a wall of text.

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
- Choose ONE REALISTIC colour mood and ONE visual style for the whole carousel that genuinely match the post's topic - derive the colours from the real-world subject and describe them as the lighting and atmosphere of real scenes (for example "warm sunrise tones with deep shadow contrast"), NOT flat background fills. Every carousel must use a clearly different, realistic palette; do NOT default to a cool blue, teal, or neon "tech" look unless the post is genuinely about technology or the future. Describe it once in "palette" and let every slide share that same atmosphere while the scenes' own natural colours carry the frames.
- All slides share the SAME compositional grid and consistent headline placement. Vary only the subject and imagery per slide; keep type placement, margins, and visual rhythm identical across all slides.
- Choose ONE visual style for the whole carousel that genuinely fits the post's topic - a clean infographic / chart / diagram system, a bold flat illustration or cartoon set, a realistic editorial / photographic set, an editorial concept, or a futuristic look ONLY when the post is genuinely about the future or technology. Commit to that ONE register across all slides. Do NOT default every carousel to realistic, and do NOT default to futuristic or neon.
- The visual scene must be the hero of each slide - occupying at least 65% of the frame area. Headlines are elegant overlays, not the dominant element.

EACH SLIDE NEEDS:
- "headline": the dominant text on that slide, always present and legible - it must communicate that slide's point on its own, not act as a faded caption. Between 3 and 7 words, never more than 7, and at most 42 characters total. Punchy, spelled exactly, capturing that slide's one idea as a bold readable message. Prefer short common words; avoid words longer than 12 letters and avoid long numbers, decimals, multi-digit percentages, currency, and dates. Use Title Case. No quotation marks, no hashtags, no emojis.
- "visual": ONE single-line sentence describing the BEST GRAPHIC CONCEPT for THIS slide's idea - STRONGLY PREFER a clean chart, graph, key stat with realistic numbers, a device or UI mockup, or a tidy diagram; otherwise a clean DESIGNED composition (a labeled diagram, an annotated mockup, or an icon-driven concept layout, not a plain photo or empty illustration) built around the real subject of THIS person's actual role and the post's topic (never a generic stereotype of their field). Render it in the carousel's one chosen style (realistic, illustrated / cartoon, infographic, editorial, or futuristic only when the topic genuinely calls for it), consistent across all slides. Name the specific elements and any real figures or short labels to show (use figures from the post or research, never invent fake statistics). The visual carries the meaning, so keep on-slide text minimal. Keep every slide in ONE cohesive designed style. At most 50 words.
- "textPosition": choose the best headline placement for this slide's composition: "top-center", "bottom-center", "bottom-left", or "center-left". Keep it consistent across all slides in this carousel.

GUARDRAILS:
- Use plain hyphens only, never em-dashes or en-dashes.

${NO_EMOJI_RULES}

Return a JSON object with this EXACT structure (the "slides" array holds between 2 and ${count} objects):
{
  "palette": "string (the one shared colour mood and visual style described as scene lighting and atmosphere, reused by every slide)",
  "slides": [
    { "headline": "string (3-7 words, max 42 chars, the dominant text on this slide)", "visual": "string (one graphic concept for this slide's idea, in the carousel's chosen style)", "textPosition": "string (top-center, bottom-center, bottom-left, or center-left)" }
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

// ─── Restyle Prompt (mobile "regenerate in a new style") ─────────────────────
// Rewrites an existing post in a new writing style while keeping the exact same
// topic, facts and length. Used by app/api/mobile/posts/[id]/regenerate.
export function buildRestylePrompt(
  profileContext: string,
  title: string,
  body: string,
  humanMode: boolean = false,
): string {
  const styleRule = humanMode
    ? `- Plain, natural, human-sounding paragraphs. Conversational and understated.
- Do NOT use any emojis.
- Do NOT use hashtags: set the "hashtags" field to an empty array [].
- Use short paragraphs with a blank line between them. No symbol bullets.`
    : `- Open with a punchy hook line led by a single relevant emoji (e.g. 🚀, 💡, 🎯).
- For any list of points/achievements, put each on its own line starting with a ✅ checkmark.
- Use a few tasteful, relevant emojis (4-8 total, never spammy).
- END the body with a short engagement question inviting comments (you may add 👇).
- Provide 3-5 relevant lowercase hashtags in the "hashtags" field.`;

  return `You are an expert LinkedIn editor. REWRITE the post below in a new writing style.

PROFESSIONAL PROFILE:
${profileContext}

ORIGINAL POST TITLE: ${title}
ORIGINAL POST BODY:
"""
${body}
"""

YOUR TASK:
- Keep the EXACT SAME topic, message, facts, examples and key points as the original.
- Do NOT invent new information, do NOT change the subject, do NOT drift off-context.
- Keep roughly the same meaning and length. Only change the WRITING STYLE + formatting.

STYLE RULES:
${styleRule}

ABSOLUTE FORMATTING RULES (apply to BOTH modes):
- Output PLAIN TEXT only. Do NOT use Markdown of any kind.
- NEVER use the asterisk character "*" anywhere — no *italics*, no **bold**, no "* " bullets.
- Never wrap words in symbols for emphasis.

Return ONLY a JSON object with this exact shape:
{
  "body": "string (the rewritten post body, plain text, NO asterisks, max 1300 chars)",
  "hashtags": ["string", "string", "string"]
}

Return ONLY valid JSON. No markdown fences. No explanation.`;
}
