import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { trainName } = body;

    if (!trainName) {
      return NextResponse.json(
        { error: 'Train name is required' },
        { status: 400 }
      );
    }

    // Create the prompt for OpenAI
    const prompt = `
      I'm looking for a train that sounds like "${trainName}". 
      It may not necessarily be in Thomas the Tank Engine but could be in similar train-based franchises.
      Please provide a succinct and to-the-point response about which train this could be.
      If there are multiple possibilities, list the most likely one first.
      Keep your response brief and focused.
    `;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant that specializes in trains from children's media." },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
    });

    // Extract the response
    const aiResponse = completion.choices[0].message.content;

    // Return the response
    return NextResponse.json({ result: aiResponse });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}