import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, FileAudio, Loader2 } from "lucide-react";
import { voiceAPI } from "@/lib/api";
import { toast } from "sonner";

interface UploadRecordingModalProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadRecordingModal({ open, onClose, onUploadSuccess }: UploadRecordingModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (file: File) => {
    // Validate file type
    // Accept audio/* and video/webm (WebM recordings are often reported as video/webm)
    const isValidAudio = file.type.startsWith('audio/') || 
                         file.type === 'video/webm' || 
                         file.type === 'video/mp4' ||
                         file.name.toLowerCase().endsWith('.webm') ||
                         file.name.toLowerCase().endsWith('.m4a');
    
    if (!isValidAudio) {
      toast.error("Invalid file type. Please select an audio file (WebM, MP3, WAV, M4A, etc.)");
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB. Please select a smaller file.");
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      const metadata = {
        title: `Uploaded ${selectedFile.name}`,
        description: 'Uploaded audio recording',
        recorded_at: new Date().toISOString(),
        field_id: null,
        location: null
      };

      const uploadResponse = await voiceAPI.uploadVoiceNote(selectedFile, metadata);
      const voiceNoteId = uploadResponse.voice_note_id;

      // Start AI processing in background
      voiceAPI.processVoiceNote(voiceNoteId).catch(error => {
        console.log('Background processing error:', error);
      });

      toast.success("Recording uploaded successfully!");
      setSelectedFile(null);
      onClose();
      onUploadSuccess();

    } catch (err: any) {
      console.error("Failed to upload recording:", err);
      toast.error(err.message || "Failed to upload recording");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setUploading(false);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full z-[10001]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload Recording</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!selectedFile ? (
            <>
              {/* Enhanced Mobile-friendly file selection */}
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-farm-accent to-farm-accent/70 rounded-full flex items-center justify-center shadow-lg shadow-farm-accent/30">
                      <FileAudio className="w-12 h-12 text-farm-dark" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground mb-1">
                      Select an audio file from your device
                    </p>
                    <p className="text-sm text-muted-foreground">
                      WebM, MP3, WAV, M4A, or any audio format
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Maximum file size: 50MB
                    </p>
                  </div>
                </div>

                {/* Enhanced Button */}
                <div className="bg-gradient-to-r from-farm-accent/10 to-farm-accent/5 border-2 border-farm-accent/30 rounded-xl p-4 hover:shadow-lg hover:shadow-farm-accent/20 transition-all">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-14 text-base font-semibold shadow-md bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                    size="lg"
                  >
                    <Upload className="w-6 h-6 mr-2" />
                    Choose Audio File
                  </Button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.webm,.mp3,.wav,.m4a,.aac,.ogg,audio/webm,audio/mpeg,audio/wav,audio/mp3,audio/m4a,audio/aac,audio/ogg"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </>
          ) : (
            <>
              {/* Enhanced Selected File Preview */}
              <div className="bg-gradient-to-r from-farm-accent/10 to-farm-accent/5 border-2 border-farm-accent/30 rounded-xl p-8 flex flex-col items-center justify-center overflow-hidden min-w-0 relative">
                {!uploading && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-md z-10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
                <div className="w-12 h-12 bg-farm-accent/20 rounded-lg flex items-center justify-center mb-2 flex-shrink-0">
                  <FileAudio className="w-6 h-6 text-farm-accent" />
                </div>
                <div className="w-full min-w-0 px-2 max-w-full">
                  <h3 
                    className="font-semibold text-sm text-foreground mb-1 break-words text-center w-full"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 h-12 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1 h-12 text-base font-semibold shadow-md bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

