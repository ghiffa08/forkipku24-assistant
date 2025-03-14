import { NextRequest, NextResponse } from 'next/server';
import { 
  generateResponse, 
  generateAIResponse, 
  getUserId, 
  checkRateLimit, 
  getFromCache, 
  saveToCache,
  withTimeout 
} from '../../genkit';

// Handler untuk route POST /api/chat
export async function POST(req: NextRequest) {
  try {
    // Dapatkan ID pengguna
    const userId = getUserId(req);
    
    // Cek rate limit
    const rateLimit = await checkRateLimit(userId);
    
    if (!rateLimit.isAllowed) {
      return NextResponse.json(
        { 
          message: 'Batas penggunaan harian tercapai, silakan coba lagi besok',
          remainingQuota: 0 
        },
        { status: 429 }
      );
    }
    
    // Parse body with timeout
    let query;
    try {
      // Add a timeout to the body parsing to prevent hanging
      const bodyText = await withTimeout(req.text(), 2000);
      const body = JSON.parse(bodyText);
      query = body.query;
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { 
          message: 'Format permintaan tidak valid atau timeout',
          remainingQuota: rateLimit.remaining
        },
        { status: 400 }
      );
    }
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { 
          message: 'Query tidak valid',
          remainingQuota: rateLimit.remaining
        },
        { status: 400 }
      );
    }
    
    // Cek cache terlebih dahulu (with timeout)
    let cachedResponse;
    try {
      cachedResponse = await withTimeout(getFromCache(query), 2000);
      if (cachedResponse) {
        return NextResponse.json({ 
          response: cachedResponse,
          remainingQuota: rateLimit.remaining
        });
      }
    } catch (error) {
      console.error('Cache retrieval timed out:', error);
      // Continue without cache
    }
    
    // Coba dapatkan jawaban dari knowledge base
    let response = generateResponse(query);
    
    // Jika tidak ada jawaban, gunakan AI
    if (response === "AI_GENERATE") {
      try {
        // Use a longer timeout for AI generation
        const aiResult = await withTimeout(generateAIResponse({ query }), 10000);
        response = aiResult.response;
      } catch (error) {
        console.error('Error generating AI response:', error);
        response = "Maaf, server sedang sibuk. Silakan coba lagi dalam beberapa saat atau hubungi pengurus forum melalui email: forumkipk@uniku.ac.id untuk informasi lebih lanjut.";
      }
    }
    
    // Simpan hasil ke cache (with timeout protection)
    try {
      await withTimeout(saveToCache(query, response), 2000);
    } catch (error) {
      console.error('Cache save timed out:', error);
      // Continue without saving to cache
    }
    
    return NextResponse.json({ 
      response,
      remainingQuota: rateLimit.remaining
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { 
        message: 'Terjadi kesalahan internal',
        remainingQuota: 0
      },
      { status: 500 }
    );
  }
}