'use client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useMemo } from 'react';

export default function MatchesPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const matchesQuery = useMemo(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'matches'), where('ownerUid', '==', user.uid), orderBy('date', 'desc'));
    }, [firestore, user]);

    const { data: matches, loading } = useCollection(matchesQuery);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Partidos"
        description="Programa, visualiza y gestiona todos tus partidos."
      >
        <Button>Programar Partido</Button>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Partidos</CardTitle>
        </CardHeader>
        <CardContent>
        {loading && <p>Cargando partidos...</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches?.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="font-medium">{match.title}</TableCell>
                  <TableCell>{format(new Date(match.date), 'E, d MMM, yyyy')} - {match.time}</TableCell>
                  <TableCell>{match.location}</TableCell>
                  <TableCell>{match.type}</TableCell>
                  <TableCell>
                    <Badge
                        variant={match.status === 'completed' ? 'secondary' : 'default'}
                        className={cn({
                          'bg-primary/20 text-primary-foreground dark:bg-primary/30': match.status === 'upcoming',
                          'bg-muted text-muted-foreground': match.status === 'completed',
                        })}
                      >
                        {match.status === 'upcoming' ? 'Próximo' : 'Completado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
