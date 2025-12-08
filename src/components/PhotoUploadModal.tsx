import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, ImageIcon, Camera } from "lucide-react";
import { toast } from "sonner";

interface PhotoUploadModalProps {
  open: boolean;
  onClose: () => void;
  onPhotosSelected: (files: File[]) => void;
}

export function PhotoUploadModal({ open, onClose, onPhotosSelected }: PhotoUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Validate file types
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== fileArray.length) {
      toast.error("Some files were not images and were skipped");
    }

    // Validate file sizes (max 10MB per image)
    const validSizedFiles = validFiles.filter(file => file.size <= 10 * 1024 * 1024);
    if (validSizedFiles.length !== validFiles.length) {
      toast.error("Some images were too large (max 10MB) and were skipped");
    }

    // Create previews
    const newPreviews = validSizedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
    setSelectedFiles(prev => [...prev, ...validSizedFiles]);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const removeImage = (index: number) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one photo");
      return;
    }

    onPhotosSelected(selectedFiles);
    handleClose();
  };

  const handleClose = () => {
    // Cleanup previews
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews([]);
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add Photos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {selectedFiles.length === 0 ? (
            <>
              {/* Selection Options */}
              <div className="space-y-3">
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="icon-brand">
                      <ImageIcon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <p className="body-text">
                    Add photos from your device or camera
                  </p>
                  <p className="label-text">
                    JPEG, PNG • Max 10MB per image
                  </p>
                </div>

                {/* Camera Button (mobile-friendly) */}
                <Button
                  onClick={handleCameraClick}
                  className="w-full"
                  size="lg"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Take Photo
                </Button>

                {/* Browse Button */}
                <Button
                  onClick={handleBrowseClick}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Choose from Gallery
                </Button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileSelection(e.target.files)}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFileSelection(e.target.files)}
                className="hidden"
              />
            </>
          ) : (
            <>
              {/* Photo Previews */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-center text-muted-foreground">
                  {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} selected
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  Confirm ({selectedFiles.length})
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

