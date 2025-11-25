import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentsAPI, fieldsAPI } from "@/lib/api";

const DocumentEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    document_type: "photo",
    ai_summary: "",
    field_id: "",
    document_date: "",
  });

  useEffect(() => {
    loadDocumentAndFields();
  }, [id]);

  // Auto-expand textarea on load
  useEffect(() => {
    if (textareaRef.current && formData.ai_summary) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [formData.ai_summary]);

  const loadDocumentAndFields = async () => {
    try {
      setLoading(true);
      const [documentResponse, fieldsResponse] = await Promise.all([
        documentsAPI.getDocument(id!),
        fieldsAPI.getFields(),
      ]);
      
      // Format document_date to YYYY-MM-DD
      // Priority: document_date (user-set or AI-extracted) > ai_extracted_data.document_date > created_at
      let formattedDate = "";
      let dateToFormat: string | undefined;
      
      if (documentResponse.document_date) {
        // Use document_date if it exists (could be AI-extracted or user-set)
        dateToFormat = documentResponse.document_date;
      } else if ((documentResponse as any).ai_extracted_data?.document_date) {
        // Fallback to AI-extracted date from ai_extracted_data
        dateToFormat = (documentResponse as any).ai_extracted_data.document_date;
      } else if (documentResponse.created_at) {
        // Final fallback to created_at (upload date)
        dateToFormat = documentResponse.created_at;
      }
      
      if (dateToFormat) {
        const date = new Date(dateToFormat);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day}`;
      }
      
      setFormData({
        title: documentResponse.title || documentResponse.original_filename || "",
        document_type: documentResponse.document_type || "photo",
        ai_summary: documentResponse.ai_summary || "",
        field_id: documentResponse.field_id || "",
        document_date: formattedDate,
      });
      
      setAvailableFields(fieldsResponse.fields || []);
    } catch (error: any) {
      console.error("Failed to load document:", error);
      toast.error("Failed to load document");
      navigate("/documents");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    try {
      setSaving(true);
      await documentsAPI.updateDocument(id!, {
        title: formData.title,
        document_type: formData.document_type,
        ai_summary: formData.ai_summary || undefined,
        field_id: formData.field_id || null,
        document_date: formData.document_date || null,
      });
      
      toast.success("Document updated successfully");
      navigate(`/documents/${id}`);
    } catch (error: any) {
      console.error("Failed to update document:", error);
      toast.error(error.message || "Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(`/documents/${id}`)} className="p-2 hover:bg-accent rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Edit Document</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="p-4 pb-24">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm"
              placeholder="Document title"
              required
            />
          </div>

          {/* Document Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Document Type</label>
            <select
              value={formData.document_type}
              onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="photo">Photo</option>
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
              <option value="pdf">PDF</option>
              <option value="report">Report</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Document Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Document Date
              <span className="text-xs text-farm-muted ml-2">(AI-extracted or manual)</span>
            </label>
            <input
              type="date"
              value={formData.document_date}
              onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="YYYY-MM-DD"
            />
            <p className="text-xs text-farm-muted">
              📅 This is the actual date of the observation/event (not upload date). Used for timeline ordering.
            </p>
          </div>

          {/* Assign to Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Assign to Field
              <span className="text-xs text-farm-muted ml-2">(Optional)</span>
            </label>
            <select
              value={formData.field_id || ""}
              onChange={(e) => setFormData({ ...formData, field_id: e.target.value || "" })}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No field assigned (Generic document)</option>
              {availableFields.map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.name} ({field.farm_name || 'Unknown Farm'})
                </option>
              ))}
            </select>
            <p className="text-xs text-farm-muted">
              Link this document to a specific field for better organization.
            </p>
          </div>

          {/* AI Summary */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              AI Summary
              <span className="text-xs text-farm-muted ml-2">(Editable - AI can make mistakes)</span>
            </label>
            <textarea
              ref={textareaRef}
              value={formData.ai_summary}
              onChange={(e) => setFormData({ ...formData, ai_summary: e.target.value })}
              className="w-full px-3 py-2 bg-background border rounded-lg text-sm min-h-[120px] resize-none"
              placeholder="AI-generated summary of the document..."
              rows={8}
              style={{ height: 'auto', minHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
            <p className="text-xs text-farm-muted">
              You can edit or correct the AI-generated summary if needed.
            </p>
          </div>
        </form>
      </main>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/documents/${id}`)}
            className="flex-1"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DocumentEdit;

