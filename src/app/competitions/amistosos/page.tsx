
'use client';

import { PageHeader } from '@/components/page-header';
import { useCompetitionsData } from '@/hooks/use-competitions-data';
import { Swords, Search, Loader2, ArrowLeft, Bell, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TeamChallengesList } from '@/components/team-challenge-card';
import { MyTeamsAvailability } from '@/components/my-teams-availability';
import { AvailablePostsGrid } from '@/components/available-posts-grid';
import { motion } from 'framer-motion';
import { BackButton } from '@/components/navigation/back-button';

export default function AmistososPage() {
    const {
        user,
        loading,
        teams,
        myTeams,
        invitations,
        invitationsLoading,
        fetchInvitations
    } = useCompetitionsData();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Amistosos"
                    description="Desafiá a otros equipos y gestioná tus retos pendientes."
                    icon={<Swords className="h-8 w-8" />}
                />
                <BackButton href="/competitions" label="Volver al Hub" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Challenges & Availability */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Active Challenges */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden ring-1 ring-border/50">
                            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-2xl font-black flex items-center gap-3">
                                    <Bell className="h-6 w-6 text-emerald-500 animate-pulse" />
                                    Retos Recibidos
                                </CardTitle>
                                <Link href="/competitions/challenges">
                                    <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                                        Historial
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                {invitationsLoading ? (
                                    <div className="flex justify-center p-12"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>
                                ) : myTeams.length > 0 && invitations.length > 0 ? (
                                    <TeamChallengesList
                                        invitations={invitations}
                                        teamId={myTeams[0].id}
                                        userId={user!.uid}
                                        onUpdate={fetchInvitations}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border">
                                        <Swords className="h-16 w-16 mb-4 opacity-10" />
                                        <p className="text-lg font-medium">No tenés retos pendientes</p>
                                        <p className="text-sm opacity-70">Cuando un equipo te desafíe, aparecerá acá.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Availability */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <Card className="border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden ring-1 ring-border/50">
                            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-400" />
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-2xl font-black">Tus Postulaciones</CardTitle>
                                <Link href="/competitions/my-teams">
                                    <Button variant="outline" size="sm" className="rounded-full">
                                        Gestionar Equipos
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent>
                                <MyTeamsAvailability teams={myTeams} userId={user!.uid} isActive={true} />
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Right Column: Search Rivals */}
                <div className="lg:col-span-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="sticky top-24"
                    >
                        <Card className="border-0 bg-white/40 dark:bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-border/50">
                            <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />
                            <CardHeader className="pb-4">
                                <CardTitle className="text-2xl font-black flex items-center gap-3">
                                    <Search className="h-6 w-6 text-primary" />
                                    Buscar Rivales
                                </CardTitle>
                                <CardDescription className="text-base">
                                    Equipos de tu grupo que buscan partido ahora mismo.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AvailablePostsGrid userId={user!.uid} userTeams={teams || []} isActive={true} />
                                <div className="mt-8">
                                    <Link href="/competitions/search" className="block">
                                        <Button className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-2xl group transition-all">
                                            Búsqueda Avanzada
                                            <ArrowLeft className="ml-2 h-5 w-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
