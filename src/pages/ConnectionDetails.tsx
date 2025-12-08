import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Unlink, CheckCircle2, XCircle, Clock, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { userAPI, connectionAPI, ConnectionStatus } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

export default function ConnectionDetails() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [jdConnection, setJdConnection] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await userAPI.getConnections();
      // Find the John Deere connection from the array
      const johnDeere = data.connections.find(c => c.provider === 'johndeere' || c.provider === 'john_deere');
      console.log('JD Connection loaded:', johnDeere);
      setJdConnection(johnDeere || null);
      
      // If sync is in progress or pending, start polling
      if (johnDeere?.sync_status === 'in_progress' || johnDeere?.sync_status === 'pending') {
        setSyncing(true);
        toast.info("Field sync in progress... This may take a minute.", { duration: 8000 });
        startSyncPolling();
      }
    } catch (error: any) {
      console.error("Failed to load connections:", error);
      toast.error("Failed to load connection details");
    } finally {
      setLoading(false);
    }
  };

  const startSyncPolling = async () => {
    let pollCount = 0;
    const maxPolls = 300; // Poll for up to 15 minutes (300 * 3 seconds)
    
    const pollInterval = setInterval(async () => {
      try {
        const data = await userAPI.getConnections();
        const johnDeere = data.connections.find(c => c.provider === 'johndeere' || c.provider === 'john_deere');
        
        if (johnDeere) {
          setJdConnection(johnDeere);
          
          // Check if sync is complete
          if (johnDeere.sync_status === 'completed') {
            clearInterval(pollInterval);
            setSyncing(false);
            toast.success("Sync complete! Your fields are up to date.");
          } else if (johnDeere.sync_status === 'failed') {
            clearInterval(pollInterval);
            setSyncing(false);
            toast.error("Field sync failed. Please try again.");
          }
        }
        
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          setSyncing(false);
          toast.info(
            "Field sync is still running in the background. Your fields will appear when the sync completes.",
            { duration: 8000 }
          );
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000); // Poll every 3 seconds
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      toast.info("Starting field sync from John Deere...");
      
      // Call the sync API endpoint
      const result = await connectionAPI.syncJohnDeereFields();
      
      toast.success("Field sync started! Importing data in the background...");
      console.log("Sync result:", result);
      
      // Wait for background job to complete (syncs typically take 30-60 seconds)
      await new Promise(resolve => setTimeout(resolve, 35000));
      
      // Reload connection data without showing full page loading
      try {
        const data = await userAPI.getConnections();
        const johnDeere = data.connections.find(c => c.provider === 'johndeere' || c.provider === 'john_deere');
        setJdConnection(johnDeere || null);
        toast.success("Sync complete! Your fields are up to date.");
      } catch (error) {
        console.error("Failed to reload connection data:", error);
        // Still show success for the sync itself
      }
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast.error(error.message || "Failed to sync fields");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await userAPI.disconnectProvider("johndeere");
      toast.success("Disconnected from John Deere");
      setShowDisconnectDialog(false); // Close the dialog
      // Reload the connection data to show disconnected state
      await loadConnections();
    } catch (error: any) {
      console.error("Failed to disconnect:", error);
      toast.error(error.message || "Failed to disconnect");
      setShowDisconnectDialog(false); // Close dialog even on error
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-farm-dark">
        <Loader2 className="h-8 w-8 animate-spin text-farm-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-farm-dark">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-farm-dark border-b border-farm-accent/20">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              className="hover:bg-farm-accent/10"
            >
              <ArrowLeft className="h-5 w-5 text-farm-text" />
            </Button>
            <h1 className="text-xl font-semibold text-farm-text">John Deere Ops Connectivity</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-6">
        {/* Connection Status */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4 space-y-4">
          <h2 className="font-semibold text-lg text-farm-text">Connection Status</h2>
          
          <div className="flex items-center justify-between py-3 border-b border-farm-accent/10">
            <div className="flex items-center gap-3">
              {jdConnection?.connected ? (
                <CheckCircle2 className="h-5 w-5 text-farm-accent" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="font-medium text-farm-text">
                  {jdConnection?.connected ? "Connected" : "Disconnected"}
                </p>
                {jdConnection?.organization_name && (
                  <p className="text-sm text-farm-muted">
                    {jdConnection.organization_name}
                  </p>
                )}
              </div>
            </div>
            <div className={`
              px-3 py-1 rounded-full text-xs font-medium
              ${jdConnection?.connected 
                ? 'bg-farm-accent/10 text-farm-accent'
                : 'bg-destructive/10 text-destructive'
              }
            `}>
              {jdConnection?.connected ? "Active" : "Inactive"}
            </div>
          </div>

          {jdConnection?.last_sync_at && (
            <div className="flex items-center justify-between py-3 border-b border-farm-accent/10">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-farm-muted" />
                <div>
                  <p className="font-medium text-farm-text">Last Sync</p>
                  <p className="text-sm text-farm-muted">
                    {formatDistanceToNow(new Date(jdConnection.last_sync_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {jdConnection?.fields_synced !== undefined && (
            <div className="space-y-3 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-farm-text">Total Fields</p>
                  <p className="text-sm text-farm-muted">
                    All fields from John Deere
                  </p>
                </div>
                <div className="text-2xl font-bold text-farm-text">
                  {syncing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-farm-accent" />
                  ) : (
                    jdConnection.fields_synced
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-farm-accent/10 pt-3">
                <div>
                  <p className="font-medium text-farm-accent">With Boundaries</p>
                  <p className="text-sm text-farm-muted">
                    {syncing ? "Importing..." : "Fields ready for field plans"}
                  </p>
                </div>
                <div className="text-2xl font-bold text-farm-accent">
                  {syncing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    jdConnection.fields_with_boundaries ?? 0
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4 space-y-3">
          <h2 className="font-semibold text-lg text-farm-text">Actions</h2>
          
          {jdConnection?.connected ? (
            <>
              {/* Warning for disabled JD sync */}
              {jdConnection?.jd_sync_enabled === false && (
                <div className="bg-farm-gold/10 border border-farm-gold/20 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="text-farm-gold text-lg mt-0.5">⚠️</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-farm-gold mb-1">
                        JD Sync Disabled
                      </p>
                      <p className="text-xs text-farm-muted">
                        John Deere field sync is currently disabled for your account.
                        This feature is only available for users with JD sync capability.
                        Contact support if you need this feature enabled.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSync}
                disabled={syncing || jdConnection?.jd_sync_enabled === false}
                className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                variant="outline"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-sync Fields Now
                  </>
                )}
              </Button>

              <p className="text-xs text-farm-muted px-1">
                {jdConnection?.jd_sync_enabled === false 
                  ? "Field sync is disabled for your account type"
                  : "Manually trigger a sync to import the latest field data from John Deere Operations Center"
                }
              </p>

              {/* Grant Organization Access */}
              <div className="pt-4 border-t border-farm-accent/10">
                <Button
                  onClick={() => {
                    // Open in external browser (not PWA)
                    window.open(
                      'https://connections.deere.com/connections/0oaqyaxtyhUjkNhmU5d7/select-organizations',
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                  variant="outline"
                  className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Grant Organization Access
                  <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
                </Button>
                <p className="text-xs text-farm-muted mt-2 px-1">
                  If your fields aren't showing up, click here to grant access to your JD organizations
                </p>
              </div>

              <div className="pt-4 border-t border-farm-accent/10">
                <Button
                  onClick={() => setShowDisconnectDialog(true)}
                  variant="destructive"
                  className="w-full"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Disconnect John Deere
                </Button>
                <p className="text-xs text-farm-muted mt-2 px-1">
                  This will remove the connection but keep your existing field data
                </p>
              </div>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate('/connect/john-deere')}
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Connect to John Deere
              </Button>
              <p className="text-xs text-farm-muted px-1">
                Connect your John Deere Operations Center account to import fields and sync data
              </p>
            </>
          )}
        </div>

        {/* Info */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4">
          <h3 className="font-medium mb-2 text-farm-text">About John Deere Integration</h3>
          <p className="text-sm text-farm-muted">
            The John Deere connection allows you to sync the latest field boundaries 
            directly from your Operations Center account. 
            Use the "Re-sync Fields Now" button above to import updated field data from John Deere anytime.
          </p>
        </div>

        {/* Bottom padding for mobile */}
        <div className="pb-20" />
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect John Deere?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your John Deere Operations Center account. 
              Your existing field data will be preserved, but automatic syncing will stop.
              You can reconnect anytime from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

