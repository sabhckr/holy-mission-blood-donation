/** Simple drop mark drawn inline (no image request). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 2.5c-.4 0-.8.2-1 .6C12.3 7.6 6 15.2 6 20.5 6 26 10.5 30 16 30s10-4 10-9.5C26 15.2 19.7 7.6 17 3.1c-.2-.4-.6-.6-1-.6Z" fill="currentColor" />
      <path d="M11.5 20.5c0 2.6 2 4.6 4.5 4.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85" />
    </svg>
  );
}
