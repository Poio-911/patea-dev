'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, MessageSquare, Users, UserCheck, Sparkles, History, Trash2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sendCompetitionMessageAction, getCompetitionMessagesAction, deleteCompetitionMessageAction } from '@/lib/actions/communication-actions';
import { MESSAGE_TEMPLATES, getTemplatesByCategory, replaceVariables } from '@/lib/message-templates';
import type { CommunicationMessage, MessageRecipientType, MessageTemplate } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface CompetitionCommunicationTabProps {
  competitionId: string;
  competitionName: string;
  competitionType?: 'leagues' | 'cups';
}

export function CompetitionCommunicationTab({ competitionId, competitionName, competitionType = 'leagues' }: CompetitionCommunicationTabProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = React.useState(false);
  const [messages, setMessages] = React.useState<CommunicationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(true);

  // Form state
  const [recipientType, setRecipientType] = React.useState<MessageRecipientType>('all_teams');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [selectedTemplate, setSelectedTemplate] = React.useState<MessageTemplate | null>(null);
  const [showTemplates, setShowTemplates] = React.useState(false);

  // Load messages
  const loadMessages = React.useCallback(async () => {
    setLoadingMessages(true);
    const result = await getCompetitionMessagesAction(competitionId, competitionType);
    if (result.success && result.messages) {
      setMessages(result.messages);
    }
    setLoadingMessages(false);
  }, [competitionId, competitionType]);

  React.useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Completá el asunto y el mensaje.' });
      return;
    }

    setIsSending(true);
    try {
      const result = await sendCompetitionMessageAction({
        competitionId,
        competitionType,
        recipientType,
        recipientIds: [], // Simplified: will be calculated in server action
        subject,
        body,
        templateId: selectedTemplate?.id,
        priority: 'normal',
        deliveryMethod: ['push'],
      });

      if (result.success) {
        toast({
          title: '✅ Mensaje enviado',
          description: `Se envió a ${result.recipientCount} destinatarios.`,
        });
        setSubject('');
        setBody('');
        setSelectedTemplate(null);
        loadMessages(); // Reload messages
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBody(template.body);
    setShowTemplates(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const result = await deleteCompetitionMessageAction(competitionId, competitionType, messageId);
    if (result.success) {
      toast({ title: 'Mensaje eliminado' });
      loadMessages();
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="compose">
            <Send className="mr-2 h-4 w-4" /> Enviar Mensaje
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Recipient Type */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest">Destinatarios</Label>
                <Select value={recipientType} onValueChange={(v) => setRecipientType(v as MessageRecipientType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_teams">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Todos los Equipos
                      </div>
                    </SelectItem>
                    <SelectItem value="all_captains">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Todos los Capitanes
                      </div>
                    </SelectItem>
                    <SelectItem value="all_referees">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Todos los Árbitros
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template Button */}
              <Button
                variant="outline"
                onClick={() => setShowTemplates(true)}
                className="w-full border-primary/30 text-primary hover:bg-primary/5"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Usar Plantilla
              </Button>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-widest">Asunto</Label>
                <Input
                  id="subject"
                  placeholder="Ej: Recordatorio de partido"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="body" className="text-xs font-bold uppercase tracking-widest">Mensaje</Label>
                <Textarea
                  id="body"
                  placeholder="Escribí tu mensaje aquí..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                />
              </div>

              {selectedTemplate && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    Usando plantilla: <strong>{selectedTemplate.name}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {/* Send Button */}
              <Button onClick={handleSend} disabled={isSending} className="w-full" size="lg">
                {isSending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Enviar Mensaje
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center flex flex-col items-center gap-4">
                <MessageSquare className="h-16 w-16 text-muted-foreground/30" />
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">No hay mensajes enviados</h3>
                  <p className="text-sm text-muted-foreground">
                    Los mensajes que envíes aparecerán aquí.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {messages.map(message => (
                <Card key={message.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base">{message.subject}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {message.recipientType.replace('_', ' ')}
                          </Badge>
                          {message.priority === 'urgent' && (
                           <Badge variant="destructive" className="text-xs">URGENTE</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{message.body}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true, locale: es })}
                          </span>
                          {message.deliveryStatus && (
                            <span>
                              📤 {message.deliveryStatus.push.sent} enviados
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-headline font-black text-2xl uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Plantillas de Mensajes
            </DialogTitle>
            <DialogDescription>
              Seleccioná una plantilla para personalizar y enviar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {['match', 'general', 'emergency', 'celebration'].map(category => (
              <div key={category} className="space-y-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  {category === 'match' && '⚽ Partidos'}
                  {category === 'general' && '📢 General'}
                  {category === 'emergency' && '🚨 Emergencia'}
                  {category === 'celebration' && '🎉 Celebración'}
                </h3>
                <div className="grid gap-2">
                  {getTemplatesByCategory(category as any).map(template => (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="justify-start h-auto py-3 px-4 text-left"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div>
                        <div className="font-bold">{template.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {template.subject}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
