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
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize large images for better performance in cropper
  const resizeImageForPreview = (dataUrl: string, maxDimension: number = 1500): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // If image is small enough, use original
        if (img.width <= maxDimension && img.height <= maxDimension) {
          resolve(dataUrl);
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (img.width > img.height) {
          newWidth = maxDimension;
          newHeight = Math.round((img.height / img.width) * maxDimension);
        } else {
          newHeight = maxDimension;
          newWidth = Math.round((img.width / img.height) * maxDimension);
        }

        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Convert to dataURL (use JPEG for smaller size)
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        console.log(`[Logo] Resized from ${img.width}x${img.height} to ${newWidth}x${newHeight}`);
        resolve(resizedDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    });
  };

  const handleFileSelection = async (file: File) => {
    // Validate file type - check MIME type OR file extension (Android sometimes has weird MIME types)
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidMime = file.type.startsWith('image/') || file.type === '' || file.type === 'application/octet-stream';
    
    if (!hasValidMime && !hasValidExtension) {
      toast.error("Invalid file type. Please select an image file (PNG, JPG, WEBP)");
      return;
    }
    
    // Log for debugging
    console.log(`[Logo] File selected: ${file.name}, type: ${file.type}, size: ${file.size}`);
    

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB. Please select a smaller file.");
      return;
    }

    setSelectedFile(file);
    setLoadingPreview(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);

    // Create preview with error handling
    const reader = new FileReader();
    
    // Check if file is HEIC/HEIF - be very permissive on detection
    // Android often reports HEIC with weird MIME types or no extension
    const fileNameLower = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    const isHeic = mimeType === 'image/heic' || 
                   mimeType === 'image/heif' || 
                   mimeType.includes('heic') ||
                   mimeType.includes('heif') ||
                   fileNameLower.endsWith('.heic') || 
                   fileNameLower.endsWith('.heif') ||
                   // Samsung/Android often uses numeric names with no extension for HEIC
                   (mimeType === '' && !fileNameLower.match(/\.(jpg|jpeg|png|webp|gif)$/));

    // HEIC files: Skip preview entirely, upload directly to backend for conversion
    if (isHeic) {
      console.log('[Logo] HEIC file detected, skipping preview (browser cannot display HEIC)');
      toast.info("HEIC photo detected. Image will be converted on upload.", { duration: 3000 });
      setLoadingPreview(false);
      // Don't try to preview - just keep the file selected for direct upload
      return;
    }

    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        
        if (!dataUrl) {
          throw new Error('Failed to read file');
        }

        // Resize large images for better cropper performance
        const resizedDataUrl = await resizeImageForPreview(dataUrl);
        setPreviewUrl(resizedDataUrl);
        setShowCrop(true);
        setLoadingPreview(false);
      } catch (error) {
        console.error('[Logo] Error processing image:', error);
        // If resize fails, try using original
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          console.log('[Logo] Resize failed, using original image');
          setPreviewUrl(dataUrl);
          setShowCrop(true);
          setLoadingPreview(false);
        } else {
          toast.error("Could not process this image. Try a different file format (JPG or PNG).");
          setSelectedFile(null);
          setLoadingPreview(false);
        }
      }
    };
    
    reader.onerror = () => {
      console.error('[Logo] FileReader error:', reader.error);
      // FileReader failed - this often happens with HEIC on Android
      // Treat as potential HEIC and allow direct upload
      console.log('[Logo] FileReader failed, treating as HEIC for server-side conversion');
      toast.info("Preview not available. Image will be converted on upload.", { duration: 3000 });
      // Keep the file selected but skip preview
      setLoadingPreview(false);
      // Don't clear selectedFile - allow upload attempt
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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileSelection(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      console.log('[Logo] Starting upload, file:', selectedFile.name, 'size:', selectedFile.size, 'type:', selectedFile.type);

      let fileToUpload: File;

      if (croppedImageBlob) {
        // Use cropped image
        fileToUpload = new File([croppedImageBlob], selectedFile.name, { type: "image/png" });
        console.log('[Logo] Using cropped image');
      } else {
        // For files where preview failed (HEIC, etc), read as ArrayBuffer first
        // This helps with "stale" file handles on mobile browsers
        console.log('[Logo] No cropped image, reading original file as ArrayBuffer');
        try {
          const arrayBuffer = await selectedFile.arrayBuffer();
          console.log('[Logo] ArrayBuffer read successfully, size:', arrayBuffer.byteLength);
          
          // Determine MIME type - use original or default to octet-stream
          const mimeType = selectedFile.type || 'application/octet-stream';
          fileToUpload = new File([arrayBuffer], selectedFile.name, { type: mimeType });
        } catch (readError) {
          console.error('[Logo] Failed to read file as ArrayBuffer:', readError);
          toast.error("Unable to read the file. Please try selecting the image again.");
          return;
        }
      }

      console.log('[Logo] Uploading file:', fileToUpload.name, 'size:', fileToUpload.size);
      const result = await userAPI.uploadFarmLogo(fileToUpload);

      toast.success("Farm logo uploaded successfully!");
      setSelectedFile(null);
      setPreviewUrl(null);
      setCroppedImageBlob(null);
      setShowCrop(false);
      onClose();
      onUploadSuccess(result.farm_logo_url);

    } catch (err: any) {
      console.error("[Logo] Failed to upload:", err);
      // Provide more specific error messages
      if (err.message?.includes('timeout') || err.message?.includes('taking too long')) {
        toast.error("Upload timed out. Please try again with a stable connection.");
      } else if (err.message?.includes('Unable to connect') || err.message?.includes('Failed to fetch')) {
        toast.error("Connection failed. Please check your internet and try again.");
      } else {
        toast.error(err.message || "Failed to upload logo");
      }
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
    setLoadingPreview(false);
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
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload Farm Logo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {loadingPreview ? (
            <>
              {/* Loading State */}
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-base font-medium text-foreground">Processing image...</p>
                  <p className="text-sm text-muted-foreground mt-1">This may take a moment for large photos</p>
                </div>
              </div>
            </>
          ) : showCrop && previewUrl ? (
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
          ) : selectedFile && !previewUrl && !showCrop ? (
            <>
              {/* HEIC file selected - no preview available, direct upload */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl p-4 shadow-md">
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="w-24 h-24 bg-farm-dark rounded-lg flex items-center justify-center border border-white/10">
                      <ImageIcon className="w-10 h-10 text-farm-muted" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Preview not available for this image format.<br/>
                    Image will be converted and auto-cropped to square on upload.
                  </p>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 px-2">
                      <h3 className="font-semibold text-base text-foreground mb-1" title={selectedFile.name}>
                        {truncateFileName(selectedFile.name)}
                      </h3>
                      <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-md flex-shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCancel} variant="outline" className="flex-1 h-12" disabled={uploading}>
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
                      Converting & Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Upload & Convert
                    </>
                  )}
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
                accept="image/*"
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

