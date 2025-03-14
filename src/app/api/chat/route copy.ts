import { NextRequest, NextResponse } from 'next/server';
import { googleAI, gemini20Flash } from '@genkit-ai/googleai';
import { genkit, z } from 'genkit';
import { Redis } from '@upstash/redis';

// Inisialisasi Redis untuk caching dan rate limiting
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || '',
});

// Inisialisasi instance AI dengan plugin GoogleAI
const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: gemini20Flash,
});

// Knowledge base yang berisi informasi tentang KIPK dan Universitas Kuningan
const knowledgeBase = {
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
    kontak: "Forum dapat dihubungi melalui email: forumkipk@uniku.ac.id atau Instagram: @forumkipkuniku",
    aspirasi: "Aspirasi dan keluhan dapat disampaikan melalui formulir online di website forum atau langsung ke pengurus forum."
  }
};


// Fungsi untuk memeriksa rate limit
const checkRateLimit = async (userId: string): Promise<boolean> => {
  const today = new Date().toISOString().split('T')[0];
  const key = `rate:${userId}:${today}`;
  
  // Cek jumlah request hari ini
  const count = await redis.incr(key);
  
  // Set expiry untuk key (24 jam)
  if (count === 1) {
    await redis.expire(key, 24 * 60 * 60);
  }
  
  // Batasi 60 request per hari
  return count <= 60;
};

// Fungsi untuk mengenerate response dari knowledge base
const generateResponseFromKnowledgeBase = (query: string): string => {
  const queryLower = query.toLowerCase();
  
  if (queryLower.includes("kipk")) {
    if (queryLower.includes("syarat") || queryLower.includes("persyaratan")) {
      return knowledgeBase.kipk.syarat;
    } else if (queryLower.includes("cara daftar") || queryLower.includes("pendaftaran")) {
      return knowledgeBase.kipk.cara_daftar;
    } else if (queryLower.includes("manfaat") || queryLower.includes("keuntungan")) {
      return knowledgeBase.kipk.manfaat;
    } else if (queryLower.includes("kapan") || queryLower.includes("deadline") || queryLower.includes("batas waktu")) {
      return knowledgeBase.kipk.batas_waktu;
    } else if (queryLower.includes("nilai") || queryLower.includes("akademik")) {
      return knowledgeBase.kipk.persyaratan_akademik;
    } else {
      return knowledgeBase.kipk.deskripsi;
    }
  } else if (queryLower.includes("uniku")) {
    // (Cek jawaban terkait Universitas Kuningan seperti di knowledgeBase.universitas_kuningan)
    return knowledgeBase.universitas_kuningan.profil;
  } else if (queryLower.includes("forum") || queryLower.includes("organisasi")) {
    // (Cek jawaban terkait Forum Mahasiswa KIPK)
    return knowledgeBase.forum_mahasiswa_kipk.deskripsi;
  } else {
    return "AI_GENERATE"; // Tanda untuk menggunakan AI jika tidak ada jawaban dari knowledge base
  }
};

// Fungsi untuk menggunakan AI untuk menjawab pertanyaan yang tidak dikenali
const generateAIResponse = ai.defineFlow(
  {
    name: 'generateAIResponse',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.object({
      response: z.string(),
    }),
  },
  async (input) => {
    const { query } = input;
    
    const prompt = `
      Kamu adalah asisten resmi dari Forum Mahasiswa KIPK Universitas Kuningan.
      Jawablah pertanyaan pengguna tentang KIPK, Universitas Kuningan, atau Forum Mahasiswa KIPK.
      Jika kamu tidak mengetahui jawaban pastinya, beri tahu bahwa kamu akan meneruskan pertanyaan ke pengurus forum.
      Pertanyaan: ${query}
    `;
    
    const response = await ai.generateText(prompt);
    return { response };
  }
);

// Fungsi untuk menyimpan hasil ke cache
const saveToCache = async (query: string, response: string): Promise<void> => {
  const key = `cache:${query.toLowerCase().trim()}`;
  await redis.set(key, response, { ex: 7 * 24 * 60 * 60 });
};

// Handler untuk route POST /api/chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { message: 'Query tidak valid' },
        { status: 400 }
      );
    }

    // Mendapatkan ID pengguna
    const userId = req.headers.get('x-forwarded-for') || 'unknown';

    // Cek rate limit
    const isAllowed = await checkRateLimit(userId);
    if (!isAllowed) {
      return NextResponse.json(
        { message: 'Batas penggunaan harian tercapai, silakan coba lagi besok' },
        { status: 429 }
      );
    }

    // Cek apakah sudah ada di cache
    const cachedResponse = await redis.get(`cache:${query.toLowerCase().trim()}`);
    if (cachedResponse) {
      return NextResponse.json({ response: cachedResponse });
    }

    // Generate response dari knowledge base
    let response = generateResponseFromKnowledgeBase(query);

    // Jika tidak ada jawaban dari knowledge base, gunakan AI
    if (response === "AI_GENERATE") {
      const aiResult = await generateAIResponse({ query });
      response = aiResult.response;
    }

    // Simpan hasil ke cache
    await saveToCache(query, response);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan internal' },
      { status: 500 }
    );
  }
}
