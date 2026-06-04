import { Metadata } from "next";
import { blogPosts } from "@/lib/blog-data";
import BlogIndexClient, { type BlogCard } from "@/components/BlogIndexClient";

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
  const posts: BlogCard[] = [...blogPosts]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map(({ slug, title, description, date, author, category, readTime, image }) => ({
      slug,
      title,
      description,
      date,
      author,
      category,
      readTime,
      image: image ?? null,
    }));

  return <BlogIndexClient posts={posts} />;
}
