"use client";

/**
 * In-browser voice recorder using the standard MediaRecorder API. Produces a
 * single File per recording and hands it back via onRecorded — the caller is
 * responsible for uploading. The backend treats any blob whose content_type
 * starts with `audio/` as kind="voice", so we don't need a separate flag.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RecorderState = "idle" | "recording" | "done";

/** Pick a mime type the current browser actually supports. */
function pickMimeType(): { mimeType: string; ext: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", ext: "webm" };
  }
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/mp4", ext: "m4a" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "", ext: "webm" };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  onRecorded,
}: {
  /** Called when the user finishes a take. Receives a fresh audio File. */
  onRecorded: (file: File) => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{
    url: string;
    file: File;
    durationSec: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Clean up the stream + any preview URL on unmount.
  useEffect(() => {
    return () => {
      stopTracks();
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // We intentionally don't re-run cleanup on `preview` changes — the dropPreview
    // helper handles URL.revokeObjectURL for replaced previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTracks() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  function dropPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function startRecording() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("Браузер не поддерживает запись звука.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mimeType, ext } = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const durationSec = Math.max(
          1,
          Math.round((performance.now() - startedAtRef.current) / 1000)
        );
        const fileName = `voice-${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type });
        const url = URL.createObjectURL(blob);
        dropPreview();
        setPreview({ url, file, durationSec });
        setState("done");
        stopTracks();
        onRecorded(file);
      };

      startedAtRef.current = performance.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed(
          Math.floor((performance.now() - startedAtRef.current) / 1000)
        );
      }, 250);
      recorder.start();
      setState("recording");
    } catch (err) {
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Доступ к микрофону запрещён."
          : "Не удалось включить микрофон.";
      toast.error(message);
      stopTracks();
      setState("idle");
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopTracks();
      setState("idle");
    }
  }

  function discardRecording() {
    dropPreview();
    setElapsed(0);
    setState("idle");
  }

  return (
    <div>
      <label className="block text-[12px] font-medium text-ink-2 mb-1.5">
        Голосовое сообщение (необязательно)
      </label>

      {state !== "done" ? (
        <button
          type="button"
          onClick={state === "recording" ? stopRecording : startRecording}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3 rounded-md border text-[13px] transition-colors",
            state === "recording"
              ? "border-danger/40 bg-tag-red-bg/40 text-tag-red-fg"
              : "border-dashed border-hairline-strong text-ink-3 hover:text-ink hover:bg-surface-2"
          )}
        >
          {state === "recording" ? (
            <>
              <span className="relative grid place-items-center h-3 w-3">
                <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-danger" />
              </span>
              <Square className="h-3.5 w-3.5" />
              Остановить · {formatDuration(elapsed)}
            </>
          ) : (
            <>
              <Mic className="h-3.5 w-3.5" />
              Записать голосовое
            </>
          )}
        </button>
      ) : (
        preview && (
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 rounded-md border border-hairline bg-surface-2">
            <Mic className="h-3.5 w-3.5 text-tag-purple-fg shrink-0" />
            <audio
              controls
              src={preview.url}
              className="h-10 sm:h-8 min-w-0 w-full sm:w-auto sm:max-w-[280px] flex-1"
            />
            <span className="text-[11px] text-ink-4 tabular-nums">
              {formatDuration(preview.durationSec)}
            </span>
            <button
              type="button"
              onClick={discardRecording}
              className="h-9 w-9 sm:h-7 sm:w-7 grid place-items-center rounded text-ink-4 hover:text-danger hover:bg-tag-red-bg/30 transition-colors"
              title="Удалить запись"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      )}

      <p className="mt-1 text-[11px] text-ink-4">
        Запись добавится к задаче после создания и будет помечена как голосовое.
      </p>
    </div>
  );
}
