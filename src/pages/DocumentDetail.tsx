import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { documentsAPI, Document, fieldsAPI, fieldPlansAPI } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  FileText,
  Tag,
  Lightbulb,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [creatingFieldPlan, setCreatingFieldPlan] = useState(false);
  
  // Field plan creation result modal
  const [showFieldPlanResult, setShowFieldPlanResult] = useState(false);
  const [fieldPlanResult, setFieldPlanResult] = useState<any>(null);
  
  const [isEditingField, setIsEditingField] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Polling refs for document status updates
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const documentIdRef = useRef<string | undefined>(id);
  const documentStatusRef = useRef<string | undefined>(document?.processing_status);

  // Keep refs up to date
  useEffect(() => {
    documentIdRef.current = id;
  }, [id]);

  useEffect(() => {
    documentStatusRef.current = document?.processing_status;
  }, [document?.processing_status]);

  useEffect(() => {
    if (id) {
      loadDocument();
      loadAvailableFields();
    }
  }, [id, location.key]); // Reload when navigating back from edit page

  // Poll document status when it's processing
  useEffect(() => {
    if (!document || !id) {
      // Stop polling if no document or id
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const isProcessing = document.processing_status === 'PROCESSING' || document.processing_status === 'PENDING';
    
    if (isProcessing && !pollingIntervalRef.current) {
      console.log(`⏰ Starting polling for document ${id} (status: ${document.processing_status})`);
      
      pollingIntervalRef.current = setInterval(async () => {
        const currentId = documentIdRef.current;
        if (!currentId) {
          console.warn('⚠️ No document ID in ref, stopping polling');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        console.log(`🔄 Polling document ${currentId} status...`);
        try {
          // Fetch the document directly and check status immediately
          const doc = await documentsAPI.getDocument(currentId);
          console.log(`✅ Document ${currentId} status: ${doc.processing_status}`);
          
          // Update the document state
          setDocument(doc);
          
          // Update status ref
          documentStatusRef.current = doc.processing_status;
          
          // Stop polling immediately if completed or failed
          if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
            console.log(`🛑 Document ${currentId} is ${doc.processing_status} - stopping polling immediately`);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        } catch (error) {
          console.error(`❌ Error polling document ${currentId}:`, error);
        }
      }, 10000); // Poll every 10 seconds
    } else if (!isProcessing && pollingIntervalRef.current) {
      console.log(`🛑 Document ${id} is ${document.processing_status} - stopping polling`);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Cleanup on unmount or when document/id changes
    return () => {
      if (pollingIntervalRef.current) {
        console.log(`🧹 Cleaning up polling interval for document ${id}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [document?.processing_status, id, document]);

  // Inline editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  const loadDocument = async () => {
    try {
      setLoading(true);
      const doc = await documentsAPI.getDocument(id!);
      setDocument(doc);
      
      // If document is completed/failed, stop polling immediately
      if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
        if (pollingIntervalRef.current) {
          console.log(`🛑 Document ${id} is ${doc.processing_status} - stopping polling after load`);
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      toast.error("Document not found");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      setAvailableFields(response.fields || []);
    } catch (err) {
      console.error("Failed to load fields:", err);
    }
  };

  // Inline editing handlers
  const handleEditTitle = () => {
    setEditedTitle(document?.title || document?.original_filename || "");
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    if (!id || !editedTitle.trim()) return;
    
    try {
      setIsSaving(true);
      await documentsAPI.updateDocument(id, { title: editedTitle });
      await loadDocument();
      setIsEditingTitle(false);
      toast.success("Title updated");
    } catch (err: any) {
      console.error("Failed to update title:", err);
      toast.error(err.message || "Failed to update title");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTitleEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const handleEditField = () => {
    // Ensure we set the field_id properly, converting undefined to null
    const fieldId = document?.field_id || null;
    setSelectedFieldId(fieldId);
    setIsEditingField(true);
  };

  const handleSaveField = async () => {
    if (!id) return;
    
    try {
      setIsSaving(true);
      // Send null explicitly to clear field assignment, or the field_id string to assign
      await documentsAPI.updateDocument(id, { field_id: selectedFieldId ?? null });
      await loadDocument();
      setIsEditingField(false);
      toast.success("Field assignment updated");
    } catch (err: any) {
      console.error("Failed to update field:", err);
      toast.error(err.message || "Failed to update field");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelFieldEdit = () => {
    setIsEditingField(false);
    setSelectedFieldId(null);
  };

  const [isEditingType, setIsEditingType] = useState(false);
  const [editedType, setEditedType] = useState("");

  const handleEditType = () => {
    setEditedType(document?.document_type || "photo");
    setIsEditingType(true);
  };

  const handleSaveType = async () => {
    if (!id) return;
    
    try {
      setIsSaving(true);
      await documentsAPI.updateDocument(id, { document_type: editedType });
      await loadDocument();
      setIsEditingType(false);
      toast.success("Document type updated");
    } catch (err: any) {
      console.error("Failed to update type:", err);
      toast.error(err.message || "Failed to update type");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTypeEdit = () => {
    setIsEditingType(false);
    setEditedType("");
  };

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const handleEditDate = () => {
    // Priority: document_date (user-set or AI-extracted) > ai_extracted_data.document_date > created_at
    let dateToFormat: string | undefined;
    
    if (document?.document_date) {
      // Use document_date if it exists (could be AI-extracted or user-set)
      dateToFormat = document.document_date;
    } else if ((document as any)?.ai_extracted_data?.document_date) {
      // Fallback to AI-extracted date from ai_extracted_data
      dateToFormat = (document as any).ai_extracted_data.document_date;
    } else if (document?.created_at) {
      // Final fallback to created_at (upload date)
      dateToFormat = document.created_at;
    }
    
    if (dateToFormat) {
      setSelectedDate(new Date(dateToFormat));
    } else {
      setSelectedDate(new Date()); // Default to today
    }
    
    setIsEditingDate(true);
    setDatePopoverOpen(true);
  };

  const handleSaveDate = async () => {
    if (!id) return;
    
    try {
      setIsSaving(true);
      const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
      await documentsAPI.updateDocument(id, { document_date: formattedDate });
      await loadDocument();
      setIsEditingDate(false);
      setDatePopoverOpen(false);
      toast.success("Document date updated");
    } catch (err: any) {
      console.error("Failed to update date:", err);
      toast.error(err.message || "Failed to update date");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelDateEdit = () => {
    setIsEditingDate(false);
    setSelectedDate(undefined);
    setDatePopoverOpen(false);
  };

  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");

  const handleEditSummary = () => {
    setEditedSummary(document?.ai_summary || "");
    setIsEditingSummary(true);
  };

  const handleSaveSummary = async () => {
    if (!id) return;
    
    try {
      setIsSaving(true);
      await documentsAPI.updateDocument(id, { ai_summary: editedSummary });
      await loadDocument();
      setIsEditingSummary(false);
      toast.success("AI Summary updated");
    } catch (err: any) {
      console.error("Failed to update summary:", err);
      toast.error(err.message || "Failed to update summary");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSummaryEdit = () => {
    setIsEditingSummary(false);
    setEditedSummary("");
  };

  const handleReprocess = async () => {
    if (!id) return;
    
    try {
      setReprocessing(true);
      await documentsAPI.reprocessDocument(id);
      toast.success("Reprocessing started...");
      
      // Poll for updates
      const pollInterval = setInterval(async () => {
        const updatedDoc = await documentsAPI.getDocument(id);
        if (updatedDoc && (updatedDoc.processing_status === 'COMPLETED' || updatedDoc.processing_status === 'FAILED')) {
          setDocument(updatedDoc);
          setReprocessing(false);
          clearInterval(pollInterval);
          if (updatedDoc.processing_status === 'COMPLETED') {
            toast.success("Reprocessing complete!");
          }
        }
      }, 2000);
      
      // Stop after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setReprocessing(false);
      }, 60000);
    } catch (error: any) {
      console.error("Failed to reprocess:", error);
      toast.error(error.message || "Failed to reprocess document");
      setReprocessing(false);
    }
  };

  const handleDownload = () => {
    if (document?.file_url) {
      window.open(document.file_url, '_blank');
    }
  };

  const handleCreateFieldPlan = async () => {
    if (!id) return;
    
    try {
      setCreatingFieldPlan(true);
      toast.info("Analyzing document for field planning... This may take up to 3 minutes.", { duration: 5000 });
      
      const result = await fieldPlansAPI.createFieldPlanFromDocument(id);
      
      if (result.success && result.plans_created && result.plans_created.length > 0) {
        // Store result and show modal
        setFieldPlanResult({
          is_bulk_plan: result.plans_created.length > 1,
          total_plans_created: result.plans_created.length,
          created_plans: result.plans_created,
          // For single plan, extract details
          field_plan_id: result.plans_created[0]?.id,
          field_name: result.plans_created[0]?.field_name,
          plan_name: result.plans_created[0]?.plan_name,
          plan_year: result.plans_created[0]?.plan_year,
          total_passes: result.plans_created[0]?.total_passes || 0,
        });
        setShowFieldPlanResult(true);
        toast.success(`Created ${result.plans_created.length} field plan(s)!`);
        
        // Refresh document to update field_plan_id link
        await loadDocument();
      } else {
        toast.error(result.message || "Could not create field plan from this document");
      }
    } catch (error: any) {
      console.error("Failed to create field plan:", error);
      toast.error(error.message || "Failed to create field plan from document");
    } finally {
      setCreatingFieldPlan(false);
    }
  };

  // Check if document can potentially be used for field plan creation
  const canCreateFieldPlan = () => {
    if (!document) return false;
    
    // Only allow for completed documents
    if (document.processing_status !== 'COMPLETED') return false;
    
    // Allow for photos and PDFs (common field plan formats)
    const allowedTypes = ['photo', 'image', 'pdf', 'report', 'invoice', 'receipt'];
    if (!allowedTypes.includes(document.document_type || '')) return false;
    
    // Check if already linked to a field plan
    if (document.field_plan_id) return false;
    
    return true;
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'FAILED':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-farm-muted mx-auto mb-4" />
          <p className="text-farm-muted">Document not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark/95 backdrop-blur supports-[backdrop-filter]:bg-farm-dark/80 border-b border-farm-accent/20">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-farm-accent/10 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-farm-text" />
          </button>
          <h1 className="text-lg font-semibold text-farm-text flex-1">Document Details</h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Title with inline editing */}
        <div className="space-y-2">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 px-3 py-2 text-xl font-bold bg-farm-dark border border-farm-accent/20 rounded text-farm-text focus:outline-none focus:ring-2 focus:ring-farm-accent"
                autoFocus
              />
              <button onClick={handleSaveTitle} disabled={isSaving} className="p-2 text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Check className="h-5 w-5" />
              </button>
              <button onClick={handleCancelTitleEdit} className="p-2 text-farm-muted hover:bg-farm-accent/10 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-farm-text flex-1 truncate min-w-0" title={document.title || document.original_filename}>
                {document.title || document.original_filename}
              </h2>
              <button onClick={handleEditTitle} className="p-2 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors flex-shrink-0">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {getStatusIcon(document.processing_status)}
            <span className="text-sm font-medium text-farm-text">{document.processing_status}</span>
            {document.ai_analyzed && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded-full ml-2">
                ✓ AI Analyzed
              </span>
            )}
          </div>
        </div>

        {/* Document Type with inline editing */}
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-farm-muted" />
          <span className="text-farm-muted">Type:</span>
          {isEditingType ? (
            <div className="flex items-center gap-2 flex-1">
              <Select value={editedType} onValueChange={setEditedType}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="photo">Photo</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={handleSaveType} disabled={isSaving} className="p-1 text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={handleCancelTypeEdit} className="p-1 text-farm-muted hover:bg-farm-accent/10 rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <span className="text-farm-text capitalize">{document.document_type || 'photo'}</span>
              <button onClick={handleEditType} className="p-1 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>

        {/* Document Date with inline editing */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-farm-muted" />
            <span className="text-farm-muted">Date:</span>
            {isEditingDate ? (
              <div className="flex items-center gap-2 flex-1">
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="px-3 py-1.5 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm hover:bg-farm-accent/10 transition-colors flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'MM/dd/yyyy') : 'Select date'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setDatePopoverOpen(false);
                        }
                      }}
                      initialFocus
                      fixedWeeks={false}
                      className="scale-90 origin-top"
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-0",
                        month: "space-y-2",
                        caption: "flex justify-center pt-1 relative items-center h-8",
                        caption_label: "text-xs font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell: "text-farm-muted rounded-md w-8 font-normal text-[0.7rem]",
                        row: "flex w-full mt-1",
                        cell: "h-8 w-8 text-center text-xs p-0 relative",
                        day: "h-8 w-8 p-0 font-normal",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground",
                        day_outside: "text-farm-muted opacity-50",
                        day_disabled: "text-farm-muted opacity-50",
                        day_hidden: "invisible",
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <button onClick={handleSaveDate} disabled={isSaving} className="p-1 text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={handleCancelDateEdit} className="p-1 text-farm-muted hover:bg-farm-accent/10 rounded transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-farm-text">
                  {(() => {
                    // Priority: document_date > ai_extracted_data.document_date > created_at
                    if (document.document_date) {
                      return formatDate(document.document_date);
                    } else if ((document as any).ai_extracted_data?.document_date) {
                      return formatDate((document as any).ai_extracted_data.document_date);
                    } else if (document.created_at) {
                      return formatDate(document.created_at);
                    }
                    return 'Not set';
                  })()}
                </span>
                <button onClick={handleEditDate} className="p-1 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
          
          {/* Show AI-extracted date info if available */}
          {(document as any).ai_extracted_data?.document_date && (
            <div className="flex items-center gap-2 text-xs ml-6">
              <span className="text-farm-muted italic">
                🤖 AI extracted: {formatDate((document as any).ai_extracted_data.document_date)}
                {(document as any).document_date_confidence && (
                  <span className="ml-1">({Math.round((document as any).document_date_confidence * 100)}% confidence)</span>
                )}
                {document.document_date && document.document_date !== (document as any).ai_extracted_data.document_date && (
                  <span className="ml-1 text-farm-accent">(edited)</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Field Assignment with inline editing */}
        <div className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-farm-muted" />
          <span className="text-farm-muted">Field:</span>
          {isEditingField ? (
            <div className="flex items-center gap-2 flex-1">
              <Select value={selectedFieldId || "none"} onValueChange={(val) => setSelectedFieldId(val === "none" ? null : val)}>
                <SelectTrigger className="w-[250px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No field assigned</SelectItem>
                  {availableFields.map((field) => (
                    <SelectItem key={field.field_id} value={field.field_id}>
                      {field.name} ({field.farm_name || 'Unknown Farm'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={handleSaveField} disabled={isSaving} className="p-1 text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={handleCancelFieldEdit} className="p-1 text-farm-muted hover:bg-farm-accent/10 rounded transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {document.field_id ? (
                <FieldNameDisplay fieldId={document.field_id} />
              ) : (
                <span className="text-farm-muted italic">None</span>
              )}
              <button onClick={handleEditField} className="p-1 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        
        {/* Removed Description - not in Document model */}

        {/* Field Assignment Display */}
        {/* Removed - moved to inline editing above */}

        {/* Document Preview */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 overflow-hidden">
          {(document.mime_type?.startsWith('image/') || document.document_type === 'photo') && document.file_url ? (
            <img
              src={document.file_url}
              alt={document.title || document.original_filename}
              className="w-full max-h-96 object-contain bg-farm-dark"
              onError={(e) => {
                // Hide image if it fails to load (e.g., HEIC not supported by browser)
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const isHeic = document?.original_filename?.toLowerCase().endsWith('.heic') || 
                                 document?.original_filename?.toLowerCase().endsWith('.heif');
                  parent.innerHTML = `
                    <div class="p-12 flex flex-col items-center justify-center bg-farm-dark">
                      <svg class="h-16 w-16 text-farm-muted mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <p class="text-sm text-farm-muted">Image preview not available${isHeic ? ' (HEIC format)' : ''}</p>
                      <p class="text-xs text-farm-muted mt-1">${isHeic ? 'HEIC files are being converted. Try reprocessing or downloading the file.' : 'The file is processing or in an unsupported format'}</p>
                    </div>
                  `;
                }
              }}
            />
          ) : (
            <div className="p-12 flex flex-col items-center justify-center bg-farm-dark">
              <FileText className="h-16 w-16 text-farm-muted mb-4" />
              <p className="text-sm text-farm-muted">PDF Document</p>
            </div>
          )}
        </div>

        {/* Analysis Type Badge */}
        {document.analysis_type && document.analysis_type !== 'none' && (
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-farm-muted" />
            <span className={`text-sm px-3 py-1 rounded-full ${
              document.analysis_type === 'visual' ? 'bg-purple-500/10 text-purple-400' :
              document.analysis_type === 'hybrid' ? 'bg-blue-500/10 text-blue-400' :
              'bg-farm-accent/10 text-farm-muted'
            }`}>
              {document.analysis_type === 'visual' && '👁️ Visual Analysis'}
              {document.analysis_type === 'hybrid' && '🔄 Visual + Text'}
              {document.analysis_type === 'text' && '📝 Text Analysis'}
            </span>
          </div>
        )}

        {/* Detected Elements */}
        {document.detected_elements && document.detected_elements.length > 0 && (
          <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-farm-muted" />
              <h3 className="font-semibold text-farm-text">Detected Elements</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {document.detected_elements.map((element, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-farm-accent/10 text-farm-accent text-sm rounded-full"
                >
                  {element}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Visual Analysis */}
        {document.visual_analysis && (
          <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-farm-muted" />
              <h3 className="font-semibold text-farm-text">Visual Analysis</h3>
            </div>

            {/* Description */}
            {document.visual_analysis.description && (
              <div>
                <h4 className="text-sm font-medium text-farm-muted mb-1">Description</h4>
                <p className="text-sm text-farm-text">{document.visual_analysis.description}</p>
              </div>
            )}

            {/* Agricultural Insights */}
            {document.visual_analysis.agricultural_insights && (
              <div>
                <h4 className="text-sm font-medium text-farm-muted mb-1">Agricultural Insights</h4>
                <p className="text-sm text-farm-text">{document.visual_analysis.agricultural_insights}</p>
              </div>
            )}

            {/* Condition Assessment */}
            {document.visual_analysis.condition_assessment && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-farm-muted" />
                <span className="text-sm font-medium text-farm-text">Condition:</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  document.visual_analysis.condition_assessment === 'Excellent' ? 'bg-green-500/10 text-green-400' :
                  document.visual_analysis.condition_assessment === 'Good' ? 'bg-blue-500/10 text-blue-400' :
                  document.visual_analysis.condition_assessment === 'Fair' ? 'bg-yellow-500/10 text-yellow-400' :
                  document.visual_analysis.condition_assessment === 'Poor' ? 'bg-orange-500/10 text-orange-400' :
                  document.visual_analysis.condition_assessment === 'Critical' ? 'bg-red-500/10 text-red-400' :
                  'bg-farm-accent/10 text-farm-muted'
                }`}>
                  {document.visual_analysis.condition_assessment}
                </span>
              </div>
            )}

            {/* Recommended Actions */}
            {document.visual_analysis.recommended_actions && document.visual_analysis.recommended_actions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-farm-muted" />
                  <h4 className="text-sm font-medium text-farm-text">Recommended Actions</h4>
                </div>
                <ul className="space-y-1">
                  {document.visual_analysis.recommended_actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-farm-text flex items-start gap-2">
                      <span className="text-farm-accent mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confidence */}
            {document.visual_analysis.confidence !== undefined && (
              <div className="flex items-center gap-2 text-sm text-farm-muted">
                <span>Confidence:</span>
                <span className="font-medium">{(document.visual_analysis.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}

        {/* AI Summary with inline editing */}
        {(document.ai_summary || isEditingSummary) && (
          <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-farm-text">AI Summary</h3>
              {!isEditingSummary && document.ai_summary && (
                <button onClick={handleEditSummary} className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors">
                  <Pencil className="h-4 w-4 text-farm-accent" />
                </button>
              )}
            </div>
            
            {isEditingSummary ? (
              <div className="space-y-3">
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm min-h-[200px] focus:outline-none focus:ring-2 focus:ring-farm-accent resize-none"
                  placeholder="AI-generated summary..."
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleSaveSummary} disabled={isSaving} size="sm" className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark">
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button onClick={handleCancelSummaryEdit} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert 
                prose-headings:font-semibold prose-headings:text-farm-text
                prose-p:text-sm prose-p:text-farm-text prose-p:leading-relaxed 
                prose-p:my-3 first:prose-p:mt-0
                prose-strong:text-farm-accent prose-strong:font-semibold
                prose-ul:my-2 prose-ul:ml-5 prose-ul:list-disc
                prose-ol:my-2 prose-ol:ml-5 prose-ol:list-decimal
                prose-li:text-sm prose-li:text-farm-text prose-li:my-1 prose-li:leading-relaxed prose-li:marker:text-farm-accent
                [&_strong]:text-farm-accent [&_strong]:font-semibold
                [&_ol]:list-decimal [&_ol]:ml-5
                [&_ul]:list-disc [&_ul]:ml-5
                [&_p:first-child]:mt-0
                [&_p]:mb-3
                [&_p+p]:mt-4
                [&_ol+p]:mt-5
                [&_ul+p]:mt-5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {document.ai_summary}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Metadata - Collapsible */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full p-4 flex items-center justify-between hover:bg-farm-accent/10 transition-colors"
          >
            <h3 className="font-semibold text-farm-text">Details</h3>
            {showDetails ? (
              <ChevronUp className="h-5 w-5 text-farm-muted" />
            ) : (
              <ChevronDown className="h-5 w-5 text-farm-muted" />
            )}
          </button>
          
          {showDetails && (
            <div className="px-4 pb-4 space-y-2 text-sm border-t border-farm-accent/20 pt-3">
              <div className="flex justify-between">
                <span className="text-farm-muted">Type:</span>
                <span className="font-medium text-farm-text capitalize">{document.document_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Size:</span>
                <span className="font-medium text-farm-text">{formatFileSize(document.file_size_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Uploaded:</span>
                <span className="font-medium text-farm-text">{formatDate(document.created_at)}</span>
              </div>
              {document.updated_at !== document.created_at && (
                <div className="flex justify-between">
                  <span className="text-farm-muted">Updated:</span>
                  <span className="font-medium text-farm-text">{formatDate(document.updated_at)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Create Field Plan Button - Primary Action */}
          {canCreateFieldPlan() && (
            <Button
              onClick={handleCreateFieldPlan}
              disabled={creatingFieldPlan}
              className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              {creatingFieldPlan ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Plan...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Create Field Plan</>
              )}
            </Button>
          )}
          
          {/* Show linked field plan if exists */}
          {document?.field_plan_id && (
            <Button
              onClick={() => navigate(`/field-plans/${document.field_plan_id}`)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              View Linked Field Plan
            </Button>
          )}
          
          <Button
            onClick={handleDownload}
            className="w-full"
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          
          <Button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="w-full"
            variant="outline"
          >
            {reprocessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reprocessing...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Reprocess</>
            )}
          </Button>
        </div>
      </main>

      {/* Field Plan Creation Result Dialog */}
      <Dialog open={showFieldPlanResult} onOpenChange={setShowFieldPlanResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🌾</span>
              {fieldPlanResult?.is_bulk_plan 
                ? `${fieldPlanResult.total_plans_created} Field Plans Created!`
                : 'Field Plan Created Successfully!'
              }
            </DialogTitle>
            <DialogDescription>
              {fieldPlanResult?.is_bulk_plan 
                ? `Your document has been converted into ${fieldPlanResult.total_plans_created} field plans`
                : 'Your document has been converted into a structured field plan'
              }
            </DialogDescription>
          </DialogHeader>
          
          {fieldPlanResult && (
            <div className="space-y-3">
              {/* Multi-field plans */}
              {fieldPlanResult.is_bulk_plan && fieldPlanResult.created_plans ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-farm-muted">Created Plans</p>
                  <div className="space-y-2">
                    {fieldPlanResult.created_plans.map((plan: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="bg-card border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          setShowFieldPlanResult(false);
                          navigate(`/field-plans/${plan.id}`);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🌾</span>
                            <span className="font-medium">{plan.plan_name || plan.field_name || 'Field Plan'}</span>
                          </div>
                        </div>
                        {plan.plan_year && (
                          <div className="text-xs text-farm-muted">
                            Year: {plan.plan_year}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Single field plan */
                <div 
                  className="bg-card border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setShowFieldPlanResult(false);
                    if (fieldPlanResult.field_plan_id) {
                      navigate(`/field-plans/${fieldPlanResult.field_plan_id}`);
                    }
                  }}
                >
                  {fieldPlanResult.plan_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-farm-muted">Plan</span>
                      <span className="font-medium">{fieldPlanResult.plan_name}</span>
                    </div>
                  )}
                  {fieldPlanResult.field_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-farm-muted">Field</span>
                      <span className="font-medium">{fieldPlanResult.field_name}</span>
                    </div>
                  )}
                  {fieldPlanResult.plan_year && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-farm-muted">Year</span>
                      <span className="font-medium">{fieldPlanResult.plan_year}</span>
                    </div>
                  )}
                  {fieldPlanResult.total_passes > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-farm-muted">Passes</span>
                      <span className="font-medium">{fieldPlanResult.total_passes}</span>
                    </div>
                  )}
                  <p className="text-xs text-primary mt-2">Click to view plan details →</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button onClick={() => navigate('/field-plans')} className="flex-1">
              View All Plans
            </Button>
            <Button variant="outline" onClick={() => setShowFieldPlanResult(false)} className="flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Field Name Display Component
function FieldNameDisplay({ fieldId }: { fieldId: string }) {
  const [fieldName, setFieldName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFieldName = async () => {
      try {
        const data = await fieldsAPI.getFields();
        const field = data?.fields?.find((f: any) => f.field_id === fieldId);
        if (field) {
          setFieldName(field.name); // Use 'name' not 'field_name'
        } else {
          setFieldName('Unknown Field');
        }
      } catch (error) {
        console.error("Failed to load field name:", error);
        setFieldName('Unknown Field');
      } finally {
        setLoading(false);
      }
    };

    loadFieldName();
  }, [fieldId]);

  if (loading) {
    return <Loader2 className="h-3 w-3 animate-spin inline" />;
  }

  return <span className="font-medium text-farm-accent">{fieldName}</span>;
}
