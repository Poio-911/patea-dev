'use client';

import { useEffect, useState } from 'react';
import { getFirestore, collection, getCountFromServer, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Swords, Trophy, Activity, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminDashboardPage() {
    const [metrics, setMetrics] = useState({
        users: 0,
        matches: 0,
        groups: 0,
        activeMatches: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const { firebaseApp } = initializeFirebase();
                const db = getFirestore(firebaseApp);

                // Fetch counts securely using Firebase V9 aggregations (efficient, 1 read per query)
                const [usersSnap, matchesSnap, groupsSnap, activeMatchesSnap] = await Promise.all([
                    getCountFromServer(collection(db, 'users')),
                    getCountFromServer(collection(db, 'matches')),
                    getCountFromServer(collection(db, 'groups')),
                    getCountFromServer(query(collection(db, 'matches'), where('status', 'in', ['active', 'upcoming']))),
                ]);

                setMetrics({
                    users: usersSnap.data().count,
                    matches: matchesSnap.data().count,
                    groups: groupsSnap.data().count,
                    activeMatches: activeMatchesSnap.data().count,
                });

            } catch (err: any) {
                console.error('Error fetching admin metrics:', err);
                setError('No se pudieron cargar las métricas. Verifica tus permisos.');
            } finally {
                setLoading(false);
            }
        }

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Consultando métricas globales...</p>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard General</h1>
                <p className="text-muted-foreground mt-2">
                    Visión panorámica de la plataforma Pateá. Todas las métricas mostradas reflejan datos en tiempo real de Firestore.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.users.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Jugadores registrados en Auth
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Partidos Históricos</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.matches.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Juegos creados en la plataforma
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Partidos Activos/Próximos</CardTitle>
                        <Swords className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {metrics.activeMatches.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Encuentros pendientes de jugar
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Grupos y Ligas</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.groups.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Comunidades formadas
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Espacio reservado para futuras tablas de usuarios/logs */}
            <Card className="mt-8 border-dashed bg-transparent">
                <CardHeader>
                    <CardTitle className="text-muted-foreground">Gestión de Usuarios (Próximamente)</CardTitle>
                    <CardDescription>
                        Aquí se implementará la tabla reactiva para buscar usuarios, editar sus créditos OVR o banearlos del sistema.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
