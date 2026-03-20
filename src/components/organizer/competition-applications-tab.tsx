'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { reviewTeamApplicationAction } from '@/lib/actions/registration-actions';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, Clock, Users, Mail, Phone,
  MessageSquare, ChevronDown, ChevronUp, ClipboardList, Loader2, MinusCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
// Local interface supporting both TeamApplication and CompetitionApplication shapes
interface ApplicationDisplay {
  id: string;
  teamName: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  submittedAt: string;
  reviewNotes?: string;
  captainName?: string;
  captainEmail?: string;
  captainPhone?: string;
  playerCount?: number;
  message?: string;
  [key: string]: any;
}

interface CompetitionApplicationsTabProps {
  competitionId: string;
  competitionType?: 'leagues' | 'cups';
}

const statusConfig = {
  pending: { label: 'Pendiente', icon: Clock, className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30 dark:text-yellow-400' },
  approved: { label: 'Aprobado', icon: CheckCircle2, className: 'bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400' },
  rejected: { label: 'Rechazado', icon: XCircle, className: 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400' },
  revoked: { label: 'Revocada', icon: MinusCircle, className: 'bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-300' },
} as const;

function ApplicationCard({
  app,
  competitionId,
  competitionType,
  onReviewed,
}: {
  app: ApplicationDisplay;
  competitionId: string;
  competitionType: 'leagues' | 'cups';
  onReviewed: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState(app.status === 'pending');
  const [reviewNotes, setReviewNotes] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const statusCfg = statusConfig[app.status];
  const StatusIcon = statusCfg.icon;

  const handleReview = async (status: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const result = await reviewTeamApplicationAction({
        competitionId,
        competitionType,
        applicationId: app.id,
        status,
        reviewNotes,
      });
      if (result.success) {
        toast({
          title: status === 'approved' ? '✅ Solicitud aprobada' : '❌ Solicitud rechazada',
          description: `El equipo "${app.teamName}" fue ${status === 'approved' ? 'aprobado' : 'rechazado'}.`,
        });
        onReviewed();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate">{app.teamName}</p>
            {app.captainName && <p className="text-xs text-muted-foreground">{app.captainName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-xs gap-1 ${statusCfg.className}`}>
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-sm">
            {app.captainEmail && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a href={`mailto:${app.captainEmail}`} className="truncate hover:underline text-foreground">
                  {app.captainEmail}
                </a>
              </span>
            )}
            {app.captainPhone && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{app.captainPhone}</span>
              </span>
            )}
            {app.playerCount && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>{app.playerCount} jugadores</span>
              </span>
            )}
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{format(parseISO(app.submittedAt), "d MMM yyyy, HH:mm", { locale: es })}</span>
            </span>
          </div>

          {app.message && (
            <div className="flex gap-2 p-3 rounded-lg bg-muted/30 text-sm">
              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-muted-foreground italic">{app.message}</p>
            </div>
          )}

          {app.status === 'pending' && (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="Notas internas (opcional, no se envían al equipo)"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={2}
                className="bg-muted/30 resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
                  disabled={isProcessing}
                  onClick={() => handleReview('approved')}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-500/40 text-red-500 hover:bg-red-500/10 font-bold"
                  disabled={isProcessing}
                  onClick={() => handleReview('rejected')}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                  Rechazar
                </Button>
              </div>
            </div>
          )}

          {app.status !== 'pending' && app.reviewNotes && (
            <p className="text-xs text-muted-foreground italic px-1">
              Nota: {app.reviewNotes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CompetitionApplicationsTab({ competitionId, competitionType = 'leagues' }: CompetitionApplicationsTabProps) {
  const firestore = useFirestore();
  // Two sources: root collection (from public explorer) + subcollection (from registration form)
  const [rootApps, setRootApps] = React.useState<ApplicationDisplay[]>([]);
  const [subApps, setSubApps] = React.useState<ApplicationDisplay[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected' | 'revoked'>('all');

  // Merge and deduplicate by ID, root apps take precedence
  const applications = React.useMemo(() => {
    const rootIds = new Set(rootApps.map(a => a.id));
    return [...rootApps, ...subApps.filter(a => !rootIds.has(a.id))].sort(
      (a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')
    );
  }, [rootApps, subApps]);

  React.useEffect(() => {
    if (!firestore) return;

    let rootLoaded = false;
    let subLoaded = false;

    // Query 1: root competitionApplications collection (from public explorer)
    const rootRef = collection(firestore, 'competitionApplications');
    const rootQuery = query(rootRef, where('competitionId', '==', competitionId));
    const unsubRoot = onSnapshot(rootQuery, (snap) => {
      setRootApps(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApplicationDisplay)));
      rootLoaded = true;
      if (rootLoaded && subLoaded) setLoading(false);
    });

    // Query 2: subcollection (from registration form)
    const subRef = collection(firestore, competitionType, competitionId, 'applications');
    const unsubSub = onSnapshot(query(subRef), (snap) => {
      setSubApps(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApplicationDisplay)));
      subLoaded = true;
      if (rootLoaded && subLoaded) setLoading(false);
    });

    return () => { unsubRoot(); unsubSub(); };
  }, [firestore, competitionId, competitionType]);

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const filtered = filter === 'all' ? applications : applications.filter(a => a.status === filter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Solicitudes de Inscripción</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length === 0 ? 'Sin solicitudes todavía.' : `${applications.length} solicitud${applications.length !== 1 ? 'es' : ''} recibida${applications.length !== 1 ? 's' : ''}.`}
            {pendingCount > 0 && <span className="text-yellow-500 font-semibold"> · {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected', 'revoked'] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="text-xs h-7 px-3"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todas' : statusConfig[f].label}
              {f === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-yellow-500 text-white text-[10px] flex items-center justify-center font-black">
                  {pendingCount}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed bg-card/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all' ? 'No hay solicitudes de inscripción aún.' : `No hay solicitudes ${statusConfig[filter as keyof typeof statusConfig]?.label.toLowerCase()}.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(app => (
            <ApplicationCard
              key={app.id}
              app={app}
              competitionId={competitionId}
              competitionType={competitionType}
              onReviewed={() => {}} // real-time via onSnapshot
            />
          ))}
        </div>
      )}
    </div>
  );
}
