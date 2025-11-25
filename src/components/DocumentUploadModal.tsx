import { useState, useRef, useEffect } from "react";
import { Camera, Upload, File, X, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { documentsAPI, fieldsAPI } from "@/lib/api";

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: (uploadedDocId?: string, uploadResponse?: any) => void;
  additionalMetadata?: {
    field_id?: string;
    field_plan_id?: string;
    field_plan_pass_id?: string;
    field_note_id?: string;
    location?: { lat: number; lon: number };
  };
  disableCamera?: boolean; // Disable camera feature entirely
}

export default function DocumentUploadModal({ open, onClose, onUploadComplete, additionalMetadata, disableCamera = false }: DocumentUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string>("photo");
  const [showCamera, setShowCamera] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load fields when modal opens and reset state
  useEffect(() => {
    if (open) {
      loadFields();
      // Reset modal state when opening
      setShowCamera(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setDocumentType("photo");
      
      // Pre-select field if provided in additionalMetadata
      if (additionalMetadata?.field_id) {
        setSelectedFieldId(additionalMetadata.field_id);
      } else {
        setSelectedFieldId("");
      }
    }
  }, [open, additionalMetadata]);

  const loadFields = async () => {
    try {
      setLoadingFields(true);
      const response = await fieldsAPI.getFields();
      setAvailableFields(response.fields || []);
    } catch (error) {
      console.error("Failed to load fields:", error);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    setSelectedFile(file);

    // Auto-detect document type based on MIME type or file extension
    const fileName = file.name.toLowerCase();
    const isImageByExtension = fileName.endsWith('.heic') || fileName.endsWith('.heif') || 
                                fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                                fileName.endsWith('.png') || fileName.endsWith('.gif') || 
                                fileName.endsWith('.webp');
    
    if (file.type.startsWith("image/") || isImageByExtension) {
      setDocumentType("photo");
      // Create preview for images (skip for HEIC as browser might not support preview)
      if (!fileName.endsWith('.heic') && !fileName.endsWith('.heif')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null); // HEIC files might not preview in browser
      }
    } else if (file.type === "application/pdf") {
      setDocumentType("pdf");
      setPreviewUrl(null);
    } else {
      setDocumentType("other");
      setPreviewUrl(null);
    }

    // Reset input value so the same file can be selected again if needed
    if (event.target) {
      event.target.value = '';
    }
  };

  const startCamera = () => {
    // On mobile, use the capture attribute which directly opens the camera
    // On desktop, fall back to getUserMedia for a live preview
    if (cameraInputRef.current) {
      // Check if we're on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: Use capture attribute (more reliable)
        cameraInputRef.current.click();
      } else {
        // Desktop: Use getUserMedia for live preview
        startCameraPreview();
      }
    }
  };

  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error("Failed to start camera:", error);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;

      // Create File from Blob (workaround for TypeScript issue)
      const filename = `photo-${Date.now()}.jpg`;
      const fileObj = Object.assign(blob, {
        name: filename,
        lastModified: Date.now(),
      }) as unknown as File;

      setSelectedFile(fileObj);
      setDocumentType("photo");

      // Create preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // Stop camera
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    try {
      setUploading(true);

      const uploadMetadata = {
        document_type: documentType as any,
        field_id: additionalMetadata?.field_id || selectedFieldId || undefined, // Use metadata field_id or selected field_id
        field_plan_id: additionalMetadata?.field_plan_id,
        field_plan_pass_id: additionalMetadata?.field_plan_pass_id,
        field_note_id: additionalMetadata?.field_note_id,
        location: additionalMetadata?.location,
      };


      const response = await documentsAPI.uploadDocument(selectedFile, uploadMetadata);

      // Check if this is a duplicate document
      if (response?.is_duplicate) {
        toast.info("This document was already uploaded. Showing existing document.", {
          duration: 4000,
        });
      } else {
        toast.success("Document uploaded! AI processing...");
      }
      
      // Pass the uploaded document ID and response to parent for tracking BEFORE closing
      const uploadedDocId = response?.id;
      const uploadResponse = response; // Pass full response for immediate display
      
      // Notify parent first with both ID and response
      onUploadComplete(uploadedDocId, uploadResponse);
      
      // Then close modal
      handleClose();
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    // Clean up
    stopCamera();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setDocumentType("photo");
    setShowCamera(false);
    setSelectedFieldId(""); // Reset field selection
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full z-[10001]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Take a photo or upload a file. AI will analyze it automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-hidden">
          {showCamera ? (
            // Camera View
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photo
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : selectedFile ? (
            // File Selected View
            <div className="space-y-4 overflow-hidden">
              {/* Preview */}
              {previewUrl ? (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-48 object-contain bg-muted"
                  />
                </div>
              ) : (
                <div className="rounded-lg border p-8 flex flex-col items-center justify-center bg-muted overflow-hidden min-w-0">
                  <File className="h-12 w-12 text-muted-foreground mb-2 flex-shrink-0" />
                  <div className="w-full min-w-0 px-2 max-w-full">
                    <p 
                      className="text-sm font-medium truncate text-center w-full" 
                      title={selectedFile.name}
                    >
                      {selectedFile.name}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              )}

              {/* Document Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="photo">Photo</option>
                  <option value="receipt">Receipt</option>
                  <option value="invoice">Invoice</option>
                  <option value="pdf">PDF Document</option>
                  <option value="report">Report</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Assign to Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Assign to Field
                  {!additionalMetadata?.field_id && (
                    <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                  )}
                </label>
                <select
                  value={selectedFieldId}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={loadingFields || !!additionalMetadata?.field_id}
                >
                  <option value="">No field (Generic document)</option>
                  {availableFields.map((field) => (
                    <option key={field.field_id} value={field.field_id}>
                      {field.name} ({field.farm_name || 'Unknown Farm'})
                    </option>
                  ))}
                </select>
                {loadingFields && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading fields...
                  </p>
                )}
                {additionalMetadata?.field_id ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✓ Field automatically selected from map location
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Link this document to a specific field for better organization.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Initial Selection View
            <div className="space-y-3">
              {/* Take Photo - Only show if camera is not disabled */}
              {!disableCamera && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors flex items-center gap-3"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium">Take Photo</p>
                    <p className="text-xs text-muted-foreground">
                      Use your camera to capture a document
                    </p>
                  </div>
                </button>
              )}

              {/* Upload File */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {/* Camera Input (for mobile) */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors flex items-center gap-3"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">Choose File</p>
                  <p className="text-xs text-muted-foreground">
                    Select a photo or PDF from your device
                  </p>
                </div>
              </button>

              {/* Info */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Supported: JPG, PNG, HEIC, PDF • Max 10MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

