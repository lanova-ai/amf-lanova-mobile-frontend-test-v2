import { useState, useRef, useEffect } from "react";
import { Mic, Trash2, Upload, ChevronDown, ChevronUp, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fieldsAPI } from "@/lib/api";

interface ScoutingVoiceRecorderProps {
  voiceBlob: Blob | null;
  onUpdate: (updates: { voice_blob: Blob | null }) => void;
  fieldId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function ScoutingVoiceRecorder({ voiceBlob, onUpdate, fieldId, latitude, longitude, onRecordingStateChange }: ScoutingVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [fieldName, setFieldName] = useState<string | null>(null);
  const [loadingField, setLoadingField] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch field name if fieldId is provided
  useEffect(() => {
    const fetchFieldName = async () => {
      if (!fieldId) {
        setFieldName(null);
        return;
      }
      
      try {
        setLoadingField(true);
        const response = await fieldsAPI.getFields();
        // Try matching by both id and field_id (different APIs use different keys)
        const field = response.fields?.find((f: any) => 
          f.id === fieldId || f.field_id === fieldId || 
          String(f.id) === String(fieldId) || String(f.field_id) === String(fieldId)
        );
        if (field) {
          setFieldName(field.name);
        } else {
          setFieldName("Unknown Field");
        }
      } catch (error) {
        // Silent fail - just show Unknown Field
        setFieldName("Unknown Field");
      } finally {
        setLoadingField(false);
      }
    };

    fetchFieldName();
  }, [fieldId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Support multiple formats
      const mimeType = 
        MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
        MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : '';
      
      if (!mimeType) {
        throw new Error('No supported audio format found');
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onUpdate({ voice_blob: blob });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Notify parent component
      onRecordingStateChange?.(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast.success("Recording started - Tap mic to stop");
    } catch (error: any) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Notify parent component
      onRecordingStateChange?.(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success("Recording stopped");
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    onUpdate({ voice_blob: null });
    setRecordingTime(0);
    setUploadedFileName(null);
    toast.success("Recording deleted");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isValidAudio = file.type.startsWith('audio/') || 
                         file.type === 'video/webm' || 
                         file.type === 'video/mp4' ||
                         file.type === 'application/ogg' ||
                         fileName.endsWith('.webm') ||
                         fileName.endsWith('.m4a') ||
                         fileName.endsWith('.mp3') ||
                         fileName.endsWith('.wav') ||
                         fileName.endsWith('.ogg') ||
                         fileName.endsWith('.aac') ||
                         fileName.endsWith('.flac');
    
    if (!isValidAudio) {
      toast.error("Invalid file type. Please select an audio file (MP3, WAV, M4A, OGG, WebM)");
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size must be less than 25MB");
      return;
    }

    // Create URL for playback
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setUploadedFileName(file.name);
    onUpdate({ voice_blob: file });
    
    // Get audio duration if possible
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setRecordingTime(Math.floor(audio.duration));
    });

    toast.success("Audio file uploaded successfully");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg,.aac,.flac"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Location Confirmation - Compact */}
      {(fieldId || (latitude && longitude)) && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span className="font-medium text-green-700 mr-1">Location Confirmed:</span>
            
            <div className="flex items-center gap-3 text-muted-foreground overflow-hidden">
              {fieldId && (
                <span className="truncate font-medium text-foreground/80">
                  {loadingField ? "..." : fieldName || "Unknown"}
                </span>
              )}
              {latitude && longitude && (
                <span className="font-mono opacity-70 hidden xs:inline">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tips Section - Collapsible */}
      <div className="bg-muted/50 border rounded-lg overflow-hidden">
        <button 
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">
              💡 Recording Tips
            </h3>
          </div>
          {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showTips && (
          <div className="px-4 pb-4 space-y-3 border-t">
            <div className="space-y-2 text-sm text-muted-foreground pt-3">
              <div>
                <p className="font-medium text-foreground">Essential:</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                  <li>Growth stage (V6, V8, R1, R3, etc.)</li>
                  <li>Plant height (approximate inches)</li>
                </ul>
              </div>
              
              <div>
                <p className="font-medium text-foreground">Observations:</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-xs">
                  <li>Weeds present (types if known)</li>
                  <li>Insects observed (describe damage)</li>
                  <li>Disease symptoms (describe location)</li>
                  <li>Nutrient issues (yellowing, stunting)</li>
                  <li>General field condition</li>
                </ul>
              </div>
            </div>

            <div className="bg-muted rounded p-2 text-xs italic text-muted-foreground">
              Example: "Plants at V8 stage, about 36 inches tall. Seeing some gray leaf spot on lower leaves, medium severity. Also noticing foxtail in the rows..."
            </div>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        {/* IDLE STATE - No recording, no audio */}
        {!audioUrl && !isRecording && (
          <>
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-16 h-16 text-primary" />
            </div>
            
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                onClick={startRecording}
                size="lg"
                className="w-full rounded-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                <Mic className="mr-2 h-5 w-5" />
                Record Voice
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                variant="outline"
                className="w-full rounded-full"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Audio File
              </Button>
            </div>
          </>
        )}

        {/* RECORDING STATE */}
        {isRecording && (
          <>
            {/* Pulsating Mic Animation */}
            <div className="relative">
              {/* Outer pulse rings */}
              <div className="absolute inset-0 w-40 h-40 rounded-full bg-red-500/20 animate-pulse" />
              <div className="absolute inset-6 w-28 h-28 rounded-full bg-red-500/30 animate-pulse" style={{ animationDelay: "0.3s" }} />
              
              {/* Clickable Mic Button - RED while recording */}
              <button
                onClick={stopRecording}
                className="relative w-40 h-40 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-200 flex items-center justify-center shadow-2xl cursor-pointer"
              >
                <Mic className="h-20 w-20 text-white drop-shadow-lg" />
              </button>
            </div>

            {/* Recording Status */}
            <div className="text-red-500 font-semibold text-lg">
              🔴 Recording...
            </div>

            {/* Timer */}
            <div className="space-y-3 w-64">
              <div className="text-5xl font-mono font-bold text-center text-red-500">
                {formatTime(recordingTime)}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full transition-all duration-1000 ease-linear shadow-lg"
                  style={{ width: `${Math.min((recordingTime / 300) * 100, 100)}%` }} // 300 seconds = 5 minutes
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
            >
              Stop Recording
            </Button>
          </>
        )}

        {/* COMPLETED STATE - Audio available */}
        {audioUrl && !isRecording && (
          <>
            <div className="w-32 h-32 rounded-full bg-green-500/20 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
                {uploadedFileName ? <Upload className="w-12 h-12 text-white" /> : <Mic className="w-12 h-12 text-white" />}
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                ✓ {uploadedFileName ? 'Audio Uploaded' : 'Recording Complete'}
              </p>
              {uploadedFileName && (
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {uploadedFileName}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Duration: {formatTime(recordingTime)}
              </p>
            </div>

            {/* Audio Player */}
            <div className="w-full max-w-md">
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={deleteRecording}
                variant="outline"
                size="lg"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              {uploadedFileName ? (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="lg"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Change File
                </Button>
              ) : (
                <Button
                  onClick={startRecording}
                  variant="outline"
                  size="lg"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Re-record
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Optional Note */}
      {!isRecording && (
        <div className="text-center text-sm text-muted-foreground">
          Voice recording is optional but helps AI generate better analysis
        </div>
      )}
    </div>
  );
}
