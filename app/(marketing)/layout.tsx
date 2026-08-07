import { CustomCursor } from "@/components/ui/CustomCursor";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CustomCursor />
      {children}
      <div className="film-grain" aria-hidden />
    </>
  );
}
