import Footer from "@/components/Footer";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FB] dark:bg-[#0A0E14]">
      {children}
      <Footer />
    </div>
  );
}
