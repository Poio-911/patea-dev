
'use client';

import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Match, Player } from '@/lib/types';
import { MatchCard } from '@/components/match-card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MatchesCalendarProps {
  matches: Match[];
  allPlayers: Player[];
}

export function MatchesCalendar({ matches, allPlayers }: MatchesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Calcular días del calendario (incluye días del mes anterior/siguiente)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Agrupar partidos por fecha
  const matchesByDate = useMemo(() => {
    const grouped = new Map<string, Match[]>();
    matches.forEach(match => {
      const dateKey = format(new Date(match.date), 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(match);
    });
    return grouped;
  }, [matches]);

  // Partidos de la fecha seleccionada
  const selectedDateMatches = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return matchesByDate.get(dateKey) || [];
  }, [selectedDate, matchesByDate]);

  // Navegación
  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-bold capitalize w-40 text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Hoy
        </Button>
      </div>

      {/* Grid del calendario */}
      <Card>
        <CardContent className="p-2">
          {/* Encabezados de días */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>

          {/* Días del calendario */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayMatches = matchesByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <motion.button
                  key={day.toISOString()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative aspect-square p-1 rounded-md border-2 transition-colors flex items-center justify-center",
                    "hover:border-primary/50 hover:bg-accent",
                    isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                    isSelected && "border-primary bg-primary/10",
                    isTodayDate && !isSelected && "border-blue-500 bg-blue-50 dark:bg-blue-950",
                    !isCurrentMonth && "opacity-50"
                  )}
                >
                  <div className="text-xs font-medium">{format(day, 'd')}</div>

                  {/* Indicadores de partidos */}
                  {dayMatches.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayMatches.slice(0, 3).map((match, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 w-1 rounded-full",
                            match.status === 'upcoming' || match.status === 'active'
                              ? "bg-green-500"
                              : "bg-gray-400"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Partidos de la fecha seleccionada */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate.toISOString()}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize text-base">
                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                  </CardTitle>
                  <Badge variant="secondary">{selectedDateMatches.length} partido(s)</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {selectedDateMatches.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {selectedDateMatches.map(match => (
                      <MatchCard key={match.id} match={match} allPlayers={allPlayers} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No hay partidos programados para esta fecha.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
