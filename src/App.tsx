import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Upload, Music, Play, Pause, BarChart2, Star, FileText, Info, Loader2, Disc3, Mic2, Activity, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AnalysisResult = {
  detectedType: string;
  hitLevel: number;
  statistics: {
    style: string;
    innovation: string;
    productionQuality: string;
    overallVibe: string;
  };
  structure: {
    sectionName: string;
    startTime: string;
    endTime: string;
    description: string;
  }[];
  suggestedLyrics?: string;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    detectedType: {
      type: Type.STRING,
      description: "Either 'Beat' or 'Song'",
    },
    hitLevel: {
      type: Type.NUMBER,
      description: "Score from 0 to 10 indicating the hit potential",
    },
    statistics: {
      type: Type.OBJECT,
      properties: {
        style: { type: Type.STRING, description: "Description of the style" },
        innovation: { type: Type.STRING, description: "How innovative or similar to existing tracks it is" },
        productionQuality: { type: Type.STRING, description: "Assessment of mixing, mastering, and sound selection" },
        overallVibe: { type: Type.STRING, description: "The general mood and energy" },
      },
    },
    structure: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionName: { type: Type.STRING, description: "e.g., Intro, Verse, Chorus, Hook, Outro" },
          startTime: { type: Type.STRING, description: "Start time in mm:ss format" },
          endTime: { type: Type.STRING, description: "End time in mm:ss format" },
          description: { type: Type.STRING, description: "Brief description of what happens musically in this section" },
        },
      },
    },
    suggestedLyrics: {
      type: Type.STRING,
      description: "If it's a beat, provide suggested lyrics that fit the structure and vibe. If it's a song, leave empty.",
    },
  },
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError("File is too large. Please upload an audio file under 20MB.");
        return;
      }
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setResult(null);
      setError(null);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const analyzeAudio = async () => {
    if (!audioFile) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const base64Audio = await fileToBase64(audioFile);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const promptText = `
        You are an expert music producer, A&R, and hitmaker.
        Analyze the provided audio file.
        ${userDetails ? `The user provided these additional details: "${userDetails}"` : `The user did not provide additional details, so base your analysis purely on the audio style, whether it's similar to existing tracks or innovative.`}
        
        If the audio is an instrumental beat, evaluate it as a beat. If it has vocals, evaluate it as a song.
        Provide statistics on what was done (style, innovation, production quality, overall vibe).
        Give a "Hit Level" score from 0 to 10 based on its commercial potential and quality.
        Divide the audio into sections (Intro, Verse, Chorus, Hook, etc.) with start and end times, and a brief description of each section.
        If it is evaluated as a beat, create possible lyrics that fit the analysis and structure. If it's a song, leave suggestedLyrics empty.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType: audioFile.type || 'audio/mp3',
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as AnalysisResult;
        setResult(parsedResult);
      } else {
        throw new Error("No response from AI");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadReport = () => {
    if (!result) return;
    
    let report = `HIT ANALYZER REPORT\n`;
    report += `===================\n\n`;
    report += `Type: ${result.detectedType}\n`;
    report += `Hit Level: ${result.hitLevel}/10\n\n`;
    
    report += `SONIC PROFILE\n`;
    report += `-------------\n`;
    report += `Style: ${result.statistics.style}\n`;
    report += `Innovation: ${result.statistics.innovation}\n`;
    report += `Production Quality: ${result.statistics.productionQuality}\n`;
    report += `Overall Vibe: ${result.statistics.overallVibe}\n\n`;
    
    report += `TRACK STRUCTURE\n`;
    report += `---------------\n`;
    result.structure.forEach(s => {
      report += `[${s.startTime} - ${s.endTime}] ${s.sectionName}: ${s.description}\n`;
    });
    
    if (result.suggestedLyrics) {
      report += `\nSUGGESTED LYRICS\n`;
      report += `----------------\n`;
      report += `${result.suggestedLyrics}\n`;
    }
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HitAnalyzer_Report_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-200 font-sans selection:bg-violet-500/30">
      {/* Header */}
      <header className="border-b border-neutral-800/50 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
              <Activity className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Hit Analyzer</h1>
          </div>
          <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            AI Audio Intelligence
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Column: Input */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Upload Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500"></span>
              01. Audio Source
            </h2>
            
            <label className="block w-full aspect-video rounded-2xl border-2 border-dashed border-neutral-800 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all cursor-pointer group relative overflow-hidden">
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-900 group-hover:bg-violet-500/20 flex items-center justify-center transition-colors">
                  {audioFile ? <Disc3 className="w-8 h-8 text-violet-400" /> : <Upload className="w-8 h-8 text-neutral-500 group-hover:text-violet-400 transition-colors" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {audioFile ? audioFile.name : "Click or drag audio file"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(2)} MB` : "MP3, WAV, M4A up to 20MB"}
                  </p>
                </div>
              </div>
            </label>

            {audioUrl && (
              <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800/50 flex items-center gap-4">
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-violet-500 text-white flex items-center justify-center hover:bg-violet-600 transition-colors shrink-0"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </button>
                <div className="flex-1">
                  <div className="flex justify-between text-xs font-mono text-neutral-400 mb-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                    />
                  </div>
                </div>
                <audio 
                  ref={audioRef} 
                  src={audioUrl} 
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              </div>
            )}
          </section>

          {/* Details Section */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutral-700"></span>
              02. Context (Optional)
            </h2>
            <textarea
              value={userDetails}
              onChange={(e) => setUserDetails(e.target.value)}
              placeholder="Add details about genre, mood, influences, or what you were aiming for..."
              className="w-full h-32 bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
            />
          </section>

          {/* Action */}
          <button
            onClick={analyzeAudio}
            disabled={!audioFile || isAnalyzing}
            className="w-full py-4 rounded-xl bg-white text-black font-semibold flex items-center justify-center gap-2 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Audio...
              </>
            ) : (
              <>
                <BarChart2 className="w-5 h-5" />
                Generate Analysis
              </>
            )}
          </button>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!result && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-center border border-neutral-800/50 rounded-2xl bg-neutral-900/20 p-8"
              >
                <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-6">
                  <Activity className="w-8 h-8 text-neutral-700" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Awaiting Audio</h3>
                <p className="text-sm text-neutral-500 max-w-sm">
                  Upload a beat or song and run the analysis to see hit potential, structural breakdown, and AI-generated insights.
                </p>
              </motion.div>
            )}

            {isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center text-center border border-neutral-800/50 rounded-2xl bg-neutral-900/20 p-8"
              >
                <div className="relative w-24 h-24 mb-8">
                  <div className="absolute inset-0 border-2 border-violet-500/20 rounded-full animate-ping"></div>
                  <div className="absolute inset-2 border-2 border-violet-500/40 rounded-full animate-pulse"></div>
                  <div className="absolute inset-4 bg-violet-500/20 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Processing Audio</h3>
                <p className="text-sm text-neutral-500">
                  Our AI is listening to the track, analyzing the structure, and evaluating hit potential...
                </p>
              </motion.div>
            )}

            {result && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Analysis Results</h2>
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download TXT
                  </button>
                </div>

                {/* Top Stats Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-neutral-400 mb-4">
                      <Music className="w-4 h-4" />
                      <span className="text-xs font-mono uppercase tracking-wider">Detected Type</span>
                    </div>
                    <div className="text-3xl font-light text-white">
                      {result.detectedType}
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-violet-500/20 blur-2xl rounded-full"></div>
                    <div className="flex items-center gap-2 text-violet-300 mb-4 relative z-10">
                      <Star className="w-4 h-4" />
                      <span className="text-xs font-mono uppercase tracking-wider">Hit Level</span>
                    </div>
                    <div className="flex items-baseline gap-1 relative z-10">
                      <span className="text-5xl font-light text-white">{result.hitLevel}</span>
                      <span className="text-xl text-violet-400/50">/10</span>
                    </div>
                  </div>
                </div>

                {/* Detailed Stats */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 space-y-6">
                  <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-4">
                    Sonic Profile
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Style</h4>
                      <p className="text-sm text-neutral-300 leading-relaxed">{result.statistics.style}</p>
                    </div>
                    <div>
                      <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Innovation</h4>
                      <p className="text-sm text-neutral-300 leading-relaxed">{result.statistics.innovation}</p>
                    </div>
                    <div>
                      <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Production Quality</h4>
                      <p className="text-sm text-neutral-300 leading-relaxed">{result.statistics.productionQuality}</p>
                    </div>
                    <div>
                      <h4 className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Overall Vibe</h4>
                      <p className="text-sm text-neutral-300 leading-relaxed">{result.statistics.overallVibe}</p>
                    </div>
                  </div>
                </div>

                {/* Structure Timeline */}
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-4 mb-6">
                    Track Structure
                  </h3>
                  
                  <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[4.5rem] before:w-px before:bg-neutral-800">
                    {result.structure.map((section, idx) => (
                      <div key={idx} className="flex gap-6 relative z-10">
                        <div className="w-16 shrink-0 text-right pt-1">
                          <span className="text-xs font-mono text-neutral-500">{section.startTime}</span>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-neutral-800 border-2 border-[#050505] mt-1.5 shrink-0 relative -ml-[1.125rem]"></div>
                        <div className="pb-6">
                          <h4 className="text-sm font-medium text-white mb-1">{section.sectionName}</h4>
                          <p className="text-sm text-neutral-400">{section.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lyrics (if beat) */}
                {result.suggestedLyrics && (
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 border-b border-neutral-800 pb-4 mb-6">
                      <Mic2 className="w-4 h-4 text-neutral-400" />
                      <h3 className="text-sm font-mono text-neutral-400 uppercase tracking-widest">
                        AI Suggested Lyrics
                      </h3>
                    </div>
                    <div className="whitespace-pre-wrap font-mono text-sm text-neutral-300 leading-relaxed bg-[#050505] p-6 rounded-xl border border-neutral-800/50">
                      {result.suggestedLyrics}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
