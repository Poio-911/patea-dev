'use client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Users2, Calendar } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function MatchesPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);

    const { data: matches, loading } = useCollection(matchesQuery);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Partidos"
        description="Programa, visualiza y gestiona todos tus partidos."
      >
        <Button>Programar Partido</Button>
      </PageHeader>

      {!loading && !user?.activeGroupId && (
         <Alert>
            <Users2 className="h-4 w-4" />
            <AlertTitle>No hay grupo activo</AlertTitle>
            <AlertDescription>
                No tienes un grupo activo seleccionado. Por favor, crea o únete a un grupo para ver los partidos.
                <Button asChild variant="link" className="p-0 h-auto ml-1">
                    <Link href="/groups">Ir a la página de grupos</Link>
                </Button>
            </AlertDescription>
         </Alert>
       )}

      {user?.activeGroupId && (
        <Card>
            <CardHeader>
            <CardTitle>Historial de Partidos</CardTitle>
            </CardHeader>
            <CardContent>
            {loading && <p>Cargando partidos...</p>}
            {!loading && matches?.length === 0 && (
                 <Alert variant="default" className="text-center">
                    <Calendar className="h-4 w-4" />
                    <AlertTitle>No hay partidos programados</AlertTitle>
                    <AlertDescription>
                        Este grupo todavía no tiene partidos. ¡Programa el primero!
                    </AlertDescription>
                 </Alert>
            )}
            {matches && matches.length > 0 && (
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
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
