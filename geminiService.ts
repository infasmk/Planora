
import { GoogleGenAI, Type } from "@google/genai";
import { Task } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeSchedule = async (tasks: Task[], date: string) => {
  if (!process.env.API_KEY) return "AI Insights are unavailable without an API Key.";

  const taskSummary = tasks
    .filter(t => t.date === date)
    .map(t => `- [${t.startTime}-${t.endTime}] ${t.title} (${t.priority})`)
    .join('\n');

  const prompt = `
    Analyze this daily schedule for ${date}:
    ${taskSummary || 'No tasks planned yet.'}

    Provide a concise productivity analysis:
    1. Identify any critical gaps or oversights.
    2. Warn about overloaded periods.
    3. Suggest one "Deep Work" slot if applicable.
    Keep the tone professional and encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate insights at this moment.";
  }
};
