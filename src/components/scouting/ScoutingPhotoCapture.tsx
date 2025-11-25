import { useRef, useState } from "react";
import { Camera, Upload, X, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScoutingPhotoCaptureProps {
  photoBlobs: Blob[];
  onUpdate: (updates: { photo_blobs: Blob[] }) => void;
}

const MAX_PHOTOS = 10;

export function ScoutingPhotoCapture({ photoBlobs, onUpdate }: ScoutingPhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showTips, setShowTips] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (photoBlobs.length + files.length > MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    // Validate file types
    const validFiles = files.filter(file => {
      const isValid = file.type.startsWith('image/');
      if (!isValid) {
        toast.error(`${file.name} is not an image file`);
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      onUpdate({ photo_blobs: [...photoBlobs, ...validFiles] });
      toast.success(`${validFiles.length} photo(s) added`);
    }

    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photoBlobs.filter((_, i) => i !== index);
    onUpdate({ photo_blobs: newPhotos });
    toast.success("Photo removed");
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Tips Section - Collapsible */}
      <div className="bg-muted/50 border rounded-lg overflow-hidden">
        <button 
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-sm">
              Photo Tips
            </h3>
          </div>
          {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showTips && (
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Close-ups of disease symptoms</li>
              <li>Insect damage on leaves/stems</li>
              <li>Overall plant health</li>
              <li>Weed pressure in rows</li>
              <li>Multiple angles of same issue</li>
            </ul>

            <p className="text-xs text-muted-foreground">
              Clear, well-lit photos help AI detect issues more accurately
            </p>
          </div>
        )}
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto">
        {photoBlobs.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {photoBlobs.length} / {MAX_PHOTOS} photos
              </p>
              {photoBlobs.length < MAX_PHOTOS && (
                <p className="text-xs text-muted-foreground">
                  {MAX_PHOTOS - photoBlobs.length} more allowed
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {photoBlobs.map((blob, index) => {
                const url = URL.createObjectURL(blob);
                return (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                    <img
                      src={url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur px-2 py-0.5 rounded text-xs font-medium">
                      {index + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-lg mb-1">No photos yet</p>
              <p className="text-sm text-muted-foreground">
                Capture or upload up to {MAX_PHOTOS} photos
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {photoBlobs.length < MAX_PHOTOS && (
        <div className="space-y-2">
          <Button
            onClick={openCamera}
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Take Photo
          </Button>
          <Button
            onClick={openFileSelector}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-5 w-5" />
            Choose from Gallery
          </Button>
        </div>
      )}

      {photoBlobs.length >= MAX_PHOTOS && (
        <div className="bg-muted border rounded-lg p-3 text-center">
          <p className="text-sm text-muted-foreground">
            Maximum {MAX_PHOTOS} photos reached. Remove a photo to add more.
          </p>
        </div>
      )}

      {/* Optional Note */}
      <div className="text-center text-sm text-muted-foreground">
        Photos are optional but help AI identify diseases and pests
      </div>
    </div>
  );
}

