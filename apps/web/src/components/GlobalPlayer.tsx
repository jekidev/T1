import { Pause, Play, RotateCcw, RotateCw, Square, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTts } from "../context/TtsContext";

function time(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

export function GlobalPlayer() {
  const tts = useTts();
  if (!tts.current && !tts.restoreAvailable) return null;
  return (
    <aside className="mini-player" aria-label="Oplæsningsafspiller">
      <div className="mini-meta">
        <strong>{tts.current?.title || "Tidligere oplæsning"}</strong>
        <span>{tts.restoreAvailable ? "Klar til at genoptage" : `${time(tts.position)} / ${time(tts.duration)}`}</span>
      </div>
      <div className="mini-progress"><span style={{ width: `${tts.duration ? (tts.position / tts.duration) * 100 : 0}%` }} /></div>
      <div className="mini-actions">
        <button onClick={() => tts.seek(-15)} title="15 sekunder tilbage"><RotateCcw size={17} /></button>
        <button className="primary-circle" onClick={() => tts.playing ? tts.pause() : void tts.resume()} disabled={tts.loading}>
          {tts.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={() => tts.seek(15)} title="15 sekunder frem"><RotateCw size={17} /></button>
        <Link className="player-link" to="/player">Åbn</Link>
        <button onClick={() => void tts.stop(true)} title="Stop og ryd"><Square size={16} /></button>
        <button onClick={tts.pause} title="Skjul/pause"><X size={16} /></button>
      </div>
    </aside>
  );
}
