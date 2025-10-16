import { players } from '@/lib/data';
import { PageHeader } from '@/components/page-header';
import { PlayerCard } from '@/components/player-card';
import { AddPlayerDialog } from '@/components/add-player-dialog';

export default function PlayersPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Players"
        description="Manage your team roster and player stats."
      >
        <AddPlayerDialog />
      </PageHeader>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
