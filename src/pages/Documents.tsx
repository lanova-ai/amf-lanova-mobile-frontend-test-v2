import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { documentsAPI, Document, fieldsAPI, shareTimelinesAPI, handlePageError } from "@/lib/api";
import { toast } from "sonner";
import DocumentUploadModal from "@/components/DocumentUploadModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  FileText,
  Image as ImageIcon,
  File,
  Upload,
  MoreVertical,
  Download,
  RefreshCw,
  Trash2,
  Eye,
  Camera,
  FolderOpen,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Plus,
  ArrowLeft,
  Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function Documents() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View mode: notes | summary | shared
  const [viewMode, setViewMode] = useState<'notes' | 'summary' | 'shared'>('notes');
  
  // Filters (shared across all tabs) - initialize from URL params
  const [filterYear, setFilterYear] = useState<string>(searchParams.get('year') || "all");
  const [filterField, setFilterField] = useState<string>(searchParams.get('field') || "all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<any[]>([]);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  
  // Summary generation state
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);
  const [loadingSummaryDetail, setLoadingSummaryDetail] = useState(false);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  
  // Shared timelines state
  const [sharedTimelines, setSharedTimelines] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [selectedShare, setSelectedShare] = useState<any | null>(null);
  
  // Edit Title Modal
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editItemType, setEditItemType] = useState<'summary' | 'share' | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);
  
  // Delete Confirmation
  const [itemToDelete, setItemToDelete] = useState<{type: 'summary' | 'share', item: any} | null>(null);
  
  // Multi-select for summary generation
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Editing state
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState<any | null>(null);

  useEffect(() => {
    loadDocuments(true);
    loadFields();
  }, []);

  // Track polling state with useRef to persist across re-renders
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimesRef = useRef<Map<string, number>>(new Map());
  const pollCountRef = useRef<number>(0);
  const loadDocumentsRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);
  const documentsRef = useRef<Document[]>([]);
  const processingIdsRef = useRef<Set<string>>(new Set());
  const reprocessingIdsRef = useRef<Set<string>>(new Set());

  // Smart polling: Auto-refresh when documents are processing or creating field plans
  useEffect(() => {
    // Check if we have any documents that are currently processing or creating field plans
    const processingDocuments = documents.filter(doc => 
      doc.processing_status === 'PROCESSING' || 
      doc.processing_status === 'PENDING' ||
      doc.field_plan_creation_status === 'creating' ||
      processingIds.has(doc.id) ||
      reprocessingIds.has(doc.id)
    );

    console.log(`🔍 Polling check: ${processingDocuments.length} processing documents, interval active: ${!!pollingIntervalRef.current}`);

    // Initialize start times for new processing documents
    processingDocuments.forEach(doc => {
      if (!pollingStartTimesRef.current.has(doc.id)) {
        pollingStartTimesRef.current.set(doc.id, Date.now());
        console.log(`📌 Started tracking polling for document ${doc.id} (status: ${doc.processing_status})`);
      }
    });

    // Clean up start times for documents that are no longer processing
    const currentProcessingIds = new Set(processingDocuments.map(d => d.id));
    pollingStartTimesRef.current.forEach((startTime, docId) => {
      if (!currentProcessingIds.has(docId)) {
        pollingStartTimesRef.current.delete(docId);
        console.log(`✅ Stopped tracking polling for document ${docId} (completed)`);
      }
    });

    if (processingDocuments.length > 0) {
      // Only start polling if not already polling
      if (!pollingIntervalRef.current) {
        console.log(`⏰ Starting auto-polling for ${processingDocuments.length} processing document(s)`);
        pollCountRef.current = 0;
        
        const maxPollDuration = 10 * 60 * 1000; // 10 minutes maximum
        const pollIntervalMs = 10000; // 10 seconds
        const maxPolls = Math.floor(maxPollDuration / pollIntervalMs); // 60 polls max
        
        // Poll every 10 seconds when documents are processing
        pollingIntervalRef.current = setInterval(() => {
          pollCountRef.current++;
          console.log(`🔄 Auto-polling (${pollCountRef.current}/${maxPolls}): Refreshing document list...`);
          
          // Use ref to get latest loadDocuments function
          if (loadDocumentsRef.current) {
            loadDocumentsRef.current(false).then(() => {
              console.log(`✅ Polling refresh completed (poll ${pollCountRef.current})`);
              
              // Check the actual document statuses after loading
              // Use refs to get the latest values (updated by loadDocuments)
              const currentDocs = documentsRef.current;
              let currentProcessingIds = processingIdsRef.current;
              let currentReprocessingIds = reprocessingIdsRef.current;
              
              // Remove completed/failed documents from sets immediately (synchronously)
              const completedDocIds: string[] = [];
              currentDocs.forEach(doc => {
                if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
                  if (currentProcessingIds.has(doc.id) || currentReprocessingIds.has(doc.id)) {
                    completedDocIds.push(doc.id);
                  }
                }
              });
              
              // Update refs immediately (synchronously) before checking
              if (completedDocIds.length > 0) {
                console.log(`🧹 Removing ${completedDocIds.length} completed document(s) from processing sets:`, completedDocIds.map(id => id.substring(0, 8) + '...'));
                
                // Update refs synchronously
                const newProcessingIds = new Set(currentProcessingIds);
                const newReprocessingIds = new Set(currentReprocessingIds);
                completedDocIds.forEach(id => {
                  newProcessingIds.delete(id);
                  newReprocessingIds.delete(id);
                });
                processingIdsRef.current = newProcessingIds;
                reprocessingIdsRef.current = newReprocessingIds;
                currentProcessingIds = newProcessingIds;
                currentReprocessingIds = newReprocessingIds;
                
                // Update state (async, but refs are already updated)
                setProcessingIds(newProcessingIds);
                setReprocessingIds(newReprocessingIds);
              }
              
              // Check if any documents are still processing (using updated refs)
              // IMPORTANT: Trust the document status over set membership
              // If status is COMPLETED/FAILED, it's NOT processing, regardless of set membership
              const stillProcessing = currentDocs.some(doc => {
                // If document is completed or failed, it's NOT processing
                if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
                  return false;
                }
                
                // Only consider it processing if status is PROCESSING or PENDING
                const isProcessing = doc.processing_status === 'PROCESSING' || doc.processing_status === 'PENDING';
                const inProcessingSet = currentProcessingIds.has(doc.id);
                const inReprocessingSet = currentReprocessingIds.has(doc.id);
                
                if (isProcessing || inProcessingSet || inReprocessingSet) {
                  console.log(`⏳ Document ${doc.id.substring(0, 8)}... still processing: status=${doc.processing_status}, inProcessingSet=${inProcessingSet}, inReprocessingSet=${inReprocessingSet}`);
                  return true;
                }
                return false;
              });
              
              if (!stillProcessing && pollingIntervalRef.current) {
                console.log('🛑 No processing documents detected after refresh - stopping polling');
                
                // Get the document IDs that were being polled
                const polledDocIds = Array.from(pollingStartTimesRef.current.keys());
                
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                pollCountRef.current = 0;
                pollingStartTimesRef.current.clear();
                setProcessingIds(new Set());
                setReprocessingIds(new Set());
                processingIdsRef.current = new Set();
                reprocessingIdsRef.current = new Set();
                
                // Refresh the documents list one more time to ensure UI shows latest status
                console.log(`🔄 Refreshing documents list to update UI for ${polledDocIds.length} document(s)`);
                loadDocumentsRef.current?.(false).then(() => {
                  console.log('✅ Documents list refreshed - UI should now show updated status');
                }).catch((error) => {
                  console.error('❌ Error refreshing documents after polling stop:', error);
                });
              }
            }).catch((error) => {
              console.error('❌ Error during polling:', error);
            });
          } else {
            console.warn('⚠️ loadDocumentsRef.current is null, skipping poll');
          }
          
          // Check timeout based on poll count
          if (pollCountRef.current >= maxPolls) {
            console.warn(`⏹️ Maximum polling duration (${maxPollDuration / 1000}s) reached - stopping auto-polling`);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            pollCountRef.current = 0;
            pollingStartTimesRef.current.clear();
            toast.info("Document processing is taking longer than expected. Please refresh the page to check status.");
          }
        }, pollIntervalMs);
      } else {
        console.log(`⏸️ Polling already active (${pollCountRef.current} polls so far)`);
      }
    } else {
      // Stop polling if no documents are processing
      if (pollingIntervalRef.current) {
        console.log('✅ No processing documents found - stopping auto-polling');
        
        // Get the document IDs that were being polled
        const polledDocIds = Array.from(pollingStartTimesRef.current.keys());
        
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        pollCountRef.current = 0;
        pollingStartTimesRef.current.clear();
        
        // Refresh the documents list to ensure UI shows latest status
        if (polledDocIds.length > 0) {
          console.log(`🔄 Refreshing documents list to update UI for ${polledDocIds.length} document(s)`);
          loadDocumentsRef.current?.(false).then(() => {
            console.log('✅ Documents list refreshed - UI should now show updated status');
          }).catch((error) => {
            console.error('❌ Error refreshing documents after polling stop:', error);
          });
        }
      }
    }
    
    // Cleanup function - clear interval on unmount
    return () => {
      // Only clear on unmount, not on every dependency change
      // The interval will be cleared when processingDocuments.length becomes 0
    };
  }, [documents, processingIds, reprocessingIds]);

  // Handle navigation from sharing page
  useEffect(() => {
    if (location.state?.tab === 'shared') {
      setViewMode('shared');
      if (location.state?.refresh) {
        loadSharedTimelines();
      }
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Reset selection when field filter changes
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedDocuments(new Set());
  }, [filterField]);

  // Load cached summaries when Summary tab is opened
  useEffect(() => {
    if (viewMode === 'summary' && summaries.length === 0) {
      loadCachedSummaries();
    }
    if (viewMode === 'shared' && sharedTimelines.length === 0) {
      loadSharedTimelines();
    }
  }, [viewMode]);

  // Reset selected summary when switching tabs
  useEffect(() => {
    if (viewMode !== 'summary') {
      setSelectedSummary(null);
      setIsEditingMode(false);
      setLoadingSummaryDetail(false);
    }
    if (viewMode !== 'shared') {
      setSelectedShare(null);
    }
  }, [viewMode]);

  const loadCachedSummaries = async () => {
    try {
      setLoadingSummaries(true);
      const response = await fieldsAPI.listDocumentTimelines();
      setSummaries(response.summaries || []);
    } catch (error) {
      console.error("Failed to load cached summaries:", error);
      // Don't show error toast - just means no summaries exist yet
    } finally {
      setLoadingSummaries(false);
    }
  };

  const loadSharedTimelines = async () => {
    try {
      setLoadingShared(true);
      
      // Load both timeline shares and document shares
      const [timelineResponse, documentResponse] = await Promise.all([
        shareTimelinesAPI.getShareHistory().catch(() => ({ shares: [] })),
        documentsAPI.getShareHistory().catch(() => ({ shares: [] }))
      ]);
      
      // Add share_type to timeline shares for identification
      const timelineShares = (timelineResponse.shares || []).map((s: any) => ({
        ...s,
        share_type: 'timeline'
      }));
      
      // Document shares already have share_type: 'document' from backend
      const documentShares = documentResponse.shares || [];
      
      // Merge and sort by date (newest first)
      const allShares = [...timelineShares, ...documentShares].sort((a, b) => {
        const dateA = new Date(a.shared_at || a.created_at || 0);
        const dateB = new Date(b.shared_at || b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSharedTimelines(allShares);
    } catch (error) {
      console.error("Failed to load shared items:", error);
      // Don't show error toast - just means no shares exist yet
    } finally {
      setLoadingShared(false);
    }
  };

  const loadFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const sortedFields = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
    } catch (error) {
      console.error("Failed to load fields:", error);
    }
  };

  const loadDocuments = async (showLoading = true) => {
    // Update ref so polling can access latest function
    loadDocumentsRef.current = loadDocuments;
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await documentsAPI.getDocuments({
        limit: 500, // Load up to 500 documents for now
      });
      const docs = response.documents || [];
      setDocuments(docs);
      documentsRef.current = docs; // Update ref for polling callback
      
      // Clear processingIds for documents that are now completed
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        let removedCount = 0;
        docs.forEach((doc: Document) => {
          if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
            if (newSet.has(doc.id)) {
              newSet.delete(doc.id);
              removedCount++;
              console.log(`✅ Document ${doc.id} is ${doc.processing_status}, removed from processingIds`);
            }
          }
        });
        if (removedCount > 0) {
          console.log(`🧹 Cleaned up ${removedCount} completed document(s) from processingIds`);
        }
        processingIdsRef.current = newSet; // Update ref for polling callback
        return newSet;
      });
      
      // Clear reprocessingIds for documents that are now completed
      setReprocessingIds(prev => {
        const newSet = new Set(prev);
        docs.forEach((doc: Document) => {
          if (doc.processing_status === 'COMPLETED' || doc.processing_status === 'FAILED') {
            newSet.delete(doc.id);
          }
        });
        reprocessingIdsRef.current = newSet; // Update ref for polling callback
        return newSet;
      });
      
      // Extract unique years from document_date with error handling
      const years: number[] = [];
      try {
        if (Array.isArray(docs)) {
          docs.forEach((doc: any) => {
            if (!doc) return;
            
            try {
              let year: number | null = null;
              
              if (doc.document_date) {
                const parsedYear = new Date(doc.document_date).getFullYear();
                if (!isNaN(parsedYear) && parsedYear > 1900 && parsedYear < 2100) {
                  year = parsedYear;
                }
              } else if (doc.created_at) {
                // Fallback to created_at if no document_date
                const parsedYear = new Date(doc.created_at).getFullYear();
                if (!isNaN(parsedYear) && parsedYear > 1900 && parsedYear < 2100) {
                  year = parsedYear;
                }
              }
              
              if (year !== null && !years.includes(year)) {
                years.push(year);
              }
            } catch (docError) {
              console.warn('Error parsing year from document:', doc.id, docError);
            }
          });
        }
        setAvailableYears(years.sort((a, b) => b - a)); // Sort descending
      } catch (error) {
        console.error('Error extracting years from documents:', error);
        setAvailableYears([]);
      }
    } catch (error: any) {
      console.error("Failed to load documents:", error);
      if (showLoading) {
        const errorMsg = handlePageError(error, "Failed to load documents");
        if (errorMsg) toast.error(errorMsg);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleUploadComplete = async (uploadedDocId?: string, uploadResponse?: any) => {
    if (!uploadedDocId) {
      // Still reload documents even if no ID provided
      await loadDocuments(false);
      return;
    }

    // Check if this is a duplicate - if so, don't add to processing set
    // and reload documents to show the existing one
    if (uploadResponse?.is_duplicate) {
      // Reload documents to show the existing document
      await loadDocuments(false);
      return;
    }

    // Add to processing set for UI indicator (this ensures status shows immediately)
    setProcessingIds(prev => {
      const newSet = new Set(prev).add(uploadedDocId);
      processingIdsRef.current = newSet; // Update ref
      return newSet;
    });

    // Create a placeholder document immediately from upload response
    if (uploadResponse) {
      const placeholderDoc: Document = {
        id: uploadedDocId,
        original_filename: uploadResponse.original_filename || 'Uploaded file',
        title: uploadResponse.original_filename || 'Uploaded file',
        document_type: 'photo', // Will be updated when we fetch full document
        file_size_bytes: uploadResponse.file_size_bytes,
        storage_url: uploadResponse.storage_url,
        file_url: uploadResponse.file_url,
        processing_status: uploadResponse.status || 'PENDING', // Use 'status' from upload response
        ai_analyzed: false,
        created_at: uploadResponse.uploaded_at || new Date().toISOString(),
        updated_at: uploadResponse.uploaded_at || new Date().toISOString(),
      };

      // Add placeholder document to the beginning of the list immediately
      setDocuments(prev => {
        // Check if it already exists (shouldn't, but just in case)
        const exists = prev.find(d => d.id === uploadedDocId);
        if (exists) {
          // Update existing
          return prev.map(d => d.id === uploadedDocId ? placeholderDoc : d);
        } else {
          // Add to beginning
          return [placeholderDoc, ...prev];
        }
      });
    }

    // Try to fetch the full document immediately to get complete data
    try {
      const uploadedDoc = await documentsAPI.getDocument(uploadedDocId);
      if (uploadedDoc) {
        // Update the document in the list with full data
        setDocuments(prev => {
          const index = prev.findIndex(d => d.id === uploadedDocId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = uploadedDoc;
            return updated;
          } else {
            // Add to beginning if not found
            return [uploadedDoc, ...prev];
          }
        });
        
        // Clear from processingIds if already completed
        if (uploadedDoc.processing_status === 'COMPLETED' || uploadedDoc.processing_status === 'FAILED') {
          setProcessingIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(uploadedDocId);
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch uploaded document:", error);
      // Document will still show with placeholder data, and polling will update it
    }

    // The smart polling useEffect will handle status updates automatically
  };

  const handleReprocess = async (documentId: string) => {
    try {
      setReprocessingIds(prev => new Set(prev).add(documentId));
      await documentsAPI.reprocessDocument(documentId);
      toast.success("Document reprocessing started");
      
      // Poll for status updates
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds max
      
      const pollReprocessedDoc = async () => {
        attempts++;
        try {
          // Fetch the specific document by ID
          const updatedDoc = await documentsAPI.getDocument(documentId);
          
          if (updatedDoc) {
            // Update only the specific document in the list
            setDocuments(prev => prev.map(doc => 
              doc.id === documentId ? updatedDoc : doc
            ));
            
            // Stop polling if processing is complete or failed
            if (updatedDoc.processing_status === 'COMPLETED' || updatedDoc.processing_status === 'FAILED' || attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setReprocessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(documentId);
                return newSet;
              });
              if (updatedDoc.processing_status === 'COMPLETED') {
                toast.success("Document processed successfully");
              } else if (updatedDoc.processing_status === 'FAILED') {
                toast.error("Document reprocessing failed");
              }
            }
          }
        } catch (error) {
          console.error("Failed to poll document status:", error);
          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setReprocessingIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(documentId);
              return newSet;
            });
          }
        }
      };
      
      // Poll immediately, then every 2 seconds
      pollReprocessedDoc();
      const pollInterval = setInterval(pollReprocessedDoc, 2000);
    } catch (error) {
      console.error("Failed to reprocess document:", error);
      toast.error("Failed to reprocess document");
      setReprocessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const handleDelete = async () => {
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

  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.size === filteredDocuments.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const handleGenerateSummary = async (forceRegenerate: boolean = false) => {
    if (!filterField || filterField === "all") {
      toast.error("Please select a specific field");
      return;
    }
    
    if (selectedDocuments.size === 0) {
      toast.error("Please select at least one document");
      return;
    }
    
    try {
      setGeneratingSummary(true);
      
      // Get field info for farm name
      const selectedField = fields.find(f => f.field_id === filterField);
      
      // Extract year from documents or use filterYear
      const year = filterYear !== 'all' ? parseInt(filterYear) : new Date().getFullYear();
      
      // Get selected document IDs
      const documentIds = Array.from(selectedDocuments);
      
      // Create placeholder immediately (before backend call)
      const placeholderId = `generating-${filterField}-${year}-${Date.now()}`;
      const placeholder = {
        id: placeholderId,
        field_id: filterField,
        field_name: selectedField?.name || 'Unknown Field',
        farm_name: selectedField?.farm_name || 'Unknown Farm',
        year: year,
        time_period: 'full_season',
        generation_status: 'generating' as const,
        custom_title: 'Generating...',
        total_documents: documentIds.length,
        summary_text: '',
        key_observations: [],
        trends: [],
        recommendations: [],
        summary_preview: '',
        last_computed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        cached: false
      };
      
      // Add placeholder immediately to show progress
      setSummaries(prev => {
        // Check if placeholder already exists
        const existingPlaceholder = prev.find(
          s => s.generation_status === 'generating' && 
               s.field_id === filterField && 
               s.year === year
        );
        if (existingPlaceholder) {
          return prev; // Don't add duplicate placeholder
        }
        return [placeholder, ...prev];
      });
      
      // Switch to Summary tab to show progress
      setViewMode('summary');
      toast.info("Generating summary... This may take a moment.");
      
      // Call the backend - pass selected document IDs
      const response = await fieldsAPI.getFieldDocumentTimeline(
        filterField,
        'full_season',
        year,
        forceRegenerate,
        undefined, // start_date
        undefined, // end_date
        documentIds.join(',') // document_ids (comma-separated string)
      );
      
      // If generation is in progress, start polling for this specific placeholder
      if (response.generation_status === 'generating') {
        // Start polling for completion - will update the placeholder
        pollSummaryStatus(filterField, year, selectedField, documentIds, placeholderId);
        return;
      }
      
      // If completed immediately, update the placeholder and reload summaries
      setSummaries(prev => {
        const index = prev.findIndex(s => s.id === placeholderId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            ...response,
            generation_status: 'completed',
            id: (response as any).id || placeholderId
          };
          return updated;
        }
        return prev;
      });
      
      // Reload summaries to get proper structure
      await loadCachedSummaries();
      
      toast.success("Summary generated successfully!");
    } catch (error: any) {
      console.error("Failed to generate summary:", error);
      toast.error(error.message || "Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };
  
  const pollSummaryStatus = (fieldId: string, year: number, selectedField: any, documentIds?: string[], placeholderId?: string) => {
    const pollInterval = setInterval(async () => {
      try {
        // Try to find the summary_id from the placeholder first
        let response: any;
        const placeholder = summaries.find(s => s.id === placeholderId);
        
        // If placeholder has been updated with a real ID, use that
        if (placeholder && placeholder.id && !placeholder.id.startsWith('generating-') && !placeholder.id.startsWith('temp-')) {
          try {
            response = await fieldsAPI.getDocumentTimelineById(placeholder.id);
          } catch (e) {
            // If summary_id endpoint fails, fall back to field/year/document_ids
            response = await fieldsAPI.getFieldDocumentTimeline(
              fieldId,
              'full_season',
              year,
              false,
              undefined, // startDate
              undefined, // endDate
              documentIds ? documentIds.join(',') : undefined // documentIds (comma-separated string)
            );
          }
        } else {
          // Poll with document_ids to get the correct summary
          response = await fieldsAPI.getFieldDocumentTimeline(
            fieldId,
            'full_season',
            year,
            false,
            undefined, // startDate
            undefined, // endDate
            documentIds ? documentIds.join(',') : undefined // documentIds (comma-separated string) - IMPORTANT!
          );
        }
        
        if (response.generation_status === 'completed') {
          clearInterval(pollInterval);
          setGeneratingSummary(false);
          
          // Update ONLY the specific placeholder by ID
          setSummaries(prev => {
            const index = prev.findIndex(s => 
              placeholderId ? s.id === placeholderId : 
              (s.field_id === fieldId && s.year === year && s.time_period === 'full_season' && s.generation_status === 'generating')
            );
            
            if (index >= 0) {
              // Update the specific placeholder with response data
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                ...response,
                generation_status: 'completed',
                id: (response as any).id || updated[index].id, // Use real ID from backend if available
                field_name: selectedField?.name || updated[index].field_name || 'Unknown Field',
                farm_name: selectedField?.farm_name || updated[index].farm_name || 'Unknown Farm'
              };
              return updated;
            }
            return prev;
          });
          
          // Reload summaries once to get the proper ID and structure from backend
          setTimeout(async () => {
            await loadCachedSummaries();
          }, 500); // Small delay to ensure backend has saved the summary
          
          toast.success("Summary generated successfully!");
        } else if (response.generation_status === 'failed') {
          clearInterval(pollInterval);
          setGeneratingSummary(false);
          
          // Update the specific placeholder status to failed
          setSummaries(prev => prev.map(s => 
            (placeholderId && s.id === placeholderId) || 
            (!placeholderId && s.field_id === fieldId && s.year === year && s.time_period === 'full_season' && s.generation_status === 'generating')
              ? { ...s, generation_status: 'failed' }
              : s
          ));
          
          toast.error("Summary generation failed. Please try again.");
        }
        // If still generating, no update needed - placeholder already shows generating status
      } catch (error) {
        console.error("Polling error:", error);
        // Continue polling even on error
      }
    }, 3000); // Poll every 3 seconds
    
    // Stop polling after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setGeneratingSummary(false);
    }, 120000);
  };

  const handleSaveSummaryEdits = async () => {
    if (!editedSummary || !selectedSummary) return;
    
    if (!selectedSummary.id) {
      toast.error("Cannot update: Summary ID missing");
      return;
    }
    
    try {
      // ✅ Update summary content via API using summary ID
      await shareTimelinesAPI.updateTimelineContent(
        selectedSummary.id,
        editedSummary.field_id,
        {
          summary_text: editedSummary.summary_text,
          key_observations: editedSummary.key_observations,
          trends: editedSummary.trends,
          recommendations: editedSummary.recommendations
        }
      );
      
      // Update the summary in the list
      setSummaries(prev => prev.map(s => 
        s.field_id === selectedSummary.field_id && s.year === selectedSummary.year
          ? editedSummary
          : s
      ));
      
      setSelectedSummary(editedSummary);
      setIsEditingMode(false);
      toast.success("Summary updated successfully!");
    } catch (error: any) {
      console.error("Failed to save summary edits:", error);
      toast.error(error.message || "Failed to save summary edits");
    }
  };

  const handleViewSummaryDetail = async (summaryPreview: any) => {
    try {
      setLoadingSummaryDetail(true);
      
      // If we have summary_id, use the simple summary_id endpoint (preferred - no document_ids needed!)
      if (summaryPreview.id) {
        const fullSummary = await fieldsAPI.getDocumentTimelineById(summaryPreview.id);
        setSelectedSummary(fullSummary);
        return;
      }
      
      // Fallback: Use field/year/document_ids if summary_id not available (shouldn't happen for existing summaries)
      // This is only for backward compatibility or during generation
      const documentIds = summaryPreview.included_document_ids || summaryPreview.document_ids;
      let documentIdsParam: string | undefined = undefined;
      
      if (documentIds) {
        if (Array.isArray(documentIds)) {
          documentIdsParam = documentIds.join(',');
        } else if (typeof documentIds === 'string') {
          // Handle PostgreSQL array string format: {uuid1,uuid2} or comma-separated
          const idsStr = documentIds.trim();
          if (idsStr.startsWith('{') && idsStr.endsWith('}')) {
            documentIdsParam = idsStr.slice(1, -1); // Remove curly braces
          } else {
            documentIdsParam = idsStr;
          }
        }
      }
      
      const fullSummary = await fieldsAPI.getFieldDocumentTimeline(
        summaryPreview.field_id,
        summaryPreview.time_period || 'full_season',
        summaryPreview.year,
        false, // regenerate
        undefined, // startDate
        undefined, // endDate
        documentIdsParam
      );
      
      // Merge with preview data
      setSelectedSummary({
        ...fullSummary,
        farm_name: summaryPreview.farm_name,
        field_name: fullSummary.field_name || summaryPreview.field_name,
        id: summaryPreview.id || fullSummary.id
      });
    } catch (error: any) {
      console.error("Failed to load summary detail:", error);
      toast.error(error.message || "Failed to load summary details");
    } finally {
      setLoadingSummaryDetail(false);
    }
  };

  const handleEditTitle = (item: any, type: 'summary' | 'share') => {
    setEditingItem(item);
    setEditItemType(type);
    // Use appropriate title field based on share type
    const currentTitle = item.share_type === 'document' 
      ? (item.document_title || "") 
      : (item.custom_title || "");
    setEditedTitle(currentTitle);
    setShowEditTitleModal(true);
  };

  const handleSaveTitle = async () => {
    if (!editingItem || !editItemType || savingTitle) return;

    try {
      setSavingTitle(true);
      
      if (editItemType === 'summary') {
        // ✅ Update summary title via API - WAIT for response
        if (!editingItem.id) {
          toast.error("Cannot update: Summary ID missing");
          return;
        }
        
        const response = await shareTimelinesAPI.updateTimelineTitle(
          editingItem.id,
          editingItem.field_id,
          editedTitle
        );
        
        console.log("✅ API Response:", response);
        
        // ✅ Only update local state if API call succeeded
        setSummaries(prev => prev.map(s => 
          s.id === editingItem.id
            ? { ...s, custom_title: editedTitle }
            : s
        ));
        
        // ✅ Only close modal and show success if API succeeded
        setShowEditTitleModal(false);
        setEditingItem(null);
        setEditedTitle("");
        setEditItemType(null);
        toast.success("Summary title updated!");
      } else if (editItemType === 'share') {
        // Handle both document and timeline shares
        if (editingItem.share_type === 'document') {
          // For document shares, update the document's title
          if (!editingItem.document_id) {
            toast.error("Cannot update: Missing document information");
            return;
          }
          
          await documentsAPI.updateDocument(editingItem.document_id, { title: editedTitle });
          
          // Update local state
          setSharedTimelines(prev => prev.map(sh => 
            sh.id === editingItem.id
              ? { ...sh, document_title: editedTitle }
              : sh
          ));
          
          toast.success("Document title updated!");
        } else {
          // For timeline shares, update via timeline API
          if (!editingItem.field_id || !editingItem.year) {
            toast.error("Cannot update: Missing field or year information");
            return;
          }
          
          await shareTimelinesAPI.updateTimelineTitle(
            editingItem.field_id,
            editingItem.year,
            editingItem.time_period || 'full_season',
            editedTitle
          );
          
          // Update local state
          setSharedTimelines(prev => prev.map(sh => 
            sh.id === editingItem.id
              ? { ...sh, custom_title: editedTitle }
              : sh
          ));
          
          toast.success("Timeline title updated!");
        }
        
        // Close modal
        setShowEditTitleModal(false);
        setEditingItem(null);
        setEditedTitle("");
        setEditItemType(null);
      }
    } catch (error: any) {
      console.error("❌ Failed to update title:", error);
      // ✅ Show detailed error message
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to update title";
      toast.error(`Failed to update title: ${errorMessage}`, { duration: 5000 });
      // ✅ Keep modal open so user can retry
    } finally {
      setSavingTitle(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'summary') {
        // ✅ Delete summary via API using summary ID
        if (!itemToDelete.item.id) {
          toast.error("Cannot delete: Summary ID missing");
          return;
        }
        
        await shareTimelinesAPI.deleteTimeline(
          itemToDelete.item.id,
          itemToDelete.item.field_id
        );
        
        // Update local state - remove by ID
        setSummaries(prev => prev.filter(s => s.id !== itemToDelete.item.id));
        toast.success("Summary deleted successfully!");
      } else if (itemToDelete.type === 'share') {
        // ✅ Delete share from backend - handle both document and timeline shares
        if (itemToDelete.item.share_type === 'document') {
          await documentsAPI.deleteShare(itemToDelete.item.id);
          toast.success("Document share deleted successfully!");
        } else {
          await shareTimelinesAPI.deleteSharedTimeline(itemToDelete.item.id);
          toast.success("Timeline share deleted successfully!");
        }
        
        // Update local state
        setSharedTimelines(prev => prev.filter(sh => sh.id !== itemToDelete.item.id));
      }
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      toast.error(error.message || "Failed to delete item");
    } finally {
      setItemToDelete(null);
    }
  };

  const getDocumentIcon = (doc: Document) => {
    if (doc.mime_type?.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4 text-farm-accent" />;
    } else if (doc.mime_type === "application/pdf") {
      return <FileText className="h-4 w-4 text-farm-accent" />;
    }
    return <File className="h-4 w-4 text-farm-muted" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-farm-accent" />;
      case "PROCESSING":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "FAILED":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      PROCESSING: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-farm-accent/10 text-farm-accent",
      FAILED: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDocumentDate = (doc: Document) => {
    // Use document_date if available, otherwise fallback to created_at
    const dateToFormat = doc.document_date || doc.created_at;
    if (!dateToFormat) return 'No date';
    
    // Format as YYYY-MM-DD
    const date = new Date(dateToFormat);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get fields that have documents (with error handling)
  const fieldsWithDocuments = (() => {
    try {
      if (!Array.isArray(fields) || !Array.isArray(documents)) {
        return [];
      }
      return fields.filter(field => {
        if (!field || !field.field_id) return false;
        try {
          return documents.some(doc => doc && doc.field_id === field.field_id);
        } catch (error) {
          console.warn('Error filtering field:', field.field_id, error);
          return false;
        }
      });
    } catch (error) {
      console.error('Error computing fieldsWithDocuments:', error);
      return [];
    }
  })();

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      // Year filter (from document_date or created_at)
      if (filterYear !== "all") {
        const docDate = doc.document_date || doc.created_at;
        if (docDate) {
          const docYear = new Date(docDate).getFullYear();
          if (docYear !== parseInt(filterYear)) return false;
        } else {
          return false; // Exclude documents without dates if year filter is active
        }
      }

      // Field filter
      if (filterField !== "all" && doc.field_id !== filterField) return false;

      return true;
    })
    .sort((a, b) => {
      // Sort by document_date (with created_at as fallback), most recent first
      const dateA = new Date(a.document_date || a.created_at).getTime();
      const dateB = new Date(b.document_date || b.created_at).getTime();
      return dateB - dateA; // Descending order (newest first)
    });

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="body-text">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col page-background">
      {/* Fixed Header: Tabs */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-farm-accent/20 bg-farm-dark z-30">
          <div className="inline-flex items-center justify-center w-full bg-farm-card border border-farm-accent/20 p-1 rounded-full">
            <button
              onClick={() => setViewMode('notes')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'notes'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Docs & Photos
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'summary'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('shared')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'shared'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Shared
            </button>
          </div>
        </div>

        {/* Selection Actions */}
        {viewMode === 'notes' && isSelectionMode && (
          <div className="flex-shrink-0 px-4 py-3 border-b bg-farm-dark/95 z-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {selectedDocuments.size === filteredDocuments.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-sm text-farm-muted">
                  {selectedDocuments.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedDocuments(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleGenerateSummary(true)}
                  disabled={selectedDocuments.size === 0 || generatingSummary}
                  className="flex items-center gap-2 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  {generatingSummary ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filters - Only show in Notes tab */}
        {viewMode === 'notes' && (
          <div className="flex-shrink-0 px-4 py-4 border-b bg-farm-dark z-20 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Type Filter */}
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {filterYear === "all" ? "All Years" : filterYear}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {(() => {
                  try {
                    if (!Array.isArray(availableYears)) return null;
                    return availableYears
                      .filter(year => typeof year === 'number' && !isNaN(year))
                      .map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ));
                  } catch (error) {
                    console.error('Error rendering document year filter:', error);
                    return null;
                  }
                })()}
              </SelectContent>
            </Select>

            {/* Field Filter */}
            <Select value={filterField} onValueChange={setFilterField}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {filterField === "all" 
                    ? "All Fields" 
                    : (() => {
                        try {
                          if (!Array.isArray(fieldsWithDocuments)) return "All Fields";
                          const field = fieldsWithDocuments.find(f => f && f.field_id === filterField);
                          return field && field.name 
                            ? `${field.name} (${field.farm_name || 'Unknown Farm'})` 
                            : "All Fields";
                        } catch (error) {
                          console.error('Error rendering field filter value:', error);
                          return "All Fields";
                        }
                      })()
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                {(() => {
                  try {
                    if (!Array.isArray(fieldsWithDocuments)) return null;
                    return fieldsWithDocuments
                      .filter(field => field && field.field_id && field.name)
                      .map((field) => (
                        <SelectItem key={field.field_id} value={field.field_id}>
                          {field.name} ({field.farm_name || 'Unknown Farm'})
                        </SelectItem>
                      ));
                  } catch (error) {
                    console.error('Error rendering document field filter:', error);
                    return null;
                  }
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Results count and action button */}
          <div className="flex items-center justify-between gap-2">
            <p className="label-text">
              {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'} found
            </p>
            {!isSelectionMode && filterField !== "all" && filteredDocuments.length > 0 && (
              <button
                onClick={() => setIsSelectionMode(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Select Documents
              </button>
            )}
          </div>
          
          {/* Helper text for generating summary */}
          <div className="pt-2">
            <p className="text-xs text-farm-muted flex items-center gap-1">
              <FileText className="h-3 w-3" />
              💡 Select a field and year, then click "Select Documents" to generate a timeline summary
            </p>
          </div>
        </div>
        )}

        {/* Notes Tab - Documents List (Scrollable) */}
        {viewMode === 'notes' && (
          <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 pb-24">
            {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              {documents.length === 0 ? (
                <>
                  <div className="icon-brand mx-auto">
                    <FolderOpen className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="section-heading">No documents yet</h3>
                    <p className="body-text max-w-sm mx-auto">
                      Upload photos, receipts, or PDFs using the + button. AI will automatically analyze them for you.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-6xl">🔍</div>
                  <div className="space-y-2">
                    <h3 className="section-heading">No documents found</h3>
                    <p className="body-text max-w-sm mx-auto">
                      Try adjusting your filters
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="card-interactive relative"
                  onClick={() => isSelectionMode ? toggleDocumentSelection(doc.id) : navigate(`/documents/${doc.id}`)}
                >
                  {/* Three-dot menu - Top Right */}
                  <div className="absolute top-2 right-2 z-20">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent/50">
                          <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/documents/${doc.id}`);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        {doc.file_url && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            window.open(doc.file_url, '_blank');
                          }}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          if (doc.processing_status === 'COMPLETED') {
                            navigate(`/documents/${doc.id}/share`);
                          } else {
                            toast.info("Please wait for document processing to complete before sharing");
                          }
                        }}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocumentToDelete(doc.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                <div className="flex items-start gap-3 pr-8">
                  {/* Checkbox for Selection Mode */}
                  {isSelectionMode && (
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(doc.id)}
                        onChange={() => toggleDocumentSelection(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>
                  )}
                  
                  {/* Thumbnail or Icon */}
                  <div className="flex-shrink-0">
                    {doc.mime_type?.startsWith("image/") && doc.file_url ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-farm-accent/20">
                        <img
                          src={doc.file_url}
                          alt={doc.original_filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center border border-farm-accent/10">
                        {getDocumentIcon(doc)}
                      </div>
                    )}
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate">
                        {doc.title || doc.original_filename}
                      </h3>
                    </div>

                    {/* Document Type & Date */}
                    <div className="flex items-center gap-2 text-xs text-farm-muted mb-2">
                      <span className="capitalize">{doc.document_type}</span>
                      <span>•</span>
                      <span>📅 {formatDocumentDate(doc)}</span>
                    </div>

                    {/* Field Name & Status - Same Line */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Field Name (if assigned) */}
                      {doc.field_id && (
                        <FieldNameBadge fieldId={doc.field_id} fields={fields} />
                      )}
                      
                      {/* Status */}
                      {(reprocessingIds.has(doc.id) || processingIds.has(doc.id) || doc.processing_status !== 'COMPLETED') && (
                        <div className="flex items-center gap-1">
                          {(reprocessingIds.has(doc.id) || processingIds.has(doc.id)) ? (
                            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                          ) : (
                            getStatusIcon(doc.processing_status)
                          )}
                          <span className="text-xs text-farm-muted">
                            {reprocessingIds.has(doc.id) ? 'REPROCESSING' : 
                             processingIds.has(doc.id) ? 'PROCESSING' : 
                             doc.processing_status !== 'COMPLETED' ? doc.processing_status : ''}
                          </span>
                        </div>
                      )}
                      
                      {/* AI Analyzed Badge */}
                      {doc.ai_analyzed && !reprocessingIds.has(doc.id) && !processingIds.has(doc.id) && (
                        <span className="text-xs text-farm-accent">✓ AI Analyzed</span>
                      )}
                      
                      {/* Field Plan Creation Status */}
                      {doc.field_plan_creation_status === 'creating' && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full animate-pulse">
                          Creating Field Plan...
                        </span>
                      )}
                      {doc.field_plan_creation_status === 'completed' && doc.field_plan_id && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                          Field Plan ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}
        </main>
        )}

        {/* Filters - Summary Tab */}
        {viewMode === 'summary' && !selectedSummary && !loadingSummaryDetail && (
          <div className="flex-shrink-0 px-4 py-4 border-b bg-farm-dark z-20 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Year Filter */}
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filterYear === "all" ? "All Years" : filterYear}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {(() => {
                    try {
                      if (!Array.isArray(summaries)) return null;
                      return Array.from(new Set(
                        summaries
                          .filter(s => s && typeof s.year === 'number' && !isNaN(s.year) && s.year > 1900 && s.year < 2100)
                          .map(s => s.year)
                      ))
                        .sort((a, b) => b - a)
                        .map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ));
                    } catch (error) {
                      console.error('Error rendering summary year filter:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>

              {/* Field Filter */}
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filterField === "all" 
                      ? "All Fields" 
                      : (() => {
                          const summary = summaries.find(s => s.field_id === filterField);
                          return summary ? `${summary.field_name} (${summary.farm_name || 'Unknown Farm'})` : "All Fields";
                        })()
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  {(() => {
                    try {
                      if (!Array.isArray(summaries)) return null;
                      return Array.from(new Map(
                        summaries
                          .filter(s => s && s.field_id && s.field_name)
                          .map(s => [s.field_id, s])
                      ).values())
                        .sort((a, b) => (a.field_name || '').localeCompare(b.field_name || ''))
                        .map((summary) => (
                          <SelectItem key={summary.field_id} value={summary.field_id}>
                            {summary.field_name} ({summary.farm_name || 'Unknown Farm'})
                          </SelectItem>
                        ));
                    } catch (error) {
                      console.error('Error rendering summary field filter:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Summary Tab - Document Summaries (Scrollable) */}
        {viewMode === 'summary' && (
          <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
            {loadingSummaryDetail ? (
              /* Loading State */
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-farm-muted">Loading summary details...</p>
                </div>
              </div>
            ) : selectedSummary ? (
              /* Detail View */
              <div className="space-y-4">
                {/* Header with Back Button and Actions */}
                <div className="flex items-center gap-3 pb-3 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedSummary(null);
                      setIsEditingMode(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>

                  <div className="h-6 w-px bg-border"></div>

                  {/* Action Buttons */}
                  {isEditingMode ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingMode(false);
                          setEditedSummary(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveSummaryEdits}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Save Edits
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => {
                          setIsEditingMode(true);
                          setEditedSummary({...selectedSummary});
                        }}
                      >
                        <FileText className="h-4 w-4 text-farm-accent" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                        onClick={() => {
                          navigate(`/documents/share-timeline?summary_id=${selectedSummary.id}`);
                        }}
                      >
                        <Share2 className="h-4 w-4 text-farm-accent" />
                        Share
                      </Button>
                    </div>
                  )}
                </div>

                {/* Summary Header */}
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-farm-text">
                    {selectedSummary.custom_title || `${selectedSummary.farm_name} - ${selectedSummary.field_name}`}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-farm-muted">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{selectedSummary.year}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>{selectedSummary.total_documents} document{selectedSummary.total_documents !== 1 ? 's' : ''}</span>
                    </div>
                    {selectedSummary.last_computed_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(selectedSummary.last_computed_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Content */}
                <div className="card">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  {isEditingMode ? (
                    <textarea
                      className="w-full min-h-[300px] p-3 border rounded-md body-text bg-farm-dark resize-y"
                      value={editedSummary?.summary_text || ''}
                      onChange={(e) => setEditedSummary({...editedSummary, summary_text: e.target.value})}
                      autoFocus
                      rows={15}
                    />
                  ) : (
                    <ul className="text-sm text-farm-text leading-relaxed space-y-1.5 list-none">
                      {selectedSummary.summary_text.split(/[•\n]/).filter((line: string) => line.trim()).map((line: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-farm-accent mt-0.5">•</span>
                          <span className="[&_strong]:text-farm-accent [&_strong]:font-semibold">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              p: ({children}) => <>{children}</>
                            }}>
                              {line.trim()}
                            </ReactMarkdown>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Key Observations */}
                {((isEditingMode && editedSummary?.key_observations) || (selectedSummary.key_observations && selectedSummary.key_observations.length > 0)) && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Key Observations</h3>
                    {isEditingMode ? (
                      <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md body-text bg-farm-dark resize-y"
                        value={(editedSummary?.key_observations || []).join('\n')}
                        onChange={(e) => setEditedSummary({
                          ...editedSummary,
                          key_observations: e.target.value.split('\n').filter(line => line.trim())
                        })}
                        placeholder="Enter observations, one per line..."
                        rows={6}
                      />
                    ) : (
                      <ul className="space-y-2">
                        {selectedSummary.key_observations.map((obs: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-farm-accent mt-0.5">•</span>
                            <span className="text-sm text-farm-text flex-1 [&_strong]:text-farm-accent [&_strong]:font-semibold">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                p: ({children}) => <>{children}</>
                              }}>
                                {obs}
                              </ReactMarkdown>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Trends */}
                {((isEditingMode && editedSummary?.trends) || (selectedSummary.trends && selectedSummary.trends.length > 0)) && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Trends</h3>
                    {isEditingMode ? (
                      <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md body-text bg-farm-dark resize-y"
                        value={(editedSummary?.trends || []).join('\n')}
                        onChange={(e) => setEditedSummary({
                          ...editedSummary,
                          trends: e.target.value.split('\n').filter(line => line.trim())
                        })}
                        placeholder="Enter trends, one per line..."
                        rows={6}
                      />
                    ) : (
                      <ul className="space-y-2">
                        {selectedSummary.trends.map((trend: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">📈</span>
                            <span className="text-sm text-farm-text flex-1 [&_strong]:text-blue-500 [&_strong]:font-semibold">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                p: ({children}) => <>{children}</>
                              }}>
                                {trend}
                              </ReactMarkdown>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {((isEditingMode && editedSummary?.recommendations) || (selectedSummary.recommendations && selectedSummary.recommendations.length > 0)) && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Recommendations</h3>
                    {isEditingMode ? (
                      <textarea
                        className="w-full min-h-[150px] p-3 border rounded-md body-text bg-farm-dark resize-y"
                        value={(editedSummary?.recommendations || []).join('\n')}
                        onChange={(e) => setEditedSummary({
                          ...editedSummary,
                          recommendations: e.target.value.split('\n').filter(line => line.trim())
                        })}
                        placeholder="Enter recommendations, one per line..."
                        rows={6}
                      />
                    ) : (
                      <ul className="space-y-2">
                        {selectedSummary.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span className="text-sm text-farm-text flex-1 [&_strong]:text-green-500 [&_strong]:font-semibold">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                p: ({children}) => <>{children}</>
                              }}>
                                {rec}
                              </ReactMarkdown>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ) : loadingSummaries ? (
              /* Loading State */
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-farm-muted">Loading summaries...</p>
                </div>
              </div>
            ) : summaries.length > 0 ? (
              /* List View */
              <div className="space-y-3">
                {summaries
                  .filter(summary => {
                    if (filterYear !== "all" && summary.year !== parseInt(filterYear)) return false;
                    if (filterField !== "all" && summary.field_id !== filterField) return false;
                    return true;
                  })
                  .map((summary) => (
                  <div
                    key={summary.id}
                    className="card-interactive relative"
                    onClick={() => handleViewSummaryDetail(summary)}
                  >
                    {/* Three-dot menu - Top Right */}
                    <div className="absolute top-2 right-2 z-20">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent/50">
                            <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-50">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleViewSummaryDetail(summary);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleEditTitle(summary, 'summary');
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Edit Title
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({type: 'summary', item: summary});
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-start justify-between gap-3 pr-8">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                          {summary.custom_title || `${summary.year || ''} ${summary.field_name || ''} Field Timeline Summary`.trim() || "Untitled Summary"}
                          {summary.generation_status === 'generating' && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap">
                          {summary.generation_status === 'generating' ? (
                            <span className="text-blue-500 animate-pulse">Generating summary...</span>
                          ) : (
                            <>
                              {summary.year && (
                                <>
                                  <span>Year: {summary.year}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="font-medium text-farm-accent">{summary.total_documents || 0} document{summary.total_documents !== 1 ? 's' : ''}</span>
                              {(summary.generated_at || summary.last_computed_at) && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(summary.generated_at || summary.last_computed_at).toLocaleDateString()}</span>
                                </>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Field Name & Insights Count */}
                        {!summary.generation_status || summary.generation_status === 'completed' ? (
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            {/* Field Name Badge */}
                            {summary.field_name && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                                📍 {summary.field_name}
                              </span>
                            )}
                            
                            {/* Insights Badges */}
                            {summary.key_observations && summary.key_observations.length > 0 && (
                              <span className="text-xs text-farm-muted">
                                {summary.key_observations.length} observation{summary.key_observations.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            
                            {summary.trends && summary.trends.length > 0 && (
                              <>
                                <span className="text-xs text-farm-muted">•</span>
                                <span className="text-xs text-farm-muted">
                                  {summary.trends.length} trend{summary.trends.length !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                            
                            {summary.recommendations && summary.recommendations.length > 0 && (
                              <>
                                <span className="text-xs text-farm-muted">•</span>
                                <span className="text-xs text-farm-muted">
                                  {summary.recommendations.length} recommendation{summary.recommendations.length !== 1 ? 's' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="text-center py-12 space-y-4">
                <div className="icon-brand mx-auto">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="section-heading">No Summaries Yet</h3>
                  <p className="body-text max-w-sm mx-auto">
                    Generate summaries from your field documents using the Notes tab.
                  </p>
                </div>
              </div>
            )}
          </main>
        )}

        {/* Filters - Shared Tab */}
        {viewMode === 'shared' && !selectedShare && (
          <div className="flex-shrink-0 px-4 py-4 border-b bg-farm-dark z-20 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Year Filter */}
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filterYear === "all" ? "All Years" : filterYear}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {(() => {
                    try {
                      if (!Array.isArray(sharedTimelines)) return null;
                      return Array.from(new Set(
                        sharedTimelines
                          .filter(s => s && typeof s.year === 'number' && !isNaN(s.year) && s.year > 1900 && s.year < 2100)
                          .map(s => s.year)
                      ))
                        .sort((a, b) => b - a)
                        .map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ));
                    } catch (error) {
                      console.error('Error rendering shared year filter:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>

              {/* Field Filter */}
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {filterField === "all" 
                      ? "All Fields" 
                      : (() => {
                          const share = sharedTimelines.find(s => s.field_id === filterField);
                          return share ? `${share.field_name} (${share.farm_name || 'Unknown Farm'})` : "All Fields";
                        })()
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  {(() => {
                    try {
                      if (!Array.isArray(sharedTimelines)) return null;
                      return Array.from(new Map(
                        sharedTimelines
                          .filter(s => s && s.field_id && s.field_name)
                          .map(s => [s.field_id, s])
                      ).values())
                        .sort((a, b) => (a.field_name || '').localeCompare(b.field_name || ''))
                        .map((share) => (
                          <SelectItem key={share.field_id} value={share.field_id}>
                            {share.field_name} ({share.farm_name || 'Unknown Farm'})
                          </SelectItem>
                        ));
                    } catch (error) {
                      console.error('Error rendering shared field filter:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Shared Tab - Shared Timelines (Scrollable) */}
        {viewMode === 'shared' && (
          <main className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
            {selectedShare ? (
              /* Detail View - Only show when selectedShare is set */
              <div className="space-y-4" key={`share-detail-${selectedShare.id}`}>
                {/* Header with Back Button */}
                <div className="flex items-center gap-3 pb-3 border-b">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedShare(null)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>

                {/* Share Header */}
                <div className="card">
                  <div className="space-y-2">
                    {/* Badge + Title */}
                    <div className="flex items-center gap-2">
                      {selectedShare.share_type === 'document' ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Document</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">Timeline</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold">
                      {selectedShare.share_type === 'document' 
                        ? (selectedShare.document_title || "Shared Document")
                        : `${selectedShare.field_name} ${selectedShare.farm_name ? `(${selectedShare.farm_name})` : ''}`
                      }
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-farm-muted flex-wrap">
                      {selectedShare.share_type === 'document' ? (
                        <>
                          <span>{selectedShare.document_type}</span>
                          <span>•</span>
                        </>
                      ) : (
                        <>
                          <span>Year: {selectedShare.year}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{selectedShare.communication_method === 'sms' ? '📱 SMS' : '✉️ Email'}</span>
                      <span>•</span>
                      <span>Shared {new Date(selectedShare.shared_at || selectedShare.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-farm-muted">Recipients:</span>{' '}
                      <span className="font-medium">
                        {Array.isArray(selectedShare.recipient_names) 
                          ? selectedShare.recipient_names.join(', ') 
                          : selectedShare.recipient_names}
                      </span>
                    </div>
                    {selectedShare.view_count > 0 && (
                      <div className="text-xs text-farm-muted">
                        👁️ Viewed {selectedShare.view_count} time{selectedShare.view_count !== 1 ? 's' : ''}
                        {selectedShare.last_viewed_at && (
                          <> • Last viewed {new Date(selectedShare.last_viewed_at).toLocaleDateString()}</>
                        )}
                      </div>
                    )}
                    {/* View Document button for document shares */}
                    {selectedShare.share_type === 'document' && selectedShare.document_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/documents/${selectedShare.document_id}`)}
                        className="mt-2"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Document
                      </Button>
                    )}
                  </div>
                </div>

                {/* Email Subject (if email) */}
                {selectedShare.communication_method === 'email' && selectedShare.message_subject && (
                  <div className="card">
                    <h3 className="font-semibold mb-2 text-sm text-farm-muted">Subject</h3>
                    <p className="font-medium">{selectedShare.message_subject}</p>
                  </div>
                )}

                {/* Message Content - Contains full summary already */}
                <div className="card">
                  <h3 className="font-semibold mb-2 text-sm text-farm-muted">Message</h3>
                  <div className="text-sm text-farm-text leading-snug
                    [&_strong]:text-farm-accent [&_strong]:font-semibold
                    [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {selectedShare.message_body}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ) : !selectedShare && (
              /* List View or Loading/Empty - Only show when selectedShare is null */
              <>
                {loadingShared ? (
                  /* Loading State */
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-farm-muted">Loading shared timelines...</p>
                    </div>
                  </div>
                ) : sharedTimelines.length > 0 ? (
                  /* List View */
                  <div className="space-y-3">
                {sharedTimelines
                  .filter(share => {
                    // For document shares, filter by field if document has one
                    if (share.share_type === 'document') {
                      if (filterField !== "all" && share.field_name && share.field_id !== filterField) return false;
                      return true;
                    }
                    // For timeline shares, filter by year and field
                    if (filterYear !== "all" && share.year !== parseInt(filterYear)) return false;
                    if (filterField !== "all" && share.field_id !== filterField) return false;
                    return true;
                  })
                  .map((share) => (
                  <div
                    key={share.id}
                    className="card-interactive relative group"
                    onClick={() => setSelectedShare(share)}
                  >
                    {/* Three-dot menu - Top Right */}
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-3 right-3 z-50 h-8 w-8 flex items-center justify-center rounded-md hover:bg-farm-accent/20 focus:outline-none focus:ring-2 focus:ring-farm-accent"
                        >
                          <MoreVertical className="h-4 w-4 text-farm-muted" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[9999]">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShare(share);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Share Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleEditTitle(share, 'share');
                          }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Edit Title
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({type: 'share', item: share});
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    
                    <div className="flex items-start justify-between gap-3 pr-12">
                      <div className="flex-1 min-w-0">
                        {/* Title - different for document vs timeline */}
                        <div className="flex items-center gap-2 mb-1">
                          {share.share_type === 'document' ? (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Doc</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">Timeline</span>
                          )}
                          <h3 className="font-semibold text-sm">
                            {share.share_type === 'document' 
                              ? (share.document_title || "Untitled Document")
                              : (share.custom_title || "Untitled Summary")
                            }
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap">
                          {share.share_type === 'timeline' && share.year && (
                            <>
                              <span>Year: {share.year}</span>
                              <span>•</span>
                            </>
                          )}
                          {share.share_type === 'document' && share.document_type && (
                            <>
                              <span>{share.document_type}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{share.communication_method === 'sms' ? '📱 SMS' : '✉️ Email'}</span>
                          <span>•</span>
                          <span>{new Date(share.shared_at || share.created_at).toLocaleDateString()}</span>
                          {share.view_count > 0 && (
                            <>
                              <span>•</span>
                              <span>👁️ {share.view_count}</span>
                            </>
                          )}
                        </div>
                        {share.recipient_names && (
                          <p className="text-sm text-farm-muted mt-2 line-clamp-1">
                            To: {Array.isArray(share.recipient_names) ? share.recipient_names.join(', ') : share.recipient_names}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
                ) : (
                  /* Empty State */
                  <div className="text-center py-12 space-y-4">
                    <div className="icon-brand mx-auto">
                      <FileText className="w-10 h-10 text-white" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="section-heading">No Shared Timelines Yet</h3>
                      <p className="body-text max-w-sm mx-auto">
                        Share timeline summaries with your contacts via SMS or Email.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        )}

      {/* Floating Action Button - Upload (Notes tab only) */}
      {viewMode === 'notes' && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-6 right-6 lg:right-[calc(50%-256px+1.5rem)] w-14 h-14 rounded-full bg-farm-accent text-farm-dark shadow-lg hover:shadow-xl transition-all hover:scale-110 z-20 flex items-center justify-center"
          style={{ boxShadow: "var(--shadow-elevated)" }}
          aria-label="Upload document"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Delete Document Confirmation Dialog */}
      <AlertDialog open={documentToDelete !== null} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Title Modal */}
      <Dialog open={showEditTitleModal} onOpenChange={setShowEditTitleModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Title</DialogTitle>
            <DialogDescription>
              Enter a custom title for this {editItemType === 'summary' ? 'summary' : 'shared item'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Enter title..."
              disabled={savingTitle}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditTitleModal(false)}
              disabled={savingTitle}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTitle}
              disabled={savingTitle || !editedTitle.trim()}
              className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              {savingTitle ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Title"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Summary/Share Confirmation Dialog */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {itemToDelete?.type === 'summary' ? 'Summary' : 'Shared Timeline'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'summary' ? (
                <>
                  Are you sure you want to delete the summary for{" "}
                  <span className="font-semibold">
                    {itemToDelete?.item?.custom_title || "this summary"}
                  </span>?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete this shared timeline? This will remove the share record but the timeline summary will still be available.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Field Name Badge Component
function FieldNameBadge({ fieldId, fields }: { fieldId: string; fields: any[] }) {
  const field = fields.find((f: any) => f.field_id === fieldId);
  
  if (!field || !field.name) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
      📍 {field.name}
    </span>
  );
}

