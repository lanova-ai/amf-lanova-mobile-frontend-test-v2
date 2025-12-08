import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { scoutingNotesAPI, fieldsAPI, shareScoutingSummariesAPI, type ScoutingNote, type Field } from "@/lib/api";
import { ScoutingNoteCard } from "@/components/scouting/ScoutingNoteCard";
import { ScoutingSummaryCard } from "@/components/scouting/ScoutingSummaryCard";
import { Plus, MapPin, FileText, MoreVertical, Eye, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  Page,
  PageContent,
  PageLoading,
  EmptyState,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  LoadingSpinner,
} from "@/components/ui";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ScoutingNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notes, setNotes] = useState<ScoutingNote[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View mode: notes | summary | shared
  const [viewMode, setViewMode] = useState<'notes' | 'summary' | 'shared'>('notes');
  
  // Filters for Notes tab - initialize from URL params
  const [filterField, setFilterField] = useState<string>(searchParams.get('field') || "all");
  const [filterYear, setFilterYear] = useState<string>(searchParams.get('year') || "all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // Summary-specific state
  const [summaries, setSummaries] = useState<ScoutingNote[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summariesLoaded, setSummariesLoaded] = useState(false);
  
  // Shared timelines state
  const [sharedSummaries, setSharedSummaries] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [sharedLoaded, setSharedLoaded] = useState(false);
  const [selectedShare, setSelectedShare] = useState<any | null>(null);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [shareToDelete, setShareToDelete] = useState<any | null>(null);

  // Handle ?tab=shared query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'shared') {
      setViewMode('shared');
      // Clear the query parameter after reading it
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Load data on mount
  useEffect(() => {
    console.log('🔄 Loading scouting notes data');
    loadData();
  }, []); // Run only once on mount
  
  // Track note being processed for AI
  const [processingNoteId, setProcessingNoteId] = useState<string | null>(null);
  const processingPollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle navigation from create page
  useEffect(() => {
    if (location.state?.newNoteId) {
      const noteId = location.state.newNoteId;
      const isProcessing = location.state.processing;
      
      console.log('🔄 Detected new note from create page', { noteId, isProcessing });
      
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
      
      // Reload data in background, then apply optimistic update
      loadData(false).then(() => {
        // If AI processing was requested, start polling for status
        if (isProcessing) {
          setProcessingNoteId(noteId);
          
          // ✅ OPTIMISTICALLY show "Analyzing" status immediately AFTER data loads
          // (So it doesn't get overwritten by stale server data)
          setNotes(prevNotes => 
            prevNotes.map(note => 
              note.id === noteId 
                ? { ...note, ai_status: 'processing' as const }
                : note
            )
          );
          
          // Poll for AI status (no toast - the "Analyzing" badge on the card is enough)
          let consecutiveErrors = 0;
          const pollForAIStatus = async () => {
            try {
              const updatedNote = await scoutingNotesAPI.getScoutingNote(noteId);
              consecutiveErrors = 0; // Reset error count on success
              
              // Update the note in the list
              setNotes(prevNotes => 
                prevNotes.map(note => 
                  note.id === noteId ? updatedNote : note
                )
              );
              
              // Check if processing is complete
              if (updatedNote.ai_status === 'completed') {
                toast.success("AI analysis completed!", { duration: 3000 });
                setProcessingNoteId(null);
                if (processingPollRef.current) {
                  clearInterval(processingPollRef.current);
                  processingPollRef.current = null;
                }
              } else if (updatedNote.ai_status === 'failed') {
                toast.error("AI analysis failed", { duration: 4000 });
                setProcessingNoteId(null);
                if (processingPollRef.current) {
                  clearInterval(processingPollRef.current);
                  processingPollRef.current = null;
                }
              }
              // Continue polling if still 'processing' or 'pending'
            } catch (error) {
              consecutiveErrors++;
              console.warn(`AI status check failed (attempt ${consecutiveErrors}):`, error);
              // Only stop polling after 5 consecutive errors
              if (consecutiveErrors >= 5) {
                console.error("Too many consecutive errors, stopping AI status polling");
                setProcessingNoteId(null);
                if (processingPollRef.current) {
                  clearInterval(processingPollRef.current);
                  processingPollRef.current = null;
                }
              }
              // Otherwise continue polling - transient errors are expected
            }
          };
          
          // Initial check after 1.5 seconds (reduced from 3s for faster feedback)
          setTimeout(() => {
            pollForAIStatus();
            // Then poll every 3 seconds
            processingPollRef.current = setInterval(pollForAIStatus, 3000);
          }, 1500);
          
          // Stop polling after 2 minutes max
          setTimeout(() => {
            if (processingPollRef.current) {
              clearInterval(processingPollRef.current);
              processingPollRef.current = null;
              setProcessingNoteId(null);
            }
          }, 120000);
        }
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (processingPollRef.current) {
        clearInterval(processingPollRef.current);
      }
    };
  }, [location.state?.newNoteId]);

  useEffect(() => {
    if (viewMode === 'summary') {
      // Only show spinner on first load
      if (!summariesLoaded) {
        loadSummaries(true);
        setSummariesLoaded(true);
      } else {
        // Refresh data in background without spinner
        loadSummaries(false);
      }
    }
    if (viewMode === 'shared') {
      // Only show spinner on first load
      if (!sharedLoaded) {
        loadSharedSummaries(true);
        setSharedLoaded(true);
      } else {
        // Refresh data in background without spinner
        loadSharedSummaries(false);
      }
    }
  }, [viewMode]);

  // Reset selected share when switching tabs
  useEffect(() => {
    if (viewMode !== 'shared') {
      setSelectedShare(null);
    }
  }, [viewMode]);

  const loadData = async (showLoadingSpinner = true) => {
    try {
      // Only show loading spinner if explicitly requested (initial load)
      if (showLoadingSpinner) {
        setLoading(true);
      }
      
      const [notesData, fieldsData] = await Promise.all([
        scoutingNotesAPI.listScoutingNotes({ limit: 500 }),
        fieldsAPI.getFields().catch(() => ({ fields: [] })),
      ]);

      setNotes(notesData.notes);
      // Sort fields alphabetically by name
      const sortedFields = (fieldsData.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
      
      // Extract available years from scouting_date
      const years = new Set<number>();
      notesData.notes.forEach((note: ScoutingNote) => {
        const year = new Date(note.scouting_date).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => b - a));
    } catch (error: any) {
      console.error("Failed to load scouting notes:", error);
      toast.error("Failed to load scouting notes: " + (error.message || "Unknown error"));
    } finally {
      // Always turn off loading spinner
      setLoading(false);
    }
  };

  const loadSummaries = async (showSpinner = true) => {
    try {
      // Only show spinner if explicitly requested (first load)
      if (showSpinner) {
        setSummariesLoading(true);
      }
      
      const data = await scoutingNotesAPI.listScoutingNotes({ 
        ai_status: 'completed',
        limit: 500 
      });
      setSummaries(data.notes);
      
      // Update available years from summaries
      const years = new Set(availableYears);
      data.notes.forEach((note: ScoutingNote) => {
        const year = new Date(note.scouting_date).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => b - a));
    } catch (error: any) {
      console.error("Failed to load summaries:", error);
      toast.error("Failed to load summaries: " + (error.message || "Unknown error"));
    } finally {
      // Always turn off spinner
      setSummariesLoading(false);
    }
  };

  const loadSharedSummaries = async (showSpinner = true) => {
    try {
      // Only show spinner if explicitly requested (first load)
      if (showSpinner) {
        setLoadingShared(true);
      }
      
      const response = await shareScoutingSummariesAPI.getShareHistory();
      setSharedSummaries(response.shares || []);
      
      // Update available years from shared summaries
      const years = new Set(availableYears);
      (response.shares || []).forEach((share: any) => {
        const year = new Date(share.scouting_date).getFullYear();
        if (!isNaN(year)) {
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => b - a));
    } catch (error) {
      console.error("Failed to load shared summaries:", error);
      // Don't show error toast - just means no shares exist yet
    } finally {
      setLoadingShared(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      await shareScoutingSummariesAPI.deleteShare(shareId);
      toast.success("Share deleted successfully");
      setShareToDelete(null);
      setSelectedShare(null);
      await loadSharedSummaries();
    } catch (error) {
      console.error("Failed to delete share:", error);
      toast.error("Failed to delete share");
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    if (filterField !== "all" && note.field_id !== filterField) return false;
    if (filterYear !== "all") {
      const noteYear = new Date(note.scouting_date).getFullYear().toString();
      if (noteYear !== filterYear) return false;
    }
    return true;
  });

  // Sort by date (newest first)
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    return new Date(b.scouting_date).getTime() - new Date(a.scouting_date).getTime();
  });

  // Filter summaries
  const filteredSummaries = summaries.filter((note) => {
    if (filterField !== "all" && note.field_id !== filterField) return false;
    if (filterYear !== "all") {
      const noteYear = new Date(note.scouting_date).getFullYear().toString();
      if (noteYear !== filterYear) return false;
    }
    return true;
  });

  // Sort summaries by date (newest first)
  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
    return new Date(b.scouting_date).getTime() - new Date(a.scouting_date).getTime();
  });

  // Filter shared summaries
  const filteredSharedSummaries = sharedSummaries.filter((share) => {
    if (filterField !== "all" && share.field_id !== filterField) return false;
    if (filterYear !== "all") {
      const shareYear = new Date(share.scouting_date).getFullYear().toString();
      if (shareYear !== filterYear) return false;
    }
    return true;
  });

  // Sort shared summaries by shared date (newest first)
  const sortedSharedSummaries = [...filteredSharedSummaries].sort((a, b) => {
    return new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime();
  });

  const handleNoteClick = (noteId: string) => {
    navigate(`/scouting-notes/${noteId}`);
  };

  const handleSummaryClick = (noteId: string) => {
    navigate(`/scouting-notes/summary/${noteId}`);
  };

  const handleEditSummary = (noteId: string) => {
    navigate(`/scouting-notes/summary/${noteId}`);
  };

  const handleCreateNew = () => {
    navigate("/scouting-notes/create");
  };

  const handleReprocess = async (noteId: string) => {
    let toastId: string | number | undefined;
    let pollInterval: NodeJS.Timeout | undefined;
    
    try {
      // Update local state to show processing status immediately
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === noteId 
            ? { ...note, ai_status: 'processing' as const }
            : note
        )
      );
      
      await scoutingNotesAPI.triggerAIAnalysis(noteId, true);
      
      // Show single loading toast that will transition
      toastId = toast.loading("Reprocessing with AI...");
      
      // Poll for status updates silently (no additional toasts)
      pollInterval = setInterval(async () => {
        try {
          const updatedNote = await scoutingNotesAPI.getScoutingNote(noteId);
          
          // Update state silently
          setNotes(prevNotes => 
            prevNotes.map(note => 
              note.id === noteId ? updatedNote : note
            )
          );
          
          // Stop polling when processing is complete
          if (updatedNote.ai_status !== 'processing') {
            if (pollInterval) clearInterval(pollInterval);
            
            // Update the single toast based on final status
            if (updatedNote.ai_status === 'completed') {
              toast.success("Analysis completed", { id: toastId });
            } else if (updatedNote.ai_status === 'failed') {
              toast.error("Analysis failed", { id: toastId });
            } else {
              // Dismiss toast for other statuses
              toast.dismiss(toastId);
            }
          }
        } catch (error) {
          console.error("Failed to check status:", error);
          if (pollInterval) clearInterval(pollInterval);
          toast.error("Failed to check processing status", { id: toastId });
        }
      }, 3000); // Check every 3 seconds (less aggressive)
      
      // Stop polling after 2 minutes max
      setTimeout(() => {
        if (pollInterval) clearInterval(pollInterval);
        
        // Check if still processing
        const currentNote = notes.find(n => n.id === noteId);
        if (currentNote?.ai_status === 'processing') {
          toast.error("Processing is taking longer than expected. Check back later.", { id: toastId });
        }
      }, 120000);
      
    } catch (error: any) {
      console.error("Failed to reprocess note:", error);
      
      // Clean up polling
      if (pollInterval) clearInterval(pollInterval);
      
      // Show error toast (reuse same toast ID if available)
      if (toastId) {
        toast.error(error.message || "Failed to start reprocessing", { id: toastId });
      } else {
        toast.error(error.message || "Failed to start reprocessing");
      }
      
      // Silently reload the note to show correct status
      try {
        const updatedNote = await scoutingNotesAPI.getScoutingNote(noteId);
        setNotes(prevNotes => 
          prevNotes.map(note => 
            note.id === noteId ? updatedNote : note
          )
        );
      } catch (reloadError) {
        console.error("Failed to reload note:", reloadError);
      }
    }
  };

  const handleDelete = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteSummary = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;
    
    try {
      if (viewMode === 'summary') {
        // Clear AI summary via API (preserves note, voice, photos)
        await scoutingNotesAPI.clearAISummary(noteToDelete);
        toast.success("AI summary cleared. You can regenerate it by reprocessing.");
        // Remove from summaries list
        setSummaries(prev => prev.filter(n => n.id !== noteToDelete));
      } else {
        // Delete entire note
        await scoutingNotesAPI.deleteScoutingNote(noteToDelete);
        toast.success("Scouting note deleted");
        // Remove from notes list
        setNotes(prev => prev.filter(n => n.id !== noteToDelete));
      }
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error: any) {
      console.error("Failed to delete:", error);
      toast.error(error.message || "Failed to delete");
    }
  };

  return (
    <Page>
      <PageContent noPadding>
        {/* Pills / Tabs */}
        <div className="px-4 py-4 border-b border-farm-accent/20 bg-farm-dark/95 backdrop-blur sticky top-0 z-20">
          <div className="inline-flex items-center justify-center w-full bg-farm-card border border-farm-accent/20 p-1 rounded-full">
            <button
              onClick={() => setViewMode('notes')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'notes'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'summary'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Summary
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

        {/* Filters - Show only when there's content to filter */}
        {(availableYears.length > 0 || fields.length > 0 || summaries.length > 0 || sharedSummaries.length > 0) && (
          <div className="px-4 py-4 border-b border-farm-accent/20 bg-farm-dark/95 backdrop-blur sticky top-[60px] z-10 space-y-3">
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
                      let years: number[] = [];
                      
                      if (viewMode === 'notes' && Array.isArray(notes)) {
                        years = Array.from(new Set(
                          notes
                            .filter(n => n && n.scouting_date)
                            .map(n => {
                              try {
                                const year = new Date(n.scouting_date).getFullYear();
                                return !isNaN(year) && year > 1900 && year < 2100 ? year : null;
                              } catch {
                                return null;
                              }
                            })
                            .filter((y): y is number => y !== null)
                        ));
                      } else if (viewMode === 'summary' && Array.isArray(summaries)) {
                        years = Array.from(new Set(
                          summaries
                            .filter(s => s && s.scouting_date)
                            .map(s => {
                              try {
                                const year = new Date(s.scouting_date).getFullYear();
                                return !isNaN(year) && year > 1900 && year < 2100 ? year : null;
                              } catch {
                                return null;
                              }
                            })
                            .filter((y): y is number => y !== null)
                        ));
                      } else if (viewMode === 'shared' && Array.isArray(sharedSummaries)) {
                        years = Array.from(new Set(
                          sharedSummaries
                            .filter(s => s && typeof s.year === 'number' && !isNaN(s.year))
                            .map(s => s.year)
                        ));
                      }
                      
                      return years.sort((a, b) => b - a).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ));
                    } catch (error) {
                      console.error('Error rendering year filter:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>

              {/* Field Filter */}
              <Select value={filterField} onValueChange={setFilterField}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(() => {
                      try {
                        if (filterField === "all") return "All Fields";
                        
                        if (viewMode === 'notes' && Array.isArray(fields)) {
                          const field = fields.find(f => f && f.field_id === filterField);
                          return field && field.name ? `${field.name} (${field.farm_name || 'Unknown Farm'})` : "All Fields";
                        } else if (viewMode === 'summary' && Array.isArray(summaries)) {
                          const summary = summaries.find(s => s && s.field_id === filterField);
                          return summary ? `${summary.field_name || 'Unknown'} (${summary.farm_name || 'Unknown Farm'})` : "All Fields";
                        } else if (viewMode === 'shared' && Array.isArray(sharedSummaries)) {
                          const share = sharedSummaries.find(s => s && s.field_id === filterField);
                          return share ? `${share.field_name || 'Unknown'} (${share.farm_name || 'Unknown Farm'})` : "All Fields";
                        }
                        return "All Fields";
                      } catch (error) {
                        console.error('Error rendering field filter value:', error);
                        return "All Fields";
                      }
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  {(() => {
                    try {
                      if (viewMode === 'notes' && Array.isArray(notes) && Array.isArray(fields)) {
                        const fieldsWithNotes = Array.from(new Map(
                          notes
                            .filter(n => n && n.field_id)
                            .map(n => {
                              const field = fields.find(f => f && f.field_id === n.field_id);
                              return field && field.name ? [n.field_id, { 
                                field_id: n.field_id, 
                                name: field.name, 
                                farm_name: field.farm_name 
                              }] : null;
                            })
                            .filter((item): item is [string, any] => item !== null)
                        ).values());
                        
                        return fieldsWithNotes
                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                          .map((field) => (
                            <SelectItem key={field.field_id} value={field.field_id}>
                              {field.name} {field.farm_name && `(${field.farm_name})`}
                            </SelectItem>
                          ));
                      } else if (viewMode === 'summary' && Array.isArray(summaries)) {
                        return Array.from(new Map(
                          summaries
                            .filter(s => s && s.field_id)
                            .map(s => [s.field_id, s])
                        ).values())
                          .sort((a, b) => (a.field_name || '').localeCompare(b.field_name || ''))
                          .map((summary) => (
                            <SelectItem key={summary.field_id || summary.id} value={summary.field_id || ''}>
                              {summary.field_name || 'Unknown'} ({summary.farm_name || 'Unknown Farm'})
                            </SelectItem>
                          ));
                      } else if (viewMode === 'shared' && Array.isArray(sharedSummaries)) {
                        return Array.from(new Map(
                          sharedSummaries
                            .filter(s => s && s.field_id)
                            .map(s => [s.field_id, s])
                        ).values())
                          .sort((a, b) => (a.field_name || '').localeCompare(b.field_name || ''))
                          .map((share) => (
                            <SelectItem key={share.field_id || share.id} value={share.field_id || ''}>
                              {share.field_name || 'Unknown'} ({share.farm_name || 'Unknown Farm'})
                            </SelectItem>
                          ));
                      }
                      return null;
                    } catch (error) {
                      console.error('Error rendering field filter options:', error);
                      return null;
                    }
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-4 pb-24">
          {viewMode === 'notes' && (
            <>
              {loading && notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" className="mb-2" />
                  <p className="text-sm text-farm-muted">Loading scouting notes...</p>
                </div>
              ) : sortedNotes.length === 0 ? (
                <Card className="p-8 text-center">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-farm-muted" />
                  <h3 className="font-semibold text-lg mb-2">
                    {notes.length === 0 ? "No Scouting Notes Yet" : "No Notes Match Filters"}
                  </h3>
                  <p className="text-sm text-farm-muted mb-4">
                    {notes.length === 0
                      ? "Start scouting your fields by creating your first note"
                      : "Try adjusting your filters to see more notes"}
                  </p>
                  {notes.length === 0 && (
                    <Button onClick={handleCreateNew}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Note
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="space-y-3">
                  {sortedNotes.map((note) => (
                    <ScoutingNoteCard
                      key={note.id}
                      note={note}
                      onClick={() => handleNoteClick(note.id)}
                      onReprocess={handleReprocess}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === 'summary' && (
            <>
              {summariesLoading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" className="mb-2" />
                  <p className="text-sm text-farm-muted">Loading summaries...</p>
                </div>
              ) : sortedSummaries.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-farm-muted" />
                  <h3 className="font-semibold text-lg mb-2">
                    {summaries.length === 0 ? "No Summaries Yet" : "No Summaries Match Filters"}
                  </h3>
                  <p className="text-sm text-farm-muted mb-4">
                    {summaries.length === 0
                      ? "Summaries are generated after processing scouting notes with AI"
                      : "Try adjusting your filters to see more summaries"}
                  </p>
                  <Button onClick={() => setViewMode('notes')} variant="outline">
                    <MapPin className="w-4 h-4 mr-2" />
                    View Scouting Notes
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sortedSummaries.map((note) => (
                    <ScoutingSummaryCard
                      key={note.id}
                      note={note}
                      onClick={() => handleSummaryClick(note.id)}
                      onEdit={handleEditSummary}
                      onDelete={handleDeleteSummary}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {viewMode === 'shared' && (
            <>
              {selectedShare ? (
                /* Detail View */
                <div className="space-y-4">
                  {/* Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedShare(null)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                  </Button>

                  {/* Share Header */}
                  <Card className="p-4">
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold">
                        {selectedShare.field_name} {selectedShare.farm_name && `(${selectedShare.farm_name})`}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-farm-muted flex-wrap">
                        <span>{new Date(selectedShare.scouting_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{selectedShare.communication_method === 'sms' ? '📱 SMS' : '✉️ Email'}</span>
                        <span>•</span>
                        <span>Shared {new Date(selectedShare.shared_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-farm-muted">Recipients:</span>{' '}
                        <span className="font-medium">{selectedShare.recipient_names}</span>
                      </div>
                      {selectedShare.view_count > 0 && (
                        <div className="text-xs text-farm-muted">
                          👁️ Viewed {selectedShare.view_count} time{selectedShare.view_count !== 1 ? 's' : ''}
                          {selectedShare.last_viewed_at && (
                            <> • Last viewed {new Date(selectedShare.last_viewed_at).toLocaleDateString()}</>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Email Subject (if email) */}
                  {selectedShare.communication_method === 'email' && selectedShare.message_subject && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-2 text-sm text-farm-muted">Subject</h3>
                      <p className="font-medium">{selectedShare.message_subject}</p>
                    </Card>
                  )}

                  {/* Message Content */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2 text-sm text-farm-muted">Message</h3>
                    <div className="body-text prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {selectedShare.message_body}
                      </ReactMarkdown>
                    </div>
                  </Card>
                </div>
              ) : loadingShared ? (
                /* Loading State */
                <div className="flex flex-col items-center justify-center h-full">
                  <LoadingSpinner size="lg" className="mb-2" />
                  <p className="text-sm text-farm-muted">Loading shared summaries...</p>
                </div>
              ) : sortedSharedSummaries.length > 0 ? (
                /* List View */
                <div className="space-y-3">
                  {sortedSharedSummaries.map((share) => (
                    <div
                      key={share.id}
                      className="card-interactive relative"
                      onClick={() => setSelectedShare(share)}
                    >
                      {/* Three-dot menu - Top Right */}
                      <div className="absolute top-2 right-2 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-0.5 hover:bg-accent/50 rounded transition-colors">
                              <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setSelectedShare(share);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShareToDelete(share);
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
                          <h3 className="font-semibold text-sm mb-1">
                            {share.field_name} {share.farm_name && `(${share.farm_name})`}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap">
                            <span>{new Date(share.scouting_date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{share.communication_method === 'sms' ? '📱 SMS' : '✉️ Email'}</span>
                            <span>•</span>
                            <span>{new Date(share.shared_at).toLocaleDateString()}</span>
                            {share.view_count > 0 && (
                              <>
                                <span>•</span>
                                <span>👁️ {share.view_count}</span>
                              </>
                            )}
                          </div>
                          {share.recipient_names && (
                            <p className="text-sm text-farm-muted mt-2 line-clamp-1">
                              To: {share.recipient_names}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sharedSummaries.length > 0 ? (
                /* Empty State - has data but filtered out */
                <Card className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-farm-muted" />
                  <h3 className="font-semibold text-lg mb-2">No Shared Summaries Match Filters</h3>
                  <p className="text-sm text-farm-muted mb-4">
                    Try adjusting your filters to see more shared summaries.
                  </p>
                </Card>
              ) : (
                /* Empty State */
                <Card className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-farm-muted" />
                  <h3 className="font-semibold text-lg mb-2">No Shared Summaries Yet</h3>
                  <p className="text-sm text-farm-muted mb-4">
                    Share scouting summaries with your contacts via SMS or Email.
                  </p>
                  <Button onClick={() => setViewMode('summary')} variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    View Summaries
                  </Button>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Floating Action Button - Only show in Notes tab */}
        {viewMode === 'notes' && notes.length > 0 && (
          <button
            onClick={handleCreateNew}
            className="fixed bottom-6 right-6 lg:right-[calc(50%-256px+1.5rem)] w-14 h-14 rounded-full bg-farm-accent text-farm-dark shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-50"
            aria-label="Create new scouting note"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {viewMode === 'summary' ? 'Clear AI Summary?' : 'Delete Scouting Note?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {viewMode === 'summary' 
                ? 'This will clear the AI-generated summary, issues, and recommendations. The original scouting note, voice recordings, and photos will be preserved. You can regenerate the summary by reprocessing.'
                : 'This will permanently delete the scouting note including any voice recordings and photos.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {viewMode === 'summary' ? 'Clear Summary' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Share Confirmation Dialog */}
      <AlertDialog open={!!shareToDelete} onOpenChange={(open) => !open && setShareToDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shared Summary?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this share record. The original scouting note will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShareToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (shareToDelete) {
                  handleDeleteShare(shareToDelete.id);
                  setShareToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

