import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Play, Pause, Pencil, Check, X } from "lucide-react";
import { voiceAPI, fieldsAPI } from "@/lib/api";

interface VoiceNoteDetail {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  transcript: string | null;
  file_url: string | null;
  created_at: string;
  recorded_at: string | null;
  updated_at: string | null;
  duration_seconds: number | null;
  structured_insight: any;
  field_plan_creation_status?: string | null;
}

const RecordingDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [recording, setRecording] = useState<VoiceNoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  
  // Creation status for tasks, field plans, and field notes
  const [creationStatus, setCreationStatus] = useState<{
    tasks: 'idle' | 'creating' | 'success' | 'error';
    fieldPlan: 'idle' | 'creating' | 'success' | 'error';
    fieldNotes: 'idle' | 'creating' | 'success' | 'error';
  }>({ tasks: 'idle', fieldPlan: 'idle', fieldNotes: 'idle' });
  
  const [showTasksResult, setShowTasksResult] = useState(false);
  const [tasksResult, setTasksResult] = useState<any>(null);
  
  const [showFieldPlanResult, setShowFieldPlanResult] = useState(false);
  const [fieldPlanResult, setFieldPlanResult] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadRecording(true); // Initial load with loading state
      loadAvailableFields(); // Load user's fields for dropdown
    }
  }, [id]);


  // Smart polling: Auto-refresh when recording is processing OR field plan is being created
  useEffect(() => {
    if (recording && (recording.status === 'processing' || recording.status === 'uploading' || recording.field_plan_creation_status === 'creating')) {
      const reason = recording.field_plan_creation_status === 'creating' ? 'creating field plan' : recording.status;
      console.log(`⏰ Recording is ${reason}, starting auto-polling...`);
      
      // Poll every 5 seconds when creating field plan, 10 seconds for processing
      const pollInterval = recording.field_plan_creation_status === 'creating' ? 5000 : 10000;
      
      const interval = setInterval(() => {
        console.log(`🔄 Auto-polling: Checking status (${reason})...`);
        loadRecording(false); // Silent refresh without loading state
      }, pollInterval);
      
      // Cleanup function
      return () => {
        console.log('⏹️ Stopping auto-polling');
        clearInterval(interval);
      };
    }
  }, [recording?.status, recording?.field_plan_creation_status]);

  // Update UI state based on field_plan_creation_status from API
  useEffect(() => {
    if (recording?.field_plan_creation_status) {
      const status = recording.field_plan_creation_status;
      console.log(`📊 Field plan creation status from API: ${status}`);
      
      if (status === 'creating') {
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'creating' }));
        setIsSaving(true);
      } else if (status === 'completed') {
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'success' }));
        setIsSaving(false);
      } else if (status === 'failed') {
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'error' }));
        setIsSaving(false);
      }
    }
  }, [recording?.field_plan_creation_status]);

  const loadRecording = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      
      // Get voice note details
      const details = await voiceAPI.getVoiceNoteStatus(id!);
      console.log('📊 Voice note details:', details);
      console.log('📊 Has structured_insight:', !!details.structured_insight);
      setRecording(details);
      
      // Get signed audio URL if available (only on initial load to avoid re-fetching)
      if (details.file_url && showLoading) {
        try {
          const audioData = await voiceAPI.getAudioUrl(id!);
          setAudioUrl(audioData.audio_url || details.file_url);
        } catch (err) {
          console.warn("Failed to get signed URL, using direct URL:", err);
          setAudioUrl(details.file_url);
        }
      }
    } catch (err: any) {
      console.error("Failed to load recording:", err);
      setError(err.message || "Failed to load recording");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Audio controls
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };


  const handleEditTranscript = () => {
    setEditedTranscript(recording?.transcript || "");
    setIsEditingTranscript(true);
  };

  const handleSaveTranscript = async () => {
    try {
      setIsSaving(true);
      await voiceAPI.updateTranscript(id!, editedTranscript);
      setRecording({ ...recording!, transcript: editedTranscript });
      setIsEditingTranscript(false);
    } catch (err: any) {
      console.error("Failed to save transcript:", err);
      alert("Failed to save transcript");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingTranscript(false);
    setEditedTranscript("");
  };

  const loadAvailableFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const sortedFields = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setAvailableFields(sortedFields);
    } catch (err) {
      console.error("Failed to load fields:", err);
    }
  };


  const handleEditFieldMapping = (index: number, currentFieldId: string) => {
    setEditingFieldIndex(index);
    setSelectedFieldId(currentFieldId || "");
  };

  const handleSaveFieldMapping = async (index: number) => {
    try {
      setIsSaving(true);
      const selectedField = availableFields.find(f => f.field_id === selectedFieldId);
      if (!selectedField) return;

      // Use the current field_name from the insight (which may have been corrected before)
      const currentFieldName = recording!.structured_insight.field_insights[index].field_name;
      
      console.log("🔧 Updating field mapping:", {
        voiceNoteId: id,
        currentFieldName,
        newFieldName: selectedField.name,
        newFieldId: selectedField.field_id
      });

      await voiceAPI.updateFieldMapping(id!, currentFieldName, {
        field_name: selectedField.name,
        field_id: selectedField.field_id,
        confidence_override: 1.0
      });

      // Reload from backend to ensure we have the latest state
      await loadRecording(false);
      setEditingFieldIndex(null);
    } catch (err: any) {
      console.error("Failed to update field mapping:", err);
      alert("Failed to update field mapping");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelFieldEdit = () => {
    setEditingFieldIndex(null);
    setSelectedFieldId("");
  };

  const handleEditTitle = () => {
    setEditedTitle(recording?.title || "");
    setIsEditingTitle(true);
  };

  const handleSaveTitle = async () => {
    try {
      setIsSaving(true);
      await voiceAPI.updateTitle(id!, editedTitle);
      await loadRecording(false);
      setIsEditingTitle(false);
    } catch (err: any) {
      console.error("Failed to update title:", err);
      alert(err.message || "Failed to update title");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTitleEdit = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const handleStartReview = async () => {
    try {
      setIsSaving(true);
      await voiceAPI.startReview(id!);
      await loadRecording(false);
    } catch (err: any) {
      console.error("Failed to start review:", err);
      alert("Failed to start review");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsSaving(true);
      await voiceAPI.approveVoiceNote(id!, {
        generate_observations: false,
        generate_tasks: false
      });
      await loadRecording(false);
    } catch (err: any) {
      console.error("Failed to approve voice note:", err);
      alert("Failed to approve voice note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Reject this voice note? It will be marked for reprocessing.")) return;
    try {
      setIsSaving(true);
      await voiceAPI.rejectVoiceNote(id!, {
        action_notes: "Marked for reprocessing"
      });
      await loadRecording(false);
    } catch (err: any) {
      console.error("Failed to reject voice note:", err);
      alert("Failed to reject voice note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocess = async () => {
    setShowReprocessConfirm(false);
    const oldTitle = recording?.title;
    try {
      setIsSaving(true);
      
      // Start reprocessing (backend returns immediately, processes in background)
      await voiceAPI.reprocessVoiceNote(id!);
      
      // Poll for completion by checking status
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updated = await voiceAPI.getVoiceNoteStatus(id!);
        
        if (updated.status === 'completed' || updated.status === 'approved') {
          // Reload the full recording data
          await loadRecording(false);
          break;
        }
        
        if (updated.status === 'failed') {
          await loadRecording(false);
          break;
        }
        
        attempts++;
      }
      
      // Final reload if timeout
      if (attempts >= maxAttempts) {
        await loadRecording(false);
      }
    } catch (err: any) {
      console.error("Failed to reprocess voice note:", err);
      alert(err.message || "Failed to reprocess voice note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!recording) return;
    
    try {
      setCreationStatus(prev => ({ ...prev, fieldPlan: 'creating' }));
      setIsSaving(true);
      
      // Check if we're recreating based on backend status
      const isRecreating = recording.field_plan_creation_status === 'completed';
      
      console.log(`🌾 ${isRecreating ? 'Recreating' : 'Creating'} field plan for voice note:`, recording.id);
      
      // Show immediate feedback
      toast.info(`${isRecreating ? 'Recreating' : 'Creating'} field plan... This may take up to 3 minutes.`, { duration: 5000 });
      
      // Use recreate endpoint if plans already exist, otherwise use create
      const response = isRecreating 
        ? await voiceAPI.recreateFieldPlan(recording.id)
        : await voiceAPI.createFieldPlan(recording.id);
      
      // Check for duplicate plan error (success: false)
      if (response.success === false) {
        if (response.error === 'duplicate_plan') {
          const existingPlan = response.existing_plan || response.existing_plans?.[0];
          const planName = existingPlan?.plan_name || 'Unknown';
          setCreationStatus(prev => ({ ...prev, fieldPlan: 'error' }));
          toast.error(
            `A field plan "${planName}" already exists for this field/year. Please delete it first before creating a new one.`,
            { duration: 8000 }
          );
          await loadRecording(false);
          return;
        }
        // Other errors
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'error' }));
        toast.error(response.message || "Failed to create field plan");
        return;
      }
      
      setFieldPlanResult(response);
      setShowFieldPlanResult(true);
      setCreationStatus(prev => ({ ...prev, fieldPlan: 'success' }));
      
      // Handle multi-field plan creation
      if (response.is_bulk_plan) {
        toast.success(`✅ ${response.total_plans_created} field plans created successfully!`);
        // Show warning if some fields were skipped (existing plans)
        if (response.skipped_fields?.length > 0) {
          const skippedNames = response.skipped_fields.map((f: any) => f.field_name).join(', ');
          toast.warning(`⏭️ Skipped ${response.skipped_fields.length} field(s) with existing plans: ${skippedNames}`, { duration: 8000 });
        }
        // Show info if some plans need field assignment (unmatched fields)
        if (response.plans_needing_field_assignment?.length > 0) {
          const unmatchedNames = response.plans_needing_field_assignment.map((p: any) => p.field_name).join(', ');
          toast.warning(`📝 ${response.plans_needing_field_assignment.length} plan(s) created but need field assignment: ${unmatchedNames}. Edit each plan to assign the correct field.`, { duration: 10000 });
        }
      } else {
        // Show appropriate toast based on field matching for single field
        const fieldMatchSource = response.field_match_source || 'none';
        
        if (fieldMatchSource === 'none') {
          toast.warning(`⚠️ Field plan created but no field was matched. Please assign a field in the plan editor.`);
        } else if (fieldMatchSource === 'ai_match') {
          toast.success(`✅ Field plan created and assigned to '${response.field_name}'. Please verify the field assignment.`);
        } else {
          toast.success(`✅ Field plan created successfully for '${response.field_name}'`);
        }
      }
      
      await loadRecording(false);
      
      // Keep success status permanently (don't reset to idle)
      console.log('✅ Field plan creation complete - status will persist');
      
    } catch (error: any) {
      console.error('❌ Failed to create field plan:', error);
      
      // Handle 409 Conflict (field plan already exists)
      if (error.status === 409) {
        const errorDetails = error.details || {};
        const existingPlanId = errorDetails.existing_field_plan?.id;
        
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'success' }));
        
        toast.error(
          `Field plans already exist for this recording. Delete existing plans first if you want to recreate them.`,
          {
            duration: 5000,
            dismissible: true
          }
        );
        
        // Reload to update the UI
        await loadRecording(false);
      } else if (error.status === 500 && (error.detail?.includes('already exists') || error.detail?.includes('No plans created'))) {
        // Handle 500 error for duplicate plans
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'success' }));
        
        toast.error(
          `Field plans already exist for this recording. Delete existing plans first if you want to recreate them.`,
          {
            duration: 5000,
            dismissible: true
          }
        );
        
        // Reload to update the UI
        await loadRecording(false);
      } else {
        // Enhanced error message extraction
        let errorMessage = "Failed to create field plan";
        
        if (error.message) {
          errorMessage = error.message;
        } else if (error.detail) {
          errorMessage = error.detail;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'error' }));
        toast.error(errorMessage, {
          duration: 5000,
          dismissible: true
        });
      }
      
      setTimeout(() => {
        setCreationStatus(prev => ({ ...prev, fieldPlan: 'idle' }));
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTasks = async () => {
    if (!recording) return;
    
    try {
      setCreationStatus(prev => ({ ...prev, tasks: 'creating' }));
      setIsSaving(true);
      
      console.log('🎯 Creating tasks for voice note:', recording.id);
      const response = await voiceAPI.createTasks(recording.id);
      
      setTasksResult(response);
      setShowTasksResult(true);
      setCreationStatus(prev => ({ ...prev, tasks: 'success' }));
      
      await loadRecording(false);
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setCreationStatus(prev => ({ ...prev, tasks: 'idle' }));
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Failed to create tasks:', error);
      setCreationStatus(prev => ({ ...prev, tasks: 'error' }));
      toast.error(error.message || "Failed to create tasks");
      
      setTimeout(() => {
        setCreationStatus(prev => ({ ...prev, tasks: 'idle' }));
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCreateFieldNotes = async () => {
    if (!recording) return;
    
    try {
      setCreationStatus(prev => ({ ...prev, fieldNotes: 'creating' }));
      setIsSaving(true);
      
      console.log('📝 Creating field notes for voice note:', recording.id);
      const response = await voiceAPI.createObservations(recording.id, true); // Create as drafts
      
      console.log('✅ Field notes created response:', response);
      
      const created = response.total_created || 0;
      const skipped = response.total_skipped || 0;
      
      setCreationStatus(prev => ({ ...prev, fieldNotes: 'success' }));
      
      // Show appropriate toast based on results
      if (created > 0 && skipped === 0) {
        toast.success(`✅ ${created} field note(s) created`);
      } else if (created > 0 && skipped > 0) {
        toast.warning(`⚠️ ${created} note(s) created, ${skipped} field(s) not matched. Please verify field assignments.`);
      } else if (created === 0 && skipped > 0) {
        toast.error(`❌ No notes created - ${skipped} field(s) could not be matched. Try mentioning specific field names in your recording.`);
      } else {
        toast.info('ℹ️ No field insights found in this recording');
      }
      
      await loadRecording(false);
      
      // Only navigate to field notes if some were created
      if (created > 0) {
        setTimeout(() => {
          navigate('/field-notes');
        }, 1500);
      }
      
    } catch (error: any) {
      console.error('❌ Failed to create field notes:', error);
      setCreationStatus(prev => ({ ...prev, fieldNotes: 'error' }));
      toast.error(error.message || "Failed to create field notes");
      
      setTimeout(() => {
        setCreationStatus(prev => ({ ...prev, fieldNotes: 'idle' }));
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready_for_review":
        return "🔔"; // Bell - Ready for review
      case "under_review":
      case "pending_approval":
        return "⏰"; // Alarm - Under review / Pending approval
      case "approved":
        return "✅"; // Check - Approved
      case "completed":
      case "processed":
        return "✅"; // Green check
      case "processing":
        return "⏳"; // Hourglass
      case "uploaded":
        return "☁️"; // Cloud (uploaded to cloud, waiting to process)
      case "failed":
        return "❌"; // Red X
      case "rejected":
        return "🚫"; // No entry - Rejected
      default:
        return "📄"; // Document
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready_for_review":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "under_review":
      case "pending_approval":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "completed":
      case "processed":
        return "text-green-600 bg-green-50 border-green-200";
      case "processing":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "uploaded":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "failed":
        return "text-red-600 bg-red-50 border-red-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      ready_for_review: "Ready for Review",
      under_review: "Under Review",
      pending_approval: "Pending Approval",
      approved: "Approved",
      completed: "Completed",
      processed: "Processed",
      processing: "Processing",
      uploaded: "Uploaded",
      failed: "Failed",
      rejected: "Rejected"
    };
    return statusMap[status] || status.replace("_", " ");
  };

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col bg-farm-dark">
        <header className="px-4 py-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate(-1)} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 h-6 bg-muted animate-pulse rounded w-48"></div>
          </div>
          <p className="text-sm text-farm-muted ml-14">
            <span className="inline-block h-4 bg-muted animate-pulse rounded w-32"></span>
          </p>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-farm-muted">Loading recording...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="absolute inset-0 flex flex-col bg-farm-dark">
        <header className="px-4 py-4 border-b border-farm-accent/20">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors">
              <ArrowLeft className="h-5 w-5 text-farm-text" />
            </button>
            <h1 className="text-lg font-semibold flex-1 truncate text-farm-text">Error</h1>
          </div>
          <p className="text-sm text-farm-muted ml-14">
            Failed to load
          </p>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-5xl">⚠️</div>
            <p className="text-lg font-semibold">Error Loading Recording</p>
            <p className="text-sm text-farm-muted">{error}</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-farm-dark">
      {/* Header */}
      <header className="px-4 py-4 border-b border-farm-accent/20">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-farm-text" />
          </button>
          
          {isEditingTitle ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 px-2 py-1 text-lg font-semibold bg-farm-dark border border-farm-accent/20 rounded text-farm-text focus:outline-none focus:ring-2 focus:ring-farm-accent"
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
            <>
              <h1 className="text-lg font-semibold flex-1 truncate text-farm-text">
                {recording.title || "Voice Note"}
              </h1>
              <button onClick={handleEditTitle} className="p-2 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors">
                <Pencil className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <p className="text-sm text-farm-muted ml-14">
          {formatRelativeTime(recording.recorded_at || recording.created_at)}
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide">
        <div className="p-4 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`text-2xl transition-all duration-500 ${
              recording.status === 'processing' ? 'animate-pulse' : ''
            }`}>
              {getStatusIcon(recording.status)}
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full border transition-all duration-500 ${getStatusColor(recording.status)} ${
              recording.status === 'processing' ? 'animate-pulse' : ''
            }`}>
              {getStatusText(recording.status)}
            </span>
          </div>

          {/* Audio Player - Compact Version */}
          {audioUrl && (
            <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />

              <div className="flex items-center gap-3">
                {/* Play/Pause Button - Smaller */}
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 bg-farm-accent text-white rounded-full flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5 ml-0.5" />
                  )}
                </button>

                {/* Progress Bar - Inline */}
                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-farm-accent/20 rounded-lg appearance-none cursor-pointer accent-farm-accent"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${(currentTime / duration) * 100}%, rgba(16, 185, 129, 0.2) ${(currentTime / duration) * 100}%, rgba(16, 185, 129, 0.2) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-farm-muted">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Summary & Insights */}
          {recording.structured_insight && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-farm-text">AI Summary</h2>
              
              {/* Summary */}
              {recording.structured_insight.summary && (
                <div className="bg-farm-accent/10 border border-farm-accent/20 rounded-lg p-4">
                  <p className="text-sm leading-relaxed text-farm-text">
                    {recording.structured_insight.summary}
                  </p>
                </div>
              )}

              {/* Field Insights */}
              {recording.structured_insight.field_insights?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-farm-text">Field Insights</h3>
                  {recording.structured_insight.field_insights.map((insight: any, idx: number) => (
                    <div key={idx} className="bg-farm-card border border-farm-accent/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        {editingFieldIndex === idx ? (
                          <div className="flex items-center gap-2 flex-1">
                            <select
                              value={selectedFieldId}
                              onChange={(e) => setSelectedFieldId(e.target.value)}
                              className="flex-1 bg-farm-dark border border-farm-accent/20 rounded px-3 py-1.5 text-sm text-farm-text focus:outline-none focus:ring-2 focus:ring-farm-accent"
                            >
                              <option value="">Select a field...</option>
                              {availableFields.map((field) => (
                                <option key={field.field_id} value={field.field_id}>
                                  {field.name} ({field.farm_name || 'Unknown Farm'})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={handleCancelFieldEdit}
                              disabled={isSaving}
                              className="p-1.5 hover:bg-farm-accent/10 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="h-4 w-4 text-farm-muted" />
                            </button>
                            <button
                              onClick={() => handleSaveFieldMapping(idx)}
                              disabled={isSaving || !selectedFieldId}
                              className="p-1.5 bg-farm-accent text-white hover:opacity-90 rounded transition-opacity disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div>
                                <h4 className="font-medium text-farm-text">{insight.field_name || insight.matched_field || "Field"}</h4>
                                {insight.crop_type && (
                                  <p className="text-xs text-farm-muted capitalize">{insight.crop_type}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleEditFieldMapping(idx, insight.field_id)}
                                className="p-1 hover:bg-farm-accent/10 rounded transition-colors"
                                title="Change field"
                              >
                                <Pencil className="h-3.5 w-3.5 text-farm-accent" />
                              </button>
                            </div>
                            
                            {/* Field Matching Badge */}
                            {insight.field_match_confidence !== undefined && insight.field_match_confidence > 0 ? (
                              <span className={`text-xs px-2 py-1 rounded ${
                                insight.field_match_confidence >= 0.8 ? 'bg-green-600/20 text-green-400' :
                                insight.field_match_confidence >= 0.5 ? 'bg-yellow-600/20 text-yellow-400' :
                                'bg-red-600/20 text-red-400'
                              }`}>
                                {Math.round(insight.field_match_confidence * 100)}% match
                              </span>
                            ) : (insight.field_id === null && insight.field_name) && (
                              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                                No match found
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Action Items */}
                      {insight.action_items?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-farm-muted uppercase">Action Items</p>
                          {insight.action_items.map((item: any, itemIdx: number) => (
                            <div key={itemIdx} className="border border-farm-accent/20 rounded p-3 space-y-1">
                              <p className="text-sm font-medium text-farm-text">{item.task}</p>
                              {item.reason && (
                                <p className="text-xs text-farm-muted">{item.reason}</p>
                              )}
                              <div className="flex gap-2 mt-2">
                                {item.timing && (
                                  <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                                    {item.timing.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {item.priority && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    item.priority === 'high' ? 'bg-red-500/10 text-red-600' :
                                    item.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                                    'bg-green-500/10 text-green-600'
                                  }`}>
                                    {item.priority} priority
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Observations */}
                      {insight.observations?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-farm-muted uppercase">Observations</p>
                          {insight.observations.map((obs: any, obsIdx: number) => (
                            <div key={obsIdx} className="border border-farm-accent/20 rounded p-3 space-y-1">
                              <p className="text-sm font-medium text-farm-text">{obs.title || obs.description}</p>
                              {obs.severity && (
                                <span className={`text-xs px-2 py-0.5 rounded inline-block ${
                                  obs.severity === 'high' || obs.severity === 'severe' ? 'bg-red-500/10 text-red-600' :
                                  obs.severity === 'medium' || obs.severity === 'moderate' ? 'bg-yellow-500/10 text-yellow-600' :
                                  'bg-green-500/10 text-green-600'
                                }`}>
                                  {obs.severity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Overall Assessment */}
              {recording.structured_insight.overall_assessment && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-farm-text">Overall Assessment</h3>
                  
                  <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4 space-y-3">
                    {/* Farmer Sentiment */}
                    {recording.structured_insight.overall_assessment.farmer_sentiment && (
                      <div className="flex items-center gap-2 pb-3 border-b border-farm-accent/20">
                        <span className="text-xs font-medium text-farm-muted">Sentiment:</span>
                        <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${
                          recording.structured_insight.overall_assessment.farmer_sentiment === 'positive' 
                            ? 'bg-green-600/20 text-green-400' :
                          recording.structured_insight.overall_assessment.farmer_sentiment === 'negative'
                            ? 'bg-red-600/20 text-red-400' :
                            'bg-muted text-farm-muted'
                        }`}>
                          {recording.structured_insight.overall_assessment.farmer_sentiment}
                        </span>
                      </div>
                    )}
                  
                    {recording.structured_insight.overall_assessment.opportunities?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-farm-accent mb-2">Opportunities</p>
                        <ul className="space-y-1">
                          {recording.structured_insight.overall_assessment.opportunities.map((opp: string, idx: number) => (
                            <li key={idx} className="text-sm text-farm-muted pl-4 relative before:content-['•'] before:absolute before:left-0">
                              {opp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {recording.structured_insight.overall_assessment.main_concerns?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-farm-gold mb-2">Concerns</p>
                        <ul className="space-y-1">
                          {recording.structured_insight.overall_assessment.main_concerns.map((concern: string, idx: number) => (
                            <li key={idx} className="text-sm text-farm-muted pl-4 relative before:content-['•'] before:absolute before:left-0">
                              {concern}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-farm-text">Transcript</h2>
              {recording.transcript && !isEditingTranscript && (
                <button
                  onClick={handleEditTranscript}
                  className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors"
                  title="Edit transcript"
                >
                  <Pencil className="h-4 w-4 text-farm-accent" />
                </button>
              )}
            </div>

            {recording.transcript ? (
              isEditingTranscript ? (
                <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4 space-y-3">
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full min-h-[200px] bg-farm-dark border border-farm-accent/20 rounded-lg p-3 text-sm text-farm-text leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-farm-accent"
                    placeholder="Edit transcript..."
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors"
                      title="Cancel"
                    >
                      <X className="h-5 w-5 text-farm-muted" />
                    </button>
                    <button
                      onClick={handleSaveTranscript}
                      disabled={isSaving}
                      className="p-2 bg-farm-accent text-white hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50"
                      title="Save"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4">
                  {(() => {
                    const words = recording.transcript.split(' ');
                    const shouldTruncate = words.length > 50;
                    const displayText = showFullTranscript || !shouldTruncate
                      ? recording.transcript
                      : words.slice(0, 50).join(' ') + '...';
                    
                    return (
                      <>
                        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          showFullTranscript && shouldTruncate ? 'max-h-96 overflow-y-auto' : ''
                        }`}>
                          {displayText}
                        </div>
                        {shouldTruncate && (
                          <button
                            onClick={() => setShowFullTranscript(!showFullTranscript)}
                            className="mt-3 text-sm text-farm-accent hover:underline font-medium"
                          >
                            {showFullTranscript ? 'Show Less' : 'Show More'}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )
            ) : recording.status === "processing" || recording.status === "uploaded" ? (
              <div className="bg-farm-accent/10 border-2 border-dashed border-farm-accent/20 rounded-lg p-8 text-center">
                <div className="w-12 h-12 border-4 border-farm-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-farm-muted">
                  Transcript is being generated...
                </p>
              </div>
            ) : (
              <div className="bg-farm-accent/10 border-2 border-dashed border-farm-accent/20 rounded-lg p-8 text-center">
                <p className="text-sm text-farm-muted">
                  No transcript available
                </p>
              </div>
            )}
          </div>

          {/* Workflow Actions */}
          {recording.status === 'ready_for_review' && (
            <div className="space-y-3 pt-4 border-t border-farm-accent/20">
              <h3 className="text-sm font-medium text-farm-muted uppercase">Review</h3>
              <Button
                onClick={handleStartReview}
                disabled={isSaving}
                className="w-full"
              >
                👁️ Start Review
              </Button>
            </div>
          )}

          {(recording.status === 'under_review' || recording.status === 'pending_approval') && (
            <div className="space-y-3 pt-4 border-t border-farm-accent/20">
              <h3 className="text-sm font-medium text-farm-muted uppercase">Review Decision</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleReject}
                  disabled={isSaving}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  🚫 Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  ✅ Approve
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons - Show for completed, approved, OR failed (so user can reprocess) */}
          {(recording.status === 'completed' || recording.status === 'approved' || recording.status === 'failed') && (
            <div className="space-y-3 pt-4 border-t border-farm-accent/20">
              <h3 className="text-sm font-medium text-farm-muted uppercase">Actions</h3>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => setShowReprocessConfirm(true)}
                  disabled={isSaving}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 bg-farm-accent/10 hover:bg-farm-accent/20 border-farm-accent/20 text-farm-accent shadow-sm"
                >
                  🔄 Reprocess with AI
                </Button>
                {/* Create Field Notes - DEPRECATED: Use Scouting Notes instead */}
                {/* <Button
                  onClick={handleCreateFieldNotes}
                  disabled={isSaving || creationStatus.fieldNotes === 'creating'}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 bg-muted/30 hover:bg-muted/50 shadow-sm"
                >
                  {creationStatus.fieldNotes === 'creating' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating Notes...
                    </>
                  ) : creationStatus.fieldNotes === 'success' ? (
                    <>✅ Notes Created</>
                  ) : (
                    <>📝 Create Field Notes</>
                  )}
                </Button> */}
                <Button
                  onClick={handleCreatePlan}
                  disabled={isSaving || creationStatus.fieldPlan === 'creating'}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 bg-farm-accent/10 hover:bg-farm-accent/20 border-farm-accent/20 text-farm-accent shadow-sm"
                >
                  {creationStatus.fieldPlan === 'creating' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating Field Plans...
                    </>
                  ) : recording.field_plan_creation_status === 'completed' ? (
                    <>🔄 Re-Create Field Plans</>
                  ) : (
                    <>📋 Create Field Plans</>
                  )}
                </Button>
                {/* <Button
                  onClick={handleCreateTasks}
                  disabled={isSaving || creationStatus.tasks === 'creating'}
                  variant="outline"
                  className="w-full justify-start"
                >
                  {creationStatus.tasks === 'creating' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Creating Tasks...
                    </>
                  ) : creationStatus.tasks === 'success' ? (
                    <>✅ Tasks Created</>
                  ) : (
                    <>✓ Create Tasks</>
                  )}
                </Button> */}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Reprocess Confirmation Dialog */}
      <AlertDialog open={showReprocessConfirm} onOpenChange={setShowReprocessConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Reprocess Voice Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-run AI analysis, regenerate insights, and update the smart title.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReprocess} 
              disabled={isSaving}
              className="bg-farm-accent text-farm-dark hover:bg-farm-accent/90"
            >
              {isSaving ? "Processing..." : "Reprocess"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tasks Creation Result Dialog */}
      <Dialog open={showTasksResult} onOpenChange={setShowTasksResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Tasks Created Successfully!
            </DialogTitle>
            <DialogDescription>
              {tasksResult?.total_created || 0} task{(tasksResult?.total_created || 0) !== 1 ? 's' : ''} have been created from your voice note
            </DialogDescription>
          </DialogHeader>
          
          {tasksResult?.created_tasks && tasksResult.created_tasks.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tasksResult.created_tasks.map((task: any, idx: number) => (
                <div key={idx} className="bg-muted rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.field_name && (
                        <p className="text-xs text-farm-muted">🌾 {task.field_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => navigate('/tasks')} className="flex-1">
              View Tasks
            </Button>
            <Button variant="outline" onClick={() => setShowTasksResult(false)} className="flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                ? `Your voice note has been converted into ${fieldPlanResult.total_plans_created} field plans`
                : 'Your voice note has been converted into a structured field plan'
              }
            </DialogDescription>
          </DialogHeader>
          
          {fieldPlanResult && (
            <div className="space-y-3">
              {/* Multi-field plans */}
              {fieldPlanResult.is_bulk_plan && fieldPlanResult.created_plans ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-farm-muted">Fields</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {fieldPlanResult.created_plans.map((plan: any, idx: number) => (
                      <div key={idx} className="bg-card border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🌾</span>
                            <span className="font-medium">{plan.field_name || 'Unknown Field'}</span>
                          </div>
                          {plan.total_passes > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {plan.total_passes} passes
                            </span>
                          )}
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
                <div className="bg-card border rounded-lg p-4 space-y-2">
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
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => navigate('/field-plans')} className="flex-1">
              View Plans
            </Button>
            <Button variant="outline" onClick={() => setShowFieldPlanResult(false)} className="flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default RecordingDetail;

