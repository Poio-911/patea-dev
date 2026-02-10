import { redirect } from 'next/navigation';

export default function FindMatchRedirect() {
  redirect('/explore?tab=matches');
}
