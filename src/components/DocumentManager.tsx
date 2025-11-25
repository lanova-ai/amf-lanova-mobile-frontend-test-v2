import { useState, useEffect } from "react";
import { FileText, Image, FileIcon, Upload, Trash2, Eye, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentsAPI, Document } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface DocumentManagerProps {
  fieldPlanId?: string;
  fieldPlanPassId?: string;
  title?: string;
  allowUpload?: boolean;
}

export const DocumentManager = ({
  fieldPlanId,
  fieldPlanPassId,
  title = "Documents",
  allowUpload = true,
}: DocumentManagerProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [fieldPlanId, fieldPlanPassId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      let result;
      if (fieldPlanPassId) {
        result = await documentsAPI.getFieldPlanPassDocuments(fieldPlanPassId);
      } else if (fieldPlanId) {
        result = await documentsAPI.getFieldPlanDocuments(fieldPlanId);
      }
      if (result) {
        setDocuments(result.documents || []);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Determine document type based on MIME type
      let documentType: 'photo' | 'pdf' | 'document' | 'receipt' | 'invoice' | 'report' | 'other' = "other";
      if (file.type.startsWith("image/")) {
        documentType = "photo";
      } else if (file.type === "application/pdf") {
        documentType = "pdf";
      } else if (file.name.toLowerCase().includes("receipt")) {
        documentType = "receipt";
      } else if (file.name.toLowerCase().includes("invoice")) {
        documentType = "invoice";
      }

      await documentsAPI.uploadDocument(file, {
        document_type: documentType,
        field_plan_id: fieldPlanId,
        field_plan_pass_id: fieldPlanPassId,
      });

      toast.success("Document uploaded successfully");
      loadDocuments(); // Reload documents
      
      // Reset input
      event.target.value = "";
    } catch (error) {
      console.error("Failed to upload document:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      await documentsAPI.deleteDocument(documentToDelete);
      toast.success("Document deleted");
      setDocumentToDelete(null);
      loadDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleReprocess = async (documentId: string) => {
    try {
      await documentsAPI.reprocessDocument(documentId);
      toast.success("Document reprocessing started");
      // Reload after a delay to show updated status
      setTimeout(() => loadDocuments(), 2000);
    } catch (error) {
      console.error("Failed to reprocess document:", error);
      toast.error("Failed to reprocess document");
    }
  };

  const getDocumentIcon = (doc: Document) => {
    if (doc.mime_type?.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-500" />;
    } else if (doc.mime_type === "application/pdf") {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PROCESSING: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      FAILED: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {allowUpload && (
          <div>
            <input
              type="file"
              id="document-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,.pdf"
              disabled={uploading}
            />
            <label htmlFor="document-upload">
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                className="cursor-pointer"
                onClick={() => document.getElementById("document-upload")?.click()}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </label>
          </div>
        )}
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No documents attached yet.
          {allowUpload && <div className="text-sm mt-2">Click "Upload" to add photos, PDFs, or receipts.</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getDocumentIcon(doc)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{doc.original_filename}</div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span>{formatFileSize(doc.file_size_bytes)}</span>
                    <span>•</span>
                    {getStatusBadge(doc.processing_status)}
                    {doc.ai_analyzed && (
                      <>
                        <span>•</span>
                        <span className="text-green-600">✓ AI Analyzed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDocument(doc)}
                  title="View details"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {doc.processing_status === "FAILED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReprocess(doc.id)}
                    title="Reprocess"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocumentToDelete(doc.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Detail Dialog */}
      <Dialog open={selectedDocument !== null} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>
              {selectedDocument?.original_filename}
            </DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-4">
              {/* Document Preview (for images) */}
              {selectedDocument.mime_type?.startsWith("image/") && selectedDocument.file_url && (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selectedDocument.file_url}
                    alt={selectedDocument.original_filename}
                    className="w-full h-auto"
                  />
                </div>
              )}

              {/* AI Summary */}
              {selectedDocument.ai_summary && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">AI Summary</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedDocument.ai_summary}</p>
                </div>
              )}

              {/* Extracted Text */}
              {selectedDocument.text_content && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Extracted Text</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedDocument.text_content}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Type:</span> {selectedDocument.document_type}
                </div>
                <div>
                  <span className="font-semibold">Size:</span> {formatFileSize(selectedDocument.file_size_bytes)}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> {getStatusBadge(selectedDocument.processing_status)}
                </div>
                <div>
                  <span className="font-semibold">Uploaded:</span>{" "}
                  {new Date(selectedDocument.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Download Link */}
              {selectedDocument.file_url && (
                <div className="pt-4">
                  <a
                    href={selectedDocument.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Original File
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentManager;

