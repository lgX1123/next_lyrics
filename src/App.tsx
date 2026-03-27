import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Play, Pause, RotateCcw, ChevronRight, Mic2, Loader2, CheckCircle2, AlertCircle, Key, ListMusic, ArrowLeft, Plus, X } from 'lucide-react';
import { generateSongQuestion, searchSongsBySinger, SongQuestion, SongItem } from './services/geminiService';

type GameState = 'setup' | 'loading_songs' | 'selecting' | 'loading_challenge' | 'playing' | 'paused' | 'revealed';

export default function App() {
  const [singers, setSingers] = useState<string[]>(['', '', '']);
  const [gameState, setGameState] = useState<GameState>('setup');
  const [songList, setSongList] = useState<SongItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<SongQuestion | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const handleSingerChange = (index: number, value: string) => {
    const newSingers = [...singers];
    newSingers[index] = value;
    setSingers(newSingers);
  };

  const addSinger = () => {
    setSingers([...singers, '']);
  };

  const removeSinger = (index: number) => {
    if (singers.length <= 1) return;
    const newSingers = singers.filter((_, i) => i !== index);
    setSingers(newSingers);
  };

  const activeSingers = singers.filter(s => s.trim() !== '');

  const fetchSongs = async () => {
    if (activeSingers.length === 0) {
      setError('请至少输入一位歌手的名字');
      return;
    }
    setError(null);
    setGameState('loading_songs');
    
    try {
      const songs = await searchSongsBySinger(activeSingers);
      if (songs.length === 0) {
        throw new Error('未找到相关歌曲，请尝试更换歌手名');
      }
      setSongList(songs);
      setGameState('selecting');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '获取歌曲列表失败，请重试。');
      setGameState('setup');
    }
  };

  const selectSong = async (song: SongItem) => {
    setError(null);
    setGameState('loading_challenge');
    
    try {
      const question = await generateSongQuestion(song);
      setCurrentQuestion(question);
      setAudioUrl(question.audioUrl || null);
      
      setGameState('playing'); // Change to 'playing' state to hide answer initially
      setProgress(0);
    } catch (err: any) {
      console.error(err);
      let userMessage = err.message || '生成题目失败，请重试。';
      if (userMessage.includes("版权") || userMessage.includes("会员") || userMessage.includes("403")) {
        userMessage = "该歌曲受版权保护或仅限会员，请尝试其他歌曲";
      } else if (userMessage.includes("404") || userMessage.includes("未找到")) {
        userMessage = "音频资源不可用，请尝试其他歌曲";
      }
      setError(userMessage);
      setGameState('selecting');
    }
  };

  const resetGame = () => {
    setGameState('setup');
    setCurrentQuestion(null);
    setAudioUrl(null);
    setSongList([]);
    setSingers(['', '', '']);
  };

  const backToSelecting = () => {
    setGameState('selecting');
    setCurrentQuestion(null);
    setAudioUrl(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 min-h-screen flex flex-col">
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-4"
          >
            <Music className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium tracking-widest uppercase opacity-70">Real Song Challenge</span>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold tracking-tighter mb-4 italic"
          >
            猜猜下一句
          </motion.h1>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            选择你喜欢的歌手，挑选一首歌曲，我们将为你播放一段真实片段。你能接出下一句吗？
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {gameState === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest opacity-40 block">输入歌手名字</label>
                    <button 
                      onClick={addSinger}
                      className="text-xs font-bold uppercase tracking-widest text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> 新增歌手
                    </button>
                  </div>
                  {singers.map((singer, i) => (
                    <div key={i} className="relative group flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mic2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-orange-500 transition-colors" />
                        <input
                          type="text"
                          value={singer}
                          onChange={(e) => handleSingerChange(i, e.target.value)}
                          placeholder={`歌手 ${i + 1}`}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all placeholder:text-white/10"
                        />
                      </div>
                      {singers.length > 1 && (
                        <button 
                          onClick={() => removeSinger(i)}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/20 hover:text-red-400 hover:bg-red-400/10 hover:border-red-400/20 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <button
                  onClick={fetchSongs}
                  disabled={activeSingers.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-50 disabled:opacity-30 disabled:hover:bg-orange-600 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-orange-900/20 flex items-center justify-center gap-2 group"
                >
                  搜索歌曲
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {gameState === 'loading_songs' && (
              <motion.div
                key="loading_songs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 space-y-6"
              >
                <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
                <p className="text-xl font-medium">正在搜索歌曲列表...</p>
              </motion.div>
            )}

            {gameState === 'selecting' && (
              <motion.div
                key="selecting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <ListMusic className="w-5 h-5 text-orange-500" />
                    请选择一首歌曲
                  </h2>
                  <button onClick={resetGame} className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-3 h-3" /> 返回重填
                  </button>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
                
                <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {songList.map((song, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSong(song)}
                      className="flex flex-col items-start p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 hover:border-orange-500/30 transition-all text-left group shadow-lg relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 px-3 py-1 bg-green-600/20 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl border-l border-b border-white/5">
                        QQ Music
                      </div>
                      <span className="text-xl font-bold group-hover:text-orange-500 transition-colors">{song.songTitle}</span>
                      <span className="text-base text-white/40">{song.singer}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchSongs}
                  className="w-full mt-4 py-3 border border-white/10 rounded-2xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  换一批歌曲
                </button>
              </motion.div>
            )}

            {gameState === 'loading_challenge' && (
              <motion.div
                key="loading_challenge"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 space-y-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full animate-pulse" />
                  <Loader2 className="w-16 h-16 text-orange-500 animate-spin relative z-10" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-medium">正在为你准备题目...</p>
                  <p className="text-white/40 text-sm">AI 正在匹配官方歌词</p>
                </div>
              </motion.div>
            )}

            {(gameState === 'playing' || gameState === 'revealed') && currentQuestion && (
              <motion.div
                key="game"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 flex-1 flex flex-col"
              >
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">{currentQuestion.songTitle}</h2>
                  <p className="text-orange-500 text-lg font-medium">{currentQuestion.singer}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[40px] p-8 md:p-16 space-y-10 relative overflow-hidden flex-1 flex flex-col shadow-2xl min-h-[600px]">
                  <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
                    <p className="text-sm font-bold uppercase tracking-[0.3em] opacity-30 text-center shrink-0">经典歌词片段</p>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <p className="text-3xl md:text-5xl leading-relaxed italic text-white/95 whitespace-pre-wrap text-center font-serif tracking-tight py-4">
                        {currentQuestion.lyricsSnippet}
                      </p>
                    </div>
                  </div>

                  <div className="pt-12 border-t border-white/5 space-y-8">
                    {audioUrl && (
                      <div className="flex flex-col items-center gap-4">
                        <audio 
                          ref={audioRef}
                          src={audioUrl}
                          onTimeUpdate={() => {
                            if (audioRef.current) {
                              setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                            }
                          }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => {
                            setIsPlaying(false);
                            setGameState('revealed');
                          }}
                        />
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-orange-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.currentTime = 0;
                                audioRef.current.play();
                              }
                            }}
                            className="p-4 pr-6 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                            title="重播"
                          >
                            <RotateCcw className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">重播</span>
                          </button>
                          
                          <button 
                            onClick={() => {
                              if (audioRef.current?.paused) {
                                audioRef.current.play();
                              } else {
                                audioRef.current?.pause();
                              }
                            }}
                            className="p-8 px-12 rounded-full bg-orange-500 text-white hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-orange-500/40 flex flex-col items-center gap-1"
                          >
                            <div className="flex items-center gap-3">
                              {isPlaying ? (
                                <Pause className="w-8 h-8" />
                              ) : (
                                <Play className="w-8 h-8" />
                              )}
                              <span className="text-2xl font-black uppercase tracking-tighter">
                                {isPlaying ? "暂停音频" : "播放音频"}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">智能播放/暂停</span>
                          </button>
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-orange-500/50 italic">原声片段 • 沉浸式挑战</p>
                      </div>
                    )}

                    {!audioUrl && gameState === 'playing' && (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <AlertCircle className="w-5 h-5 text-white/10" />
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-medium">
                          该歌曲暂无原声试听片段
                        </p>
                      </div>
                    )}

                    <AnimatePresence mode="wait">
                      {gameState === 'playing' ? (
                        <motion.button
                          key="reveal-btn"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setGameState('revealed')}
                          className="w-full py-12 border-2 border-dashed border-white/10 rounded-3xl text-white/20 hover:text-orange-500 hover:border-orange-500/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-4 group"
                        >
                          <Play className="w-12 h-12 group-hover:scale-110 transition-transform" />
                          <span className="text-base font-bold tracking-[0.2em] uppercase">点击揭晓下一句</span>
                        </motion.button>
                      ) : (
                        <motion.div 
                          key="answer"
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-8 text-center"
                        >
                          <div className="flex items-center justify-center gap-3 text-orange-500 text-sm font-bold uppercase tracking-[0.3em]">
                            <CheckCircle2 className="w-5 h-5" />
                            接下来的歌词
                          </div>
                          <p className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                            {currentQuestion.nextLyric}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={backToSelecting}
                    className="bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-900/20"
                  >
                    <ListMusic className="w-5 h-5" />
                    换一首挑战
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="mt-12 text-center text-white/20 text-[10px] uppercase tracking-[0.2em] font-medium">
          Powered by Gemini & QQ Music • Lyric Challenge
        </footer>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
