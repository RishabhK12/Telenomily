export function Logo({ tile = "lavender" }: { tile?: "lavender" | "white" }) {
  const fill = tile === "white" ? "#FFFFFF" : "#EBEAFC";
  return (
    <span className="inline-flex items-center gap-3">
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-12 w-12">
        <rect width="64" height="64" rx="16" fill={fill} />
        <path d="M16 18h32M32 12v16c0 0 16 2 16 12 0 8-8 14-16 18-8-4-16-10-16-18 0-10 16-12 16-12" fill="none" stroke="#4D50A2" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="type-heading text-navy">Telenomily</span>
    </span>
  );
}
