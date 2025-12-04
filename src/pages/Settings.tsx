import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  User, 
  Building2, 
  Link2, 
  Users, 
  Bell, 
  ChevronRight,
  LogOut,
  CheckCircle2,
  XCircle,
  Upload,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  Lock,
  FileBarChart
} from "lucide-react";
import { toast } from "sonner";
import { userAPI, UserProfile, ConnectionStatus } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { LogoUploadModal } from "@/components/LogoUploadModal";
import {
  Page,
  PageHeader,
  PageContent,
  PageLoading,
  Section,
  Button,
  Label,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadData();
    
    // Check for JD OAuth errors in URL
    const jdError = searchParams.get('jd_error');
    if (jdError) {
      handleJDOAuthError(jdError);
      // Clean up URL
      searchParams.delete('jd_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const handleJDOAuthError = (errorCode: string) => {
    const errorMessages: Record<string, { title: string; message: string }> = {
      'invalid_state': {
        title: 'John Deere Connection Failed',
        message: 'The connection request expired or was invalid. Please try connecting again. If the issue persists, contact support.'
      },
      'access_denied': {
        title: 'Connection Cancelled',
        message: 'You cancelled the John Deere connection. You can try again anytime from Settings.'
      },
      'invalid_grant': {
        title: 'Authorization Failed',
        message: 'The authorization code was invalid or expired. Please try connecting again.'
      },
      'server_error': {
        title: 'Server Error',
        message: 'John Deere encountered an error. Please try again later or contact support if the issue persists.'
      }
    };

    const error = errorMessages[errorCode] || {
      title: 'Connection Error',
      message: `An error occurred during John Deere connection (${errorCode}). Please try again or contact support if the issue persists.`
    };

    toast.error(error.title, {
      description: error.message,
      duration: 8000,
      action: {
        label: "Retry",
        onClick: () => navigate('/connect/john-deere')
      }
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileData, connectionsData] = await Promise.all([
        userAPI.getProfile(),
        userAPI.getConnections()
      ]);
      setProfile(profileData);
      setConnections(connectionsData.connections);
    } catch (error: any) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (type: 'email' | 'sms' | 'push', value: boolean) => {
    try {
      await userAPI.updateNotifications({ [type]: value });
      setProfile(prev => prev ? {
        ...prev,
        notification_preferences: {
          ...prev.notification_preferences!,
          [type]: value
        }
      } : null);
      toast.success("Notification preferences updated");
    } catch (error) {
      toast.error("Failed to update notifications");
    }
  };

  const handleLogoUploadSuccess = async (logoUrl: string) => {
    setProfile(prev => prev ? { ...prev, farm_logo_url: logoUrl } : null);
    // Refresh user context so logo appears everywhere (Home, Menu, etc.)
    await refreshUser();
  };

  const handleLogoDelete = async () => {
    try {
      await userAPI.deleteFarmLogo();
      setProfile(prev => prev ? { ...prev, farm_logo_url: undefined } : null);
      
      // Refresh user context so logo removal appears everywhere
      await refreshUser();
      
      toast.success("Farm logo deleted successfully");
      setShowDeleteDialog(false);
    } catch (error: any) {
      console.error("Logo delete failed:", error);
      toast.error(error.message || "Failed to delete farm logo");
    }
  };

  const handleLogout = async () => {
    try {
      await userAPI.logout();
      logout();
      navigate("/");
    } catch (error) {
      // Still logout on client side even if API call fails
      logout();
      navigate("/");
    }
  };

  if (loading) return <PageLoading />;
  
  if (!profile) {
    return (
      <Page>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <XCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-farm-muted">Failed to load profile</p>
          <Button onClick={loadData} className="mt-4">Retry</Button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Settings" backTo="/home" />

      <PageContent>
        {/* (a) Farm Logo */}
        <Section title="Farm Logo" description="Personalize your dashboard">
          {profile.farm_logo_url ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-lg border-2 border-farm-accent/20 overflow-hidden bg-farm-dark flex items-center justify-center">
                  <img 
                    src={profile.farm_logo_url} 
                    alt="Farm logo" 
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-farm-text">Current logo</p>
                  <p className="text-xs text-farm-muted mt-1">512x512 pixels</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  onClick={() => setLogoModalOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Change Logo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-farm-accent/20 rounded-lg bg-farm-dark">
                <div className="text-center">
                  <Building2 className="h-12 w-12 mx-auto text-farm-muted mb-2" />
                  <p className="text-sm text-farm-muted">No logo uploaded</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                onClick={() => setLogoModalOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Farm Logo
              </Button>
              <p className="text-xs text-farm-muted text-center">
                Recommended: Square image, min 200x200px • Max 5MB
              </p>
            </div>
          )}
        </Section>

        {/* (b) My Contacts */}
        <Section>
          <button
            onClick={() => navigate("/settings/contacts")}
            className="w-full flex items-center gap-3 hover:bg-farm-accent/5 transition-colors text-left -m-4 p-4 rounded-lg"
          >
            <Users className="h-6 w-6 text-farm-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-farm-text">My Contacts</h3>
              <p className="text-sm text-farm-muted">
                Agronomists, advisors, buyers
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-farm-text flex-shrink-0" />
          </button>
        </Section>

        {/* AMF Field Reports */}
        <Section>
          <button
            onClick={() => navigate("/amf-reports")}
            className="w-full flex items-center gap-3 hover:bg-farm-accent/5 transition-colors text-left -m-4 p-4 rounded-lg"
          >
            <FileBarChart className="h-6 w-6 text-farm-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-farm-text">
                <span className="text-farm-accent">A</span>
                <span className="text-amber-500">M</span>
                <span className="text-farm-accent">F</span>
                {" "}Field Reports
              </h3>
              <p className="text-sm text-farm-muted">
                Unified field dashboard & sharing
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-farm-text flex-shrink-0" />
          </button>
        </Section>

        {/* (c) John Deere Ops Connectivity */}
        <Section>
          <button
            onClick={() => navigate(`/settings/connections/johndeere`)}
            className="w-full flex items-center gap-3 hover:bg-farm-accent/5 transition-colors text-left -m-4 p-4 rounded-lg"
          >
            <Link2 className="h-6 w-6 text-farm-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-farm-text">John Deere Ops Connectivity</h3>
              <p className="text-sm text-farm-muted">
                Connected services
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-farm-text flex-shrink-0" />
          </button>
        </Section>

        {/* (d) Notifications */}
        <Section title="Notifications" description="Manage alerts">

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="email-notif" className="text-sm font-medium text-farm-text">
                  Email Notifications
                </Label>
                <p className="text-xs text-farm-muted">
                  Receive updates via email
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={profile.notification_preferences?.email ?? true}
                onCheckedChange={(checked) => handleNotificationToggle('email', checked)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="sms-notif" className="text-sm font-medium text-farm-text">
                    SMS Notifications
                  </Label>
                  <div className="mt-2 space-y-1.5 text-xs text-farm-muted">
                    <p>
                      Receive field updates, task alerts, and shared plans from <strong>Lanova AI</strong>.
                    </p>
                    <p>
                      Typically 5-20 messages/month. <span className="font-medium">Message and data rates may apply.</span>
                    </p>
                    <p>
                      Reply <strong>STOP</strong> to opt out anytime. Reply <strong>HELP</strong> for help.
                    </p>
                    <p className="text-[11px]">
                      <a href="/terms" target="_blank" className="underline hover:text-farm-accent">Terms</a>
                      {' • '}
                      <a href="/privacy" target="_blank" className="underline hover:text-farm-accent">Privacy Policy</a>
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms-notif"
                  checked={profile.notification_preferences?.sms ?? false}
                  onCheckedChange={(checked) => handleNotificationToggle('sms', checked)}
                  disabled={!profile.phone_number}
                />
              </div>

              {!profile.phone_number && (
                <p className="text-xs text-farm-muted">
                  Add a phone number to enable SMS notifications
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* (e) Farm Details */}
        <Section>
          <button
            onClick={() => navigate("/settings/farm")}
            className="w-full flex items-center gap-3 hover:bg-farm-accent/5 transition-colors text-left -m-4 p-4 rounded-lg"
          >
            <Building2 className="h-6 w-6 text-farm-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-farm-text">Farm Details</h3>
              <p className="text-sm text-farm-muted">
                {profile.farm_name || "Not set"} • {profile.total_acres_range || "Unknown acres"}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-farm-text flex-shrink-0" />
          </button>
        </Section>

        {/* (f) Change Password */}
        <Section>
          <button
            onClick={() => navigate("/settings/change-password")}
            className="w-full flex items-center gap-3 hover:bg-farm-accent/5 transition-colors text-left -m-4 p-4 rounded-lg"
          >
            <Lock className="h-6 w-6 text-farm-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-farm-text">Change Password</h3>
              <p className="text-sm text-farm-muted">
                Update your account password
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-farm-text flex-shrink-0" />
          </button>
        </Section>

        {/* (g) User Profile */}
        <Section>
          <div className="flex items-center gap-4 mb-4">
            <User className="h-8 w-8 text-farm-accent" />
            <div className="flex-1">
              <h2 className="font-semibold text-lg text-farm-text">
                {profile.first_name && profile.last_name 
                  ? `${profile.first_name} ${profile.last_name}`
                  : profile.email}
              </h2>
              <p className="text-sm text-farm-muted">{profile.email}</p>
              {profile.phone_number && (
                <p className="text-sm text-farm-muted">{profile.phone_number}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10 flex items-center justify-between"
            onClick={() => navigate("/settings/profile")}
          >
            <span>Edit Profile</span>
            <ChevronRight className="h-4 w-4 text-farm-accent flex-shrink-0" />
          </Button>
        </Section>

        {/* Logout */}
        <div className="pt-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </PageContent>

      {/* Delete Logo Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Farm Logo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your farm logo from the dashboard and menu. You can upload a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logo Upload Modal */}
      <LogoUploadModal
        open={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
        onUploadSuccess={handleLogoUploadSuccess}
      />
    </Page>
  );
}

