
import { config } from 'dotenv';
config({ path: './.env' }); // Make sure to specify the path to your .env file

import '@/ai/flows/suggest-player-improvements.ts';
import '@/ai/flows/generate-balanced-teams.ts';
import '@/ai/flows/get-match-day-forecast.ts';
import '@/ai/flows/generate-fake-ad.ts';
import '@/ai/flows/find-best-fit-player.ts';
import '@/ai/flows/generate-player-card-image.ts';
import '@/ai/flows/generate-group-summary.ts';
import '@/ai/flows/get-football-headlines.ts';
import '@/ai/flows/coach-conversation.ts';
import '@/ai/flows/detect-player-patterns.ts';
