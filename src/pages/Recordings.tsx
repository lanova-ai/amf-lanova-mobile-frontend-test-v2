import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mic, MoreVertical, Trash2, Plus, Upload, RefreshCw, AlertCircle } from "lucide-react";
import { voiceAPI, fieldsAPI, Field } from "@/lib/api";
import { UploadRecordingModal } from "@/components/UploadRecordingModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface VoiceNote {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  transcript: string | null;
  created_at: string;
  duration_seconds: number | null;
  field_id: string | null;
  field_name: string | null;
  all_field_ids?: string[];  // All fields from multi-field recordings
  all_field_names?: string[]; // All field names from multi-field recordings
  from_field_note?: boolean;
  error_message?: string | null;
  field_plan_creation_status?: string | null;
}

const Recordings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [recordings, setRecordings] = useState<VoiceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  
  // Filter states - initialize from URL params
  const [selectedField, setSelectedField] = useState<string>(searchParams.get('field') || "all");
  const [selectedYear, setSelectedYear] = useState<string>(searchParams.get('year') || "all");
  const [fields, setFields] = useState<Field[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    loadRecordings(true); // Initial load with loading state
    loadFields();
  }, []);
  
  const loadFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const sortedFields = (response.fields || []).sort((a: Field, b: Field) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
    } catch (error) {
      console.error('Failed to load fields:', error);
    }
  };

  // Reload when returning to page (e.g., from voice capture)
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('🔄 Refresh triggered by navigation state');
      loadRecordings(false); // Silent refresh
      // Clear the refresh flag
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Smart polling: Auto-refresh when recordings are processing OR creating field plans
  useEffect(() => {
    // Check if we have any recordings that are currently processing or creating field plans
    const processingRecordings = recordings.filter(recording => 
      recording.status === 'processing' || 
      recording.status === 'uploading' ||
      recording.field_plan_creation_status === 'creating'
    );

    if (processingRecordings.length > 0) {
      console.log(`⏰ Starting auto-polling for ${processingRecordings.length} processing recording(s)`);
      
      // Poll every 10 seconds when recordings are processing
      const interval = setInterval(() => {
        console.log('🔄 Auto-polling: Checking for recording status updates...');
        loadRecordings(false); // Silent refresh without loading state
      }, 10000); // 10 seconds
      
      // Cleanup function
      return () => {
        console.log('⏹️ Stopping auto-polling');
        clearInterval(interval);
      };
    } else {
      console.log('✅ No processing recordings found, auto-polling not needed');
    }
  }, [recordings]);

  const loadRecordings = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await voiceAPI.getVoiceNotes();
      const voiceNotes = response.voice_notes || [];
      setRecordings(voiceNotes);
      
      // Extract available years from recordings
      const years: number[] = [];
      voiceNotes.forEach((recording: VoiceNote) => {
        if (recording.created_at) {
          const year = new Date(recording.created_at).getFullYear();
          if (!isNaN(year) && year > 1900 && year < 2100 && !years.includes(year)) {
            years.push(year);
          }
        }
      });
      setAvailableYears(years.sort((a, b) => b - a)); // Sort descending
    } catch (err: any) {
      console.error("Failed to load recordings:", err);
      setError(err.message || "Failed to load recordings");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
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
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const handleDelete = async (id: string) => {
    try {
      await voiceAPI.deleteVoiceNote(id);
      setRecordings(recordings.filter(r => r.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      setReprocessing(id);
      
      console.log('🔄 Reprocessing voice note...', id);
      
      // Call reprocess API
      await voiceAPI.reprocessVoiceNote(id);
      
      // Update the recording status to processing optimistically
      setRecordings(prev => prev.map(r => 
        r.id === id ? { ...r, status: 'processing' } : r
      ));
      
      // Schedule a refresh to get updated data
      setTimeout(() => {
        loadRecordings(false);
      }, 2000);
      
      console.log('✅ Reprocessing started successfully');
      
    } catch (err: any) {
      console.error("Failed to reprocess recording:", err);
      
      // Parse error message for better UX
      let errorMessage = err.message || "Failed to reprocess recording";
      let errorTitle = "Reprocess Failed";
      
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        errorTitle = "Processing Timeout";
        errorMessage = "The audio file is taking longer than expected to process. This may be due to file length or complexity. Please try again later.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        errorTitle = "Network Error";
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      }
      
      setErrorModal({ title: errorTitle, message: errorMessage });
    } finally {
      setReprocessing(null);
    }
  };

  const handleUploadSuccess = () => {
    // Refresh recordings list after successful upload
    loadRecordings(false);
  };

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="body-text">Loading recordings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center page-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="text-5xl">⚠️</div>
          <div className="space-y-2">
            <h3 className="section-heading">Error Loading Recordings</h3>
            <p className="body-text">{error}</p>
          </div>
          <Button onClick={() => loadRecordings(true)} variant="outline" className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide page-background">
      <div className="min-h-full flex flex-col">
        {/* Filters */}
        <div className="px-4 py-4 border-b bg-farm-dark/95 backdrop-blur sticky top-0 z-10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Year Filter */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedYear === "all" ? "All Years" : selectedYear}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Field Filter - only show fields that have recordings */}
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedField === "all" 
                    ? "All Fields" 
                    : (() => {
                        const field = fields.find(f => f.field_id === selectedField);
                        if (field) return `${field.name} (${field.farm_name || 'Unknown Farm'})`;
                        // Fallback: check all_field_ids for multi-field recordings
                        const recording = recordings.find(r => 
                          r.field_id === selectedField || 
                          (r.all_field_ids && r.all_field_ids.includes(selectedField))
                        );
                        if (recording?.all_field_ids && recording?.all_field_names) {
                          const idx = recording.all_field_ids.indexOf(selectedField);
                          if (idx >= 0 && recording.all_field_names[idx]) {
                            return recording.all_field_names[idx];
                          }
                        }
                        return recording?.field_name || "All Fields";
                      })()
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                {(() => {
                  // Get unique field_ids from recordings (including all_field_ids for multi-field recordings)
                  const fieldIdsWithRecordings = new Set<string>();
                  recordings.forEach(r => {
                    if (r.field_id) fieldIdsWithRecordings.add(r.field_id);
                    // Include all fields from multi-field recordings
                    if (r.all_field_ids && Array.isArray(r.all_field_ids)) {
                      r.all_field_ids.forEach((id: string) => fieldIdsWithRecordings.add(id));
                    }
                  });
                  
                  // Filter fields to only those with recordings, sorted alphabetically
                  return Array.from(fieldIdsWithRecordings)
                    .map(fieldId => {
                      const field = fields.find(f => f.field_id === fieldId);
                      // Find a recording that has this field (in primary or all_field_ids)
                      const recording = recordings.find(r => 
                        r.field_id === fieldId || 
                        (r.all_field_ids && r.all_field_ids.includes(fieldId))
                      );
                      // Get field name from all_field_names if available
                      let fieldName = field?.name;
                      if (!fieldName && recording?.all_field_ids && recording?.all_field_names) {
                        const idx = recording.all_field_ids.indexOf(fieldId);
                        if (idx >= 0 && recording.all_field_names[idx]) {
                          fieldName = recording.all_field_names[idx];
                        }
                      }
                      return {
                        field_id: fieldId as string,
                        name: fieldName || recording?.field_name || 'Unknown Field',
                        farm_name: field?.farm_name || 'Unknown Farm'
                      };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((field) => (
                      <SelectItem key={field.field_id} value={field.field_id}>
                        {field.name} ({field.farm_name})
                      </SelectItem>
                    ));
                })()}
              </SelectContent>
            </Select>
          </div>
          

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="label-text">
              {(() => {
                const filteredCount = recordings.filter(recording => {
                  // Year filter
                  if (selectedYear !== "all") {
                    const recordingYear = new Date(recording.created_at).getFullYear();
                    if (recordingYear !== parseInt(selectedYear)) return false;
                  }
                  // Field filter - check all_field_ids for multi-field recordings
                  if (selectedField !== "all") {
                    const allFieldIds = recording.all_field_ids || [];
                    const hasField = allFieldIds.includes(selectedField) || recording.field_id === selectedField;
                    if (!hasField) return false;
                  }
                  return true;
                }).length;
                return `${filteredCount} ${filteredCount === 1 ? 'recording' : 'recordings'} found`;
              })()}
            </p>
          </div>
        </div>

        {/* Recordings List */}
        <main className="flex-1 px-4 py-4 pb-24">
          {(() => {
            // Filter recordings based on filters
            const filteredRecordings = recordings.filter(recording => {
              // Year filter
              if (selectedYear !== "all") {
                const recordingYear = new Date(recording.created_at).getFullYear();
                if (recordingYear !== parseInt(selectedYear)) return false;
              }
              
              // Field filter - check all_field_ids for multi-field recordings
              if (selectedField !== "all") {
                const allFieldIds = recording.all_field_ids || [];
                const hasField = allFieldIds.includes(selectedField) || recording.field_id === selectedField;
                if (!hasField) return false;
              }
              
              return true;
            });

            if (recordings.length === 0) {
              return (
                <div className="text-center py-12 space-y-4">
                  <div className="icon-brand mx-auto">
                    <Mic className="w-10 h-10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="section-heading">No Recordings Yet</h3>
                    <p className="body-text max-w-sm mx-auto">
                      Start recording voice notes to capture field observations and plans
                    </p>
                  </div>
                  <Button onClick={() => navigate("/voice-capture")} className="mt-4">
                    <Mic className="mr-2 h-4 w-4" />
                    New Recording
                  </Button>
                </div>
              );
            }

            if (filteredRecordings.length === 0) {
              return (
                <div className="text-center py-12 space-y-4">
                  <div className="text-6xl">🔍</div>
                  <div className="space-y-2">
                    <h3 className="section-heading">No recordings found</h3>
                    <p className="body-text max-w-sm mx-auto">
                      Try adjusting your filters
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredRecordings.map((recording) => (
                  <div
                    key={recording.id}
                    onClick={() => navigate(`/recordings/${recording.id}`)}
                    className="card-interactive relative"
                  >
                    {/* Three-dot menu - Top Right */}
                    <div className="absolute top-2 right-2 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 hover:bg-accent/50 rounded transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReprocess(recording.id);
                            }}
                            disabled={reprocessing === recording.id || recording.status === 'processing'}
                          >
                            {reprocessing === recording.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Reprocess
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(recording.id);
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
                  <div className={`w-10 h-10 bg-farm-accent/10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                    recording.status === 'processing' ? 'animate-pulse' : ''
                  }`}>
                    <Mic className="h-5 w-5 text-farm-accent" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate flex-1">
                        {recording.title || "Voice Note"}
                      </h3>
                    </div>
                    
                    {recording.status === 'failed' && recording.error_message && (
                      <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-xs text-destructive font-medium mb-1">Processing Failed</p>
                        <p className="text-xs text-destructive/80">{recording.error_message}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap mb-1">
                      {recording.field_name && (
                        <>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            recording.from_field_note 
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' 
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {recording.from_field_note ? '🗺️' : '📍'} {recording.field_name}
                            {recording.from_field_note && (
                              <span className="text-[10px] opacity-75 ml-0.5">(Map)</span>
                            )}
                            {/* Show count of additional fields - use all_field_names as it includes unmatched fields too */}
                            {recording.all_field_names && recording.all_field_names.length > 1 && (
                              <span className="text-[10px] opacity-75 ml-0.5">
                                (+{recording.all_field_names.length - 1} {recording.all_field_names.length === 2 ? 'field' : 'fields'})
                              </span>
                            )}
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>{formatDate(recording.created_at)}</span>
                      {recording.duration_seconds && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(recording.duration_seconds)}</span>
                        </>
                      )}
                      {recording.status === 'processing' && (
                        <>
                          <span>•</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full animate-pulse">
                            Processing...
                          </span>
                        </>
                      )}
                      {recording.field_plan_creation_status === 'creating' && (
                        <>
                          <span>•</span>
                          <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full animate-pulse">
                            Creating Field Plans...
                          </span>
                        </>
                      )}
                      {recording.field_plan_creation_status === 'completed' && (
                        <>
                          <span>•</span>
                          <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                            Field Plans ✓
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
                </div>
              );
            })()}
          </main>
        </div>

        {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The recording and transcript will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle>{errorModal?.title}</DialogTitle>
            </div>
            <DialogDescription className="text-left pl-13">
              {errorModal?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setErrorModal(null)} className="w-full">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Recording Modal */}
      <UploadRecordingModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Floating Action Button */}
      <Popover open={fabMenuOpen} onOpenChange={setFabMenuOpen}>
        <PopoverTrigger asChild>
          <button
            className="fixed bottom-6 right-6 lg:right-[calc(50%-256px+1.5rem)] w-14 h-14 rounded-full bg-farm-accent text-farm-dark shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-50"
            aria-label="Add recording"
          >
            <Plus className="w-6 h-6" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="end" 
          className="w-48 p-2 mb-2 bg-farm-card border border-farm-accent/20"
        >
          <div className="space-y-1">
            <button
              onClick={() => {
                setFabMenuOpen(false);
                navigate("/voice-capture");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-farm-accent/10 transition-colors text-left"
            >
              <Mic className="h-5 w-5 text-farm-accent" />
              <span className="text-sm font-medium text-farm-text">Record</span>
            </button>
            <button
              onClick={() => {
                setFabMenuOpen(false);
                setUploadModalOpen(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-farm-accent/10 transition-colors text-left"
            >
              <Upload className="h-5 w-5 text-farm-accent" />
              <span className="text-sm font-medium text-farm-text">Upload</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default Recordings;

