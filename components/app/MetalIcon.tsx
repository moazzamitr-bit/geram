import { tradeMetalBySlug, type TradeMetalSlug } from "@/lib/market/trade-routes";

export function MetalIcon({
  slug,
  size = 18,
}: {
  slug: TradeMetalSlug;
  size?: number;
}) {
  const { accent } = tradeMetalBySlug(slug);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="shrink-0"
    >
      {slug === "gold" && (
        <>
          <circle cx="9" cy="9" r="8" fill={accent} />
          <circle cx="9" cy="9" r="5.1" fill="none" stroke="#1C1917" strokeWidth="1.1" />
          <path
            d="M9 5.7v6.2M7.2 7.2h2.8c.8 0 1.3.4 1.3 1.05S10.8 9.3 10 9.3H7.4"
            fill="none"
            stroke="#1C1917"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </>
      )}
      {slug === "silver" && (
        <>
          <rect x="2.2" y="11.2" width="13.6" height="3.4" rx="0.7" fill="#E7EBF0" stroke="#1C1917" strokeWidth="0.7" />
          <rect x="3.2" y="7.2" width="11.6" height="3.4" rx="0.7" fill={accent} stroke="#1C1917" strokeWidth="0.7" />
          <rect x="4.4" y="3.2" width="9.2" height="3.4" rx="0.7" fill="#F7F8FA" stroke="#1C1917" strokeWidth="0.7" />
        </>
      )}
      {slug === "copper" && (
        <>
          <circle cx="9" cy="9" r="8" fill={accent} />
          <circle cx="9" cy="9" r="3.3" fill="#E7B08A" />
          <path d="M4.2 12.4c1.4-2 3-3 4.8-3s3.4 1 4.8 3" fill="none" stroke="#1C1917" strokeWidth="0.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
