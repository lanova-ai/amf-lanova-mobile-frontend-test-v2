import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { scoutingNotesAPI, type ScoutingNote } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploadModal } from "@/components/PhotoUploadModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Sprout,
  Loader2,
  Mic,
  Image as ImageIcon,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Pencil,
  Upload,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function ScoutingNoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<ScoutingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Individual edit states for each section
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editedDate, setEditedDate] = useState("");
  
  const [isEditingUserNotes, setIsEditingUserNotes] = useState(false);
  const [editedUserNotes, setEditedUserNotes] = useState("");
  
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  
  const [saving, setSaving] = useState(false);
  
  // Modals & refs
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showDeleteVoiceDialog, setShowDeleteVoiceDialog] = useState(false);
  const [showDeletePhotoDialog, setShowDeletePhotoDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [voiceToDelete, setVoiceToDelete] = useState<string | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadNote(true); // Only show loading spinner on initial load
    }
  }, [id]);

  const loadNote = async (showLoadingSpinner = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const data = await scoutingNotesAPI.getScoutingNote(id!);
      setNote(data);
      setEditedTitle(getNoteTitle(data));
      setEditedDate(data.scouting_date.split('T')[0]); // Format as YYYY-MM-DD
      setEditedUserNotes(data.user_notes || "");
      setEditedTranscript(data.voice_recordings?.[0]?.transcript || "");
    } catch (error: any) {
      console.error("Failed to load scouting note:", error);
      toast.error("Failed to load scouting note");
      navigate("/scouting-notes");
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const handleTriggerAI = async () => {
    if (!note) return;

    let toastId: string | number | undefined;
    let pollInterval: NodeJS.Timeout | undefined;

    try {
      setProcessing(true);
      await scoutingNotesAPI.triggerAIAnalysis(note.id, true);
      
      // Show single toast that will transition
      toastId = toast.loading("Reprocessing with AI...");
      
      // Poll for updates silently
      pollInterval = setInterval(async () => {
        try {
          const updatedNote = await scoutingNotesAPI.getScoutingNote(note.id);
          
          // Update note state silently
          setNote(updatedNote);
          
          // Check if processing is complete
          if (updatedNote.ai_status === 'completed' || updatedNote.ai_status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
            setProcessing(false);
            
            if (updatedNote.ai_status === 'completed') {
              toast.success("Reprocessing complete!", { id: toastId });
            } else if (updatedNote.ai_status === 'failed') {
              toast.error("Reprocessing failed", { id: toastId });
            }
          }
        } catch (error) {
          console.error("Failed to poll status:", error);
          if (pollInterval) clearInterval(pollInterval);
          setProcessing(false);
          toast.error("Failed to check processing status", { id: toastId });
        }
      }, 3000); // Check every 3 seconds
      
      // Stop polling after 2 minutes
      setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        
        // Check if still processing
        if (note?.ai_status === 'processing') {
          setProcessing(false);
          toast.error("Processing is taking longer than expected. Check back later.", { id: toastId });
        }
      }, 120000);
      
    } catch (error: any) {
      console.error("Failed to trigger AI:", error);
      
      // Clean up polling
      if (pollInterval) clearInterval(pollInterval);
      setProcessing(false);
      
      // Show error toast (reuse same toast ID if available)
      if (toastId) {
        toast.error(error.message || "Failed to start reprocessing", { id: toastId });
      } else {
        toast.error(error.message || "Failed to start reprocessing");
      }
    }
  };

  const handleSaveTitle = async () => {
    if (!note) return;
    try {
      setSaving(true);
      await scoutingNotesAPI.updateScoutingNote(note.id, {
        location_description: editedTitle,
      });
      toast.success("Title updated");
      setIsEditingTitle(false);
      await loadNote();
    } catch (error: any) {
      console.error("Failed to update title:", error);
      toast.error(error.message || "Failed to update title");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDate = async () => {
    if (!note) return;
    try {
      setSaving(true);
      await scoutingNotesAPI.updateScoutingNote(note.id, {
        scouting_date: editedDate,
      });
      toast.success("Date updated");
      setIsEditingDate(false);
      await loadNote();
    } catch (error: any) {
      console.error("Failed to update date:", error);
      toast.error(error.message || "Failed to update date");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserNotes = async () => {
    if (!note) return;
    try {
      setSaving(true);
      await scoutingNotesAPI.updateScoutingNote(note.id, {
        user_notes: editedUserNotes,
      });
      toast.success("Notes updated");
      setIsEditingUserNotes(false);
      await loadNote();
    } catch (error: any) {
      console.error("Failed to update notes:", error);
      toast.error(error.message || "Failed to update notes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTranscript = async () => {
    if (!note) return;

    try {
      setSaving(true);
      await scoutingNotesAPI.updateScoutingNote(note.id, {
        voice_transcript: editedTranscript,
      });
      // Update the transcript in the voice_recordings array
      if (note.voice_recordings && note.voice_recordings.length > 0) {
        const updatedRecordings = [...note.voice_recordings];
        updatedRecordings[0] = { ...updatedRecordings[0], transcript: editedTranscript };
        setNote({ ...note, voice_recordings: updatedRecordings });
      }
      setIsEditingTranscript(false);
      toast.success("Transcript saved");
    } catch (error: any) {
      console.error("Failed to save transcript:", error);
      toast.error("Failed to save transcript");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotosSelected = async (files: File[]) => {
    if (!note) return;

    try {
      // Use toast.promise for single, managed toast
      await toast.promise(
        scoutingNotesAPI.uploadPhotos(note.id, files, note.field_id),
        {
          loading: `Uploading ${files.length} photo(s)...`,
          success: `${files.length} photo(s) added successfully!`,
          error: 'Failed to add photos',
        }
      );

      // Close modal first
      setShowPhotoModal(false);
      
      // Small delay to ensure database commit, then reload
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadNote();
    } catch (error: any) {
      console.error("Failed to upload photos:", error);
      setShowPhotoModal(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    setPhotoToDelete(photoId);
    setShowDeletePhotoDialog(true);
  };

  const confirmDeletePhoto = async () => {
    if (!photoToDelete || !note) return;

    try {
      await scoutingNotesAPI.deletePhoto(photoToDelete);
      toast.success("Photo deleted");
      await loadNote();
    } catch (error: any) {
      console.error("Failed to delete photo:", error);
      toast.error(error.message || "Failed to delete photo");
    } finally {
      setPhotoToDelete(null);
      setShowDeletePhotoDialog(false);
    }
  };

  const handleVoiceFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!note || !event.target.files || !event.target.files[0]) return;

    const file = event.target.files[0];
    
    setUploadingVoice(true);
    
    try {
      // Use toast.promise for single, managed toast
      await toast.promise(
        scoutingNotesAPI.uploadVoiceRecording(note.id, file, note.field_id),
        {
          loading: 'Uploading voice recording...',
          success: 'Voice recording added successfully!',
          error: 'Failed to add voice recording',
        }
      );

      // Reload note without showing full page loading
      await loadNote();
    } catch (error: any) {
      console.error("Failed to upload voice:", error);
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleDeleteVoice = async (voiceNoteId: string) => {
    setVoiceToDelete(voiceNoteId);
    setShowDeleteVoiceDialog(true);
  };

  const confirmDeleteVoice = async () => {
    if (!voiceToDelete || !note) return;

    try {
      await scoutingNotesAPI.deleteVoiceRecording(voiceToDelete);
      toast.success("Voice recording deleted");
      await loadNote();
    } catch (error: any) {
      console.error("Failed to delete voice recording:", error);
      toast.error(error.message || "Failed to delete voice recording");
    } finally {
      setVoiceToDelete(null);
      setShowDeleteVoiceDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getNoteTitle = (noteData: ScoutingNote = note!) => {
    if (!noteData) return 'Scouting Note';
    
    if (noteData.field_name) {
      return `${noteData.field_name} - ${formatShortDate(noteData.scouting_date)}`;
    }
    
    return noteData.location_description || 'Scouting Location';
  };

  const getSyncBadge = () => {
    if (!note) return null;
    
    switch (note.sync_status) {
      case 'synced':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Synced</Badge>;
      case 'syncing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">Syncing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">Pending</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Error</Badge>;
    }
  };

  const getAIBadge = () => {
    if (!note) return null;
    
    switch (note.ai_status) {
      case 'completed':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">AI Analyzed</Badge>;
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing
          </Badge>
        );
      case 'pending':
        return <Badge variant="outline" className="bg-muted/50 text-farm-muted border-muted">Not Analyzed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Analysis Failed</Badge>;
    }
  };

  // Show skeleton only during initial data fetch
  if (loading && !note) {
    return (
      <div className="min-h-screen bg-farm-dark">
        {/* Header skeleton */}
        <header className="px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="h-5 w-5 text-farm-text" />
            </button>
            <div className="flex-1 h-5 bg-primary/10 animate-pulse rounded"></div>
          </div>
        </header>
        
        {/* Content skeleton */}
        <div className="p-4 space-y-6">
          {/* Location info skeleton */}
          <div className="space-y-3">
            <div className="h-3 bg-primary/10 animate-pulse rounded w-20"></div>
            <div className="h-16 bg-primary/5 animate-pulse rounded"></div>
          </div>
          
          {/* Voice recording skeleton */}
          <div className="space-y-3">
            <div className="h-3 bg-primary/10 animate-pulse rounded w-32"></div>
            <div className="h-20 bg-primary/5 animate-pulse rounded"></div>
          </div>
          
          {/* Photos skeleton */}
          <div className="space-y-3">
            <div className="h-3 bg-primary/10 animate-pulse rounded w-24"></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square bg-primary/5 animate-pulse rounded"></div>
              <div className="aspect-square bg-primary/5 animate-pulse rounded"></div>
              <div className="aspect-square bg-primary/5 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!note) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-farm-dark">
      <div className="flex-1 overflow-y-auto scrollbar-hide page-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 bg-farm-dark/95 backdrop-blur supports-[backdrop-filter]:bg-farm-dark/60 border-b z-10">
          <div className="flex items-center justify-between px-4 py-4">
            <button onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl font-bold">Scouting Note</h1>
            <div className="w-10"></div> {/* Spacer for alignment */}
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-4">
          {/* Location & Metadata Card */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-lg font-bold flex-1"
                      placeholder="Note title"
                      autoFocus
                    />
                    <button onClick={handleSaveTitle} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors">
                      <Check className="h-5 w-5" />
                    </button>
                    <button onClick={() => {setIsEditingTitle(false); setEditedTitle(getNoteTitle());}} className="p-1.5 hover:bg-muted rounded transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2 group">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold flex-1">
                      {getNoteTitle()}
                    </h2>
                    <button onClick={() => setIsEditingTitle(true)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted rounded">
                      <Pencil className="h-4 w-4 text-farm-muted" />
                    </button>
                  </div>
                )}
                {note.farm_name && (
                  <p className="text-sm text-farm-muted mb-2">
                    {note.farm_name}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                {getSyncBadge()}
                {getAIBadge()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-farm-muted" />
                {isEditingDate ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      type="date"
                      value={editedDate}
                      onChange={(e) => setEditedDate(e.target.value)}
                      className="h-8 flex-1"
                      autoFocus
                    />
                    <button onClick={handleSaveDate} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => {setIsEditingDate(false); setEditedDate(note.scouting_date.split('T')[0]);}} className="p-1 hover:bg-muted rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group flex-1">
                    <span>{formatDate(note.scouting_date)}</span>
                    <button onClick={() => setIsEditingDate(true)} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted rounded">
                      <Pencil className="h-3 w-3 text-farm-muted" />
                    </button>
                  </div>
                )}
              </div>
              {note.growth_stage && (
                <div className="flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-farm-muted" />
                  <span>{note.growth_stage}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Voice Recording */}
          {note.voice_recordings && note.voice_recordings.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  Voice Recording
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadNote()}
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVoice(note.voice_recordings[0].id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <audio 
                controls 
                className="w-full" 
                src={note.voice_recordings[0].url}
                preload="metadata"
                controlsList="nodownload"
              >
                Your browser does not support the audio element.
              </audio>
              
              {/* Transcript */}
              {note.voice_recordings[0].transcript && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Transcript</p>
                    {!isEditingTranscript && (
                      <button
                        onClick={() => {
                          setEditedTranscript(note.voice_recordings[0].transcript || "");
                          setIsEditingTranscript(true);
                        }}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Edit transcript"
                      >
                        <Pencil className="h-3 w-3 text-farm-muted" />
                      </button>
                    )}
                  </div>
                  
                  {isEditingTranscript ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedTranscript}
                        onChange={(e) => setEditedTranscript(e.target.value)}
                        className="min-h-[120px] text-sm"
                        placeholder="Edit transcript..."
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          onClick={() => {
                            setIsEditingTranscript(false);
                            setEditedTranscript(note.voice_recordings[0].transcript || "");
                          }}
                          variant="outline"
                          size="sm"
                          disabled={saving}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveTranscript}
                          size="sm"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-farm-muted leading-relaxed">
                      {note.voice_recordings[0].transcript}
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Voice Recording Upload */}
          {(!note.voice_recordings || note.voice_recordings.length === 0) && (
            <Card className="p-4">
              {uploadingVoice ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-medium">Uploading Voice Recording...</p>
                    <p className="text-sm text-farm-muted mt-1">Please wait</p>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => voiceInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Voice Recording
                  </Button>
                  <input
                    ref={voiceInputRef}
                    type="file"
                    accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg,.aac,.flac"
                    onChange={handleVoiceFileSelect}
                    className="hidden"
                  />
                </>
              )}
            </Card>
          )}

          {/* Photos */}
          {note.photos && note.photos.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Photos ({note.photos.length})
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadNote()}
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPhotoModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {note.photos.map((photo) => (
                  <div 
                    key={photo.id} 
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(photo.url, '_blank')}
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center"><svg class="w-8 h-8 text-farm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p class="text-xs text-farm-muted mt-2">Failed to load</p></div>';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo.id);
                      }}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(!note.photos || note.photos.length === 0) && (
            <Card className="p-4">
              <Button
                variant="outline"
                onClick={() => setShowPhotoModal(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Photos
              </Button>
            </Card>
          )}

          {/* User Notes */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">My Notes</h3>
              {!isEditingUserNotes && (
                <button onClick={() => setIsEditingUserNotes(true)} className="p-1.5 hover:bg-muted rounded transition-colors">
                  <Pencil className="h-4 w-4 text-farm-muted" />
                </button>
              )}
            </div>
            {isEditingUserNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={editedUserNotes}
                  onChange={(e) => setEditedUserNotes(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Add your notes..."
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button onClick={handleSaveUserNotes} disabled={saving} className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded transition-colors flex items-center gap-1">
                    <Check className="h-4 w-4" />
                    Save
                  </button>
                  <button onClick={() => {setIsEditingUserNotes(false); setEditedUserNotes(note.user_notes || "");}} className="px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors flex items-center gap-1">
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-farm-muted leading-relaxed whitespace-pre-wrap">
                {note.user_notes || "No notes added yet. Click the edit icon to add notes."}
              </p>
            )}
          </Card>
        </main>

        {/* AI Process Button - Fixed at bottom */}
        <div className="sticky bottom-0 p-4 bg-farm-dark/95 backdrop-blur border-t">
          <Button
            onClick={handleTriggerAI}
            disabled={processing}
            className="w-full"
            size="lg"
            variant="outline"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {note.ai_status === 'completed' ? 'Reprocess with AI' : 'Process with AI'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        open={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onPhotosSelected={handlePhotosSelected}
      />

      {/* Delete Voice Recording Confirmation */}
      <AlertDialog open={showDeleteVoiceDialog} onOpenChange={setShowDeleteVoiceDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Voice Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the voice recording. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteVoice} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Photo Confirmation */}
      <AlertDialog open={showDeletePhotoDialog} onOpenChange={setShowDeletePhotoDialog}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the photo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePhoto} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
