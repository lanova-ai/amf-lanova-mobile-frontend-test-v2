import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon, Loader2, Crop } from "lucide-react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";
import type { Area } from "react-easy-crop";

interface LogoUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: (logoUrl: string) => void;
}

export function LogoUploadModal({ open, onClose, onUploadSuccess }: LogoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [croppedImageBlob, setCroppedImageBlob] = useState<Blob | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Invalid file type. Please select an image file (PNG, JPG, WEBP)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB. Please select a smaller file.");
      return;
    }

    setSelectedFile(file);
    setShowCrop(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  };

  const handleCropComplete = async () => {
    if (!previewUrl || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      setCroppedImageBlob(croppedBlob);
      setShowCrop(false);
      toast.success("Image cropped! Ready to upload.");
    } catch (error) {
      console.error("Failed to crop image:", error);
      toast.error("Failed to crop image");
    }
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

      // Use cropped image if available, otherwise use original
      const fileToUpload = croppedImageBlob 
        ? new File([croppedImageBlob], selectedFile.name, { type: "image/png" })
        : selectedFile;

      const result = await userAPI.uploadFarmLogo(fileToUpload);

      toast.success("Farm logo uploaded successfully!");
      setSelectedFile(null);
      setPreviewUrl(null);
      setCroppedImageBlob(null);
      setShowCrop(false);
      onClose();
      onUploadSuccess(result.farm_logo_url);

    } catch (err: any) {
      console.error("Failed to upload logo:", err);
      toast.error(err.message || "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCroppedImageBlob(null);
    setShowCrop(false);
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

  const truncateFileName = (fileName: string, maxLength: number = 35) => {
    if (fileName.length <= maxLength) return fileName;
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 3);
    return `${truncatedName}...${extension}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload Farm Logo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {showCrop && previewUrl ? (
            <>
              {/* Image Cropper */}
              <div className="relative w-full h-64 bg-farm-dark rounded-lg overflow-hidden">
                <Cropper
                  image={previewUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  cropShape="rect"
                  showGrid={true}
                />
              </div>
              
              {/* Zoom Control */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Crop Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowCrop(false);
                    setCroppedImageBlob(null);
                  }}
                  variant="outline"
                  className="flex-1 h-12"
                >
                  Cancel Crop
                </Button>
                <Button
                  onClick={handleCropComplete}
                  className="flex-1 h-12 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  <Crop className="w-5 h-5 mr-2" />
                  Apply Crop
                </Button>
              </div>
            </>
          ) : !selectedFile ? (
            <>
              {/* Enhanced Mobile-friendly file selection */}
              <div className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
                      <ImageIcon className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground mb-1">
                      Select a logo image from your device
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, or WEBP format
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: Square image, min 200x200px • Max 5MB
                    </p>
                  </div>
                </div>

                {/* Enhanced Button */}
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-14 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                  size="lg"
                >
                  <Upload className="w-6 h-6 mr-2" />
                  Choose Image
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </>
          ) : (
            <>
              {/* Enhanced Selected File Preview */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl p-4 shadow-md">
                <div className="space-y-4">
                  {/* Image Preview */}
                  {(croppedImageBlob || previewUrl) && (
                    <div className="flex justify-center">
                      <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-primary/30 bg-white flex items-center justify-center">
                        <img 
                          src={croppedImageBlob ? URL.createObjectURL(croppedImageBlob) : previewUrl || ''} 
                          alt="Logo preview" 
                          className="max-w-full max-h-full object-contain object-center"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Crop Button */}
                  {previewUrl && !showCrop && (
                    <Button
                      onClick={() => setShowCrop(true)}
                      variant="outline"
                      className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                    >
                      <Crop className="w-4 h-4 mr-2" />
                      Crop Image
                    </Button>
                  )}

                  {/* File Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 px-2 max-w-full overflow-hidden">
                      <h3 
                        className="font-semibold text-base text-foreground mb-1"
                        title={selectedFile.name}
                      >
                        {truncateFileName(selectedFile.name)}
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                          setCroppedImageBlob(null);
                          setShowCrop(false);
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-md flex-shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 h-12"
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  className="flex-1 h-12 text-base font-semibold bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
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

