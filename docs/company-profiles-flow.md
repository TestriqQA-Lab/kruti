# Company Profiles — Workflow & Architecture

Kruti.io lets a user run multiple **company / brand workspaces** from one account.
Each company profile is an isolated content workspace with its own strategy,
posts, AI images, calendar, newsletters, analytics and settings — generated in
that company's voice. The user's own content lives in a default **Personal**
workspace (unchanged, fully backward-compatible).

> Decisions in effect:
> - **Content + image generation** for companies uses the **same AI APIs** as the user (temporary).
> - **Auto-posting to LinkedIn runs for the Personal workspace only.** Company posts are
>   draft/manage/export only until LinkedIn's Community Management API (org posting) is approved.
> - **Post quota** (30 / billing cycle) is **shared account-wide** across all workspaces.
> - One **subscription per account** (billing stays at the user level).

---

## High-level workflow

```mermaid
flowchart TD
  A[User signs in with LinkedIn] --> B[Dashboard]
  B --> SW{Workspace switcher}
  SW -->|Personal| P[Personal workspace<br/>existing content, unchanged]
  SW -->|Company| G[Company workspace active]
  B --> CP[/Companies page/]
  CP -->|+ Create| NEW[New company:<br/>name, logo, industry, about,<br/>audience, positioning, goals,<br/>styles, schedule, signature, tz]
  NEW --> CP
  CP -->|Open workspace| ACT[Set active-workspace cookie]
  ACT --> G

  G --> STR[Generate weekly Strategy<br/>POST /api/generate/strategy + companyProfileId]
  STR --> PLAN[(ContentPlan<br/>companyProfileId set)]
  PLAN --> POSTS[Generate posts 5/batch<br/>POST /api/generate/posts]
  POSTS --> POST[(Post rows under the plan)]
  POST --> EDIT[Edit / AI image / variants / repurpose<br/>same AI APIs]
  EDIT --> CAL[Content Calendar:<br/>schedule across weekdays]
  CAL --> PUB{Publish}
  PUB -->|Personal only| LI[Auto-post / manual -> LinkedIn]
  PUB -->|Company| EXP[Copy / CSV export<br/>auto-post disabled]
  POST --> AN[Analytics — scoped per workspace]
  G --> NL[Newsletter drafts — per company<br/>send/schedule]
  G --> SET[Company Settings — prefs, signature, timezone, logo]

  AN --> SW
  NL --> SW
```

---

## How scoping works

Every piece of content is tied to a **workspace**:

- `ContentPlan.companyProfileId` — `null` = Personal, set = a company.
- `Post` belongs to a `ContentPlan` (inherits the workspace).
- `Newsletter.companyProfileId` — `null` = Personal, set = a company.

The **active workspace** is stored in an HTTP-only cookie (`kruti_workspace`),
always re-verified against the DB so it can only resolve to a workspace the
signed-in user owns.

```mermaid
flowchart LR
  REQ[Dashboard request] --> CK[Read kruti_workspace cookie]
  CK --> V{Owned by user?}
  V -->|company id| C[Scope queries:<br/>companyProfileId = id]
  V -->|personal / invalid| PR[Scope queries:<br/>companyProfileId = null]
  C --> Q[(Prisma queries)]
  PR --> Q
```

---

## Data model (added)

```
CompanyProfile
  id, userId (owner)
  name, tagline, about, industry, website, logoUrl
  tonePrefs, positioning, contentGoals, contentStyles, targetAudience
  humanMode, postingSchedule, postSignature, timezone
  linkedinOrgId        # future: company-page posting
  onboardingCompleted
  contentPlans[]  newsletters[]

ContentPlan.companyProfileId  -> CompanyProfile?   (null = Personal)
Newsletter.companyProfileId   -> CompanyProfile?   (null = Personal)
```

Subscription, Account (LinkedIn token), rate-limits and auth remain **user-level**.

---

## Publishing rules (current phase)

| Workspace | Generate content & images | Auto-post to LinkedIn | Manual publish |
|-----------|---------------------------|-----------------------|----------------|
| Personal  | ✅ (existing)             | ✅ (existing)         | ✅             |
| Company   | ✅ (same AI APIs)         | 🚫 disabled           | Copy / CSV export |

Real LinkedIn **Company Page** posting will be enabled later via
`CompanyProfile.linkedinOrgId` + the `w_organization_social` scope once LinkedIn
approves the app for the Community Management API.
