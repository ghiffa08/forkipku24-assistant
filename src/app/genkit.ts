import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import { genkit, z } from 'genkit';
import { Redis } from '@upstash/redis';

// Schema definitions
export const resultSchema = z.object({
  response: z.string(),
});

// Inisialisasi Redis untuk caching dan rate limiting
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || '',
});

// Inisialisasi instance AI dengan plugin GoogleAI
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: gemini20Flash,
});

// Knowledge base yang berisi informasi tentang KIPK dan Universitas Kuningan
export const knowledgeBase = {
  kipk: {
    deskripsi: "KIPK (Kartu Indonesia Pintar Kuliah) adalah program beasiswa dari pemerintah untuk mahasiswa kurang mampu secara ekonomi tetapi memiliki potensi akademik baik.",
    syarat: "Syarat pendaftaran KIPK: 1) Memiliki NIK/KK aktif, 2) Mempunyai prestasi akademik/non-akademik, 3) Kondisi ekonomi kurang mampu dibuktikan dengan SKTM, 4) Melampirkan slip gaji/penghasilan orang tua, 5) Bukti pembayaran listrik dan PBB.",
    cara_daftar: "Pendaftaran KIPK dilakukan melalui laman https://kip-kuliah.kemdikbud.go.id/ dengan langkah: 1) Registrasi akun, 2) Isi formulir data diri, 3) Unggah dokumen persyaratan, 4) Cetak dan simpan nomor pendaftaran.",
    manfaat: "Manfaat KIPK meliputi biaya kuliah dan bantuan biaya hidup selama masa studi standar, dengan besaran bervariasi berdasarkan daerah dan tingkat kemiskinan.",
    batas_waktu: "Pendaftaran KIPK biasanya dibuka pada awal tahun untuk digunakan pada tahun ajaran berikutnya. Pastikan mengecek website resmi untuk jadwal terupdate.",
    persyaratan_akademik: "Persyaratan akademik KIPK adalah memiliki nilai rata-rata minimal sesuai dengan ketentuan atau prestasi non-akademik yang diakui tingkat nasional."
  },
  universitas_kuningan: {
    profil: "Universitas Kuningan (UNIKU) adalah perguruan tinggi negeri yang berlokasi di Kabupaten Kuningan, Jawa Barat. Kampus ini berdiri sejak tahun 2008 dan terus berkembang menjadi salah satu universitas terkemuka di wilayah III Cirebon.",
    jurusan: ["Fakultas Keguruan dan Ilmu Pendidikan", "Fakultas Ekonomi", "Fakultas Kehutanan", "Fakultas Hukum", "Fakultas Komputer", "Fakultas Pertanian", "Program Pascasarjana"],
    pendaftaran: "Pendaftaran di Universitas Kuningan dapat dilakukan melalui jalur SNBP, SNBT, atau jalur mandiri. Untuk informasi lengkap, kunjungi https://uniku.ac.id/pendaftaran/",
    kontak: "Informasi lebih lanjut dapat diperoleh melalui email: info@uniku.ac.id atau telepon: (0232) 123456",
    lokasi: "Kampus Universitas Kuningan berlokasi di Jl. Siliwangi No. 123, Kuningan, Jawa Barat 45513",
    kipk_uniku: "Universitas Kuningan menerima mahasiswa jalur KIPK di semua program studi. Terdapat kuota khusus untuk mahasiswa KIPK setiap tahunnya."
  },
  forum_mahasiswa_kipk: {
    deskripsi: "Forum Mahasiswa KIPK Universitas Kuningan adalah organisasi yang menaungi seluruh mahasiswa penerima KIPK di Universitas Kuningan.",
    kegiatan: "Kegiatan forum meliputi pendampingan akademik, pelatihan soft skill, mentoring, dan pengabdian masyarakat.",
    kontak: "Forum dapat dihubungi melalui email: forumkipk@uniku.ac.id atau Instagram: @forumkipkuniku.",
    aspirasi: "Aspirasi dan keluhan dapat disampaikan melalui formulir online di website forum atau langsung ke pengurus forum."
  }
};

