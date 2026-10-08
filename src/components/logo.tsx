import { cx } from "@/lib/text";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("text-juniper", className)} aria-hidden="true">
      <path d="M12 21V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M12 14.2c-3.7 0-5.6-2.2-5.6-5.5 3.4 0 5.6 1.9 5.6 5.5Z" fill="currentColor" />
      <path d="M12 11.5c0-3.4 2-5.5 5.6-5.5 0 3.6-2.1 5.5-5.6 5.5Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
