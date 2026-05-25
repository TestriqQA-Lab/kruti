import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { blogPosts } from "@/lib/blog-data";
import { ArrowLeft, Clock, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog — Kruti.io | LinkedIn Content Strategy, AI Marketing & Personal Branding",
  description:
    "Expert insights on LinkedIn content strategy, AI-powered content creation, personal branding, and B2B lead generation. Grow your LinkedIn presence with Kruti.io.",
  openGraph: {
    title: "Blog — Kruti.io",
    description:
      "Expert insights on LinkedIn content strategy, AI-powered content creation, personal branding, and B2B lead generation.",
    type: "website",
    url: "https://kruti.io/blog",
  },
  alternates: {
    canonical: "https://kruti.io/blog",
  },
};

export default function BlogListPage() {
  return (
    <>
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="Kruti.io" width={250} height={80} className="h-20 w-auto" />
            <span className="hidden sm:block text-2xl font-bold tracking-tighter text-gray-900 dark:text-white">
              Kruti<span className="text-[#0A66C2]">.io</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[#0A66C2] hover:text-[#004182] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            The Kruti.io Blog
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Expert insights on LinkedIn content strategy, AI-powered marketing, personal branding,
            and growing your professional presence.
          </p>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-lg hover:border-[#0A66C2]/30 transition-all duration-200"
              >
                {/* Category color bar */}
                <div className="h-1 bg-gradient-to-r from-[#0A66C2] to-[#0073b1]" />

                <div className="p-6">
                  {/* Category & Read Time */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0A66C2] bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                      <Tag className="w-3 h-3" />
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-[#0A66C2] transition-colors mb-2 line-clamp-2">
                    {post.title}
                  </h2>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                    {post.description}
                  </p>

                  {/* Date */}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(post.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gradient-to-br from-[#0A66C2] to-[#004182]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Transform Your LinkedIn Presence?
          </h2>
          <p className="text-blue-100 mb-8">
            Generate a full month of AI-powered LinkedIn content in minutes. Try Kruti.io free.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-[#0A66C2] font-semibold px-8 py-3 rounded-full hover:bg-blue-50 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
}
