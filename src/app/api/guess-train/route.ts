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
      I'm looking for trains that sound like "${trainName}". 
      It may not necessarily be in Thomas the Tank Engine but could be in similar train-based franchises.
      Return a JSON array of objects with the following structure:
      [
        {
          "name": "Full train name",
          "franchise": "Franchise name (e.g., Thomas & Friends, Crotoonia's Tales from the Docks, Chuggington, etc.)",
          "searchTerms": "Optimized search terms for Google image search"
        }
      ]
      For the searchTerms field, provide specific terms that would work well for Google image search to find good images of this train.
      Include up to 3 most likely matches. Ensure the response is valid JSON.
    `;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful assistant that specializes in trains from children's media. You always respond with valid JSON. Your response should be a JSON object with a 'trains' array containing the train objects." 
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" }
    });

    // Extract the response
    const aiResponseText = completion.choices[0].message.content || '';
    
    // Parse the JSON response
    let trainCandidates = [];
    try {
      const parsedResponse = JSON.parse(aiResponseText);
      trainCandidates = Array.isArray(parsedResponse) ? parsedResponse : 
                        (parsedResponse.trains || parsedResponse.results || []);
    } catch (error) {
      console.error('Error parsing OpenAI response as JSON:', error);
    }

    // Return the structured response
    return NextResponse.json({ result: trainCandidates });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}