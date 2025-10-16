
'use client';

import { useState } from 'react';
import type { Match } from '@/lib/types';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MatchTeamsDialog } from '@/components/match-teams-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Calendar, Clock, MapPin, Users, Trash2, CheckCircle, Eye, Loader2 } from 'lucide-react';


type MatchCardProps = {
  match: Match;
};

const statusConfig = {
    upcoming: { label: 'Próximo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    active: { label: 'Activo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

const InfoRow = ({ icon, text }: { icon: React.ElementType, text: string }) => (
    <div className="flex items-center gap-3 text-sm">
        <icon className="h-4 w-4 text-muted-foreground" />
        <span>{text}</span>
    </div>
);

export function MatchCard({ match }: MatchCardProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const currentStatus = statusConfig[match.status] || statusConfig.completed;

    const handleDeleteMatch = async () => {
        if (!firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'matches', match.id));
            toast({
                title: 'Partido Eliminado',
                description: 'El partido ha sido eliminado correctamente.'
            });
            // The dialog will close automatically on success
        } catch (error) {
            console.error("Error deleting match: ", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo eliminar el partido.'
            });
            setIsDeleting(false);
        }
    };

    const handleFinishMatch = async () => {
        if (!firestore) return;
        setIsFinishing(true);
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
        } finally {
            setIsFinishing(false);
        }
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className="line-clamp-2">{match.title}</CardTitle>
                    <Badge variant="secondary" className={cn("whitespace-nowrap", currentStatus.className)}>
                        {currentStatus.label}
                    </Badge>
                </div>
                <CardDescription>
                     <Badge variant="outline">{match.type === 'manual' ? 'Manual' : 'Colaborativo'}</Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <InfoRow icon={Calendar} text={match.date ? format(new Date(match.date), 'E, d MMM, yyyy') : 'Fecha no definida'} />
                <InfoRow icon={Clock} text={match.time} />
                <InfoRow icon={MapPin} text={match.location} />
                <InfoRow icon={Users} text={`${match.players.length} / ${match.matchSize} jugadores`} />
            </CardContent>
            <Separator />
            <CardFooter className="grid grid-cols-2 gap-2 p-4">
                 <MatchTeamsDialog match={match}>
                    <Button variant="outline" size="sm" className="w-full" disabled={!match.teams || match.teams.length === 0}>
                        <Eye className="mr-2 h-4 w-4" />
                        Equipos
                    </Button>
                </MatchTeamsDialog>

                {match.status === 'upcoming' && (
                    <Button variant="default" size="sm" onClick={handleFinishMatch} disabled={isFinishing} className="w-full">
                        {isFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Finalizar
                    </Button>
                )}

                 <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    {/* The button to trigger the delete confirmation is now outside the logical flow for completed matches */}
                    {match.status !== 'completed' && match.status !== 'evaluated' && (
                         <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive col-span-2" onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </Button>
                    )}
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente el partido
                            y todos sus datos asociados.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteMatch} disabled={isDeleting}>
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sí, eliminar partido
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 {/* This is a separate delete button for completed/evaluated matches if needed, or can be combined. */}
                 {(match.status === 'completed' || match.status === 'evaluated') && (
                     <Button variant="ghost" size="sm" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive col-span-2" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </Button>
                 )}
            </CardFooter>
        </Card>
    );
}