// Fungsi untuk menghasilkan respons dari knowledge base dengan pencarian yang lebih baik
export const generateResponse = (query: string): string => {
  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/); // Split query menjadi keywords
  let bestMatch = { response: "", score: 0 };
  
  // Helper function untuk menghitung relevance score
  const calculateRelevance = (text: string, queryKeywords: string[]): number => {
    const textLower = text.toLowerCase();
    return queryKeywords.reduce((score, keyword) => {
      return score + (textLower.includes(keyword) ? 1 : 0);
    }, 0);
  };
  
  // Cek apakah query berkaitan dengan KIPK
  if (
    queryLower.includes("kipk") || 
    queryLower.includes("kip") || 
    queryLower.includes("beasiswa") || 
    queryLower.includes("bantuan kuliah")
  ) {
    const sections = {
      "syarat": knowledgeBase.kipk.syarat,
      "cara daftar": knowledgeBase.kipk.cara_daftar,
      "manfaat": knowledgeBase.kipk.manfaat,
      "deadline": knowledgeBase.kipk.batas_waktu,
      "akademik": knowledgeBase.kipk.persyaratan_akademik,
      "deskripsi": knowledgeBase.kipk.deskripsi
    };
    
    for (const [key, text] of Object.entries(sections)) {
      const score = calculateRelevance(queryLower, [key]) + calculateRelevance(text, keywords);
      if (score > bestMatch.score) {
        bestMatch = { response: text, score };
      }
    }
  } 
  
  // Cek apakah query berkaitan dengan Universitas Kuningan
  if (
    queryLower.includes("uniku") || 
    queryLower.includes("universitas") || 
    queryLower.includes("kuningan") || 
    queryLower.includes("kampus")
  ) {
    const sections = {
      "jurusan": `Universitas Kuningan memiliki beberapa fakultas yaitu: ${knowledgeBase.universitas_kuningan.jurusan.join(", ")}.`,
      "pendaftaran": knowledgeBase.universitas_kuningan.pendaftaran,
      "kontak": knowledgeBase.universitas_kuningan.kontak,
      "lokasi": knowledgeBase.universitas_kuningan.lokasi,
      "kipk": knowledgeBase.universitas_kuningan.kipk_uniku,
      "profil": knowledgeBase.universitas_kuningan.profil
    };
    
    for (const [key, text] of Object.entries(sections)) {
      const score = calculateRelevance(queryLower, [key]) + calculateRelevance(text, keywords);
      if (score > bestMatch.score) {
        bestMatch = { response: text, score };
      }
    }
  }
  
  // Cek apakah query berkaitan dengan Forum Mahasiswa KIPK
  if (
    queryLower.includes("forum") || 
    queryLower.includes("organisasi") || 
    queryLower.includes("forkipku") || 
    queryLower.includes("kegiatan mahasiswa")
  ) {
    const sections = {
      "kegiatan": knowledgeBase.forum_mahasiswa_kipk.kegiatan,
      "kontak": knowledgeBase.forum_mahasiswa_kipk.kontak,
      "aspirasi": knowledgeBase.forum_mahasiswa_kipk.aspirasi,
      "deskripsi": knowledgeBase.forum_mahasiswa_kipk.deskripsi
    };
    
    for (const [key, text] of Object.entries(sections)) {
      const score = calculateRelevance(queryLower, [key]) + calculateRelevance(text, keywords);
      if (score > bestMatch.score) {
        bestMatch = { response: text, score };
      }
    }
  }
  
  // Jika tidak ada jawaban yang relevan dari knowledge base, minta AI mencoba menjawab
  if (bestMatch.score < 2) {
    return "AI_GENERATE"; // Tanda bahwa perlu menggunakan AI untuk menjawab
  }
  
  return bestMatch.response;
};

// Definisi flow untuk menghasilkan respons dari AI yang lebih kontekstual
export const generateAIResponse = ai.defineFlow(
  {
    name: 'generateAIResponse',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: resultSchema,
  },
  async (input) => {
    const { query } = input;
    
    // Prompt AI
    const prompt = `
    Kamu adalah asisten untuk mahasiswa KIPK Universitas Kuningan.
    
    Informasi KIPK:
    ${JSON.stringify(knowledgeBase.kipk)}
    
    Informasi Universitas Kuningan:
    ${JSON.stringify(knowledgeBase.universitas_kuningan)}
    
    Informasi Forum Mahasiswa KIPK:
    ${JSON.stringify(knowledgeBase.forum_mahasiswa_kipk)}
    
    Pertanyaan: ${query}
    
    Berikan jawaban singkat dan informatif berdasarkan informasi di atas. Jika informasi tidak tersedia, jawab "Mohon maaf, untuk pertanyaan tersebut sebaiknya langsung menghubungi pengurus forum."
    `;
        
    try {
      const result = await ai.generate({ prompt });
      
      // Ensure we're getting valid text content
      if (result && typeof result.text === 'string') {
        return { response: result.text };
      } else {
        console.error('Invalid AI response format:', result);
        return { response: "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi nanti." };
      }
    } catch (error) {
      console.error('Error in AI generation:', error);
      return { response: "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi nanti." };
    }
  }
);

// Cache utilities
export const getFromCache = async (query: string): Promise<string | null> => {
  // Sanitasi query untuk digunakan sebagai cache key
  const sanitizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const key = `cache:${sanitizedQuery}`;
  return await redis.get(key);
};

export const saveToCache = async (query: string, response: string): Promise<void> => {
  const sanitizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const key = `cache:${sanitizedQuery}`;
  // Simpan dalam cache selama 7 hari
  await redis.set(key, response, { ex: 7 * 24 * 60 * 60 });
};

// Rate limiting utilities
export const getUserId = (req: Request): string => {
  const headers = new Headers(req.headers);
  const ip = headers.get('x-forwarded-for') || 'unknown';
  const userAgent = headers.get('user-agent') || 'unknown';
  // Tambahkan user-agent untuk menghindari false positive pada shared IP
  return `user:${ip}:${userAgent.substring(0, 20)}`;
};

export const checkRateLimit = async (userId: string): Promise<{isAllowed: boolean, remaining: number}> => {
  const today = new Date().toISOString().split('T')[0];
  const key = `rate:${userId}:${today}`;
  
  // Set limit harian (20 per hari)
  const dailyLimit = 20;
  
  // Cek jumlah request hari ini
  const count = await redis.incr(key);
  
  // Set expiry untuk key (24 jam)
  if (count === 1) {
    await redis.expire(key, 24 * 60 * 60);
  }
  
  // Kembalikan status dan sisa quota
  return {
    isAllowed: count <= dailyLimit,
    remaining: Math.max(0, dailyLimit - count)
  };
};

export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};