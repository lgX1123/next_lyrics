import { GoogleGenAI } from "@google/genai";

export interface SongQuestion {
  singer: string;
  songTitle: string;
  lyricsSnippet: string;
  nextLyric: string;
  audioUrl?: string;
}

export interface SongItem {
  singer: string;
  songTitle: string;
  previewUrl: string;
  mid?: string;
}

export async function searchSongsBySinger(singers: string[]): Promise<SongItem[]> {
  try {
    const allSongs: SongItem[] = [];
    
    for (const singer of singers) {
      if (!singer.trim()) continue;
      
      const query = encodeURIComponent(singer.trim());
      // Fetch more songs to allow shuffling
      const response = await fetch(`/api/music/search?s=${query}&limit=50`);
      const data = await response.json();
      
      if (data.results) {
        allSongs.push(...data.results);
      }
    }
    
    // Remove duplicates
    const uniqueSongs = allSongs.filter((song, index, self) =>
      index === self.findIndex((t) => (
        t.songTitle === song.songTitle && t.singer === song.singer
      ))
    );

    // Shuffle the array to make "Change Batch" work better
    for (let i = uniqueSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueSongs[i], uniqueSongs[j]] = [uniqueSongs[j], uniqueSongs[i]];
    }

    return uniqueSongs.slice(0, 5);
  } catch (error) {
    console.error("Music Search Error:", error);
    return [];
  }
}

export async function generateSongQuestion(song: SongItem): Promise<SongQuestion> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const singer = song.singer;
  const songTitle = song.songTitle;

  const matchPrompt = `你是一个专业的音乐挑战出题官。
  任务：
  1. 使用 Google 搜索查询 "${singer}" 的歌曲 "${songTitle}" 的【完整官方歌词】。
  2. 从歌词中挑选一段具有代表性的片段（通常是副歌或一段完整的抒情段落，长度约 4-6 行）。
  3. 将这段片段作为 lyricsSnippet 返回。注意：歌词片段中必须保留原始的换行符。
  4. 将紧接着这段片段后的【第一句完整歌词】作为 nextLyric 返回。
  
  要求：
  - 必须以官方搜索到的歌词文本为准。
  - lyricsSnippet 必须包含换行符（\n）。
  - nextLyric 必须是歌曲中紧随其后的下一句，严禁虚构。
  
  请以 JSON 格式返回：
  {
    "singer": "${singer}",
    "songTitle": "${songTitle}",
    "lyricsSnippet": "歌词片段（含换行）",
    "nextLyric": "紧随其后的下一句官方歌词"
  }`;

  try {
    const finalResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: matchPrompt }
      ],
      config: { 
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      },
    });

    const result = JSON.parse(finalResponse.text);
    
    // If it's a QQ Music song, try to get the audio URL
    let audioUrl: string | null = null;
    if (song.mid) {
      try {
        const audioRes = await fetch(`/api/music/qq-audio?mid=${song.mid}`);
        const audioData = await audioRes.json();
        if (audioData.url) {
          audioUrl = `/api/music/proxy-audio?url=${encodeURIComponent(audioData.url)}&source=qq`;
        }
      } catch (e) {
        console.error("Failed to fetch QQ audio:", e);
      }
    }

    return { ...result, audioUrl };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Rethrow with more info if possible
    if (error.response) {
      throw new Error(`Gemini API Error: ${JSON.stringify(error.response)}`);
    }
    throw error;
  }
}
