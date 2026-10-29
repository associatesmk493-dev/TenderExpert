import { ExternalLink, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

// The referral app linked from the Refer button.
const REFERRAL_URL = 'https://referral-umber.vercel.app/';

// Link to the referral app for the signed-in user, so it knows who is referring:
// ?referrerEmail=…&referrerName=…  The name is the one given at sign-up, else the part of the email before the @.
function referralUrl(email?: string | null, name?: string | null) {
  if (!email) return REFERRAL_URL;
  const referrerName = (typeof name === 'string' && name.trim()) || email.split('@')[0];
  return `${REFERRAL_URL}?${new URLSearchParams({ referrerEmail: email, referrerName })}`;
}

// Sparkles that twinkle around the gift on hover: position (px from the gift's centre), size and start delay.
const SPARKLES = [
  { x: -11, y: -11, size: 7, delay: 0 },
  { x: 12, y: -9, size: 5, delay: 90 },
  { x: 10, y: 11, size: 6, delay: 170 },
];

// "Refer & earn" button for the bottom of the sidebar. With the sidebar collapsed it shrinks to the gift icon.
export default function ReferButton({ email, name, expanded = true }: { email?: string | null; name?: string | null; expanded?: boolean }) {
  return (
    <a
      href={referralUrl(email, name)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Refer and earn (opens the referral app in a new tab)"
      title={expanded ? undefined : 'Refer & earn'}
      className={cn(
        'group relative isolate flex h-10 items-center overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary/80 text-[13px] font-semibold text-primary-foreground shadow-sm ring-1 ring-white/15 transition hover:shadow-md hover:brightness-105',
        expanded ? 'gap-2.5 px-3' : 'justify-center',
      )}
    >
      <span className="relative grid h-5 w-5 shrink-0 place-items-center">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              className="refer-sparkle"
              style={{ '--sparkle-x': `${s.x}px`, '--sparkle-y': `${s.y}px`, '--sparkle-size': `${s.size}px`, '--sparkle-delay': `${s.delay}ms` } as React.CSSProperties}
            />
          ))}
        </span>
        <Gift className="refer-gift h-5 w-5" />
      </span>
      {expanded && (
        <>
          <span className="truncate">Refer &amp; earn</span>
          <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-70 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </>
      )}
    </a>
  );
}
