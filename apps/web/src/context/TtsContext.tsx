import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { del, get, set } from "idb-keyval";
import { generateTts } from "../lib/api";
import { useApp } from "./AppContext";

export interface TtsQueueItem {
  id: string;
  title: string;
  text: string;
  cacheKey: string;
}

interface PersistedSession {
  queue: TtsQueueItem[];
  index: number;
  position: number;
  speed: number;
  status: "paused" | "stopped";
}

interface TtsContextValue {
  queue: TtsQueueItem[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  speed: number;
  restoreAvailable: boolean;
  sleepEndsAt: number | null;
  current?: TtsQueueItem;
  startText: (title: string, text: string) => Promise<void>;
  resume: () => Promise<void>;
  pause: () => void;
  stop: (confirmStop?: boolean) => Promise<void>;
  seek: (seconds: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setSpeed: (speed: number) => void;
  setSleepTimer: (minutes: number | null) => void;
}

const TtsContext = createContext<TtsContextValue | null>(null);
const SESSION_KEY = "casecraft.tts.session";

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function splitText(text: string, max: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= max) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= max) {
      current = paragraph;
      continue;
    }
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    current = "";
    for (const sentence of sentences) {
      if ((current + sentence).length > max && current) {
        chunks.push(current.trim());
        current = sentence;
      } else current += sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function TtsProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<TtsQueueItem[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const [queue, setQueue] = useState<TtsQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [restoreAvailable, setRestoreAvailable] = useState(false);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const onTime = () => setPosition(audio.currentTime || 0);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => { queueRef.current = queue; }, [queue]);

  useEffect(() => {
    get<PersistedSession>(SESSION_KEY).then((session) => {
      if (!session?.queue.length) return;
      queueRef.current = session.queue;
      setQueue(session.queue);
      setIndex(Math.min(session.index, session.queue.length - 1));
      setPosition(session.position || 0);
      setSpeedState(session.speed || 1);
      setRestoreAvailable(true);
    }).catch(() => undefined);
  }, []);

  const persist = useCallback(async (override?: Partial<PersistedSession>) => {
    if (!queue.length) return;
    const session: PersistedSession = {
      queue,
      index,
      position: audioRef.current?.currentTime || position,
      speed,
      status: playing ? "paused" : "stopped",
      ...override
    };
    await set(SESSION_KEY, session);
  }, [queue, index, position, speed, playing]);

  useEffect(() => {
    const timer = window.setInterval(() => void persist(), 3000);
    return () => window.clearInterval(timer);
  }, [persist]);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= sleepEndsAt) {
        audioRef.current?.pause();
        setSleepEndsAt(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepEndsAt]);

