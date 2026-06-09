import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refunds" },
  { href: "/cookies", label: "Cookies" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kruti.io by Cinute Digital Pvt. Ltd.
          </p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          &copy; 2024-{new Date().getFullYear()} Cinute Digital Pvt. Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
