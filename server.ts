import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for QQ Music
  app.get("/api/music/search", async (req, res) => {
    try {
      const { s, limit = 20 } = req.query;
      if (!s) return res.status(400).json({ error: "Missing search query" });

      const query = encodeURIComponent(s as string);
      // QQ Music Search API
      const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?new_json=1&aggr=1&cr=1&flag_qc=0&p=1&n=${limit}&w=${query}&format=json`;
      
      const response = await fetch(url, {
        headers: {
          "Referer": "https://y.qq.com",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`QQ Music Search API failed: ${response.status} ${text}`);
        return res.status(response.status).json({ error: "QQ Music Search API failed", details: text });
      }

      const data = await response.json();

      if (data.code === 0 && data.data && data.data.song && data.data.song.list) {
        const songs = data.data.song.list.map((song: any) => ({
          singer: song.singer.map((a: any) => a.name).join(", "),
          songTitle: song.name,
          previewUrl: "",
          mid: song.mid
        }));
        res.json({ results: songs });
      } else {
        res.json({ results: [] });
      }
    } catch (error) {
      console.error("QQ Music Proxy Error:", error);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : String(error),
        route: "/api/music/search"
      });
    }
  });

  // API to get QQ Music audio URL
  app.get("/api/music/qq-audio", async (req, res) => {
    try {
      const { mid } = req.query;
      if (!mid) return res.status(400).json({ error: "Missing mid" });

      const guid = "10000";
      const data = {
        req_0: {
          module: "vkey.GetVkeyServer",
          method: "CgiGetVkey",
          param: {
            guid,
            songmid: [mid],
            songtype: [0],
            uin: "0",
            loginflag: 1,
            platform: "20"
          }
        },
        comm: { uin: 0, format: "json", ct: 24, cv: 0 }
      };

      const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${JSON.stringify(data)}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`QQ Music Audio API failed: ${response.status} ${text}`);
        return res.status(response.status).json({ error: "QQ Music Audio API failed", details: text });
      }

      const resData = await response.json();

      if (resData.req_0 && resData.req_0.data && resData.req_0.data.midurlinfo && resData.req_0.data.midurlinfo[0]) {
        const purl = resData.req_0.data.midurlinfo[0].purl;
        console.log(`QQ Music purl for ${mid}: ${purl}`);
        if (purl && purl.trim() !== "") {
          const audioUrl = `http://ws.stream.qqmusic.qq.com/${purl}`;
          return res.json({ url: audioUrl });
        }
      }
      res.json({ url: null });
    } catch (error) {
      console.error("QQ Audio Error:", error);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : String(error),
        route: "/api/music/qq-audio"
      });
    }
  });

  // Proxy for audio files to avoid CORS
  app.get("/api/music/proxy-audio", async (req, res) => {
    try {
      const { url, source = 'netease' } = req.query;
      if (!url) return res.status(400).send("Missing url");

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };

      if (source === 'netease') {
        headers["Referer"] = "https://music.163.com";
        headers["Cookie"] = "os=pc; MUSIC_U=; __remember_me=true";
      } else if (source === 'qq') {
        headers["Referer"] = "https://y.qq.com";
      }

      const audioResponse = await fetch(url as string, {
        headers,
        redirect: 'follow'
      });

      if (!audioResponse.ok) {
        const errorText = await audioResponse.text();
        console.error(`Audio fetch failed: ${audioResponse.status} ${audioResponse.statusText} - ${errorText}`);
        return res.status(audioResponse.status).send(`Failed to fetch audio: ${audioResponse.statusText}`);
      }

      const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
      
      // If NetEase returns HTML, it's likely an error page or redirect loop
      if (contentType.includes("text/html")) {
        console.warn("Proxy received HTML instead of audio. NetEase might be blocking or song is unavailable.");
        return res.status(403).send("该歌曲受版权保护或仅限会员，无法通过外链播放，请尝试其他歌曲。");
      }

      if (audioResponse.status === 404) {
        return res.status(404).send("音频文件未找到，可能是链接已失效或该歌曲暂不支持播放。");
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      const buffer = await audioResponse.arrayBuffer();
      
      if (buffer.byteLength < 5000) {
        console.warn(`Audio file is suspiciously small (${buffer.byteLength} bytes), might be an error.`);
      }

      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Audio Proxy Error:", error);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : String(error),
        route: "/api/music/proxy-audio"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
