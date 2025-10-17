
'use server';
/**
 * @fileOverview A flow to get a weather forecast for a match day.
 *
 * - getMatchDayForecast - A function that returns a weather forecast.
 * - GetMatchDayForecastInput - The input type for the getMatchDayForecast function.
 * - GetMatchDayForecastOutput - The return type for the getMatchDayForecast function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fetch from 'node-fetch';
import { differenceInHours, parseISO } from 'date-fns';

// Define the input and output schemas for our main flow
const GetMatchDayForecastInputSchema = z.object({
  location: z.string().describe('The location of the match (e.g., "Montevideo, Uruguay").'),
  date: z.string().describe('The date and time of the match in ISO 8601 format.'),
});
type GetMatchDayForecastInput = z.infer<typeof GetMatchDayForecastInputSchema>;

const GetMatchDayForecastOutputSchema = z.object({
  description: z.string().describe('A concise, user-friendly description of the weather.'),
  icon: z.enum(['Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap']).describe('An icon name representing the weather condition.'),
  temperature: z.number().describe('The temperature in Celsius.'),
});
type GetMatchDayForecastOutput = z.infer<typeof GetMatchDayForecastOutputSchema>;


// Define the schema for the raw weather data from the API
const WeatherApiDataSchema = z.object({
    list: z.array(z.object({
        dt_txt: z.string(),
        main: z.object({
            temp: z.number(),
        }),
        weather: z.array(z.object({
            main: z.string(),
            description: z.string(),
        })),
        wind: z.object({
            speed: z.number(),
        }),
    })).optional(),
    city: z.object({
        name: z.string(),
    }).optional(),
});

// Define the Genkit Tool to fetch weather data
const getWeatherForecast = ai.defineTool(
  {
    name: 'getWeatherForecast',
    description: 'Returns the weather forecast for a given location and date.',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: WeatherApiDataSchema,
  },
  async ({ location, date }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeather API key is not configured.');
    }
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${apiKey}&units=metric&lang=es`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch weather data: ${response.statusText}`);
    }

    const data = await response.json() as z.infer<typeof WeatherApiDataSchema>;

    if (!data.list || data.list.length === 0) {
        throw new Error('No forecasts found for the specified location.');
    }
    
    // Find the closest forecast to the match date
    const matchDate = parseISO(date);
    const closestForecast = data.list.reduce((prev, curr) => {
        const currDate = parseISO(curr.dt_txt);
        const prevDiff = Math.abs(differenceInHours(prev ? parseISO(prev.dt_txt) : new Date(0), matchDate));
        const currDiff = Math.abs(differenceInHours(currDate, matchDate));
        return currDiff < prevDiff ? curr : prev;
    });
    
    // Return only the most relevant part of the data
    return {
        list: [closestForecast],
        city: data.city,
    };
  }
);


// Define the main Genkit Flow
const getMatchDayForecastFlow = ai.defineFlow(
  {
    name: 'getMatchDayForecastFlow',
    inputSchema: GetMatchDayForecastInputSchema,
    outputSchema: GetMatchDayForecastOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
        prompt: `
        You are a sports assistant. Based on the provided weather data, generate a very concise and friendly description of the match day weather. 
        Also, select the most appropriate icon and extract the temperature.

        Weather Data: {{weather}}

        - The description should be short and easy to read (e.g., "Noche clara, 18°C, poco viento.").
        - Choose one of these icons based on the weather condition: 'Sun', 'Cloud', 'Cloudy', 'CloudRain', 'CloudSnow', 'Wind', 'Zap'.
        - Extract the temperature in Celsius.
      `,
        context: {
            weather: await getWeatherForecast(input),
        },
        output: { schema: GetMatchDayForecastOutputSchema },
        model: 'googleai/gemini-2.5-flash',
    });
    return output!;
  }
);

// Export the wrapper function
export async function getMatchDayForecast(input: GetMatchDayForecastInput): Promise<GetMatchDayForecastOutput> {
  return getMatchDayForecastFlow(input);
}
