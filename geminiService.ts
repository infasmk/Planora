
import { GoogleGenAI } from "@google/genai";
import { Task } from "./types";

// Standard initialization as per SDK guidelines
// The API key is sourced from process.env.API_KEY which is handled by the platform
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSchedule = async (tasks: Task[], date: string) => {
  if (!process.env.API_KEY) {
    return "The AI Coach is currently missing its credentials. Please ensure the API Key is correctly configured.";
  }

  const dayTasks = tasks.filter(t => t.date === date);
  const taskListString = dayTasks.length > 0 
    ? dayTasks.map(t => `- [${t.startTime}-${t.endTime}] ${t.title} (Priority: ${t.priority})`).join('\n')
    : "No tasks scheduled.";

  const systemInstruction = `You are "Zenith Coach," a world-class productivity expert. 
Your goal is to analyze a user's daily schedule and provide high-impact, brief advice.
1. Identify if the user is over-committed (more than 3 high-priority tasks).
2. Spot gaps for "Deep Work" or mental recovery.
3. Suggest one small optimization to improve the flow of their day.
Keep the tone professional, encouraging, and concise (under 120 words).`;

  const prompt = `
    Analysis Request for Date: ${date}
    User Schedule:
    ${taskListString}

    Please provide a strategic overview. If the schedule is empty, suggest 3 habits for a high-performance morning.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text || "I've reviewed your day and it looks solid. Keep up the momentum!";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "I ran into an issue while analyzing your day. Let's try again in a moment.";
  }
};
