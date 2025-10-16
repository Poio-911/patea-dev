'use client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Users2, Calendar, Trash2, CheckCircle2 } from 'lucide-react';
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
import { collection, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Match } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const playersQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'players'), where('groupId', '==', user.activeGroupId));
    }, [firestore, user?.activeGroupId]);

    const { data: players, loading: playersLoading } = useCollection(playersQuery);

    const matchesQuery = useMemo(() => {
        if (!firestore || !user?.activeGroupId) return null;
        return query(collection(firestore, 'matches'), where('groupId', '==', user.activeGroupId), orderBy('date', 'desc'));
    }, [firestore, user?.activeGroupId]);

    const { data: matches, loading: matchesLoading } = useCollection<Match>(matchesQuery);

    const handleDeleteMatch = async (matchId: string) => {
        if (!firestore) return;
        if (confirm('¿Estás seguro de que quieres eliminar este partido? Esta acción no se puede deshacer.')) {
            try {
                await deleteDoc(doc(firestore, 'matches', matchId));
                toast({
                    title: 'Partido Eliminado',
                    description: 'El partido ha sido eliminado correctamente.'
                });
            } catch (error) {
                console.error("Error deleting match: ", error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'No se pudo eliminar el partido.'
                });
            }
        }
    };

    const handleFinishMatch = async (match: Match) => {
        if (!firestore) return;
        // Future logic for evaluation will go here
        try {
            await updateDoc(doc(firestore, 'matches', match.id), {
                status: 'completed'
            });
             toast({
                title: 'Partido Finalizado',
                description: `El partido "${match.title}" ha sido marcado como finalizado.`
            });
        } catch (error) {
             console.error("Error finishing match: ", error);
             toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo finalizar el partido.'
            });
        }
    };

    const loading = playersLoading || matchesLoading;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Partidos"
        description="Programa, visualiza y gestiona todos tus partidos."
      >
        <AddMatchDialog allPlayers={players || []} disabled={!user?.activeGroupId} />
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
            {!loading && matches && matches.length === 0 && (
                 <Alert variant="default" className="text-center">
                    <Calendar className="h-4 w-4" />
                    <AlertTitle>No hay partidos programados</AlertTitle>
                    <AlertDescription>
                        Este grupo todavía no tiene partidos. ¡Programa el primero!
                    </AlertDescription>
                 </Alert>
            )}
            {!loading && matches && matches.length > 0 && (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Jugadores</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {matches?.map((match) => (
                        <TableRow key={match.id}>
                        <TableCell className="font-medium">{match.title}</TableCell>
                        <TableCell>{match.date ? `${format(new Date(match.date), 'E, d MMM, yyyy')} - ${match.time}`: 'Fecha no definida'}</TableCell>
                        <TableCell>{match.players.length} / {match.matchSize}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{match.type === 'manual' ? 'Manual' : 'Colaborativo'}</Badge>
                        </TableCell>
                        <TableCell>
                            <Badge
                                variant={match.status === 'completed' ? 'secondary' : 'default'}
                                className={cn({
                                    'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': match.status === 'upcoming',
                                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300': match.status === 'completed',
                                })}
                            >
                                {match.status === 'upcoming' ? 'Próximo' : 'Finalizado'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            {match.status === 'upcoming' && (
                                <Button variant="outline" size="sm" onClick={() => handleFinishMatch(match)}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Finalizar
                                </Button>
                            )}
                            <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDeleteMatch(match.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
            )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
