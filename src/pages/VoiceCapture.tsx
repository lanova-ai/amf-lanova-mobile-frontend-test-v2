import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X, Mic, WifiOff, CheckCircle2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { voiceAPI } from "@/lib/api";
import { offlineQueue } from "@/services/offlineQueue";
import { useToast } from "@/hooks/use-toast";

type CaptureStep = "recording" | "completed" | "processing" | "error";

const VoiceCapture = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineSuccess, setShowOfflineSuccess] = useState(false);
  
  // Get parameters from map
  const fieldNoteIdFromUrl = searchParams.get('field_note_id');
  const latFromUrl = searchParams.get('lat');
  const lngFromUrl = searchParams.get('lng');
  
  console.log('VoiceCapture URL params:', {
    field_note_id: fieldNoteIdFromUrl,
    lat: latFromUrl,
    lng: lngFromUrl
  });
  
  // Recording state
  const [step, setStep] = useState<CaptureStep>("recording");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Setup MediaRecorder with best available format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = 'audio/wav';
        }
      }

      console.log(`🎤 Using MIME type: ${mimeType}`);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🎤 Recording stopped, creating blob...');
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stopStream();
        setStep('completed');
      };

      mediaRecorder.start(1000); // Collect chunks every second
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('❌ Error accessing microphone:', err);
      setError('Unable to access microphone. Please check permissions.');
      setStep('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    
    // Check if offline - queue the recording
    if (!isOnline) {
      try {
        setStep('processing');
        
        const metadata = {
          duration_seconds: recordingTime,
          source: 'quick_record',
          recorded_at: new Date().toISOString(),
          field_note_id: fieldNoteIdFromUrl || undefined,
          location: (latFromUrl && lngFromUrl) ? {
            lat: parseFloat(latFromUrl),
            lon: parseFloat(lngFromUrl)
          } : undefined
        };
        
        await offlineQueue.addRecording({
          id: `offline-${Date.now()}`,
          audioBlob,
          metadata: {
            recorded_at: metadata.recorded_at,
            duration: recordingTime,
            filename: `recording-${Date.now()}.webm`
          }
        });
        
        console.log('✅ Recording queued for offline upload');
        
        // Show centered success message
        setShowOfflineSuccess(true);
        
        // Navigate after 3 seconds
        setTimeout(() => {
          navigate('/recordings');
        }, 3000);
        
        return;
      } catch (err: any) {
        console.error('❌ Error queueing recording:', err);
        setError('Failed to save recording offline');
        setStep('error');
        return;
      }
    }
    
    // Online - upload immediately
    try {
      setStep('processing');
      
      // Upload voice note with client's local timestamp
      console.log('📤 Uploading voice note...', fieldNoteIdFromUrl ? `for field_note ${fieldNoteIdFromUrl}` : '');
      
      const metadata: any = {
        duration_seconds: recordingTime,
        source: 'quick_record',
        recorded_at: new Date().toISOString(), // Client's local time
      };
      
      // Add field_note_id if provided from map
      if (fieldNoteIdFromUrl) {
        metadata.field_note_id = fieldNoteIdFromUrl;
      }
      
      // Add location if provided from map
      if (latFromUrl && lngFromUrl) {
        metadata.location = {
          lat: parseFloat(latFromUrl),
          lon: parseFloat(lngFromUrl)
        };
      }
      
      console.log('Upload metadata:', metadata);
      const uploadResponse = await voiceAPI.uploadVoiceNote(audioBlob, metadata);

      console.log('✅ Voice note uploaded:', uploadResponse);
      
      // Explicitly trigger processing like demo-ui does
      const voiceNoteId = uploadResponse.voice_note_id;
      if (voiceNoteId) {
        console.log('🤖 Triggering AI processing...');
        // Don't wait for processing to complete, just trigger it
        voiceAPI.processVoiceNote(voiceNoteId).catch(error => {
          console.log('⚠️ Background processing error (will continue):', error);
        });
      }
      
      // Navigate to Recordings page with refresh flag to reload the list
      navigate('/recordings', { state: { refresh: true } });

    } catch (err: any) {
      console.error('❌ Error uploading voice note:', err);
      setError(err.message || 'Failed to upload recording');
      setStep('error');
    }
  };

  const handleDiscard = () => {
    // Go back to previous page without uploading
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-start recording when component mounts
  useEffect(() => {
    startRecording();
  }, []);

  if (step === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <button onClick={() => navigate("/")} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Error</h2>
          <button onClick={() => navigate("/")} className="p-2">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-6">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-xl font-bold text-center">Recording Error</h2>
          <p className="text-center text-muted-foreground max-w-md">
            {error}
          </p>
          <Button onClick={() => navigate("/")} variant="outline" className="w-full max-w-md">
            Go Back
          </Button>
        </main>
      </div>
    );
  }

  if (step === "recording") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <button onClick={handleDiscard} className="p-2">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Quick Recording</h2>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
          {/* Pulsating Mic Animation - iPhone-like */}
          <div className="relative">
            {/* Outer pulse ring */}
            <div className="absolute inset-0 w-40 h-40 rounded-full bg-red-500/20 animate-pulse" />
            <div className="absolute inset-6 w-28 h-28 rounded-full bg-red-500/30 animate-pulse" style={{ animationDelay: "0.3s" }} />
            
            {/* Clickable Mic Button - RED while recording */}
            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="relative w-40 h-40 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-200 flex items-center justify-center shadow-2xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic className="h-20 w-20 text-white drop-shadow-lg" />
            </button>
          </div>

          {/* Recording Status */}
          <div className="text-red-500 font-semibold text-lg">
            🔴 Recording...
          </div>

          {/* Timer */}
          <div className="space-y-3">
            <div className="text-5xl font-mono font-bold text-center text-red-500">
              {formatTime(recordingTime)}
            </div>
            
            {/* Progress Bar */}
            <div className="w-64 bg-muted rounded-full h-3">
              <div 
                className="bg-red-500 h-3 rounded-full transition-all duration-1000 ease-linear shadow-lg"
                style={{ width: `${(recordingTime / 300) * 100}%` }} // 300 seconds = 5 minutes
              />
            </div>
            
            <div className="text-sm text-muted-foreground text-center font-medium">
              Max: 5:00
            </div>
          </div>

          {/* Instruction Text */}
          <div className="text-center space-y-2">
            <p className="text-base text-foreground font-medium">
              Tap the microphone to stop
            </p>
            <p className="text-sm text-muted-foreground">
              or use the button below
            </p>
          </div>

          {/* Stop Button (smaller, secondary option) */}
          <Button 
            onClick={stopRecording} 
            size="default"
            variant="outline"
            className="min-w-[180px] h-11 text-sm font-medium border-2 hover:bg-red-50 hover:border-red-500 hover:text-red-600"
            disabled={!isRecording}
          >
            Stop Recording
          </Button>
        </main>
      </div>
    );
  }

  if (step === "completed") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <button onClick={handleDiscard} className="p-2">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Recording Complete</h2>
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-farm-accent/20 rounded-full flex items-center justify-center">
            <div className="text-5xl text-farm-accent">✓</div>
          </div>

          {/* Recording Info */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Recording Complete</h3>
            <p className="text-muted-foreground">Duration: {formatTime(recordingTime)}</p>
          </div>

          {/* Offline Indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-4 py-3 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
              <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <p className="text-sm text-orange-800 dark:text-orange-300">
                Offline - Will queue for upload
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-md space-y-3">
            <Button 
              onClick={handleSubmit}
              className="w-full h-12 text-base bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
            >
              {isOnline ? 'Submit Recording' : 'Save Offline'}
            </Button>
            <Button 
              onClick={handleDiscard}
              variant="outline"
              className="w-full h-12 text-base font-semibold"
            >
              Discard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <div className="w-10" /> {/* Spacer */}
          <h2 className="text-lg font-semibold">Uploading...</h2>
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>

          <div className="space-y-2 text-center">
            <p className="text-lg font-medium">Submitting Recording</p>
            <p className="text-sm text-muted-foreground">
              Processing will continue in the background
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Centered Offline Success Overlay
  if (showOfflineSuccess) {
    return (
      <div className="fixed inset-0 bg-black/5 backdrop-blur-[2px] flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center space-y-6 animate-slide-up">
          {/* Success Icon */}
          <div className="mx-auto w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-orange-600 dark:text-orange-400" />
          </div>
          
          {/* Message */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">📭 Queued for Upload</h3>
            <p className="text-muted-foreground text-lg">
              Recording saved. Will upload when you're back online.
            </p>
          </div>
          
          {/* Loading indicator */}
          <div className="flex justify-center gap-1.5 pt-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // This shouldn't be reached since we navigate immediately after upload
  return null;
};

export default VoiceCapture;

