/** `date` es el día elegido (web YYYY-MM-DD o ISO de Flutter), no el horario. */
export function buildMatchDateTime(date: string, time: string): Date | null {
  if (typeof date !== 'string' || typeof time !== 'string') return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !clock || Number(clock[1]) > 23 || Number(clock[2]) > 59) return null;
  const calendar = new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
  const dateOnly = `${day[1]}-${day[2]}-${day[3]}`;
  if (calendar.toISOString().slice(0, 10) !== dateOnly) return null;
  const result = new Date(`${dateOnly}T${time}:00-03:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}