  const browserSpeak = useCallback((item: TtsQueueItem) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = "da-DK";
    utterance.rate = speed;
    utterance.onend = () => void goTo(index + 1);
    speechSynthesis.speak(utterance);
    setPlaying(true);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, speed]);

  const loadAndPlay = useCallback(async (targetIndex: number, resumePosition = 0) => {
    const item = queueRef.current[targetIndex];
    if (!item) return;
    setLoading(true);
    setIndex(targetIndex);
    if (state.tts.provider === "browser") {
      browserSpeak(item);
      return;
    }
    let blob = await get<Blob>(`tts:${item.cacheKey}`);
    if (!blob) {
      blob = await generateTts({
        provider: state.tts.provider,
        text: item.text,
        model: state.tts.model,
        voice: state.tts.voice,
        format: state.tts.format,
        speed: state.tts.speed,
        baseUrl: state.tts.customBaseUrl
      });
      await set(`tts:${item.cacheKey}`, blob);
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(blob);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = objectUrlRef.current;
    audio.playbackRate = speed;
    audio.onended = () => void goTo(targetIndex + 1);
    audio.onloadedmetadata = () => {
      if (resumePosition > 0 && resumePosition < audio.duration) audio.currentTime = resumePosition;
    };
    await audio.play();
    setLoading(false);
    setRestoreAvailable(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tts, speed, browserSpeak]);

  const goTo = useCallback(async (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= queueRef.current.length) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    await loadAndPlay(targetIndex);
  }, [loadAndPlay]);

  const startText = useCallback(async (title: string, text: string) => {
    const chunks = splitText(text, state.tts.maxChunkLength);
    const nextQueue = chunks.map((chunk, chunkIndex) => ({
      id: crypto.randomUUID(),
      title: chunks.length > 1 ? `${title} · del ${chunkIndex + 1}/${chunks.length}` : title,
      text: chunk,
      cacheKey: hash(`${state.tts.provider}|${state.tts.model}|${state.tts.voice}|${state.tts.speed}|${chunk}`)
    }));
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    setIndex(0);
    setPosition(0);
    setRestoreAvailable(false);
    await set(SESSION_KEY, { queue: nextQueue, index: 0, position: 0, speed, status: "paused" } satisfies PersistedSession);
    // State update is asynchronous, so generate/play the first item directly.
    const first = nextQueue[0];
    if (!first) return;
    setLoading(true);
    if (state.tts.provider === "browser") {
      browserSpeak(first);
      return;
    }
    let blob = await get<Blob>(`tts:${first.cacheKey}`);
    if (!blob) {
      blob = await generateTts({ provider: state.tts.provider, text: first.text, model: state.tts.model, voice: state.tts.voice, format: state.tts.format, speed: state.tts.speed, baseUrl: state.tts.customBaseUrl });
      await set(`tts:${first.cacheKey}`, blob);
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(blob);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = objectUrlRef.current;
    audio.playbackRate = speed;
    audio.onended = () => void goTo(1);
    await audio.play();
    setLoading(false);
  }, [state.tts, speed, browserSpeak, goTo]);

  const resume = useCallback(async () => {
    if (state.tts.provider === "browser") {
      const item = queue[index];
      if (item) browserSpeak(item);
      return;
    }
    const audio = audioRef.current;
    if (audio?.src) {
      await audio.play();
      return;
    }
    await loadAndPlay(index, position);
  }, [state.tts.provider, queue, index, browserSpeak, loadAndPlay, position]);

  const pause = useCallback(() => {
    if (state.tts.provider === "browser") speechSynthesis.pause();
    else audioRef.current?.pause();
    setPlaying(false);
    void persist();
  }, [state.tts.provider, persist]);

  const stop = useCallback(async (confirmStop = false) => {
    if (confirmStop && !window.confirm("Stop oplæsningen og ryd den aktive kø?")) return;
    speechSynthesis.cancel();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    queueRef.current = [];
    setQueue([]);
    setIndex(0);
    setPosition(0);
    setDuration(0);
    setPlaying(false);
    setRestoreAvailable(false);
    await del(SESSION_KEY);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || state.tts.provider === "browser") return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + seconds));
  }, [state.tts.provider]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const previous = useCallback(() => goTo(index - 1), [goTo, index]);
  const setSpeed = useCallback((nextSpeed: number) => {
    setSpeedState(nextSpeed);
    if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
  }, []);
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null);
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const media = navigator.mediaSession;
    media.setActionHandler("play", () => void resume());
    media.setActionHandler("pause", pause);
    media.setActionHandler("stop", () => void stop());
    media.setActionHandler("seekbackward", () => seek(-15));
    media.setActionHandler("seekforward", () => seek(15));
    media.setActionHandler("previoustrack", () => void previous());
    media.setActionHandler("nexttrack", () => void next());
    return () => {
      for (const action of ["play", "pause", "stop", "seekbackward", "seekforward", "previoustrack", "nexttrack"] as MediaSessionAction[]) {
        try { media.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [resume, pause, stop, seek, previous, next]);

  const current = queue[index];
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: "CaseCraft Studio", album: "Oplæsning" });
  }, [current]);

  const value = useMemo<TtsContextValue>(() => ({
    queue, index, playing, loading, position, duration, speed, restoreAvailable, sleepEndsAt, current,
    startText, resume, pause, stop, seek, next, previous, setSpeed, setSleepTimer
  }), [queue, index, playing, loading, position, duration, speed, restoreAvailable, sleepEndsAt, current, startText, resume, pause, stop, seek, next, previous, setSpeed, setSleepTimer]);

  return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
}

export function useTts(): TtsContextValue {
  const value = useContext(TtsContext);
  if (!value) throw new Error("useTts must be used inside TtsProvider");
  return value;
}
