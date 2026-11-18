import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

/**
 * Textarea with a microphone button that transcribes speech to text
 * using the browser's Web Speech API (no backend / API key needed).
 * Supports English (en-IN) and Hindi (hi-IN) toggle.
 * Transcript appends to existing text.
 */
export default function VoiceTextInput({ value, onChange, placeholder, rows = 2, label }) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-IN");
  const recRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = lang;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      if (transcript) {
        const sep = value && !value.endsWith(" ") ? " " : "";
        onChange((value || "") + sep + transcript.trim() + " ");
      }
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        toast({ title: "Voice input error", description: e.error, variant: "destructive" });
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} };
  }, [lang]);

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) {
      toast({ title: "Voice input unsupported", description: "Use Chrome/Edge for speech-to-text", variant: "destructive" });
      return;
    }
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        // restart if already active
        try { rec.abort(); rec.start(); setListening(true); } catch {}
      }
    }
  };

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <button type="button" onClick={() => setLang(l => l === "en-IN" ? "hi-IN" : "en-IN")} className="text-[11px] px-2 py-0.5 rounded border bg-muted hover:bg-accent">
            {lang === "en-IN" ? "EN" : "हिं"}
          </button>
        </div>
      )}
      <div className="relative">
        <Textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={listening ? "pr-12 ring-2 ring-red-400" : "pr-12"}
        />
        <button
          type="button"
          onClick={toggle}
          title={listening ? "Stop listening" : "Speak to fill"}
          className={`absolute right-2 top-2 h-8 w-8 rounded-full flex items-center justify-center transition-colors ${listening ? "bg-red-500 text-white animate-pulse" : "bg-muted hover:bg-accent text-muted-foreground"}`}
        >
          {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>
      {listening && <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1"><MicOff className="h-3 w-3" /> Listening... speak now (tap to stop)</p>}
    </div>
  );
}