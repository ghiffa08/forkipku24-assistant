'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// Interface untuk pesan chat
interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

// Saran prompt untuk pengguna
const promptSuggestions = [
  "Apa syarat pendaftaran KIPK?",
  "Bagaimana cara mendaftar KIPK?",
  "Apa manfaat KIPK bagi mahasiswa?",
  "Kapan pendaftaran KIPK dibuka?",
  "Fakultas apa saja yang ada di Universitas Kuningan?",
  "Bagaimana cara mendaftar di Universitas Kuningan?",
  "Apa kegiatan Forum Mahasiswa KIPK UNIKU?"
];

// FAQ yang umum ditanyakan
const faqItems = [
  {
    question: "Apa itu KIPK?",
    answer: "KIPK (Kartu Indonesia Pintar Kuliah) adalah program beasiswa dari pemerintah untuk mahasiswa kurang mampu secara ekonomi tetapi memiliki potensi akademik baik."
  },
  {
    question: "Bagaimana cara mendaftar KIPK?",
    answer: "Pendaftaran KIPK dilakukan melalui laman https://kip-kuliah.kemdikbud.go.id/ dengan langkah: 1) Registrasi akun, 2) Isi formulir data diri, 3) Unggah dokumen persyaratan, 4) Cetak dan simpan nomor pendaftaran."
  },
  {
    question: "Apa saja fakultas di Universitas Kuningan?",
    answer: "Universitas Kuningan memiliki beberapa fakultas yaitu: Fakultas Keguruan dan Ilmu Pendidikan, Fakultas Ekonomi, Fakultas Kehutanan, Fakultas Hukum, Fakultas Komputer, Fakultas Pertanian, Program Pascasarjana."
  },
  {
    question: "Apakah Universitas Kuningan menerima mahasiswa KIPK?",
    answer: "Ya, Universitas Kuningan menerima mahasiswa jalur KIPK di semua program studi. Terdapat kuota khusus untuk mahasiswa KIPK setiap tahunnya."
  }
];

const Home = () => {
  const [userQuery, setUserQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingQuota, setRemainingQuota] = useState(20); // 20 permintaan per hari
  const [showFaq, setShowFaq] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll ke pesan terbaru
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Fungsi untuk berkomunikasi dengan server (API)
  const generateChatResponse = async (query: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000) // 10 detik timeout
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle rate limiting
        if (response.status === 429) {
          throw new Error('Batas kuota 20 pesan per hari tercapai. Silakan coba lagi besok.');
        }
        
        throw new Error(errorData.message || 'Terjadi kesalahan saat menghubungi chatbot');
      }
      
      const data = await response.json();
      
      // Update sisa kuota dari server
      if (data.remainingQuota !== undefined) {
        setRemainingQuota(data.remainingQuota);
      }
      
      return data.response;
    } catch (error: any) {
      setErrorMessage(error.message || 'Terjadi kesalahan, silakan coba lagi');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Handle perubahan input dari pengguna
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserQuery(e.target.value);
  };

  // Handle ketika form dikirim
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = userQuery.trim();
    if (!trimmedQuery) return;

    // Cek apakah kuota sudah habis
    if (remainingQuota <= 0) {
      setErrorMessage('Batas kuota 20 pesan per hari tercapai. Silakan coba lagi besok.');
      return;
    }

    // Tambahkan pesan pengguna
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmedQuery,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserQuery('');

    // Dapatkan respons dari bot
    const botResponse = await generateChatResponse(trimmedQuery);
    
    if (botResponse) {
      const botMessage: ChatMessage = {
        role: 'bot',
        content: botResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);
    }
  };

  // Handle klik pada saran prompt
  const handlePromptClick = (prompt: string) => {
    setUserQuery(prompt);
  };

  // Format waktu untuk ditampilkan
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-md py-3 px-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src="/logo_forkipku24.jpg"
              alt="Logo FORKIPKU24"
              width={40}
              height={40}
              className="rounded-full"
            />
            <h1 className="text-xl font-bold text-blue-800">FORKIPKU Assistant</h1>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto p-4 flex flex-col md:flex-row gap-4">
        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col">
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 p-4 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 240px)' }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Image
                    src="/logo_forkipku24.jpg"
                    alt="Logo FORKIPKU24"
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Halo, Mahasiswa!
                </h2>
                <p className="text-gray-700 max-w-md">
                  Selamat datang di FORKIPKU Assistant. Silakan tanyakan informasi tentang KIPK atau Universitas Kuningan.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === 'user' 
                          ? 'bg-blue-700 text-white rounded-br-none' 
                          : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      <div 
                        className={`text-xs mt-1 ${
                          msg.role === 'user' ? 'text-blue-100' : 'text-gray-600'
                        }`}
                      >
                        {formatTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 rounded-lg p-3 rounded-bl-none max-w-[80%]">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce delay-75"></div>
                        <div className="w-2 h-2 rounded-full bg-gray-600 animate-bounce delay-150"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-4 mb-4">
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
          )}
          
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t">
            <div className="relative">
            <input
              type="text"
              value={userQuery}
              onChange={handleInputChange}
              placeholder="Tanyakan sesuatu..."
              className="w-full p-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
              disabled={isLoading || remainingQuota <= 0}
            />

              <button
                type="submit"
                disabled={isLoading || !userQuery.trim() || remainingQuota <= 0}
                className="absolute right-2 top-2 bg-blue-700 text-white p-2 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed"
                aria-label="Kirim pesan"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="mt-2 flex justify-between items-center">
              <p className="text-xs text-gray-700">
                {remainingQuota} pertanyaan tersisa hari ini
              </p>
              <button
                type="button"
                onClick={() => setShowFaq(!showFaq)}
                className="text-xs text-blue-700 hover:underline"
              >
                {showFaq ? 'Sembunyikan FAQ' : 'Lihat FAQ'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Sidebar */}
        <div className="w-full md:w-72 space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-800">Saran Prompt</h2>
            <div className="space-y-2">
              {promptSuggestions.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptClick(prompt)}
                  className="w-full text-left bg-blue-50 text-blue-800 rounded-lg p-2 hover:bg-blue-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          
          {/* FAQ Section */}
          {showFaq && (
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h2 className="text-xl font-semibold mb-3 text-gray-800">FAQ</h2>
              <div className="space-y-3">
                {faqItems.map((item, index) => (
                  <div key={index}>
                    <p className="font-semibold text-gray-800">{item.question}</p>
                    <p className="text-sm text-gray-700">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
