import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { observationsAPI, documentsAPI } from "@/lib/api";
import { toast } from "sonner";
import { PhotoViewer } from "@/components/PhotoViewer";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Mic, 
  Image as ImageIcon,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface FieldNoteDetail {
  id: string;
  title: string;
  description?: string;
  type: string;
  text: string;
  score?: string;
  observed_at: string;
  created_at: string;
  updated_at: string;
  field_id: string;
  field_name: string;
  status: string;
  location?: { lat: number; lng: number };
  voice_note?: {
    id: string;
    status: string;
    transcript?: string;
    duration_seconds?: number;
  };
  images?: Array<{
    id: string;
    file_url: string;
    thumbnail_url: string;
    filename: string;
  }>;
}

const FieldNoteDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<FieldNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    if (id) {
      loadNoteDetail();
    }
  }, [id]);

  const loadNoteDetail = async () => {
    try {
      setLoading(true);
      const response = await observationsAPI.getObservationDetail(id!);
      setNote(response);
      
      // Load photos for this observation
      loadPhotos();
    } catch (err: any) {
      console.error("Failed to load field note:", err);
      toast.error(err.message || "Failed to load field note");
      navigate("/field-notes");
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async () => {
    try {
      setLoadingPhotos(true);
      const response = await documentsAPI.getObservationDocuments(id!);
      setPhotos(response.documents || []);
    } catch (err: any) {
      console.error("Failed to load photos:", err);
      // Don't show error toast - photos are optional
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await observationsAPI.deleteObservation(id!);
      toast.success("Field note deleted");
      navigate("/field-notes");
    } catch (err: any) {
      console.error("Failed to delete field note:", err);
      toast.error(err.message || "Failed to delete field note");
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handlePhotoClick = (photoId: string) => {
    navigate(`/documents/${photoId}`);
  };

  const handleDeletePhoto = async (photoId: string) => {
    await documentsAPI.deleteDocument(photoId);
    // Reload photos
    await loadPhotos();
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      inspection: "Inspection",
      issue: "Issue",
      crop_stage: "Crop Stage",
      maintenance: "Maintenance",
      voice_note: "Voice Note",
      other: "Other"
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    if (!status) return null;
    
    const styles: { [key: string]: string } = {
      draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      modified: "bg-blue-100 text-blue-800 border-blue-200"
    };
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full border ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex flex-col">
        <header className="px-4 py-4 border-b flex items-center gap-3">
          <button onClick={() => navigate("/field-notes")} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">Field Note</h2>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="body-text">Loading field note...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="min-h-screen bg-farm-dark flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b flex items-center justify-between">
        <button onClick={() => navigate("/field-notes")} className="p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold flex-1 text-center">Field Note</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/field-notes/${note.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 page-background">
        {/* Title and Status */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="page-title flex-1">
              {note.title || "Untitled Observation"}
            </h1>
            {getStatusBadge(note.status)}
          </div>
          
          {note.description && (
            <p className="body-text">{note.description}</p>
          )}
        </div>

        {/* Meta Information */}
        <div className="card-standard space-y-3">
          <div className="flex items-center gap-2 body-text">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">{note.field_name}</span>
          </div>
          
          <div className="flex items-center gap-2 body-text">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{formatDate(note.observed_at)}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="label-text">Type</span>
            <span className="text-sm font-medium">{getTypeLabel(note.type)}</span>
          </div>

          {note.score && (
            <div className="flex items-center justify-between">
              <span className="label-text">Score</span>
              <span className="text-sm font-medium text-primary">{note.score}</span>
            </div>
          )}

          {note.location && (
            <div className="flex items-center justify-between">
              <span className="label-text">Location</span>
              <span className="text-xs text-farm-muted">
                {note.location.lat.toFixed(6)}, {note.location.lng.toFixed(6)}
              </span>
            </div>
          )}
        </div>

        {/* Observation Text */}
        <div>
          <h3 className="section-heading">Notes</h3>
          <div className="card-standard">
            <p className="body-text whitespace-pre-wrap">{note.text}</p>
          </div>
        </div>

        {/* Voice Note */}
        {note.voice_note && (
          <div>
            <h3 className="section-heading">Voice Note</h3>
            <div className="card-standard space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="icon-small">
                    <Mic className="icon-small-svg" />
                  </div>
                  <div>
                    <p className="card-title">Audio Recording</p>
                    <p className="label-text">{formatDuration(note.voice_note.duration_seconds)}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate(`/recordings/${note.voice_note?.id}`)}
                >
                  View Details
                </Button>
              </div>

              {note.voice_note.transcript && (
                <div className="pt-3 border-t">
                  <p className="label-text mb-2">Transcript</p>
                  <p className="body-text text-sm line-clamp-3">
                    {note.voice_note.transcript}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {loadingPhotos ? (
          <div>
            <h3 className="section-heading">Photos</h3>
            <div className="card-standard text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="body-text mt-3">Loading photos...</p>
            </div>
          </div>
        ) : photos.length > 0 ? (
          <div>
            <h3 className="section-heading">Photos ({photos.length})</h3>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => handlePhotoClick(photo.id)}
                  className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative group"
                >
                  <img
                    src={photo.storage_url}
                    alt={photo.original_filename}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-medium">View Details</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </main>

      {/* Photo Viewer */}
      <PhotoViewer
        open={photoViewerOpen}
        onClose={() => setPhotoViewerOpen(false)}
        photos={photos}
        initialIndex={selectedPhotoIndex}
        onDelete={handleDeletePhoto}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field Note?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete this field note.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldNoteDetail;

