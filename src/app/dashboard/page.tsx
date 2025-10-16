import { players, matches } from '@/lib/data';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Goal, Star, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function DashboardPage() {
  const topPlayer = [...players].sort((a, b) => b.ovr - a.ovr)[0];
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const top5Players = [...players].sort((a, b) => b.ovr - a.ovr).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Welcome to your Amateur Football Manager."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Players" value={players.length} icon={<Users className="h-6 w-6 text-primary" />} />
        <StatCard title="Upcoming Matches" value={upcomingMatches.length} icon={<Calendar className="h-6 w-6 text-primary" />} />
        <StatCard title="Top Rated Player" value={`${topPlayer.name} (${topPlayer.ovr})`} icon={<Star className="h-6 w-6 text-primary" />} />
        <StatCard title="Default Formation" value="4-3-3" icon={<Goal className="h-6 w-6 text-primary" />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.slice(0, 5).map((match) => (
                  <TableRow key={match.id}>
                    <TableCell className="font-medium">{match.title}</TableCell>
                    <TableCell>{format(new Date(match.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{match.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={match.status === 'completed' ? 'secondary' : 'default'}
                        className={cn({
                          'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': match.status === 'upcoming',
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300': match.status === 'completed',
                        })}
                      >
                        {match.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {top5Players.map((player) => (
                <div key={player.id} className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border-2 border-primary/50">
                    <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-muted-foreground">{player.position}</p>
                  </div>
                  <div className="text-lg font-bold text-primary">{player.ovr}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
