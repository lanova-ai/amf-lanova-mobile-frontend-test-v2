import { useState, useEffect, useRef } from "react";
import { useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { fieldsAPI, fieldOperationsAPI, FieldOperationYearlySummary, OperationTimelineSummary, userAPI, Field, handlePageError } from "@/lib/api";
import { toast } from "sonner";
import {
  RefreshCw,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Tractor,
  Calendar,
} from "lucide-react";
import {
  Page,
  PageContent,
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
  AlertDialogFooter,
  LoadingSpinner,
} from "@/components/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Constants
const CURRENT_YEAR = 2025;
const AVAILABLE_YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

export default function FarmReports() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"field" | "timeline">("timeline"); // Default to Annual Timeline
  
  // Connection State
  const [jdSyncEnabled, setJdSyncEnabled] = useState<boolean>(true);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('active');
  const [connectionError, setConnectionError] = useState<string>('');
  
  // Field Reports State
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string>("");
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [fieldLoading, setFieldLoading] = useState(false);
  const [fieldSyncing, setFieldSyncing] = useState(false);
  const [yearlySummary, setYearlySummary] = useState<FieldOperationYearlySummary | null>(null);
  
  // Timeline State
  const [timelineYear, setTimelineYear] = useState<number>(CURRENT_YEAR);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineGenerating, setTimelineGenerating] = useState(false);
  const [timelineSummary, setTimelineSummary] = useState<OperationTimelineSummary | null>(null);
  
  // Sync All Fields State
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false);
  const [syncingAllFields, setSyncingAllFields] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{current: number; total: number; percentage: number} | null>(null);
  const [pollIntervalId, setPollIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [checkingSyncStatus, setCheckingSyncStatus] = useState(false);
  
  // Ref to track syncing state across org switches (avoids stale closure in useEffect)
  // This persists across organization changes so we can show "still running in background" warnings
  const syncingRef = useRef<{ operationId: string | null; operationName: string | null }>({ operationId: null, operationName: null });

  // Load JD connection status on mount
  useEffect(() => {
    loadConnectionStatus();
  }, []);

  // Load fields on mount
  useEffect(() => {
    loadFields();
  }, []);

  // Clear timeline and check sync status when organization or year changes
  useEffect(() => {
    if (selectedOperationId && timelineYear) {
      // First, check if sync is in progress (this will set the sync state if needed)
      // Do this BEFORE clearing, so we don't show "No Timeline" flash
      const checkAndClear = async () => {
        // Show warning if switching away from an active sync (use ref to avoid stale closure)
        const syncingInfo = syncingRef.current;
        if (syncingInfo.operationId && syncingInfo.operationName && syncingInfo.operationId !== selectedOperationId) {
          toast.info(
            `ℹ️ Sync for "${syncingInfo.operationName}" is still running in the background.\n\n` +
            `You can switch back to check progress anytime.`,
            { duration: 6000 }
          );
        }
        
        // Always reset timeline loading state when switching org/year
        // (timeline loading is specific to each org/year combination)
        setTimelineLoading(false);
        setTimelineSummary(null);
        
        setCheckingSyncStatus(true);
        
        // Check sync status first
        const syncDetected = await checkAndResumeSyncIfNeeded();
        
        setCheckingSyncStatus(false);
        
        // Only reset sync state if no sync is in progress for this org/year
        // If sync IS in progress, checkAndResumeSyncIfNeeded already set the state
        if (!syncDetected) {
          // Stop any existing sync polling when switching org/year
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            setPollIntervalId(null);
          }
          
          // Reset sync state (but keep syncingRef for background warning)
          setSyncingAllFields(false);
          setSyncProgress(null);
        }
      };
      
      checkAndClear();
    }
  }, [selectedOperationId, timelineYear]);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
    };
  }, [pollIntervalId]);

  // State to track if we should auto-load after navigation
  const [shouldAutoLoad, setShouldAutoLoad] = useState(false);

  // Handle navigation state (from map click) or URL query parameters (from search)
  useEffect(() => {
    if (fields.length === 0) return;
    
    // Priority 1: Check for location.state (from map click)
    if (location.state) {
      const { fieldId, operationId, year, autoLoad } = location.state as any;
      
      if (fieldId && operationId) {
        setSelectedFieldId(fieldId);
        setSelectedOperationId(operationId);
        if (year) setSelectedYear(year);
        
        // Switch to Field Reports tab when navigating from map
        setActiveTab("field");
        
        // Set flag to auto-load after state is updated
        if (autoLoad) {
          setShouldAutoLoad(true);
        }
      }
      
      // Clear the state after handling to prevent re-triggering
      window.history.replaceState({}, document.title);
      return;
    }
    
    // Priority 2: Check for URL query parameters (from search results or Recent Activity)
    const fieldParam = searchParams.get('field');
    const yearParam = searchParams.get('year');
    
    if (fieldParam) {
      // Find the field and its operation
      const field = fields.find(f => f.field_id === fieldParam);
      if (field) {
        setSelectedFieldId(field.field_id);
        setSelectedOperationId(field.operation_id);
        if (yearParam) {
          const year = parseInt(yearParam, 10);
          if (AVAILABLE_YEARS.includes(year)) {
            setSelectedYear(year);
          }
        }
        
        // Switch to Field Reports tab when navigating from search/recent activity
        setActiveTab("field");
        
        // Set flag to auto-load after state is updated
        setShouldAutoLoad(true);
      }
    }
  }, [location.state, searchParams, fields]);

  // Auto-load summary when navigation completes and state is ready
  useEffect(() => {
    if (shouldAutoLoad && selectedFieldId && selectedOperationId) {
      setShouldAutoLoad(false); // Reset flag
      loadYearlySummary();
    }
  }, [shouldAutoLoad, selectedFieldId, selectedOperationId, selectedYear]);

  // Clear yearly summary when field or year changes
  useEffect(() => {
    // Clear the old report when user changes field or year
    setYearlySummary(null);
  }, [selectedFieldId, selectedYear]);

  // Don't auto-load - user must click Generate button
  // useEffect(() => {
  //   if (selectedFieldId && activeTab === "field") {
  //     loadYearlySummary();
  //   }
  // }, [selectedFieldId, selectedYear, activeTab]);

  // Don't auto-load - user must click Generate button
  // useEffect(() => {
  //   if (activeTab === "timeline" && user?.operation_id) {
  //     loadTimeline();
  //   }
  // }, [timelineYear, activeTab, user?.operation_id]);

  const loadConnectionStatus = async () => {
    try {
      setConnectionLoading(true);
      const connections = await userAPI.getConnections();
      const jdConnection = connections.connections.find(c => c.provider === 'johndeere');
      
      if (jdConnection) {
        setJdSyncEnabled(jdConnection.jd_sync_enabled !== false);
        setConnectionStatus(jdConnection.connection_status || 'active');
        setConnectionError(jdConnection.error_message || '');
      }
    } catch (error) {
      console.error("Failed to load connection status:", error);
      // Default to enabled if we can't load status
      setJdSyncEnabled(true);
    } finally {
      setConnectionLoading(false);
    }
  };

  const loadFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const fieldsList = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(fieldsList);
      
      // Auto-select first JD operation and field
      if (fieldsList.length > 0 && !selectedOperationId) {
        const jdField = fieldsList.find(f => f.external_source === 'johndeere' && f.external_id);
        
        if (jdField) {
          setSelectedOperationId(jdField.operation_id);
          setSelectedFieldId(jdField.field_id);
        }
      }
    } catch (error: any) {
      console.error("Failed to load fields:", error);
      const errorMsg = handlePageError(error, "Failed to load fields");
      if (errorMsg) toast.error(errorMsg);
    }
  };
  
  // Get unique organizations (only those with JD fields)
  const jdFields = fields.filter(f => f.external_source === 'johndeere' && f.external_id);
  const organizations = Array.from(
    new Map(jdFields.map(f => [f.operation_id, { id: f.operation_id, name: f.operation_name }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter fields by selected organization (JD fields only)
  const fieldsInOrganization = selectedOperationId
    ? jdFields.filter(f => f.operation_id === selectedOperationId)
    : jdFields;
  
  // Handle organization change
  const handleOrganizationChange = (operationId: string) => {
    setSelectedOperationId(operationId);
    // Auto-select first JD field in new organization
    const organizationJdFields = jdFields.filter(f => f.operation_id === operationId);
    if (organizationJdFields.length > 0) {
      setSelectedFieldId(organizationJdFields[0].field_id);
    } else {
      setSelectedFieldId('');
    }
  };

  const loadYearlySummary = async () => {
    if (!selectedFieldId) return;
    
    try {
      setFieldLoading(true);
      const result = await fieldOperationsAPI.getYearlySummary(selectedFieldId, selectedYear);
      
      // API returns single object when year is specified, array when not
      const summary = Array.isArray(result) 
        ? result.find(s => s.crop_season === selectedYear) 
        : result;
      
      setYearlySummary(summary || null);
    } catch (error: any) {
      console.error("Failed to load yearly summary:", error);
      if (error?.status === 404) {
        setYearlySummary(null);
      } else {
        const errorMsg = handlePageError(error, "Failed to load field report");
        if (errorMsg) toast.error(errorMsg);
      }
    } finally {
      setFieldLoading(false);
    }
  };

  const handleSyncField = async () => {
    if (!selectedFieldId) return;
    
    try {
      setFieldSyncing(true);
      toast.info(`🔄 Syncing ${selectedYear} data from John Deere...`);
      
      // Sync only the selected year for faster response
      const response = await fieldOperationsAPI.syncFieldOperations(selectedFieldId, selectedYear);
      
      console.log("Sync response:", response);
      
      // Check if response has success field (backend returns success: true/false)
      if (response && response.success !== false) {
        // Success - show message from backend or default success message
        const successMessage = response.message || `Synced ${response.synced_count || 0} operations for ${selectedYear}`;
        toast.success(`✅ ${successMessage}`);
        
        // Reload the summary for the selected year
        await loadYearlySummary();
      } else {
        // Backend returned success: false
        const errorMessage = response?.message || "Failed to sync operations from John Deere";
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("Failed to sync operations:", error);
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        response: error?.response
      });
      
      // Show user-friendly error message
      const errorMessage = error?.message || error?.detail || "Failed to sync operations from John Deere";
      toast.error(errorMessage);
    } finally {
      setFieldSyncing(false);
    }
  };

  const loadTimeline = async (retryCount = 0, maxRetries = 2) => {
    if (!selectedOperationId) return;
    
    // Prevent timeline generation while sync is in progress
    if (syncingAllFields) {
      console.log("Sync in progress, skipping timeline load");
      toast.info("Please wait for sync to complete before viewing the timeline.", { duration: 3000 });
      setTimelineLoading(false);
      return;
    }
    
    // Prevent concurrent calls - only allow if not already loading (unless it's a retry)
    if (timelineLoading && retryCount === 0) {
      console.log("Timeline already loading, skipping duplicate call");
      return;
    }
    
    try {
      setTimelineLoading(true);
      
      // Step 1: Check status first WITHOUT triggering generation
      const statusCheck = await fieldOperationsAPI.getOperationTimeline(selectedOperationId, timelineYear, false);
      
      // Handle based on status
      if (statusCheck.generation_status === 'completed') {
        // Timeline exists and is ready
        setTimelineSummary(statusCheck);
        return;
      }
      
      if (statusCheck.generation_status === 'generating') {
        // Already generating - start polling
        console.log("Timeline is being generated, polling for completion...");
        toast.info(statusCheck.message || "Generating timeline... This may take 1-2 minutes.", { duration: 5000 });
        await pollForTimeline();
        return;
      }
      
      // Status is 'not_found', 'pending', or 'failed' - need to trigger generation
      console.log(`Timeline status: ${statusCheck.generation_status}. Triggering generation...`);
      toast.info("Starting timeline generation... This may take 1-2 minutes.", { duration: 5000 });
      
      // Step 2: Trigger generation
      const triggerResult = await fieldOperationsAPI.getOperationTimeline(selectedOperationId, timelineYear, true);
      
      if (triggerResult.generation_status === 'generating') {
        // Generation started - poll for completion
        await pollForTimeline();
      } else if (triggerResult.generation_status === 'completed') {
        // Rare case - completed immediately
        setTimelineSummary(triggerResult);
        toast.success("Timeline loaded!");
      } else {
        toast.error("Failed to start timeline generation. Please try again.");
        setTimelineSummary(null);
      }
      
    } catch (error: any) {
      console.error("Failed to load timeline:", error);
      
      // Handle 503 (timeout/busy) with automatic retry
      if (error?.status === 503 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 5000; // 5s, 10s backoff (longer for large ops)
        const orgFields = jdFields.filter(f => f.operation_id === selectedOperationId);
        const fieldCount = orgFields.length;
        console.log(`Timeline generation timed out (${fieldCount} fields), retrying in ${delay/1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
        toast.info(
          `Processing ${fieldCount} fields in chunks... Retry ${retryCount + 1}/${maxRetries} in ${delay/1000}s`,
          { duration: delay }
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return loadTimeline(retryCount + 1, maxRetries);
      }
      
      // Always clear timeline on error to avoid showing stale/broken data
      setTimelineSummary(null);
      
      if (error?.status === 404) {
        // No timeline exists yet - this is expected, don't show error
      } else if (error?.status === 503) {
        const orgFields = jdFields.filter(f => f.operation_id === selectedOperationId);
        const fieldCount = orgFields.length;
        toast.error(
          `Timeline generation timed out for ${fieldCount} fields. The AI is busy - please try again in a minute.`,
          { duration: 6000 }
        );
      } else {
        toast.error("Failed to load annual timeline");
      }
    } finally {
      setTimelineLoading(false);
    }
  };
  
  // Helper function to poll for timeline completion
  const pollForTimeline = async () => {
    const maxPolls = 18; // 3 minutes with 10s intervals
    
    for (let poll = 0; poll < maxPolls; poll++) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10s interval
      
      try {
        // Poll WITHOUT triggering (trigger=false)
        const pollResult = await fieldOperationsAPI.getOperationTimeline(selectedOperationId!, timelineYear, false);
        
        if (pollResult.generation_status === 'completed') {
          setTimelineSummary(pollResult);
          toast.success("Timeline generated successfully!");
          return;
        } else if (pollResult.generation_status === 'failed') {
          setTimelineSummary(null);
          toast.error("Timeline generation failed. Please try again.");
          return;
        }
        // Still generating, continue polling
        console.log(`Polling for timeline... (${poll + 1}/${maxPolls})`);
      } catch (pollError) {
        console.error("Poll error:", pollError);
        // Continue polling on error
      }
    }
    
    // Timeout after max polls
    toast.info("Timeline is still generating. Please refresh in a moment.");
    setTimelineSummary(null);
  };

  const checkAndResumeSyncIfNeeded = async (): Promise<boolean> => {
    if (!selectedOperationId || syncingAllFields) return false;
    
    try {
      const status = await fieldOperationsAPI.getSyncStatus(selectedOperationId, timelineYear);
      
      // If sync is in progress, resume the polling
      if (status.status === 'in_progress' && status.current < status.total) {
        console.log(`Resuming sync: ${status.current}/${status.total} fields synced`);
        
        // Set syncing state
        setSyncingAllFields(true);
        setSyncProgress({
          current: status.current,
          total: status.total,
          percentage: status.percentage
        });
        
        // Show toast notification
        toast.info(
          `🔄 Sync in progress...\n\n` +
          `${status.current}/${status.total} fields synced (${status.percentage.toFixed(1)}%)\n\n` +
          `Resuming progress tracking...`,
          { duration: 5000 }
        );
        
        // Start the polling mechanism
        startSyncPolling();
        
        return true; // Sync was detected and resumed
      }
      
      return false; // No sync in progress
    } catch (error: any) {
      console.error("Failed to check sync status:", error);
      
      // ✅ Show error if it's a real API failure (not just 404/no sync)
      if (error?.status && error.status >= 500) {
        toast.error(
          `⚠️ Unable to check sync status\n\n` +
          `Server error: ${error.message || 'Unknown error'}\n\n` +
          `Please try refreshing the page.`,
          { duration: 6000 }
        );
      }
      
      return false;
    }
  };

  const handleCancelSync = async () => {
    if (!selectedOperationId) return;
    
    try {
      const result = await fieldOperationsAPI.cancelSync(selectedOperationId, timelineYear);
      
      // Stop polling
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        setPollIntervalId(null);
      }
      
      toast.success(
        `✅ ${result.message}`,
        { duration: 6000 }
      );
      
      // Reset state
      setSyncingAllFields(false);
      setSyncProgress(null);
      syncingRef.current = { operationId: null, operationName: null };
      
    } catch (error: any) {
      console.error("Failed to cancel sync:", error);
      toast.error(error?.message || "Failed to cancel sync. Please try again.");
    }
  };

  const startSyncPolling = () => {
    // Clear any existing interval
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }
    
    let pollCount = 0;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5; // Stop after 5 consecutive failures
    const MAX_POLL_TIME = 2 * 60 * 60 * 1000; // 2 hours max
    const POLL_INTERVAL = 10000; // 10 seconds
    const MAX_POLLS = MAX_POLL_TIME / POLL_INTERVAL; // 720 polls
    const startTime = Date.now();
    
    // Define the polling function
    const checkStatus = async () => {
      try {
        const status = await fieldOperationsAPI.getSyncStatus(selectedOperationId, timelineYear);
        
        // ✅ Reset error counter on successful API call
        consecutiveErrors = 0;
        
        // Update progress
        setSyncProgress({
          current: status.current,
          total: status.total,
          percentage: status.percentage
        });
        
        // Check if completed
        if (status.status === 'completed') {
          // Stop polling
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            setPollIntervalId(null);
          }
          
          // Show success message - user can click "View Timeline" to generate
          toast.success(
            `✅ Sync complete!\n\n` +
            `${status.current}/${status.total} fields synced successfully.\n\n` +
            `Click "View Timeline" to generate the summary.`,
            { duration: 5000 }
          );
          
          // Reset state
          setSyncingAllFields(false);
          setSyncProgress(null);
          syncingRef.current = { operationId: null, operationName: null };
          
          return true; // Indicate completion
        }
        
        // Check if failed
        if (status.status === 'failed') {
          // Stop polling
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            setPollIntervalId(null);
          }
          
          toast.error(
            `❌ Sync failed\n\n` +
            `${status.current}/${status.total} fields were synced before the error.\n\n` +
            `Please try again or contact support.`,
            { duration: 8000 }
          );
          
          // Reset state
          setSyncingAllFields(false);
          setSyncProgress(null);
          syncingRef.current = { operationId: null, operationName: null };
          
          return true; // Stop polling
        }
        
        // Check if cancelled
        if (status.status === 'cancelled') {
          // Stop polling
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            setPollIntervalId(null);
          }
          
          // Toast already shown by handleCancelSync, just reset state
          setSyncingAllFields(false);
          setSyncProgress(null);
          syncingRef.current = { operationId: null, operationName: null };
          
          return true; // Stop polling
        }
        
        return false; // Still in progress
      } catch (pollError: any) {
        consecutiveErrors++;
        console.error(`Failed to poll sync status (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, pollError);
        
        // ✅ Stop polling after too many consecutive errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            setPollIntervalId(null);
          }
          
          toast.error(
            `❌ Sync monitoring failed\n\n` +
            `Unable to connect to the server after ${MAX_CONSECUTIVE_ERRORS} attempts.\n\n` +
            `The sync may still be running in the background. Please refresh the page or contact support.`,
            { duration: 10000 }
          );
          
          setSyncingAllFields(false);
          setSyncProgress(null);
          syncingRef.current = { operationId: null, operationName: null };
          
          return true; // ✅ Stop polling
        }
        
        return false; // Continue polling (but increment error counter)
      }
    };
    
    // Poll immediately once
    setTimeout(checkStatus, 2000); // Check after 2 seconds
    
    // Start polling for status every 10 seconds
    const intervalId = setInterval(async () => {
      pollCount++;
      
      // Safety timeout after 2 hours
      if (pollCount >= MAX_POLLS) {
        clearInterval(intervalId);
        setPollIntervalId(null);
        
        toast.warning(
          `⏱️ Sync timeout\n\n` +
          `Sync has been running for over 2 hours and will continue in the background.\n\n` +
          `Please check back later or contact support if the issue persists.`,
          { duration: 10000 }
        );
        
        setSyncingAllFields(false);
        syncingRef.current = { operationId: null, operationName: null };
        return;
      }
      
      const isComplete = await checkStatus();
      if (isComplete) {
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL);
    
    setPollIntervalId(intervalId);
  };

  const handleSyncAllFieldsClick = async () => {
    // If already syncing (local state), don't allow another sync
    if (syncingAllFields) {
      toast.warning("Sync is already in progress. Please wait for it to complete.", { duration: 4000 });
      return;
    }
    
    // Double-check with backend in case we switched away and back
    try {
      const status = await fieldOperationsAPI.getSyncStatus(selectedOperationId, timelineYear);
      if (status.status === 'in_progress' && status.current < status.total) {
        // Resume tracking this sync
        setSyncingAllFields(true);
        setSyncProgress({
          current: status.current,
          total: status.total,
          percentage: status.percentage
        });
        startSyncPolling();
        
        toast.warning(
          `Sync is already in progress (${status.current}/${status.total} fields).\n\nResuming progress tracking...`,
          { duration: 4000 }
        );
        return;
      }
    } catch (error) {
      // If status check fails, proceed with confirmation (backend will handle duplicates)
      console.error("Failed to check sync status:", error);
    }
    
    // Show confirmation modal
    setShowSyncConfirmation(true);
  };

  const handleConfirmSyncAllFields = async () => {
    if (!selectedOperationId) return;
    
    setShowSyncConfirmation(false);
    
    try {
      setSyncingAllFields(true);
      const orgName = organizations.find(org => org.id === selectedOperationId)?.name || 'your organization';
      syncingRef.current = { operationId: selectedOperationId, operationName: orgName }; // Track which org is syncing
      
      // ✅ Call the sync-all-fields endpoint with timeout handling
      // Note: force_refresh=true will clear existing yearly summaries before syncing
      const result = await Promise.race([
        fieldOperationsAPI.syncAllFieldsForOperation(selectedOperationId, timelineYear, true),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout - server took too long to respond')), 30000)
        )
      ]) as any;
      
      // Show simple toast - detailed warning already shown in modal
      toast.info(
        `Syncing ${result.total_fields} fields (~${Math.round(result.estimated_duration_minutes)} min)`,
        { duration: 5000 }
      );
      
      // Initialize progress
      setSyncProgress({
        current: 0,
        total: result.total_fields,
        percentage: 0
      });
      
      // Start the polling mechanism
      startSyncPolling();
      
    } catch (error: any) {
      console.error("Failed to start sync:", error);
      const errorMessage = error?.message || "Failed to start sync";
      toast.error(errorMessage, { duration: 6000 });
      
      // Reset state on error
      setSyncingAllFields(false);
      setSyncProgress(null);
      syncingRef.current = { operationId: null, operationName: null };
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTimeAgo = (dateString: string) => {
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
    return date.toLocaleDateString();
  };

  // Parse and render markdown-like text from Gemini
  const renderMarkdownText = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip horizontal rules
      if (line.trim() === '***' || line.trim() === '---') {
        elements.push(<hr key={key++} className="my-4 border-t border-muted" />);
        continue;
      }
      
      // Skip empty lines
      if (line.trim() === '') {
        continue;
      }
      
      // H1 headers (# text) - Main sections
      if (line.match(/^#\s+[^#]/)) {
        const headerText = line.replace(/^#\s*/, '').replace(/\*\*/g, '');
        // Add extra spacing before "Closing Summary" section
        const isClosingSummary = headerText.toUpperCase().includes('CLOSING SUMMARY');
        const marginClass = isClosingSummary ? 'mt-12' : 'mt-8';
        
        elements.push(
          <h1 key={key++} className={`text-lg font-bold text-farm-accent ${marginClass} mb-3 pt-4 border-t-2 border-farm-accent/20 first:mt-0 first:pt-0 first:border-0`}>
            {headerText}
          </h1>
        );
        continue;
      }
      
      // H2 headers (## text) - Subsections
      if (line.match(/^##\s+[^#]/)) {
        const headerText = line.replace(/^##\s*/, '').replace(/\*\*/g, '');
        elements.push(
          <h2 key={key++} className="text-[17px] font-bold text-farm-text mt-7 mb-3">
            {headerText}
          </h2>
        );
        continue;
      }
      
      // H3 headers (### text)
      if (line.startsWith('###')) {
        const headerText = line.replace(/^###\s*/, '').replace(/\*\*/g, '');
        elements.push(
          <h3 key={key++} className="text-base font-bold text-farm-text mt-6 mb-2">
            {headerText}
          </h3>
        );
        continue;
      }
      
      // H4 headers (#### text)
      if (line.startsWith('####')) {
        const headerText = line.replace(/^####\s*/, '').replace(/\*\*/g, '');
        elements.push(
          <h4 key={key++} className="text-[15px] font-semibold text-farm-text/90 mt-5 mb-2 leading-snug">
            {headerText}
          </h4>
        );
        continue;
      }
      
      // Arrow headers (→ text or **→ text**)
      // Handle various arrow formats: →, ->, or --, with or without bold markers
      const trimmedLine = line.trim();
      
      // Check for arrow headers (with or without bold markers)
      if (trimmedLine.match(/^(\*\*)?(→|->|--)\s*/)) {
        // Remove all arrows, bold markers, and clean up the text
        const headerText = line.replace(/^(\*\*)?(→|->|--)\s*/g, '').replace(/\*\*/g, '').replace(/:/g, '').trim();
        elements.push(
          <h5 key={key++} className="text-[15px] font-semibold text-farm-accent mt-5 mb-2 leading-snug">
            → {headerText}
          </h5>
        );
        continue;
      }
      
      // Special handling for Note/Disclaimer (starts with *Note:)
      if (line.trim().match(/^\*\s*Note:/i)) {
        const noteText = line.replace(/^\s*[\*•]\s*/, '');
        const formattedText = formatInlineMarkdown(noteText);
        elements.push(
          <p key={key++} className="text-xs italic text-farm-muted/70 mb-3 leading-relaxed">
            {formattedText}
          </p>
        );
        continue;
      }
      
      // Bullet points (*   text or •  text)
      if ((line.trim().startsWith('*') || line.trim().startsWith('•')) && !line.trim().startsWith('**')) {
        const bulletText = line.replace(/^\s*[\*•]\s*/, '');
        const formattedText = formatInlineMarkdown(bulletText);
        elements.push(
          <div key={key++} className="ml-4 mb-2 text-[14px] leading-relaxed flex">
            <span className="text-farm-accent mr-2 flex-shrink-0 font-medium">•</span>
            <span className="text-farm-text/95">{formattedText}</span>
          </div>
        );
        continue;
      }
      
      // Regular text
      const formattedText = formatInlineMarkdown(line);
      elements.push(
        <p key={key++} className="text-[14px] leading-relaxed text-farm-text/95 mb-2.5">
          {formattedText}
        </p>
      );
    }
    
    return <div className="space-y-1">{elements}</div>;
  };

  // Format inline markdown (bold)
  const formatInlineMarkdown = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let partKey = 0;
    
    // Match **bold** text
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      // Add bold text
      parts.push(
        <strong key={partKey++} className="font-semibold text-farm-text">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // Parse JD Ops markdown and render as clean timeline (like AMF Reports)
  interface JDTimelineEvent {
    date?: string;
    category: 'planting' | 'application' | 'harvest' | 'tillage' | 'fertilizer' | 'other';
    description: string;
  }

  const parseJDOpsToTimeline = (text: string): JDTimelineEvent[] => {
    if (!text) return [];
    
    const lines = text.split('\n');
    const timeline: JDTimelineEvent[] = [];
    
    // Helper to detect category from description text
    const detectCategory = (desc: string): JDTimelineEvent['category'] => {
      const lower = desc.toLowerCase();
      // Check for explicit tags first: [PLANTED], [APPLIED], [HARVESTED], [TILLAGE], [FERTILIZER]
      if (lower.includes('[planted]') || lower.includes('[seeded]')) return 'planting';
      if (lower.includes('[fertilizer]') || lower.includes('[fertilized]')) return 'fertilizer';
      if (lower.includes('[applied]') || lower.includes('[sprayed]')) return 'application';
      if (lower.includes('[harvested]')) return 'harvest';
      if (lower.includes('[tillage]') || lower.includes('[tilled]')) return 'tillage';
      
      // Fallback: detect from content
      if (lower.includes('planted') || lower.includes('seeded') || lower.includes('seeding')) return 'planting';
      if (lower.includes('harvested') || lower.includes('yield') || lower.includes('bu/ac')) return 'harvest';
      if (lower.includes('fertilizer') || lower.includes('nh3') || lower.includes('lb/ac')) return 'fertilizer';
      if (lower.includes('applied') || lower.includes('spray') || lower.includes('tank mix')) return 'application';
      if (lower.includes('tillage') || lower.includes('tilled')) return 'tillage';
      
      return 'other';
    };
    
    // Helper to clean description (remove tags)
    const cleanDescription = (desc: string): string => {
      return desc
        .replace(/\[PLANTED\]/gi, '')
        .replace(/\[SEEDED\]/gi, '')
        .replace(/\[APPLIED\]/gi, '')
        .replace(/\[SPRAYED\]/gi, '')
        .replace(/\[HARVESTED\]/gi, '')
        .replace(/\[TILLAGE\]/gi, '')
        .replace(/\[TILLED\]/gi, '')
        .replace(/\[FERTILIZER\]/gi, '')
        .replace(/\[FERTILIZED\]/gi, '')
        .trim();
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines, notes, headers
      if (!trimmed || trimmed.startsWith('*Note:') || trimmed === '***' || trimmed === '---') continue;
      if (trimmed.startsWith('#')) continue; // Skip markdown headers
      if (trimmed.match(/^(\*\*)?(→|->|--)\s*/)) continue; // Skip section headers
      
      // Extract bullet points with dates
      if (trimmed.startsWith('*') || trimmed.startsWith('•')) {
        // Only strip leading bullet, preserve ** for bold rendering
        const bulletText = trimmed.replace(/^[\*•]\s*/, '');
        
        // Try to extract date from the text: "Apr 11:" or "Apr 11 :" etc.
        const dateMatch = bulletText.match(/^([A-Z][a-z]{2}\s+\d{1,2})\s*[:,-]?\s*(.+)/);
        if (dateMatch) {
          const rawDescription = dateMatch[2].trim();
          const category = detectCategory(rawDescription);
          const description = cleanDescription(rawDescription);
          
          // Only add if description is meaningful
          if (description.length > 3) {
            timeline.push({
              date: dateMatch[1],
              category,
              description
            });
          }
        } else if (bulletText.length > 15) {
          // Content without date prefix
          const category = detectCategory(bulletText);
          const description = cleanDescription(bulletText);
          timeline.push({
            date: undefined,
            category,
            description
          });
        }
      }
    }
    
    return timeline;
  };

  // Helper to render description with bold text (converts **text** to styled spans)
  const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        // Field names are bolded - show in green accent color
        return <span key={i} className="font-semibold text-farm-accent">{boldText}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderJDOpsTimeline = (text: string) => {
    const timeline = parseJDOpsToTimeline(text);
    
    // If parsing fails, fall back to markdown
    if (timeline.length === 0) {
      return renderMarkdownText(text);
    }
    
    const getCategoryColor = (category: JDTimelineEvent['category']) => {
      switch (category) {
        case 'planting': return 'text-green-500';
        case 'fertilizer': return 'text-purple-500';
        case 'application': return 'text-blue-500';
        case 'harvest': return 'text-orange-500';
        case 'tillage': return 'text-amber-600';
        default: return 'text-gray-400';
      }
    };

    return (
      <div className="space-y-4">
        {/* Season Timeline */}
        {timeline.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-farm-accent mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Season Timeline
            </h4>
            <div className="space-y-1.5">
              {timeline.map((event, i) => {
                const colorClass = getCategoryColor(event.category);
                
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Tractor className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorClass}`} />
                    {event.date && (
                      <span className="text-farm-muted font-medium min-w-[60px]">
                        {event.date}
                      </span>
                    )}
                    <span className="text-farm-muted">{renderBoldText(event.description)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Full Details - Collapsible */}
        <details className="mt-4">
          <summary className="text-xs text-farm-muted cursor-pointer hover:text-farm-accent">
            View Full Report Details
          </summary>
          <div className="mt-3 pt-3 border-t border-farm-accent/10">
            {renderMarkdownText(text)}
          </div>
        </details>
      </div>
    );
  };

  const selectedField = fields.find(f => f.field_id === selectedFieldId);
  const selectedFieldDisplay = selectedField 
    ? `${selectedField.name}${selectedField.farm_name ? ` (${selectedField.farm_name})` : ''}`
    : '';

  return (
    <Page>
      <PageContent>
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "field" | "timeline")} className="w-full">
          <div className="px-4 py-4 border-b border-farm-accent/20 bg-farm-dark/95 backdrop-blur sticky top-0 z-20">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="field" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Field Reports
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Annual Timeline
              </TabsTrigger>
            </TabsList>
          </div>

          {/* JD Sync Disabled Warning */}
          {!connectionLoading && !jdSyncEnabled && (
            <div className="px-4 pt-4">
              <div className="bg-farm-gold/10 border-farm-gold/20 rounded-lg p-4 border">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-farm-gold mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-farm-text mb-1">
                      JD Ops Reports Not Available
                    </h3>
                    <p className="text-xs text-farm-muted">
                      John Deere field operations sync is currently disabled for your account.
                      This feature is only available for users with JD sync capability.
                      Contact support if you need this feature enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Error Warning */}
          {!connectionLoading && jdSyncEnabled && connectionStatus === 'error' && (
            <div className="px-4 pt-4">
              <div className="bg-destructive/10 border-destructive/20 rounded-lg p-4 border">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <h3 className="text-sm font-semibold text-farm-text">
                      John Deere Connection Expired
                    </h3>
                    <p className="text-xs text-farm-muted">
                      Your John Deere connection has expired and needs to be renewed. Please reconnect to continue syncing field operations.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => navigate('/settings/connections/johndeere')}
                    >
                      Reconnect John Deere
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Field Reports Tab */}
          <TabsContent value="field" className="space-y-4 mt-4 px-4">
            
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-farm-muted hover:text-farm-text transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            
            {/* Organization, Field and Year Selectors - Inline Layout */}
            <div className="space-y-3">
              {/* Organization Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Organization</label>
                <Select value={selectedOperationId} onValueChange={handleOrganizationChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Field Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Field (Farm)</label>
                <Select value={selectedFieldId} onValueChange={setSelectedFieldId} disabled={!selectedOperationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldsInOrganization
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((field) => (
                        <SelectItem key={field.field_id} value={field.field_id}>
                          {field.name} ({field.farm_name || 'Unknown Farm'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Year (defaults to 2025)</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === CURRENT_YEAR && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons - Inline */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSyncField} 
                  disabled={!selectedFieldId || fieldSyncing || !jdSyncEnabled}
                  className="flex-1 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  variant="outline"
                >
                  {fieldSyncing ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync from JD Ops
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={loadYearlySummary} 
                  disabled={!selectedFieldId || fieldLoading || !jdSyncEnabled}
                  className="flex-1 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  {fieldLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : (
                    'View Report'
                  )}
                </Button>
              </div>
              
              {yearlySummary && (
                <div className="flex items-center text-xs text-farm-muted pt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Last synced: {formatTimeAgo(yearlySummary.last_computed_at)}</span>
                </div>
              )}
            </div>

            {/* Field Report Content */}
            {fieldLoading ? (
              <div className="py-8 text-center space-y-3">
                <LoadingSpinner size="lg" className="mx-auto text-farm-accent" />
                <p className="text-sm text-farm-muted">Loading field report...</p>
              </div>
            ) : yearlySummary ? (
              <div className="space-y-4 pt-2">
                {/* Season Report */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-farm-text">
                    <CheckCircle2 className="h-5 w-5 text-farm-accent" />
                    {selectedFieldDisplay} - {selectedYear} Season Report
                  </h3>

                  {/* Season Timeline - Clean View like AMF */}
                  {yearlySummary.summary_text && (
                    <div className="pt-2">
                      {renderJDOpsTimeline(yearlySummary.summary_text)}
                    </div>
                  )}
                </div>

                {/* Operations Breakdown */}
                <div className="pt-4 border-t border-farm-accent/10">
                  <h4 className="font-semibold mb-3 text-farm-text">📈 Operations Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(yearlySummary.operations_by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between py-2 border-b border-farm-accent/10 last:border-0">
                        <span className="text-sm capitalize text-farm-text">{type.replace(/_/g, " ")}</span>
                        <span className="font-medium text-farm-accent">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-4">
                <div className="text-6xl">📭</div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-farm-text">No Report Displayed</h3>
                  <p className="text-sm text-farm-muted max-w-sm mx-auto">
                    Click <strong>'View Report'</strong> above to check if operations data exists for {selectedFieldDisplay} in {selectedYear}.
                    {" "}If no data is found, click <strong>'Sync from JD Ops'</strong> to fetch the latest data from John Deere.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Annual Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4 mt-4 px-4">
            
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-farm-muted hover:text-farm-text transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            
            {/* Organization and Year Selectors - Inline Layout */}
            <div className="space-y-3">
              {/* Organization Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Organization</label>
                <Select value={selectedOperationId} onValueChange={handleOrganizationChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Year (defaults to 2025)</label>
                <Select value={timelineYear.toString()} onValueChange={(v) => setTimelineYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === CURRENT_YEAR && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons - Inline */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleSyncAllFieldsClick} 
                  disabled={!selectedOperationId || syncingAllFields || !jdSyncEnabled}
                  className="flex-1 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  {syncingAllFields ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Syncing All Fields...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync All Fields
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => loadTimeline()} 
                  disabled={!selectedOperationId || timelineLoading || !jdSyncEnabled || syncingAllFields}
                  className="flex-1 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  variant="outline"
                >
                  {timelineLoading ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : syncingAllFields ? (
                    'Sync in progress...'
                  ) : (
                    'View Timeline'
                  )}
                </Button>
              </div>
              
              {/* Sync Progress Bar */}
              {syncingAllFields && (
                <div className="space-y-2 bg-farm-accent/5 border border-farm-accent/20 rounded-lg p-3 mt-2">
                  {syncProgress ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-farm-text">
                          ⏳ Syncing fields...
                        </span>
                        <span className="font-medium text-farm-accent">
                          {syncProgress.current}/{syncProgress.total} ({syncProgress.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-farm-muted/20 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-farm-accent h-full transition-all duration-500 ease-out"
                          style={{ width: `${syncProgress.percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-farm-muted">
                          <span className="inline-flex items-center gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Syncing operations from John Deere... This may take several minutes.
                          </span>
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelSync}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <LoadingSpinner size="sm" className="text-farm-accent" />
                      <span className="font-semibold text-farm-text">
                        Checking sync status...
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {timelineSummary && !syncingAllFields && (
                <div className="flex items-center text-xs text-farm-muted pt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Last computed: {formatTimeAgo(timelineSummary.last_computed_at)}</span>
                </div>
              )}
            </div>

            {/* Timeline Content */}
            {checkingSyncStatus ? (
              <div className="py-8 text-center space-y-3">
                <LoadingSpinner size="lg" className="mx-auto text-farm-accent" />
                <p className="text-sm text-farm-muted">Checking sync status...</p>
              </div>
            ) : syncingAllFields ? (
              <div className="py-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-farm-accent/10 mb-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-farm-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg text-farm-text">Syncing Operations Data</h3>
                  <p className="text-sm text-farm-muted max-w-md mx-auto">
                    Importing field operations from John Deere Operations Center. Click "View Timeline" after sync completes to generate the summary.
                  </p>
                </div>
              </div>
            ) : timelineLoading ? (
              <div className="py-8 text-center space-y-3">
                <LoadingSpinner size="lg" className="mx-auto text-farm-accent" />
                {(() => {
                  const orgFields = jdFields.filter(f => f.operation_id === selectedOperationId);
                  const fieldCount = orgFields.length;
                  if (fieldCount > 30) {
                    return (
                      <>
                        <p className="text-sm text-farm-muted">Processing {fieldCount} fields...</p>
                        <p className="text-xs text-farm-muted/70">Large operations may take 1-2 minutes</p>
                      </>
                    );
                  } else if (fieldCount > 15) {
                    return (
                      <>
                        <p className="text-sm text-farm-muted">Generating timeline for {fieldCount} fields...</p>
                        <p className="text-xs text-farm-muted/70">This may take 30-60 seconds</p>
                      </>
                    );
                  }
                  return <p className="text-sm text-farm-muted">Loading annual timeline...</p>;
                })()}
              </div>
            ) : timelineSummary ? (
              <div className="space-y-4 pt-2">
                {/* Overview */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-farm-text">
                    📊 {organizations.find(org => org.id === selectedOperationId)?.name || 'Farm'} - {timelineYear} Annual Timeline
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-farm-accent/5 rounded-lg border border-farm-accent/10">
                      <p className="text-xl font-bold text-farm-accent">{timelineSummary.total_fields_with_operations}</p>
                      <p className="text-xs text-farm-muted">Active Fields</p>
                    </div>
                    <div className="text-center p-3 bg-farm-accent/5 rounded-lg border border-farm-accent/10">
                      <p className="text-xl font-bold text-farm-accent">{timelineSummary.total_operations_count}</p>
                      <p className="text-xs text-farm-muted">Total Operations</p>
                    </div>
                  </div>
                  
                  {/* Crops Summary */}
                  {Object.keys(timelineSummary.fields_by_crop).length > 0 && (
                    <div className="space-y-2 pt-3 border-t border-farm-accent/10">
                      <p className="text-sm font-medium text-farm-muted">Crops:</p>
                      {Object.entries(timelineSummary.fields_by_crop).map(([crop, count]) => (
                        <div key={crop} className="flex items-center justify-between text-sm py-1">
                          <span className="capitalize text-farm-text">{crop.toLowerCase().replace(/_/g, " ")}</span>
                          <span className="text-farm-muted">{count} field{count !== 1 ? "s" : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Farm Timeline - Clean View like AMF */}
                {timelineSummary.summary_text && (
                  <div className="pt-4 border-t border-farm-accent/10">
                    {renderJDOpsTimeline(timelineSummary.summary_text)}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center space-y-4">
                <div className="text-6xl">📊</div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-farm-text">No Timeline Generated</h3>
                  <p className="text-sm text-farm-muted max-w-sm mx-auto">
                    {selectedOperationId 
                      ? `Generate a timeline for ${organizations.find(org => org.id === selectedOperationId)?.name || 'this organization'} in ${timelineYear} to see all activities across your fields.`
                      : 'Select an organization above to generate a timeline.'
                    }
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Sync All Fields Confirmation Modal */}
        <AlertDialog open={showSyncConfirmation} onOpenChange={setShowSyncConfirmation}>
          <AlertDialogContent className="max-w-md">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-farm-gold" />
                  Force Refresh All Fields for {timelineYear}?
                </h3>
                <p className="text-sm text-farm-muted">
                  This will sync operations data from John Deere for <strong>all {fieldsInOrganization.length} fields</strong> in{" "}
                  <strong>{organizations.find(org => org.id === selectedOperationId)?.name || 'this organization'}</strong>.
                </p>
              </div>

              <div className="bg-farm-gold/10 border border-farm-gold/20 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-farm-gold mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-farm-text mb-1">
                      Warning: Existing summaries will be cleared
                    </p>
                    <p className="text-xs text-farm-muted">
                      All existing yearly summaries for {timelineYear} will be deleted and re-synced from John Deere. 
                      This ensures accurate progress tracking and fresh data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-farm-accent/10 border border-farm-accent/20 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-farm-text">⏱️ Estimated Time:</p>
                <p className="text-sm text-farm-muted">
                  30-60 minutes depending on data size
                </p>
                <p className="text-xs text-farm-muted mt-2">
                  You can close this page - the sync will continue in the background.
                </p>
              </div>

              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmSyncAllFields}
                  className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  Force Refresh & Sync
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </PageContent>
    </Page>
  );
}

