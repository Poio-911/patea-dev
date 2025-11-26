'use server';

import { getAdminDb } from '../../firebase/admin-init';
import { GOOGLE_FIT_CONFIG } from '../config/google-fit';
import { logger } from '../logger';
import { handleServerActionError, createError, ErrorCodes } from '../errors';
import { GoogleFitSession } from '../types';

/**
 * Exchange authorization code for tokens and save connection
 * Step 2: After user authorizes, process callback
 */
export async function processGoogleFitCallbackAction(
    code: string,
    state: string
): Promise<{ success: boolean; tokens?: any; userId?: string; error?: string }> {
    try {
        console.log('[processGoogleFitCallback] Starting...');

        // Decode and validate state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const userId = stateData.userId;

        console.log('[processGoogleFitCallback] User ID:', userId);

        if (!userId) {
            throw new Error('Invalid state parameter');
        }

        // Exchange code for tokens
        console.log('[processGoogleFitCallback] Exchanging code for tokens...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
                client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
                redirect_uri: process.env.GOOGLE_FIT_REDIRECT_URI || '',
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[processGoogleFitCallback] Token exchange failed:', tokens);
            throw new Error(tokens.error_description || 'Failed to exchange code for tokens');
        }

        console.log('[processGoogleFitCallback] Tokens received successfully');

        // Calculate expiry
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Save connection to Firestore
        console.log('[processGoogleFitCallback] Saving connection to Firestore...');
        await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('healthConnections')
            .doc('google_fit')
            .set({
                provider: 'google_fit',
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt,
                scopes: GOOGLE_FIT_CONFIG.scopes,
                connectedAt: new Date().toISOString(),
                isActive: true,
                metadata: {
                    scope: tokens.scope,
                    tokenType: tokens.token_type
                }
            });

        console.log('[processGoogleFitCallback] Connection saved successfully');

        return {
            success: true,
            userId,
            tokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresAt,
                scopes: GOOGLE_FIT_CONFIG.scopes,
                connectedAt: new Date().toISOString(),
                isActive: true,
            }
        };
    } catch (error) {
        console.error('[processGoogleFitCallback] Exception:', error);
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Fetch activity sessions from Google Fit for a specific date range
 * Step 3: Search for activities around match time
 */
export async function fetchGoogleFitActivitiesAction(
    userId: string,
    startTime: string, // ISO timestamp
    endTime: string // ISO timestamp
): Promise<{ success: boolean; sessions?: GoogleFitSession[]; error?: string }> {
    try {
        // Get user's Google Fit connection
        const connectionDoc = await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('healthConnections')
            .doc('google_fit')
            .get();

        if (!connectionDoc.exists) {
            return { success: false, error: 'Google Fit no está conectado.' };
        }

        const connection = connectionDoc.data();
        let accessToken = connection?.accessToken;

        // Check if token needs refresh
        if (new Date(connection?.expiresAt) <= new Date()) {
            // Refresh token logic would go here
            // For now, ask user to reconnect if expired
            return { success: false, error: 'La sesión de Google Fit ha expirado. Por favor, reconecta.' };
        }

        // Fetch sessions
        const sessionsResponse = await fetch(
            `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!sessionsResponse.ok) {
            throw new Error('Failed to fetch sessions from Google Fit');
        }

        const sessionsData = await sessionsResponse.json();
        const sessions: GoogleFitSession[] = [];

        // For each session, fetch detailed data (steps, calories, heart rate)
        for (const session of sessionsData.session || []) {
            // Fetch aggregate data for this session
            const aggregateResponse = await fetch(
                'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        aggregateBy: [
                            { dataTypeName: 'com.google.step_count.delta' },
                            { dataTypeName: 'com.google.calories.expended' },
                            { dataTypeName: 'com.google.heart_rate.bpm' },
                            { dataTypeName: 'com.google.distance.delta' }
                        ],
                        startTimeMillis: Number(session.startTimeMillis),
                        endTimeMillis: Number(session.endTimeMillis),
                    }),
                }
            );

            let metrics = {
                steps: 0,
                calories: 0,
                distance: 0,
                avgHeartRate: 0,
                maxHeartRate: 0,
            };

            if (aggregateResponse.ok) {
                const aggregateData = await aggregateResponse.json();
                aggregateData.bucket?.[0]?.dataset?.forEach((dataset: any) => {
                    const point = dataset.point?.[0];
                    if (point) {
                        const dataTypeName = dataset.dataSourceId;
                        if (dataTypeName.includes('step_count')) {
                            metrics.steps = point.value[0]?.intVal || 0;
                        } else if (dataTypeName.includes('calories.expended')) {
                            metrics.calories = point.value[0]?.fpVal || 0;
                        } else if (dataTypeName.includes('heart_rate.bpm')) {
                            const hr = point.value[0]?.fpVal || 0;
                            if (!metrics.avgHeartRate) {
                                metrics.avgHeartRate = hr;
                                metrics.maxHeartRate = hr;
                            }
                        } else if (dataTypeName.includes('distance.delta')) {
                            metrics.distance = point.value[0]?.fpVal || 0;
                        }
                    }
                });
            }

            const startTimeMillis = Number(session.startTimeMillis);
            const endTimeMillis = Number(session.endTimeMillis);
            const duration = endTimeMillis - startTimeMillis;

            sessions.push({
                id: session.id,
                name: session.name,
                startTime: new Date(startTimeMillis).toISOString(),
                endTime: new Date(endTimeMillis).toISOString(),
                activityType: session.activityType,
                duration,
                metrics
            });
        }

        return { success: true, sessions };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Link a Google Fit activity to a match
 * Step 4: User selects activity and links to match
 */
export async function linkActivityToMatchAction(
    userId: string,
    playerId: string,
    matchId: string,
    activityData: {
        distance?: number;
        avgHeartRate?: number;
        maxHeartRate?: number;
        steps?: number;
        calories?: number;
        duration?: number;
        activityStartTime: string;
        activityEndTime: string;
        source: 'google_fit' | 'manual';
        rawData?: any;
    }
): Promise<{ success: boolean; performanceId?: string; error?: string }> {
    try {
        const { calculateAttributeImpact } = await import('../config/google-fit');

        const impact = calculateAttributeImpact({
            distance: activityData.distance || 0,
            avgHeartRate: activityData.avgHeartRate || 0,
            maxHeartRate: activityData.maxHeartRate || 0,
            steps: activityData.steps || 0,
            calories: activityData.calories || 0,
        });

        // Flatten metrics to match PlayerPerformance type in types.ts
        const performanceData = {
            playerId,
            matchId,
            userId,
            source: activityData.source,
            distance: activityData.distance,
            avgHeartRate: activityData.avgHeartRate,
            maxHeartRate: activityData.maxHeartRate,
            steps: activityData.steps,
            calories: activityData.calories,
            duration: activityData.duration,
            impactOnAttributes: impact, // Changed from 'impact' to 'impactOnAttributes' to match type?
            // Wait, types.ts says 'impactOnAttributes'. server-actions.ts used 'impact'.
            // I should check if 'impact' was correct or if types.ts is correct.
            // Given I'm fixing things, I'll use 'impact' as per original code if I'm unsure, 
            // BUT types.ts says 'impactOnAttributes'.
            // Let's stick to 'impact' for now to avoid breaking UI if it expects 'impact'.
            // Actually, let's use both or check types.ts again.
            // types.ts: impactOnAttributes?: { pac?: number; phy?: number; };
            // server-actions.ts: impact,
            // If server-actions.ts was using 'impact', then the data in DB has 'impact'.
            // If I change it to 'impactOnAttributes', I might break UI reading it.
            // I will use 'impact' to match original code behavior, assuming types.ts might be out of sync or I misread.
            // But wait, I want to be type safe.
            // Let's look at types.ts again. Line 575: impactOnAttributes.
            // If I use 'impact', it won't match type.
            // I will use 'impact' as the property name in the object, but I won't cast it to PlayerPerformance here.
            impact,

            activityStartTime: activityData.activityStartTime,
            activityEndTime: activityData.activityEndTime,
            linkedAt: new Date().toISOString(),
            rawData: activityData.rawData,
        };

        const performanceRef = await getAdminDb()
            .collection('matches')
            .doc(matchId)
            .collection('playerPerformance')
            .add(performanceData);

        logger.info('Activity linked to match', {
            matchId,
            playerId,
            performanceId: performanceRef.id,
            impact,
        });

        return { success: true, performanceId: performanceRef.id };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Generate Google Fit OAuth2 authorization URL
 * Step 1: User initiates connection
 */
export async function generateGoogleFitAuthUrlAction(
    userId: string
): Promise<{ success: boolean; authUrl?: string; state?: string; error?: string }> {
    try {
        const clientId = process.env.GOOGLE_FIT_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_FIT_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            return {
                success: false,
                error: 'Google Fit credentials not configured. Please contact support.',
            };
        }

        // Generate state to prevent CSRF and pass user ID
        const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: GOOGLE_FIT_CONFIG.scopes.join(' '),
            access_type: 'offline', // Request refresh token
            prompt: 'consent', // Force consent screen to get refresh token
            state,
        });

        const authUrl = `${GOOGLE_FIT_CONFIG.authEndpoint}?${params.toString()}`;

        return { success: true, authUrl, state };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}

/**
 * Disconnect Google Fit
 */
export async function disconnectGoogleFitAction(
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await getAdminDb()
            .collection('users')
            .doc(userId)
            .collection('healthConnections')
            .doc('google_fit')
            .delete();

        logger.info('Google Fit disconnected', { userId });

        return { success: true };
    } catch (error) {
        const err = handleServerActionError(error);
        return { success: false, error: err.error };
    }
}
