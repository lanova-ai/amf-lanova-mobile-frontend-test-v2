import { useState } from "react";
import { Menu, Home, BarChart3, Mic, Settings, LogOut, FolderOpen, MapPin, Brain, FileBarChart2, Leaf } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    setShowMenu(false);
    logout();
    navigate('/');
  };

  // Generate user initials
  const getUserInitials = () => {
    if (!user) return "U";
    const firstInitial = user.first_name?.[0]?.toUpperCase() || "";
    const lastInitial = user.last_name?.[0]?.toUpperCase() || "";
    return firstInitial + lastInitial || "U";
  };

  // Check if current route is active
  const isActive = (path: string) => location.pathname === path;

  // Route-based page titles for main navigation pages
  const getPageTitle = (): string | null => {
    const pageTitles: Record<string, string> = {
      '/documents': 'Docs & Photos',
      '/recordings': 'Recordings',
      '/field-plans': 'Field Plans',
      '/scouting-notes': 'Scouting Notes',
      '/field-notes': 'Field Notes',
      '/tasks': 'Tasks',
      '/settings': 'Settings',
      '/settings/profile': 'Edit Profile',
      '/settings/farm': 'Farm Details',
      '/settings/contacts': 'Contacts',
      '/settings/contacts/new': 'New Contact',
      '/settings/change-password': 'Change Password',
      '/settings/connections/johndeere': 'JD Connection',
      '/farm-reports': 'JD Ops Reports',
      '/farm-memory': 'Farm Memory',
    };
    
    // Check exact match first
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }
    
    // Check dynamic routes
    if (location.pathname.match(/^\/settings\/contacts\/[^/]+\/edit$/)) {
      return 'Edit Contact';
    }
    
    return null;
  };

  const pageTitle = getPageTitle();

  return (
    <div className="h-screen bg-background flex lg:justify-center overflow-hidden">
      {/* Left Mobile Indicator - Desktop Only */}
      <MobileFirstIndicator />
      
      {/* Main App Container - Constrained to mobile width on desktop (512px = max-w-lg) */}
      <div className="relative flex-1 lg:flex-none lg:w-[512px] h-full flex flex-col lg:border-x lg:border-farm-accent/10 overflow-hidden">
        {/* Persistent Header */}
        <header className={`sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-[100] ${
          location.pathname === '/map' ? 'bg-background/70' : 'bg-background/95'
        }`}>
          <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => setShowMenu(true)} className="p-2">
            <Menu className="h-6 w-6" />
          </button>
          {/* Show page title for main nav pages, AskMyFarm branding for home/map/detail pages */}
          {location.pathname === '/home' || location.pathname === '/map' || !pageTitle ? (
            <h1 className="text-xl font-bold">
              <span className="text-primary">Ask</span>
              <span className="text-farm-gold">My</span>
              <span className="text-primary">Farm</span>
            </h1>
          ) : location.pathname === '/amf-reports' ? (
            <h1 className="text-xl font-bold">
              <span className="text-primary">A</span>
              <span className="text-farm-gold">M</span>
              <span className="text-primary">F</span>
              <span className="text-farm-text"> Reports</span>
            </h1>
          ) : (
            <h1 className="text-xl font-bold text-farm-text">{pageTitle}</h1>
          )}
          <div className="flex items-center gap-1">
            {/* Network Status Indicator - Always show */}
            <NetworkStatusIndicator showOnlineStatus={true} />
            
            {/* Map Button */}
            <button 
              onClick={() => navigate('/map')} 
              className={`p-2 rounded-lg transition-colors ${
                location.pathname === '/map' 
                  ? 'bg-primary/10 text-primary' 
                  : 'hover:bg-muted'
              }`}
              title="View Map"
            >
              <MapPin className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger Menu Drawer */}
      {showMenu && (
        <>
          <div
            className="absolute inset-0 bg-black/5 backdrop-blur-[2px] z-[9998]"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-0 left-0 bottom-0 w-56 bg-farm-dark border-r border-farm-accent/20 shadow-xl z-[9999] animate-slide-in-left flex flex-col h-full">
            {/* Scrollable Navigation Section */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-4">
                <div className="flex items-center justify-end mb-4">
                  <button onClick={() => setShowMenu(false)} className="p-2">
                    ✕
                  </button>
                </div>

                <nav className="space-y-1">
                {/* Group 1: Home & Farm Memory */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/home");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    isActive("/home") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <Home className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Home</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/farm-memory");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/farm-memory") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <Brain className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Farm Memory</span>
                </button>

                {/* Separator */}
                <div className="my-1 border-t border-dashed border-border"></div>

                {/* Group 2: JD Ops Reports */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/farm-reports");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/farm-reports") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <FileBarChart2 className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">JD Ops Reports</span>
                </button>

                {/* AMF Field Reports */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/amf-reports");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/amf-reports") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <FileBarChart2 className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">
                    <span className="text-farm-accent">A</span>
                    <span className="text-amber-500">M</span>
                    <span className="text-farm-accent">F</span>
                    {" "}Reports
                  </span>
                </button>

                {/* Separator */}
                <div className="my-1 border-t border-dashed border-border"></div>

                {/* Group 3: Scouting Notes & Plans */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/scouting-notes");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/scouting-notes") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <Leaf className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Scouting Notes</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/field-plans");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/field-plans") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <BarChart3 className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Field Plans</span>
                </button>

                {/* <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/tasks");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/tasks") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <CheckSquare className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Tasks</span>
                </button> */}

                {/* Separator */}
                <div className="my-1 border-t border-dashed border-border"></div>

                {/* Group 4: Docs & Photos, Recordings */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/documents");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/documents") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <FolderOpen className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Docs & Photos</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/recordings");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/recordings") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <Mic className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Recordings</span>
                </button>

                {/* FIELD NOTES - Temporarily commented out (replaced by Scouting Notes) */}
                {/* <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/field-notes");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                    isActive("/field-notes") ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <FileText className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span className="font-medium">Notes</span>
                </button> */}
                </nav>
              </div>
            </div>

            {/* User Section - Bottom (Fixed) */}
            <div className="mt-auto border-t p-4 flex-shrink-0">
              {/* User Profile */}
              <div className="flex items-center gap-3 mb-3">
                {user?.farm_logo_url ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border-2 border-primary/20">
                    <img 
                      src={user.farm_logo_url} 
                      alt="Farm logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary text-primary-foreground font-bold text-base">
                    {getUserInitials()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || user?.phone_number}</p>
                </div>
              </div>

              {/* User Actions */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/settings");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left text-sm"
                >
                  <Settings className="w-5 h-5 flex-shrink-0 text-farm-accent" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors text-left text-sm text-destructive"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0 text-destructive" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
      
      {/* Right Mobile Indicator - Desktop Only */}
      <MobileFirstIndicator />
    </div>
  );
};

export default Layout;

