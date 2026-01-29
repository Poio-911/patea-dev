'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, AlertCircle, Calendar, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Player, AvailablePlayer } from '@/lib/types';
import { SocialFeed } from '@/components/social/social-feed';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SetAvailabilityDialog } from '@/components/set-availability-dialog';

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: 'easeOut',
        },
    },
};

const listVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

interface SocialTabProps {
    player: Player | null;
    availablePlayerData: AvailablePlayer | null;
    isToggling: boolean;
    locationError: string | null;
    onToggleAvailability: (isAvailable: boolean) => void;
    onRequestLocation: () => void;
}

export function SocialTab({
    player,
    availablePlayerData,
    isToggling,
    locationError,
    onToggleAvailability,
    onRequestLocation
}: SocialTabProps) {
    return (
        <div className="grid gap-6 lg:grid-cols-3">
            <motion.div
                className="lg:col-span-2 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={cardVariants}>
                    <SocialFeed limit={10} showHeader={true} />
                </motion.div>
            </motion.div>

            <motion.div
                className="lg:col-span-1 space-y-6"
                variants={listVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={cardVariants}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5 text-primary" />
                                Visibilidad Pública
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between space-x-2">
                                <Label htmlFor="availability-switch" className="flex flex-col space-y-1">
                                    <span>¿Disponible para otros?</span>
                                    <span className="font-normal leading-snug text-muted-foreground text-xs">
                                        Permití que otros DTs te encuentren y te inviten a sus partidos.
                                    </span>
                                </Label>
                                <Switch
                                    id="availability-switch"
                                    checked={!!availablePlayerData}
                                    onCheckedChange={onToggleAvailability}
                                    disabled={isToggling}
                                />
                            </div>
                            {locationError && (
                                <Alert variant="destructive" className="mt-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error de Ubicación</AlertTitle>
                                    <AlertDescription>
                                        {locationError}
                                        <Button variant="link" className="p-0 h-auto ml-1 text-destructive" onClick={onRequestLocation}>Reintentar</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {availablePlayerData && (
                                <div className="mt-4 flex gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">Estás visible en la búsqueda de jugadores.</p>
                                </div>
                            )}
                            <Separator className="my-4" />
                            <SetAvailabilityDialog player={player} availability={availablePlayerData?.availability || {}}>
                                <Button variant="outline" className="w-full" disabled={!availablePlayerData}>
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Definir mi Horario
                                </Button>
                            </SetAvailabilityDialog>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </div>
    );
}
