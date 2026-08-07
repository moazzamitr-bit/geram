import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { AppShowcase } from "@/components/home/AppShowcase";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { HeroSection } from "@/components/home/HeroSection";
import { MetricsSection } from "@/components/home/MetricsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { CustomCursor } from "@/components/ui/CustomCursor";

export default function HomePage() {
  return (
    <>
      <CustomCursor />
      <Header />
      <main id="main">
        <HeroSection />
        <FeatureGrid />
        <MetricsSection />
        <AppShowcase />
        <NewsletterSection />
      </main>
      <Footer />
    </>
  );
}
