
import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-player-improvements.ts';
import '@/ai/flows/generate-balanced-teams.ts';
import '@/ai/flows/get-match-day-forecast.ts';
import '@/ai/flows/generate-welcome-message.ts';
import '@/ai/flows/generate-fake-ad.ts';
import '@/ai/flows/generate-evaluation-tags.ts';
import '@/ai/flows/find-best-fit-player.ts';
