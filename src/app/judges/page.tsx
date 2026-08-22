import { redirect } from 'next/navigation';

// src/app/judges/page.tsx - Redirect legacy /judges route to modern /judge portal
export default function JudgesLegacyRedirectPage() {
  redirect('/judge');
}
