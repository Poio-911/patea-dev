'use client';

import { useState, useEffect } from 'react';
import type { Match, Evaluation, SelfEvaluation, Player, PerformanceTag } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { Loader2, Sparkles, Newspaper, Users, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { generateMatchChronicleAction, generateDuoImageAction } from '@/lib/actions/server-actions';
import { type GenerateMatchChronicleOutput } from '@/ai/flows/generate-match-chronicle';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface MatchChronicleCardProps {
  match: Match;
}

export function MatchChronicleCard({ match }: MatchChronicleCardProps) {
  const [chronicle, setChronicle] = useState<GenerateMatchChronicleOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [duoImage, setDuoImage] = useState<string | null>(null);
  const [selectedPlayer1, setSelectedPlayer1] = useState<string>('');
  const [selectedPlayer2, setSelectedPlayer2] = useState<string>('none');
  const [showDuoSection, setShowDuoSection] = useState(false);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selfEvaluations, setSelfEvaluations] = useState<SelfEvaluation[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleGenerateChronicle = async () => {
    console.log('[MatchChronicleCard] Starting chronicle generation for match:', match.id);
    setIsLoading(true);
    try {
      console.log('[MatchChronicleCard] Calling server action...');
      const result = await generateMatchChronicleAction(match.id);
      console.log('[MatchChronicleCard] Server action result:', result);
      
      if (result.error) {
        console.error('[MatchChronicleCard] Server returned error:', result.error);
        throw new Error(result.error);
      }
      
      if (!result.data) {
        console.error('[MatchChronicleCard] Server returned no data');
        throw new Error('No se recibieron datos de la crónica');
      }
      
      console.log('[MatchChronicleCard] Chronicle generated successfully:', result.data);
      setChronicle(result.data);
      toast({ title: 'Crónica generada', description: 'La crónica del partido está lista.' });
    } catch (error: any) {
      console.error('[MatchChronicleCard] Error in handleGenerateChronicle:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo generar la crónica.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Función para generar prompt inteligente basado en evaluaciones de jugadores
  const generateIntelligentPrompt = (player1Id: string, player2Id?: string): string => {
    const player1Evals = evaluations.filter(e => e.playerId === player1Id);
    const player1SelfEval = selfEvaluations.find(se => se.playerId === player1Id);
    const player1Goals = player1SelfEval?.goals || 0;
    
    if (!player2Id) {
      // Imagen de un solo jugador
      const tags = player1Evals.flatMap(e => e.performanceTags || []);
      const avgRating = player1Evals.length > 0 ? 
        player1Evals.reduce((sum, e) => sum + (e.rating || 0), 0) / player1Evals.filter(e => e.rating).length : 0;
      
      if (player1Goals >= 2) {
        return `${match.players.find(p => p.uid === player1Id)?.displayName} celebrando un gol espectacular, con expresión de triunfo y los brazos levantados al cielo en un momento épico del partido`;
      } else if (avgRating >= 9) {
        return `${match.players.find(p => p.uid === player1Id)?.displayName} en una jugada brillante, demostrando su técnica excepcional con el balón en los pies`;
      } else if (tags.some(t => t.name?.includes('Defensa') || t.name?.includes('Marca'))) {
        return `${match.players.find(p => p.uid === player1Id)?.displayName} realizando una defensa crucial, con determinación y concentración máxima`;
      } else if (tags.some(t => t.name?.includes('Pase') || t.name?.includes('Asistencia'))) {
        return `${match.players.find(p => p.uid === player1Id)?.displayName} ejecutando un pase perfecto, con precisión técnica y visión de juego`;
      } else {
        return `${match.players.find(p => p.uid === player1Id)?.displayName} en acción durante el partido, mostrando intensidad y pasión por el fútbol`;
      }
    } else {
      // Imagen de dos jugadores
      const player2Evals = evaluations.filter(e => e.playerId === player2Id);
      const player2SelfEval = selfEvaluations.find(se => se.playerId === player2Id);
      const player2Goals = player2SelfEval?.goals || 0;
      
      const player1Tags = player1Evals.flatMap(e => e.performanceTags || []);
      const player2Tags = player2Evals.flatMap(e => e.performanceTags || []);
      
      const player1Name = match.players.find(p => p.uid === player1Id)?.displayName;
      const player2Name = match.players.find(p => p.uid === player2Id)?.displayName;
      
      // Analizar coincidencias de rendimiento
      if (player1Goals > 0 && player2Goals > 0) {
        return `${player1Name} y ${player2Name} celebrando juntos un gol, abrazándose con alegría y emoción después de una jugada espectacular`;
      } else if (player1Tags.some(t => t.name?.includes('Pase')) && player2Tags.some(t => t.name?.includes('Gol'))) {
        return `${player1Name} asistiendo a ${player2Name} en una jugada de gol, mostrando la perfecta conexión entre ambos jugadores`;
      } else if (player1Tags.some(t => t.name?.includes('Defensa')) && player2Tags.some(t => t.name?.includes('Defensa'))) {
        return `${player1Name} y ${player2Name} trabajando juntos en defensa, coordinando una marca perfecta con determinación`;
      } else {
        return `${player1Name} y ${player2Name} en una jugada colaborativa durante el partido, demostrando trabajo en equipo y compañerismo`;
      }
    }
  };

  // Función para generar imagen de dúo
  const handleGenerateDuoImage = async () => {
    if (!selectedPlayer1) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos un jugador.' });
      return;
    }
    
    const player1 = match.players.find(p => p.uid === selectedPlayer1);
    const player2 = selectedPlayer2 && selectedPlayer2 !== 'none' ? match.players.find(p => p.uid === selectedPlayer2) : null;
    
    if (!player1?.photoUrl || (selectedPlayer2 !== 'none' && selectedPlayer2 && !player2?.photoUrl)) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: 'Los jugadores seleccionados deben tener fotos de perfil.' 
      });
      return;
    }
    
    setIsGeneratingImage(true);
    
    try {
      const prompt = generateIntelligentPrompt(selectedPlayer1, selectedPlayer2 === 'none' ? undefined : selectedPlayer2);
      
      const result = await generateDuoImageAction({
        player1PhotoUrl: player1.photoUrl,
        player1Name: player1.displayName,
        player2PhotoUrl: player2?.photoUrl,
        player2Name: player2?.displayName,
        prompt
      });
      
      if ('error' in result) {
        throw new Error(result.error);
      }
      
      setDuoImage(result.imageUrl);
      toast({ 
        title: 'Imagen generada', 
        description: `¡La imagen de ${player2 ? 'la dupla' : 'el jugador'} está lista!` 
      });
    } catch (error: any) {
      console.error('Error generating duo image:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message || 'No se pudo generar la imagen.' 
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  if (match.status !== 'evaluated' || !match.teams || match.teams.length < 2) {
    return null;
  }

  return (
    <Card className="surface hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-semibold">
          <Newspaper className="h-5 w-5 text-primary" />
          Crónica del Partido
        </CardTitle>
        <CardDescription>
          Un resumen del partido generado por IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <div className="relative">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="absolute inset-0 h-12 w-12 rounded-full bg-gradient-to-r from-primary/20 to-transparent animate-ping"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-lg">Generando crónica épica...</p>
              <p className="text-sm text-muted-foreground">La IA está analizando cada jugada</p>
            </div>
          </div>
        ) : chronicle ? (
          <div className="space-y-4">
            {/* Titular */}
            <div className="p-4 border-l-4 border-primary gradient-primary rounded">
              <h3 className="text-xl font-bold text-foreground">
                {chronicle.headline}
              </h3>
            </div>
            
            {/* Introducción */}
            <div className="p-3 surface-muted">
              <p className="text-sm leading-relaxed text-muted-foreground italic">
                &ldquo;{chronicle.introduction}&rdquo;
              </p>
            </div>
            
            {/* Momentos clave */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-primary border-b border-border pb-1">
                Momentos Clave
              </h4>
              
              {chronicle.keyMoments.map((moment, index) => (
                <div key={index} className="flex gap-3 p-3 surface-muted hover:bg-muted/60 transition-colors">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <span className="font-bold text-xs text-primary">{moment.minute}'</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{moment.event}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Conclusión */}
            <div className="p-3 surface-muted">
              <p className="font-medium text-sm leading-relaxed">{chronicle.conclusion}</p>
            </div>
            
            <Separator className="my-6" />
            
            {/* Sección de Imagen de Dúo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Users className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm text-primary">Generar Chromo</h4>
              </div>
              
              {!showDuoSection ? (
                <Button 
                  onClick={() => setShowDuoSection(true)} 
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Image className="mr-2 h-4 w-4" />
                  Crear Chromo de Jugadores
                </Button>
              ) : (
                <div className="space-y-4 p-4 surface-muted">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="player1" className="text-sm font-medium">
                        Jugador Principal *
                      </Label>
                      <Select value={selectedPlayer1} onValueChange={setSelectedPlayer1}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar jugador" />
                        </SelectTrigger>
                        <SelectContent>
                          {match.players
                            .filter(p => p.photoUrl) // Solo jugadores con foto
                            .map(player => (
                              <SelectItem key={player.uid} value={player.uid}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                    <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span>{player.displayName}</span>
                                  <Badge variant="secondary" className="text-xs">{player.position}</Badge>
                                </div>
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="player2" className="text-sm font-medium">
                        Segundo Jugador (Opcional)
                      </Label>
                      <Select value={selectedPlayer2} onValueChange={setSelectedPlayer2}>
                        <SelectTrigger>
                          <SelectValue placeholder="Imagen individual" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Solo un jugador</span>
                          </SelectItem>
                          {match.players
                            .filter(p => p.photoUrl && p.uid !== selectedPlayer1)
                            .map(player => (
                              <SelectItem key={player.uid} value={player.uid}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                    <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span>{player.displayName}</span>
                                  <Badge variant="secondary" className="text-xs">{player.position}</Badge>
                                </div>
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleGenerateDuoImage}
                      disabled={!selectedPlayer1 || isGeneratingImage}
                      className="flex-1"
                      size="sm"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generar Chromo
                        </>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        setShowDuoSection(false);
                        setSelectedPlayer1('');
                        setSelectedPlayer2('none');
                        setDuoImage(null);
                      }}
                      className="bg-gradient-to-r from-gray-600/80 to-gray-500/80 hover:from-gray-500 hover:to-gray-400 border-gray-400/50 text-white font-semibold shadow-lg shadow-gray-500/25 hover:shadow-gray-500/40 transition-all duration-300"
                      size="lg"
                    >
                      Cancelar
                    </Button>
                  </div>
                  
                  {duoImage && (
                    <div className="mt-6 relative z-10">
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/10 border border-green-500/30">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">🏆 Chromo Generado</span>
                        </div>
                      </div>
                      <div className="relative group/image">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-amber-500/20 rounded-xl opacity-0 group-hover/image:opacity-100 transition-opacity duration-500"></div>
                        <img 
                          src={duoImage} 
                          alt="Chromo generado" 
                          className="w-full max-w-lg mx-auto rounded-xl shadow-2xl border-2 border-primary/20 group-hover/image:border-primary/40 transition-all duration-500 group-hover/image:scale-105" 
                        />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-500"></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 rounded-full bg-muted border">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Generar Crónica
                </h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  Crea un resumen del partido con los momentos más destacados
                </p>
              </div>
              <Button 
                onClick={handleGenerateChronicle} 
                className="font-medium"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generar Crónica
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
