import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { AppShowcase } from "@/components/home/AppShowcase";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { HeroSection } from "@/components/home/HeroSection";
import { LiveMetalsSection } from "@/components/home/LiveMetalsSection";
import { MetricsSection } from "@/components/home/MetricsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main">
        <HeroSection />
        <LiveMetalsSection />
        <FeatureGrid />
        <MetricsSection />
        <AppShowcase />
        <NewsletterSection />
      </main>
      <Footer />
    </>
  );
}
