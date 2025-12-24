import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fieldsAPI, tasksAPI, fieldPlansAPI, observationsAPI, userAPI, fieldOperationsAPI, scoutingNotesAPI, equipmentAPI, connectionAPI, handlePageError } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ChevronDown, ChevronUp, Mic, UserPlus, FileText, Image as ImageIcon, BarChart3, Brain, Search, Tractor, Sprout, Loader2, Leaf, Plus, X, MapPin, Clock, CheckCircle2 } from "lucide-react";
import DocumentUploadModal from "@/components/DocumentUploadModal";

const Home = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [fieldsData, setFieldsData] = useState<any>(null);
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [recentJDReports, setRecentJDReports] = useState<any[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([]);
  const [recentFieldPlans, setRecentFieldPlans] = useState<any[]>([]);
  const [recentFieldNotes, setRecentFieldNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [jdSyncEnabled, setJdSyncEnabled] = useState<boolean>(true);
  const [showJDReports, setShowJDReports] = useState(false);
  const [showPrescriptions, setShowPrescriptions] = useState(false);
  const [showFieldPlans, setShowFieldPlans] = useState(false);
  const [showFieldNotes, setShowFieldNotes] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Equipment tracking announcement state
  const [showEquipmentAnnouncement, setShowEquipmentAnnouncement] = useState(false);
  const [equipmentCheckDone, setEquipmentCheckDone] = useState(false);
  
  // Use ref to prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);

  // Handle OAuth connection success redirect
  useEffect(() => {
    const connectionSuccess = searchParams.get('connection_success');
    if (connectionSuccess === 'johndeere') {
      // Clear the URL parameter
      searchParams.delete('connection_success');
      setSearchParams(searchParams, { replace: true });
      
      // Clear the dismissed flag so we don't show announcement anymore
      localStorage.removeItem('equipment_announcement_dismissed');
      setShowEquipmentAnnouncement(false);
      
      // Show success toast
      toast.success("🚜 John Deere connected!", {
        description: "Syncing your fields and equipment in the background...",
        duration: 6000
      });
      
      // Auto-trigger sync for fields AND equipment metadata
      connectionAPI.syncJohnDeereFields()
        .then(() => {
          toast.success("✅ Sync started!", {
            description: "Your fields and equipment will appear shortly.",
            duration: 4000
          });
        })
        .catch((err) => {
          console.error("Auto-sync failed:", err);
          // Don't show error toast - sync might already be in progress
        });
      
      // Refresh user data
      refreshUser();
    }
  }, [searchParams]);

  const fetchData = async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      
      // Load fields summary first (fast) and show immediately
      // Don't wait for other slower APIs
      fieldsAPI.getFieldsSummary()
        .then(response => setFieldsData(response))
        .catch(err => console.error("Failed to load fields summary:", err));
      
      // Check JD sync status (fast)
      let jdSyncEnabledFlag = true;
      try {
        const connections = await userAPI.getConnections();
        const jdConnection = connections.connections.find(c => c.provider === 'johndeere' || c.provider === 'john_deere');
        jdSyncEnabledFlag = jdConnection?.jd_sync_enabled !== false;
        setJdSyncEnabled(jdSyncEnabledFlag);
        
        // Update JD connected status
        if (jdConnection?.connected) {
          setJdConnected(true);
        }
        
        // Check for sync issues (shown when sync is complete but had problems)
        // Use same toast ID as ConnectionDetails to prevent duplicate toasts
        if (jdConnection?.sync_status === 'completed') {
          const hasFields = (jdConnection?.fields_synced || 0) > 0;
          const hasEquipmentIssue = jdConnection?.error_message === 'NO_EQUIPMENT_ACCESS';
          
          if (!hasFields && hasEquipmentIssue) {
            // No fields AND no equipment access = likely not authorized
            toast.error(
              "Sync completed but no data imported. Please visit JD Operations Center → Connections → AskMyFarm → Edit to grant access permissions.",
              { duration: 15000, id: 'jd-sync-result' }
            );
          } else if (hasEquipmentIssue) {
            // Fields OK but equipment access denied
            toast.warning(
              'Equipment access not granted. Visit JD Operations Center → Connections → AskMyFarm → Edit to enable Equipment tracking.',
              { duration: 12000, id: 'jd-sync-result' }
            );
          }
        }
        
        // Update sync status and trigger polling if syncing
        const syncSt = jdConnection?.sync_status || null;
        setSyncStatus(syncSt);
        if (syncSt === 'in_progress' || syncSt === 'pending') {
          setIsSyncing(true);
        }
      } catch (error) {
        console.error("Failed to check JD sync status:", error);
        // Default to enabled on error
        jdSyncEnabledFlag = true;
        setJdSyncEnabled(true);
      }
      
      // Load remaining data in parallel (slower APIs)
      const [tasksResponse, fieldPlansResponse, scoutingNotesResponse, reportsOrPrescriptions] = await Promise.all([
        tasksAPI.getTasks({ limit: 100 }),
        fieldPlansAPI.getFieldPlans({ limit: 3 }).catch(() => []),
        scoutingNotesAPI.listScoutingNotes({ limit: 3 }).catch(() => ({ notes: [] })),
        jdSyncEnabledFlag 
          ? fieldOperationsAPI.getRecentSummaries(3).catch(() => [])
          : fieldPlansAPI.getPrescriptions({ limit: 3 }).catch(() => [])
      ]);
        
        // Filter for urgent/high priority tasks that are not completed
        const urgent = (tasksResponse.tasks || [])
          .filter((task: any) => 
            (task.priority === 'urgent' || task.priority === 'high') && 
            task.status !== 'completed' && 
            task.status !== 'cancelled'
          )
          .slice(0, 3); // Top 3 urgent tasks
        
        setUrgentTasks(urgent);
        
        // Separate activities by category (top 3 each, already limited by API)
        const fieldPlans = (Array.isArray(fieldPlansResponse) ? fieldPlansResponse : []);
        const scoutingNotes = (scoutingNotesResponse.notes || []);
        
        if (jdSyncEnabledFlag) {
          // Map JD Ops Reports
          const jdReports = (Array.isArray(reportsOrPrescriptions) ? reportsOrPrescriptions : []);
          const jdReportActivities = jdReports.map((report: any) => {
            // Extract crop type from operations_by_type if available
            const operations_by_type = report.operations_by_type || {};
            const crops = Object.keys(operations_by_type).filter(key => 
              key.toLowerCase().includes('corn') || 
              key.toLowerCase().includes('soybean') || 
              key.toLowerCase().includes('wheat')
            );
            const primaryCrop = crops.length > 0 ? crops[0] : null;
            
            // Create subtitle: "12 operations • Corn" or just "12 operations"
            const subtitle = primaryCrop 
              ? `${report.total_operations} operations • ${primaryCrop}`
              : `${report.total_operations} operations`;
            
            return {
              type: 'jd_report',
              id: report.field_id + '-' + report.crop_season,
              field_id: report.field_id,
              field_name: report.field_name,
              year: report.crop_season,
              title: `${report.field_name} - ${report.crop_season}`,
              subtitle: subtitle,
              created_at: report.last_computed_at,
            };
          });
          setRecentJDReports(jdReportActivities);
          setRecentPrescriptions([]);
        } else {
          // Map Prescriptions
          const prescriptions = (Array.isArray(reportsOrPrescriptions) ? reportsOrPrescriptions : []);
          const prescriptionActivities = prescriptions.map((rx: any) => {
            // Format pass type nicely (e.g., "planting" -> "Planting")
            const passType = rx.pass_type 
              ? rx.pass_type.charAt(0).toUpperCase() + rx.pass_type.slice(1).replace('_', ' ')
              : 'Rx';
            
            // Build title: "Product - PassType" or "FieldName - PassType"
            let displayTitle = '';
            if (rx.product_name) {
              displayTitle = `${rx.product_name} - ${passType}`;
            } else if (rx.field_name) {
              displayTitle = `${rx.field_name} - ${passType}`;
            } else {
              displayTitle = `${passType} Prescription`;
            }
            
            // Subtitle: Field name (if we used product in title) or plan name
            const displaySubtitle = rx.product_name && rx.field_name 
              ? rx.field_name 
              : (rx.plan_name || 'Field Plan');
            
            return {
              type: 'prescription',
              id: rx.id,
              field_plan_id: rx.field_plan_id,
              title: displayTitle,
              subtitle: displaySubtitle,
              created_at: rx.created_at,
            };
          });
          setRecentPrescriptions(prescriptionActivities);
          setRecentJDReports([]);
        }
        
        // Map field plans
        const fieldPlanActivities = fieldPlans.map((plan: any) => ({
          type: 'field_plan',
          id: plan.id,
          title: plan.plan_name || 'Field Plan',
          subtitle: plan.field_name || 'Unknown Field',
          created_at: plan.created_at,
        }));
        
        // Map scouting notes
        const scoutingNoteActivities = scoutingNotes.map((note: any) => ({
          type: 'scouting_note',
          id: note.id,
          title: note.field_name ? `${note.field_name} Scouting` : 'Scouting Note',
          subtitle: new Date(note.scouting_date).toLocaleDateString(),
          created_at: note.created_at,
        }));
        
        setRecentFieldPlans(fieldPlanActivities);
        setRecentFieldNotes(scoutingNoteActivities);
      } catch (error: any) {
        console.error("Error fetching data:", error);
        const errorMsg = handlePageError(error, "Failed to load dashboard data");
        if (errorMsg) toast.error(errorMsg);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

  // Track JD connection status
  const [jdConnected, setJdConnected] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Check if JD sync is in progress
  const checkSyncStatus = async () => {
    try {
      const data = await userAPI.getConnections();
      const johnDeere = data.connections.find(c => c.provider === 'johndeere' || c.provider === 'john_deere');
      
      // Update JD connection status
      if (johnDeere?.connected) {
        setJdConnected(true);
      }
      
      // Check for sync issues and show appropriate warning (shown once after sync completes)
      // Use same toast ID to prevent duplicates from multiple pages/functions
      if (johnDeere?.sync_status === 'completed') {
        const hasFields = (johnDeere?.fields_synced || 0) > 0;
        const hasEquipmentIssue = johnDeere?.error_message === 'NO_EQUIPMENT_ACCESS';
        
        if (!hasFields && hasEquipmentIssue) {
          toast.error(
            "Sync completed but no data imported. Please visit JD Operations Center → Connections → AskMyFarm → Edit to grant access permissions.",
            { duration: 15000, id: 'jd-sync-result' }
          );
        } else if (hasEquipmentIssue) {
          toast.warning(
            'Equipment access not granted. Visit JD Operations Center → Connections → AskMyFarm → Edit to enable Equipment tracking.',
            { duration: 12000, id: 'jd-sync-result' }
          );
        }
      }
      
      // Update sync status
      setSyncStatus(johnDeere?.sync_status || null);
      
      if (johnDeere?.sync_status === 'in_progress' || johnDeere?.sync_status === 'pending') {
        setIsSyncing(true);
        return true;
      } else {
        setIsSyncing(false);
        return false;
      }
    } catch (error: any) {
      console.error("Failed to check sync status:", error);
      // If it's a timeout error, show a warning but don't stop the app
      if (error?.message?.includes('timeout')) {
        console.warn("Sync status check timed out, will retry...");
      }
      return false;
    }
  };

  // Poll sync status ONLY when isSyncing is true
  // This effect triggers when isSyncing changes (set by fetchData)
  useEffect(() => {
    if (!isSyncing) return; // Only poll when syncing
    
    let pollInterval: NodeJS.Timeout | null = null;
    let pollCount = 0;
    let consecutiveErrors = 0;
    const maxPolls = 300; // Poll for up to 15 minutes (300 * 3s)
    const maxConsecutiveErrors = 5; // Stop if 5 polls in a row fail
    let isPolling = false; // Prevent overlapping polls

    pollInterval = setInterval(async () => {
      // Skip this poll if previous one is still running
      if (isPolling) {
        console.warn("Previous poll still running, skipping this interval");
        return;
      }
      
      isPolling = true;
      pollCount++;
      
      try {
        const stillSyncing = await checkSyncStatus();
        consecutiveErrors = 0; // Reset error count on success
        
        if (!stillSyncing) {
          // Sync complete - refresh user context and data
          await refreshUser();
          await fetchData();
          if (pollInterval) clearInterval(pollInterval);
        } else if (pollCount >= maxPolls) {
          // Timeout - sync is taking longer, but still running in background
          setIsSyncing(false);
          if (pollInterval) clearInterval(pollInterval);
          toast.info(
            "Field sync is still running in the background. Your fields will appear when the sync completes.",
            { duration: 8000 }
          );
          
          // Start a slower background poll to check for fields every 30 seconds
          const backgroundPoll = setInterval(async () => {
            const data = await fieldsAPI.getFieldsSummary().catch(() => null);
            if (data && data.total_fields > 0) {
              // Only update fields data, don't refresh entire page
              setFieldsData(data);
              await refreshUser();
              clearInterval(backgroundPoll);
              
              // Show a subtle success message
              toast.success(
                `${data.total_fields} fields imported successfully!`,
                { duration: 5000 }
              );
            }
          }, 30000); // Check every 30 seconds
          
          // Stop background polling after 2 hours (extended from 1 hour)
          setTimeout(() => clearInterval(backgroundPoll), 7200000);
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`Poll error (${consecutiveErrors} consecutive):`, error);
        
        // If too many consecutive errors, stop polling and show error
        if (consecutiveErrors >= maxConsecutiveErrors) {
          if (pollInterval) clearInterval(pollInterval);
          setIsSyncing(false);
          toast.error(
            "Unable to check sync status. Please refresh the page or contact support.",
            { duration: 10000 }
          );
        }
      } finally {
        isPolling = false;
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isSyncing]); // Re-run when isSyncing changes

  // Initial data load on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Refetch data when navigating back to Home page (e.g., after deleting a prescription)
  // This ensures the Recent Activity section always shows current data
  // Debounced to prevent excessive API calls
  useEffect(() => {
    let lastFetchTime = 0;
    const DEBOUNCE_MS = 30000; // Only refetch every 30 seconds max
    
    const debouncedFetch = () => {
      const now = Date.now();
      if (now - lastFetchTime > DEBOUNCE_MS) {
        lastFetchTime = now;
        fetchData();
      }
    };
    
    const handleVisibilityChange = () => {
      // Only refetch if the page is now visible (user navigated back)
      if (!document.hidden) {
        debouncedFetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Remove focus handler - visibility change is sufficient and less noisy
    // Focus fires too frequently on desktop (clicking anywhere triggers it)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check if we should show the equipment tracking announcement
  useEffect(() => {
    const checkEquipmentStatus = async () => {
      // Don't show if user dismissed it
      const dismissed = localStorage.getItem('equipment_announcement_dismissed');
      if (dismissed === 'true') {
        setEquipmentCheckDone(true);
        return;
      }

      // Only show if user has JD connection
      if (!user?.jd_connected && !jdConnected) {
        setEquipmentCheckDone(true);
        return;
      }

      // Check if user already has equipment
      try {
        const summary = await equipmentAPI.getSummary();
        if (summary.total_equipment > 0) {
          // User already has equipment, don't show announcement
          setShowEquipmentAnnouncement(false);
        } else {
          // User has JD connection but no equipment - show announcement
          setShowEquipmentAnnouncement(true);
        }
      } catch (error) {
        // If equipment API fails (likely no eq1 scope), show announcement
        console.log("Equipment check failed - likely needs reconnect for eq1 scope");
        setShowEquipmentAnnouncement(true);
      }
      setEquipmentCheckDone(true);
    };

    // Only run after initial data load
    if (!loading && user) {
      checkEquipmentStatus();
    }
  }, [loading, user, jdConnected]);

  const handleDismissEquipmentAnnouncement = () => {
    localStorage.setItem('equipment_announcement_dismissed', 'true');
    setShowEquipmentAnnouncement(false);
  };

  const handleEnableEquipmentTracking = async () => {
    // Mark as dismissed immediately
    localStorage.setItem('equipment_announcement_dismissed', 'true');
    setShowEquipmentAnnouncement(false);
    
    try {
      toast.info("Connecting to John Deere...", { duration: 3000 });
      
      // Call API to get OAuth URL (this triggers re-authorization with new scopes including eq1)
      const response = await connectionAPI.initiateJohnDeereAuth();
      
      if (response.auth_url) {
        // Redirect directly to John Deere OAuth - new tokens will include eq1 scope
        window.location.href = response.auth_url;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error) {
      console.error("Failed to initiate JD connection:", error);
      toast.error("Failed to connect. Please try again from Settings.");
      // Fallback to settings page
      navigate('/settings/connections/johndeere');
    }
  };

  // Format time ago helper
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const handleActivityClick = (item: any) => {
    if (item.type === 'field_plan') {
      navigate(`/field-plans/${item.id}`);
    } else if (item.type === 'scouting_note') {
      navigate(`/scouting-notes/${item.id}`);
    } else if (item.type === 'observation') {
      navigate(`/field-notes/${item.id}`);
    } else if (item.type === 'jd_report') {
      // Navigate to JD Ops Reports with pre-selected field and year
      navigate(`/farm-reports?field=${item.field_id}&year=${item.year}`);
    } else if (item.type === 'prescription') {
      // Navigate to the field plan containing this prescription
      if (item.field_plan_id) {
        navigate(`/field-plans/${item.field_plan_id}`);
      } else {
        // Fallback if field_plan_id is missing
        navigate("/field-plans");
      }
    }
  };

  const handleDocumentUpload = (documentId?: string) => {
    // Navigate to documents page after successful upload
    if (documentId) {
      navigate(`/documents/${documentId}`);
    } else {
      navigate("/documents");
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden page-background">
      <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="min-h-full flex flex-col">
          {/* Welcome Section */}
          <div className="px-6 py-6">
          <div className="flex items-center gap-4 mb-1">
            {user?.farm_logo_url ? (
              <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted border border-white/10 flex-shrink-0">
                <img 
                  src={user.farm_logo_url} 
                  alt="Farm logo" 
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-lg bg-farm-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🚜</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="section-heading mb-0">
                {user?.farm_name || "Welcome back"}
              </h2>
              {/* Show fields data immediately if available (progressive loading) */}
              {fieldsData && fieldsData.total_fields > 0 ? (
                <p className="body-text text-farm-muted">
                  {fieldsData.total_fields} fields • {Math.round(fieldsData.total_acres).toLocaleString()} acres
                </p>
              ) : isSyncing ? (
                <div className="flex items-center gap-2 body-text text-farm-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-farm-accent" />
                  <span>Importing fields from John Deere...</span>
                </div>
              ) : jdConnected && (!fieldsData || fieldsData.total_fields === 0) && (syncStatus === 'in_progress' || syncStatus === 'pending') ? (
                <div className="flex items-center gap-2 body-text text-farm-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-farm-accent" />
                  <span>Processing fields...</span>
                </div>
              ) : loading && !fieldsData ? (
                <p className="body-text text-farm-muted">Loading fields...</p>
              ) : jdConnected && (!fieldsData || fieldsData.total_fields === 0) ? (
                <p className="body-text text-farm-muted">Ready to sync fields from John Deere</p>
              ) : (
                <p className="body-text text-farm-muted">No fields found</p>
              )}
            </div>
            {!user?.jd_connected && !jdConnected && (
              <Button
                onClick={() => navigate("/connect/john-deere")}
                className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark flex-shrink-0 shadow-lg hover:shadow-xl transition-all"
                size="sm"
              >
                Connect JD Ops
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-6 pt-4 pb-6 space-y-5">
        
        {/* Equipment Tracking Announcement */}
        {showEquipmentAnnouncement && equipmentCheckDone && (
          <div className="relative bg-gradient-to-br from-farm-card to-farm-accent/5 border border-farm-accent/30 rounded-xl p-4 shadow-lg">
            {/* Dismiss button */}
            <button
              onClick={handleDismissEquipmentAnnouncement}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-farm-accent/20 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4 text-farm-muted" />
            </button>
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-farm-accent/20 rounded-lg">
                <Tractor className="h-6 w-6 text-farm-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-farm-text text-base">Equipment Tracking is Here!</h3>
                <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">New Feature Update</span>
              </div>
            </div>
            
            {/* Features list */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-farm-text">
                <MapPin className="h-4 w-4 text-farm-accent flex-shrink-0" />
                <span>See equipment locations on the map</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-farm-text">
                <Clock className="h-4 w-4 text-farm-accent flex-shrink-0" />
                <span>Track engine hours per machine</span>
              </div>
            </div>
            
            {/* Action button */}
            <Button
              onClick={handleEnableEquipmentTracking}
              className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <Tractor className="h-4 w-4 mr-2" />
              Enable Equipment Tracking
            </Button>
            
            <p className="text-[11px] text-farm-muted text-center mt-2">
              Takes ~30 seconds. Your existing data stays intact.
            </p>
          </div>
        )}

        {/* Farm Memory Search Input - Enhanced Visibility */}
        <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 hover:bg-farm-accent/5 transition-all">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search farm memory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigate("/farm-memory", { state: { query: searchQuery } });
                }
              }}
              className="flex-1 bg-transparent border-none outline-none text-sm text-farm-text placeholder:text-farm-muted font-medium"
            />
            <button
              onClick={() => {
                if (searchQuery.trim()) {
                  navigate("/farm-memory", { state: { query: searchQuery } });
                } else {
                  navigate("/farm-memory");
                }
              }}
              className="p-2 hover:bg-farm-accent/20 rounded-lg transition-all flex-shrink-0 active:scale-95"
              title="My Farm Memory"
            >
              <Brain className={`h-5 w-5 transition-colors ${
                searchQuery.trim() ? 'text-farm-accent' : 'text-farm-muted'
              }`} />
            </button>
          </div>
        </div>

        {/* Quick Action Buttons - 2x2 Grid */}
        <div className="space-y-3">
          {/* Row 1: Recording Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/voice-capture")}
              className="relative bg-farm-card hover:bg-farm-accent/10 text-farm-accent border border-farm-accent/20 rounded-lg transition-all active:scale-98 flex flex-col items-center justify-center py-4 px-4"
            >
              <Plus className="absolute top-2 right-2 h-4 w-4 stroke-[2] text-farm-accent" />
              <Mic className="h-10 w-10 mb-3 text-farm-accent" />
              <h3 className="card-title mb-0 text-sm text-farm-text">Recording</h3>
            </button>

            <button
              onClick={() => setUploadModalOpen(true)}
              className="relative bg-farm-card hover:bg-farm-accent/10 text-farm-accent border border-farm-accent/20 rounded-lg transition-all active:scale-98 flex flex-col items-center justify-center py-4 px-4"
            >
              <Plus className="absolute top-2 right-2 h-4 w-4 stroke-[2] text-farm-accent" />
              <ImageIcon className="h-10 w-10 mb-3 text-farm-accent" />
              <h3 className="card-title mb-0 text-sm text-farm-text">Doc/Photo</h3>
            </button>
          </div>

          {/* Row 2: Contact & Scouting Notes Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/settings/contacts/new")}
              className="relative bg-farm-card hover:bg-farm-accent/10 text-farm-accent border border-farm-accent/20 rounded-lg transition-all active:scale-98 flex flex-col items-center justify-center py-4 px-4"
            >
              <Plus className="absolute top-2 right-2 h-4 w-4 stroke-[2] text-farm-accent" />
              <UserPlus className="h-10 w-10 mb-3 text-farm-accent" />
              <h3 className="card-title mb-0 text-sm text-farm-text">Contact</h3>
            </button>

            <button
              onClick={() => navigate("/scouting-notes/create")}
              className="relative bg-farm-card hover:bg-farm-accent/10 text-farm-accent border border-farm-accent/20 rounded-lg transition-all active:scale-98 flex flex-col items-center justify-center py-4 px-4"
            >
              <Plus className="absolute top-2 right-2 h-4 w-4 stroke-[2] text-farm-accent" />
              <Leaf className="h-10 w-10 mb-3 text-farm-accent" />
              <h3 className="card-title mb-0 text-sm text-farm-text">Scouting Note</h3>
            </button>
          </div>
        </div>

        {/* Urgent Tasks */}
        {/* <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="label-text">URGENT TASKS</h3>
            <button
              onClick={() => navigate("/tasks")}
              className="text-xs text-primary font-medium hover:underline"
            >
              View all →
            </button>
      </div>

          {loading ? (
            <div className="card-standard text-center">
              <p className="body-text">Loading tasks...</p>
            </div>
          ) : urgentTasks.length === 0 ? (
            <div className="card-standard text-center">
              <div className="icon-brand-emoji mb-3">✅</div>
              <p className="body-text">No urgent tasks</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="card-interactive"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-1 h-full rounded-full flex-shrink-0 ${
                      task.priority === 'urgent' ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                    
              <div className="flex-1 min-w-0">
                      <h4 className="card-title line-clamp-1">
                        {task.title}
                      </h4>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full ${
                          task.priority === 'urgent' 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>
                        
                        {task.field_name && (
                          <span className="flex items-center gap-1">
                            🌾 {task.field_name}
                          </span>
                        )}
                        
                        {task.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
              </div>
            </div>
          </div>
              ))}
            </div>
          )}
          </div> */}

        {/* Recent Activity - By Category */}
        <div className="space-y-6 mt-8">
          <h3 className="label-text">RECENT ACTIVITY</h3>

          {loading ? (
            <div className="card-standard text-center">
              <p className="body-text">Loading activity...</p>
            </div>
          ) : (
            <>
              {/* JD Ops Reports OR Prescriptions (conditional) */}
              {jdSyncEnabled ? (
                /* JD Ops Reports */
                <div>
                  <button
                    onClick={() => setShowJDReports(!showJDReports)}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <Tractor className="h-4 w-4 text-farm-accent" />
                      <span className="text-sm font-medium text-farm-text">JD Ops Reports</span>
                      {recentJDReports.length > 0 && (
                        <span className="text-xs text-farm-muted">({recentJDReports.length})</span>
                      )}
                    </div>
                    {showJDReports ? (
                      <ChevronUp className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                    )}
                  </button>

                  {showJDReports && (
                    recentJDReports.length === 0 ? (
                      <div className="text-center py-4 text-sm text-farm-muted">
                        No JD operations data yet
                      </div>
                    ) : (
                      <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 divide-y divide-farm-accent/10">
                        {recentJDReports.map((item: any) => (
                          <div
                            key={item.id}
                            onClick={() => handleActivityClick(item)}
                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 rounded-lg hover:bg-farm-accent/10 transition-all cursor-pointer"
                          >
                            <Tractor className="h-5 w-5 text-farm-accent flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="card-title line-clamp-1">{item.title}</h4>
                              <div className="flex items-center justify-between text-xs text-farm-muted">
                                <span className="truncate">{item.subtitle}</span>
                                <span className="ml-2 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              ) : (
                /* Prescriptions */
                <div>
                  <button
                    onClick={() => setShowPrescriptions(!showPrescriptions)}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <div className="flex items-center gap-2">
                      <Sprout className="h-4 w-4 text-farm-accent" />
                      <span className="text-sm font-medium text-farm-text">Prescriptions</span>
                      {recentPrescriptions.length > 0 && (
                        <span className="text-xs text-farm-muted">({recentPrescriptions.length})</span>
                      )}
                    </div>
                    {showPrescriptions ? (
                      <ChevronUp className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                    )}
                  </button>

                  {showPrescriptions && (
                    recentPrescriptions.length === 0 ? (
                      <div className="text-center py-4 text-sm text-farm-muted">
                        No prescriptions yet
                      </div>
                    ) : (
                      <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 divide-y divide-farm-accent/10">
                        {recentPrescriptions.map((item: any) => (
                          <div
                            key={item.id}
                            onClick={() => handleActivityClick(item)}
                            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 rounded-lg hover:bg-farm-accent/10 transition-all cursor-pointer"
                          >
                            <Sprout className="h-5 w-5 text-farm-accent flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="card-title line-clamp-1">{item.title}</h4>
                              <div className="flex items-center justify-between text-xs text-farm-muted">
                                <span className="truncate">{item.subtitle}</span>
                                <span className="ml-2 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Field Plans */}
              <div className="pt-6 border-t border-farm-accent/10">
                <button
                  onClick={() => setShowFieldPlans(!showFieldPlans)}
                  className="w-full flex items-center justify-between mb-2 group"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-farm-accent" />
                    <span className="text-sm font-medium text-farm-text">Field Plans</span>
                    {recentFieldPlans.length > 0 && (
                      <span className="text-xs text-farm-muted">({recentFieldPlans.length})</span>
                    )}
                  </div>
                  {showFieldPlans ? (
                    <ChevronUp className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                  )}
                </button>

                {showFieldPlans && (
                  recentFieldPlans.length === 0 ? (
                    <div className="text-center py-4 text-sm text-farm-muted">
                      No field plans yet
                    </div>
                  ) : (
                    <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 divide-y divide-farm-accent/10">
                      {recentFieldPlans.map((item: any) => (
                        <div
                          key={item.id}
                          onClick={() => handleActivityClick(item)}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 rounded-lg hover:bg-farm-accent/10 transition-all cursor-pointer"
                        >
                          <BarChart3 className="h-5 w-5 text-farm-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="card-title line-clamp-1">{item.title}</h4>
                            <div className="flex items-center justify-between text-xs text-farm-muted">
                              <span className="truncate">{item.subtitle}</span>
                              <span className="ml-2 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Scouting Notes */}
              <div className="pt-6 border-t border-farm-accent/10">
                <button
                  onClick={() => setShowFieldNotes(!showFieldNotes)}
                  className="w-full flex items-center justify-between mb-2 group"
                >
                  <div className="flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-farm-accent" />
                    <span className="text-sm font-medium text-farm-text">Scouting Notes</span>
                    {recentFieldNotes.length > 0 && (
                      <span className="text-xs text-farm-muted">({recentFieldNotes.length})</span>
                    )}
                  </div>
                  {showFieldNotes ? (
                    <ChevronUp className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-farm-muted group-hover:text-farm-text transition-colors" />
                  )}
                </button>

                {showFieldNotes && (
                  recentFieldNotes.length === 0 ? (
                    <div className="text-center py-4 text-sm text-farm-muted">
                      No scouting notes yet
                    </div>
                  ) : (
                    <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 divide-y divide-farm-accent/10">
                      {recentFieldNotes.map((item: any) => (
                        <div
                          key={item.id}
                          onClick={() => handleActivityClick(item)}
                          className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 rounded-lg hover:bg-farm-accent/10 transition-all cursor-pointer"
                        >
                          <Leaf className="h-5 w-5 text-farm-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="card-title line-clamp-1">{item.title}</h4>
                            <div className="flex items-center justify-between text-xs text-farm-muted">
                              <span className="truncate">{item.subtitle}</span>
                              <span className="ml-2 whitespace-nowrap">{formatTimeAgo(item.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        
        {/* Syncing Status (if sync in progress) */}
        {!loading && isSyncing && (
          <div className="card-standard text-center bg-gradient-to-br from-farm-accent/10 to-transparent">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-farm-accent/10 mb-4">
              <Loader2 className="h-8 w-8 text-farm-accent animate-spin" />
            </div>
            <h3 className="section-heading text-farm-text">Importing Fields</h3>
            <p className="body-text text-farm-muted max-w-sm mx-auto">
              Syncing your fields from John Deere Operations Center. This typically takes 15-30 minutes depending on the number of fields.
            </p>
            <p className="text-xs text-farm-muted mt-4">
              Large operations with many fields may take longer. Your fields will appear here automatically when the sync completes.
            </p>
          </div>
        )}
        </div>
        </div>
      </div>

      {/* Upload Document Modal */}
      <DocumentUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={handleDocumentUpload}
      />
    </div>
  );
};

export default Home;
