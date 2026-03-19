import type { MessageTemplate } from './types';

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // Match templates
  {
    id: 'match_confirmation',
    name: 'Confirmación de Partido',
    subject: 'Confirmación: {{homeTeam}} vs {{awayTeam}}',
    body: `Hola equipo,

Se confirma el partido:
📅 Fecha: {{matchDate}}
⏰ Hora: {{matchTime}}
📍 Lugar: {{venue}}
⚽ Equipos: {{homeTeam}} vs {{awayTeam}}

Por favor, confirmá tu asistencia.

¡Nos vemos en la cancha!`,
    category: 'match',
    variables: ['homeTeam', 'awayTeam', 'matchDate', 'matchTime', 'venue'],
  },
  {
    id: 'match_reschedule',
    name: 'Reprogramación de Partido',
    subject: '⚠️ Cambio de fecha: {{homeTeam}} vs {{awayTeam}}',
    body: `Atención equipos,

El partido {{homeTeam}} vs {{awayTeam}} ha sido reprogramado:

❌ Fecha anterior: {{oldDate}} {{oldTime}}
✅ Nueva fecha: {{newDate}} {{newTime}}
📍 Lugar: {{venue}}

Pedimos disculpas por el inconveniente.`,
    category: 'match',
    variables: ['homeTeam', 'awayTeam', 'oldDate', 'oldTime', 'newDate', 'newTime', 'venue'],
  },
  {
    id: 'match_cancellation',
    name: 'Suspensión de Partido',
    subject: '🚫 Partido suspendido: {{homeTeam}} vs {{awayTeam}}',
    body: `Equipos,

Lamentamos informar que el partido {{homeTeam}} vs {{awayTeam}} programado para el {{matchDate}} ha sido suspendido.

Motivo: {{reason}}

Se reprogramará en los próximos días.`,
    category: 'match',
    variables: ['homeTeam', 'awayTeam', 'matchDate', 'reason'],
  },
  {
    id: 'match_reminder',
    name: 'Recordatorio de Partido',
    subject: '⏰ Recordatorio: Partido mañana',
    body: `Hola {{teamName}},

Te recordamos que mañana tenés partido:

⚽ Rival: {{opponentTeam}}
⏰ Hora: {{matchTime}}
📍 Lugar: {{venue}}

¡Prepará el equipo y nos vemos en la cancha!`,
    category: 'match',
    variables: ['teamName', 'opponentTeam', 'matchTime', 'venue'],
  },

  // General templates
  {
    id: 'general_announcement',
    name: 'Anuncio General',
    subject: '📢 Anuncio importante de la liga',
    body: `Hola a todos,

{{message}}

Saludos,
Organización de {{leagueName}}`,
    category: 'general',
    variables: ['message', 'leagueName'],
  },
  {
    id: 'payment_reminder',
    name: 'Recordatorio de Pago',
    subject: '💳 Recordatorio: Cuota pendiente',
    body: `Hola ${'{{teamName}}'},

Te recordamos que tenés una cuota pendiente:

💰 Monto: $${'{{amount}}'}
📅 Vencimiento: ${'{{dueDate}}'}

Por favor, realizá el pago a la brevedad para mantener tu participación en el torneo.

Datos de pago: ${'{{paymentDetails}}'}`,
    category: 'general',
    variables: ['teamName', 'amount', 'dueDate', 'paymentDetails'],
  },
  {
    id: 'rules_update',
    name: 'Actualización de Reglamento',
    subject: '📋 Actualización del reglamento',
    body: `Equipos,

Se ha actualizado el reglamento del torneo {{leagueName}}.

Cambios principales:
{{changes}}

El reglamento completo está disponible en: {{rulesUrl}}

Cualquier consulta, comunicate con la organización.`,
    category: 'general',
    variables: ['leagueName', 'changes', 'rulesUrl'],
  },

  // Emergency templates
  {
    id: 'emergency_alert',
    name: 'Alerta de Emergencia',
    subject: '🚨 URGENTE: {{title}}',
    body: `ATENCIÓN URGENTE

{{message}}

{{instructions}}

Organización de {{leagueName}}`,
    category: 'emergency',
    variables: ['title', 'message', 'instructions', 'leagueName'],
  },
  {
    id: 'weather_alert',
    name: 'Alerta Meteorológica',
    subject: '⛈️ Alerta: Condiciones climáticas',
    body: `Equipos,

Debido a las condiciones climáticas adversas:

🌧️ {{weatherCondition}}

{{action}}

Mantenete atento a nuevas comunicaciones.`,
    category: 'emergency',
    variables: ['weatherCondition', 'action'],
  },

  // Celebration templates
  {
    id: 'champion_announcement',
    name: 'Anuncio de Campeón',
    subject: '🏆 ¡Tenemos campeón!',
    body: `¡FELICITACIONES!

🏆 {{championTeam}} es el nuevo campeón de {{leagueName}}!

🥈 Subcampeón: {{runnerUpTeam}}

Gracias a todos los equipos por su participación.

¡Nos vemos en la próxima temporada!`,
    category: 'celebration',
    variables: ['championTeam', 'leagueName', 'runnerUpTeam'],
  },
  {
    id: 'top_scorer',
    name: 'Goleador del Torneo',
    subject: '⚽ Goleador del torneo',
    body: `¡Felicitaciones a {{playerName}}!

⚽ Goleador del torneo {{leagueName}}
🎯 {{goals}} goles

¡Increíble desempeño!`,
    category: 'celebration',
    variables: ['playerName', 'leagueName', 'goals'],
  },
  {
    id: 'milestone',
    name: 'Hito Alcanzado',
    subject: '🎉 {{milestone}}',
    body: `¡Gran logro!

{{message}}

Gracias a todos por ser parte de {{leagueName}}.`,
    category: 'celebration',
    variables: ['milestone', 'message', 'leagueName'],
  },
];

export function getTemplatesByCategory(category: MessageTemplate['category']): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find(t => t.id === id);
}

export function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });
  return result;
}
