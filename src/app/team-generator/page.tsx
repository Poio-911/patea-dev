import { PageHeader } from '@/components/page-header';
import { TeamGeneratorClient } from '@/components/team-generator-client';
import { players } from '@/lib/data';

export default function TeamGeneratorPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Team Generator"
        description="Select players and let AI create balanced teams for your match."
      />
      <TeamGeneratorClient allPlayers={players} />
    </div>
  );
}
