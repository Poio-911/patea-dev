import { redirect } from 'next/navigation';

export default function FindPlayersRedirect() {
  redirect('/explore?tab=players');
}
