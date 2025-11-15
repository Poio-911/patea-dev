'use client';

import { useState, useEffect } from 'react';
import { CompetitionApplication, CompetitionFormat } from '@/lib/types';
import {
  getCompetitionApplicationsAction,
  approveApplicationAction,
  rejectApplicationAction,
} from '@/lib/actions/server-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { JerseyPreview } from '../team-builder/jersey-preview';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ApplicationsManagerProps {
  competitionId: string;
  competitionType: CompetitionFormat;
  competitionName: string;
}

export function ApplicationsManager({
  competitionId,
  competitionType,
  competitionName,
}: ApplicationsManagerProps) {
  const [applications, setApplications] = useState<CompetitionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadApplications();
  }, [competitionId]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const result = await getCompetitionApplicationsAction(competitionId, competitionType);
      if (result.success) {
        setApplications(result.applications || []);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudieron cargar las aplicaciones.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al cargar aplicaciones.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (applicationId: string) => {
    setProcessing(applicationId);
    try {
      const result = await approveApplicationAction(applicationId, competitionId, competitionType);
      if (result.success) {
        toast({
          title: 'Aplicación aprobada',
          description: 'El equipo ha sido agregado a la competición.',
        });
        await loadApplications(); // Reload to update status
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo aprobar la aplicación.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al aprobar aplicación.',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    setProcessing(applicationId);
    try {
      const result = await rejectApplicationAction(applicationId);
      if (result.success) {
        toast({
          title: 'Aplicación rechazada',
          description: 'La aplicación ha sido rechazada.',
        });
        await loadApplications(); // Reload to update status
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo rechazar la aplicación.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Error al rechazar aplicación.',
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const approvedApplications = applications.filter(app => app.status === 'approved');
  const rejectedApplications = applications.filter(app => app.status === 'rejected');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-2">Gestión de Aplicaciones</h3>
        <p className="text-sm text-muted-foreground">
          Revisa y gestiona las postulaciones de equipos para {competitionName}
        </p>
      </div>

      {applications.length === 0 && (
        <Alert>
          <AlertDescription>
            Aún no hay aplicaciones para esta competición.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Applications */}
      {pendingApplications.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingApplications.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingApplications.map(application => (
              <ApplicationCard
                key={application.id}
                application={application}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={processing === application.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Approved Applications */}
      {approvedApplications.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2 text-green-600">
            <Check className="h-4 w-4" />
            Aprobadas ({approvedApplications.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {approvedApplications.map(application => (
              <ApplicationCard
                key={application.id}
                application={application}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={processing === application.id}
                readonly
              />
            ))}
          </div>
        </div>
      )}

      {/* Rejected Applications */}
      {rejectedApplications.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
            <X className="h-4 w-4" />
            Rechazadas ({rejectedApplications.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rejectedApplications.map(application => (
              <ApplicationCard
                key={application.id}
                application={application}
                onApprove={handleApprove}
                onReject={handleReject}
                isProcessing={processing === application.id}
                readonly
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ApplicationCardProps {
  application: CompetitionApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
  readonly?: boolean;
}

function ApplicationCard({ application, onApprove, onReject, isProcessing, readonly }: ApplicationCardProps) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  };

  const statusLabels = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 flex-shrink-0">
              <JerseyPreview jersey={application.teamJersey} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{application.teamName}</CardTitle>
              <CardDescription className="text-xs">
                {format(new Date(application.submittedAt), "d 'de' MMMM, HH:mm'hs'", { locale: es })}
              </CardDescription>
            </div>
          </div>
          <Badge className={statusColors[application.status]}>
            {statusLabels[application.status]}
          </Badge>
        </div>
      </CardHeader>

      {!readonly && application.status === 'pending' && (
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => onApprove(application.id)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Aprobar
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onReject(application.id)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="mr-1 h-4 w-4" />
                  Rechazar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
