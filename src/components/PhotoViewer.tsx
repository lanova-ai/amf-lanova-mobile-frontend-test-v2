import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

interface Photo {
  id: string;
  storage_url: string;
  original_filename: string;
  file_size_bytes?: number;
  uploaded_at?: string;
  processing_status?: string;
  ai_analyzed?: boolean;
  ai_summary?: string;
  text_content?: string;
  mime_type?: string;
}

interface PhotoViewerProps {
  open: boolean;
  onClose: () => void;
  photos: Photo[];
  initialIndex?: number;
  onDelete?: (photoId: string) => void;
}

export function PhotoViewer({ 
  open, 
  onClose, 
  photos, 
  initialIndex = 0,
  onDelete 
}: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentPhoto = photos[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = async () => {
    if (!onDelete || !currentPhoto) return;

    try {
      setDeleting(true);
      await onDelete(currentPhoto.id);
      toast.success("Photo deleted");
      
      // If this was the last photo, close the viewer
      if (photos.length === 1) {
        setShowDeleteDialog(false);
        onClose();
        return;
      }
      
      // Move to the next photo or previous if at the end
      if (currentIndex >= photos.length - 1) {
        setCurrentIndex(photos.length - 2);
      }
      
      setShowDeleteDialog(false);
    } catch (err: any) {
      console.error("Failed to delete photo:", err);
      toast.error(err.message || "Failed to delete photo");
    } finally {
      setDeleting(false);
    }
  };

  if (!currentPhoto) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle>
                {currentPhoto.original_filename} ({currentIndex + 1} of {photos.length})
              </DialogTitle>
              <div className="flex items-center gap-2">
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="relative bg-black">
            {/* Main Photo */}
            <img
              src={currentPhoto.storage_url}
              alt={currentPhoto.original_filename}
              className="w-full h-[60vh] object-contain"
            />

            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition-colors"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-3 rounded-full transition-colors"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Photo Counter */}
            <div className="absolute bottom-4 left-4 bg-black/75 text-white px-3 py-1 rounded text-sm">
              {currentIndex + 1} / {photos.length}
            </div>
          </div>

          {/* Document Details Section */}
          {(currentPhoto.ai_summary || currentPhoto.text_content || currentPhoto.processing_status) && (
            <div className="px-6 py-4 border-t max-h-64 overflow-y-auto bg-muted/20">
              {/* Processing Status */}
              {currentPhoto.processing_status && (
                <div className="mb-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    currentPhoto.processing_status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    currentPhoto.processing_status === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                    currentPhoto.processing_status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {currentPhoto.processing_status}
                  </span>
                  {currentPhoto.ai_analyzed && (
                    <span className="ml-2 text-xs text-green-600">✓ AI Analyzed</span>
                  )}
                </div>
              )}

              {/* AI Summary */}
              {currentPhoto.ai_summary && (
                <div className="mb-3">
                  <h4 className="text-sm font-semibold mb-1">AI Summary</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {currentPhoto.ai_summary}
                  </p>
                </div>
              )}

              {/* Extracted Text */}
              {currentPhoto.text_content && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Extracted Text</h4>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {currentPhoto.text_content}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Thumbnail Strip (if multiple photos) */}
          {photos.length > 1 && (
            <div className="px-6 py-4 border-t overflow-x-auto">
              <div className="flex gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentIndex
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={photo.storage_url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{currentPhoto?.original_filename}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

