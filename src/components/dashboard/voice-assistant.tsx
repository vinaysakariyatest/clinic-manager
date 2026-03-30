"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { processVoiceCommand } from "@/app/actions/voice-command";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  const recognitionRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onstart = () => {
          setIsListening(true);
          setTranscript("");
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const result = event.results[current][0].transcript;
          setTranscript(result);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          setIsListening(false);
          toast.error("Speech recognition failed or was blocked.");
        };

        recognitionRef.current = recognition;
      } else {
        setIsSupported(false);
      }
    }
  }, []);


  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setShowPanel(true);
      recognitionRef.current?.start();
    }
  };

  const handleProcessCommand = async () => {
    if (!transcript) return;
    
    setIsProcessing(true);
    try {
      const result = await processVoiceCommand(transcript);
      if (result.success) {
        // 1. Give Voice Feedback
        speakFeedback(result.message);
        
        // 2. Perform Action
        if (result.action === "NAVIGATE" && result.target) {
          router.push(result.target);
        } else if (result.action === "REFRESH") {
          router.refresh();
        } else if (result.action === "LOGOUT") {
          // This would need a logout action, for now just show a message
          toast.info("Logging out...");
        }
        
        toast.success("AI Command Executed", {
          description: result.message
        });
        
        // Hide panel after a delay
        setTimeout(() => setShowPanel(false), 3000);
      } else {
        toast.error(result.message || "Failed to process command.");
      }
    } catch (err) {
      toast.error("An error occurred while processing voice.");
    } finally {
      setIsProcessing(false);
    }
  };

  const speakFeedback = (text: string) => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => 
        (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("siri") || v.name.toLowerCase().includes("google")) && 
        v.lang.startsWith("en")
      );
      if (femaleVoice) speech.voice = femaleVoice;
      speech.rate = 1.0;
      speech.pitch = 1.1;
      window.speechSynthesis.speak(speech);
    }
  };

  // Automatically process when listening ends and we have a transcript
  useEffect(() => {
    if (!isListening && transcript && showPanel && !isProcessing) {
      handleProcessCommand();
    }
  }, [isListening]);

  console.log("[VoiceAssistant] State:", { isSupported, isListening, showPanel });

  return (

    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
      {showPanel && (
        <div className="bg-white/95 backdrop-blur-xl border border-indigo-100 shadow-2xl rounded-3xl p-6 w-[280px] animate-in slide-in-from-bottom-4 duration-300">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">AI Dashboard Assistant</span>
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full" onClick={() => setShowPanel(false)}>
                <X className="h-3 w-3" />
              </Button>
           </div>

           <div className="min-h-[60px] flex items-center justify-center text-center">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2">
                   <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                   <p className="text-[11px] font-bold text-slate-400 uppercase">Analyzing Intent...</p>
                </div>
              ) : (
                <p className={cn(
                  "text-sm font-medium transition-all duration-300",
                  transcript ? "text-slate-800" : "text-slate-400 italic"
                )}>
                  {transcript || "Listening for your command..."}
                </p>
              )}
           </div>

           {!isListening && !isProcessing && transcript && (
             <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" className="text-[10px] h-7 font-black bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white" onClick={handleProcessCommand}>
                   RE-TRY COMMAND
                </Button>
             </div>
           )}
        </div>
      )}

      <button
        onClick={toggleListening}
        className={cn(
          "h-16 w-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 relative group overflow-hidden border-4 border-white",
          isListening 
            ? "bg-rose-500 scale-110 shadow-rose-200" 
            : "bg-indigo-600 hover:scale-105 shadow-indigo-200"
        )}
      >
        {isListening && (
           <>
            <span className="absolute inset-0 bg-rose-400/30 animate-ping rounded-full" />
            <span className="absolute inset-0 bg-rose-500/20 animate-pulse rounded-full" />
           </>
        )}
        
        {isProcessing ? (
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        ) : isListening ? (
          <MicOff className="h-8 w-8 text-white animate-in zoom-in" />
        ) : (
          <div className="relative">
            <Mic className="h-8 w-8 text-white" />
            <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </button>
    </div>
  );
}
