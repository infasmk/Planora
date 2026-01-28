
import { GoogleGenAI } from "@google/genai";
import { Task } from "./types";

// Initialize the API client using the platform-provided environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSchedule = async (tasks: Task[], date: string) => {
  if (!process.env.API_KEY) {
    return "AI Insights are unavailable. Please ensure your API key is configured in the environment.";
  }

  const dayTasks = tasks.filter(t => t.date === date);
  const taskSummary = dayTasks
    .map(t => `- [${t.startTime}-${t.endTime}] ${t.title} (Priority: ${t.priority})`)
    .join('\n');

  const systemInstruction = `You are an expert productivity coach. Analyze the user's schedule and provide actionable, high-level feedback.
Focus on:
1. Burnout risks (too many high-priority tasks back-to-back).
2. Schedule gaps where 'Deep Work' or recovery could happen.
3. Logical inconsistencies (e.g., lunch breaks missing or overlapping times).
Keep response under 150 words. Use a motivating yet realistic tone.`;

  const prompt = `
    Analyze my schedule for ${date}:
    ${taskSummary || 'No tasks currently scheduled for this day.'}

    Instructions:
    - If empty, suggest 3 standard high-impact habits to start.
    - If busy, identify the most critical hour of my day.
    - Warn me if I have more than 3 high-priority tasks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.9,
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "The AI coach is currently offline. Please check your connection or try again later.";
  }
};
