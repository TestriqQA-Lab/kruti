import { Metadata } from "next";
import Link from "next/link";
import LegalSection from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Privacy Policy | Kruti.io",
  description:
    "Learn how Kruti.io by Cinute Digital Pvt. Ltd. collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <article>
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Last Updated: March 10, 2026 &middot; Effective Date: March 10, 2026
        </p>
      </div>

      <LegalSection id="introduction" title="1. Introduction">
        <p>
          Welcome to <strong>Kruti.io</strong> (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), an AI-powered
          LinkedIn content generation platform operated by <strong>Cinute Digital Pvt. Ltd.</strong>,
          a company incorporated under the laws of India.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, store, share, and protect your personal
          information when you use our platform at{" "}
          <strong>kruti.io</strong> (the &ldquo;Service&rdquo;). By accessing or using Kruti.io, you
          acknowledge that you have read and understood this Privacy Policy.
        </p>
        <p>
          We are committed to protecting your privacy and handling your data transparently. This
          policy applies to all users of the Service, including those on free trials and paid
          subscriptions.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="2. Information We Collect">
        <p>We collect the following categories of information:</p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          a) Account Information via LinkedIn OAuth
        </h3>
        <p>
          When you sign in using LinkedIn, we receive and store the following through LinkedIn&rsquo;s
          OAuth 2.0 / OpenID Connect protocol (scopes: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">openid</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">profile</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">email</code>,{" "}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">w_member_social</code>):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Full name</li>
          <li>Email address</li>
          <li>Profile picture URL</li>
          <li>Professional headline</li>
          <li>LinkedIn profile identifier</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          b) Profile Data You Provide
        </h3>
        <p>
          During onboarding and in your Settings, you may provide additional information to
          personalize your content generation experience:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Professional summary and industry</li>
          <li>Skills and expertise topics</li>
          <li>Content positioning and tone preferences</li>
          <li>Content goals and styles</li>
          <li>Target audience description</li>
          <li>Posting schedule preferences</li>
          <li>Post signature / sign-off text</li>
          <li>Human Mode preference (writing style setting)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          c) Content Data
        </h3>
        <p>We store the content you create and generate using our platform:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>AI-generated content plans (weekly strategies, pillars, themes)</li>
          <li>Posts (titles, body text, hashtags, AI image prompts, generated images)</li>
          <li>Newsletter drafts (titles, subjects, bodies)</li>
          <li>Content repurposing outputs (Twitter threads, blog posts, emails)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          d) Payment Information
        </h3>
        <p>
          Subscription payments are processed by <strong>Razorpay</strong>. We store only:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Razorpay customer identifier</li>
          <li>Razorpay subscription identifier</li>
          <li>Selected plan and currency preference (INR or USD)</li>
          <li>Subscription status and billing period dates</li>
        </ul>
        <p className="font-medium text-gray-700 dark:text-gray-300 mt-2">
          We do NOT store your credit card numbers, bank account details, UPI IDs, or any payment
          instrument information. All sensitive payment data is handled exclusively by Razorpay.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          e) Technical Data
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Session tokens (JWT-based authentication)</li>
          <li>Server access logs (IP addresses, timestamps, user agent strings)</li>
          <li>Error logs for debugging and service improvement</li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use-information" title="3. How We Use Your Information">
        <p>We use your information for the following purposes:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>AI Content Generation:</strong> Your profile data, preferences, and content
            history are used to generate personalized LinkedIn posts, content strategies, images,
            and newsletters via Google&rsquo;s Generative AI services.
          </li>
          <li>
            <strong>Personalization:</strong> To tailor content recommendations, tone, and strategy
            to your professional profile and goals.
          </li>
          <li>
            <strong>LinkedIn Posting:</strong> To post content to your LinkedIn profile on your
            behalf using the <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">w_member_social</code> scope authorization.
          </li>
          <li>
            <strong>Payment Processing:</strong> To manage your subscription, process payments via
            Razorpay, and handle billing-related communications.
          </li>
          <li>
            <strong>Transactional Emails:</strong> To send account-related notifications and
            newsletter deliveries.
          </li>
          <li>
            <strong>Service Improvement:</strong> To monitor platform performance, fix issues,
            and improve features.
          </li>
          <li>
            <strong>Legal Compliance:</strong> To comply with applicable laws and respond to legal
            requests.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-data-processing" title="4. AI Data Processing">
        <p>
          Kruti.io uses <strong>Google Gemini 2.5 Pro</strong> for text generation and{" "}
          <strong>Google Imagen 3</strong> for image generation. When generating content, we send
          the following data to Google&rsquo;s AI APIs:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your professional headline, skills, and industry</li>
          <li>Your tone preferences, content goals, and positioning</li>
          <li>Content context (e.g., previous posts for continuity)</li>
          <li>Your target audience description</li>
          <li>Image generation prompts (for Imagen 3)</li>
        </ul>
        <p>
          This data is transmitted securely to Google&rsquo;s servers for processing. Google&rsquo;s{" "}
          <a href="https://ai.google.dev/terms" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Generative AI Terms of Service
          </a>{" "}
          and{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Privacy Policy
          </a>{" "}
          govern how Google handles this data.
        </p>
        <p>
          <strong>Kruti.io does not use your data to train AI models.</strong> We use Google&rsquo;s
          API services solely for generating content on your behalf.
        </p>
      </LegalSection>

      <LegalSection id="third-party-services" title="5. Third-Party Services">
        <p>
          We integrate with the following third-party services, each governed by their own privacy
          policies:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>LinkedIn Corporation:</strong> Authentication (OAuth 2.0) and content posting.
            Subject to{" "}
            <a href="https://www.linkedin.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              LinkedIn&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Google (Gemini & Imagen):</strong> AI content and image generation.
            Subject to{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Google&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Razorpay:</strong> Payment processing for subscriptions. Subject to{" "}
            <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              Razorpay&rsquo;s Privacy Policy
            </a>.
          </li>
          <li>
            <strong>Resend:</strong> Transactional email delivery service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies-and-tracking" title="6. Cookies and Tracking">
        <p>
          We use essential cookies for authentication and session management. We do not use
          third-party advertising or analytics cookies.
        </p>
        <p>
          For a detailed breakdown of cookies and similar technologies we use, please refer to
          our{" "}
          <Link href="/cookies" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
            Cookie Policy
          </Link>.
        </p>
      </LegalSection>

      <LegalSection id="data-storage-and-security" title="7. Data Storage and Security">
        <p>We implement appropriate technical and organizational measures to protect your data:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All data is transmitted over HTTPS (TLS encryption in transit)</li>
          <li>Authentication managed via secure JWT (JSON Web Token) strategy</li>
          <li>Database access restricted through application-level controls</li>
          <li>Payment data handled exclusively by PCI-DSS compliant Razorpay</li>
          <li>LinkedIn OAuth tokens stored securely and used only for authorized actions</li>
        </ul>
        <p>
          <strong>We do not sell, rent, or trade your personal data to third parties</strong> for
          marketing or any other purpose.
        </p>
      </LegalSection>

      <LegalSection id="data-retention" title="8. Data Retention">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Account data</strong> is retained for as long as your account is active.
          </li>
          <li>
            <strong>Content data</strong> (posts, plans, newsletters) is retained for your
            continued access and use.
          </li>
          <li>
            <strong>Upon account deletion:</strong> All user data, content plans, posts, and
            newsletters are permanently deleted from our database. This deletion cascades through
            all related records.
          </li>
          <li>
            <strong>Payment records:</strong> Razorpay may retain transaction records in accordance
            with their data retention policies and applicable financial regulations.
          </li>
          <li>
            <strong>Server logs:</strong> Access and error logs are retained for up to 90 days for
            debugging and security purposes.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-rights" title="9. Your Rights">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-2 mb-2">
          Under Indian Law (IT Act, 2000 & SPDI Rules, 2011)
        </h3>
        <p>As a user based in India, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate personal data</li>
          <li>Withdraw consent for processing your sensitive personal data</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          Under GDPR (for users in the European Union)
        </h3>
        <p>If you are located in the EU/EEA, you additionally have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Data portability - receive your data in a structured, machine-readable format</li>
          <li>Erasure (&ldquo;right to be forgotten&rdquo;) - request deletion of your data</li>
          <li>Restriction of processing</li>
          <li>Object to processing based on legitimate interests</li>
          <li>Lodge a complaint with a supervisory authority</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          How to Exercise Your Rights
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Delete your account:</strong> Contact us at{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>{" "}
            to request complete account and data deletion.
          </li>
          <li>
            <strong>Export your data:</strong> Request a copy of your data by emailing{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>.
          </li>
          <li>
            <strong>Revoke LinkedIn access:</strong> You can disconnect Kruti.io from your
            LinkedIn account at any time via LinkedIn&rsquo;s Settings &gt; Data Privacy &gt; Permitted
            Services.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="childrens-privacy" title="10. Children&rsquo;s Privacy">
        <p>
          Kruti.io is not intended for individuals under the age of 18. We do not knowingly
          collect personal information from minors. If you believe a minor has provided us with
          personal data, please contact us at{" "}
          <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>,
          and we will promptly delete such information.
        </p>
      </LegalSection>

      <LegalSection id="international-transfers" title="11. International Data Transfers">
        <p>
          Your data may be processed in jurisdictions outside your country of residence:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Google (United States):</strong> AI content generation via Google Gemini and
            Imagen APIs
          </li>
          <li>
            <strong>Razorpay (India):</strong> Payment processing
          </li>
          <li>
            <strong>Infrastructure providers:</strong> Hosting and CDN services
          </li>
        </ul>
        <p>
          Where data is transferred internationally, we ensure appropriate safeguards are in
          place, including compliance with applicable data protection regulations.
        </p>
      </LegalSection>

      <LegalSection id="changes-to-policy" title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Update the &ldquo;Last Updated&rdquo; date at the top of this page</li>
          <li>Notify you via email or an in-app notification for significant changes</li>
        </ul>
        <p>
          Your continued use of Kruti.io after changes are posted constitutes your acceptance of
          the updated Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>
          If you have any questions, concerns, or requests regarding this Privacy Policy or your
          personal data, please contact us:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mt-2 space-y-1.5">
          <p><strong>Cinute Digital Pvt. Ltd.</strong></p>
          <p>
            Email:{" "}
            <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">
              support@kruti.io
            </a>
          </p>
          <p>Website: kruti.io</p>
        </div>
        <p className="mt-3">
          <strong>Grievance Officer:</strong> In accordance with the Information Technology Act,
          2000 and the rules made thereunder, the Grievance Officer can be contacted at{" "}
          <a href="mailto:support@kruti.io" className="text-[#0A66C2] dark:text-blue-400 hover:underline">support@kruti.io</a>.
          We will acknowledge your grievance within 24 hours and resolve it within 30 days.
        </p>
      </LegalSection>
    </article>
  );
}
