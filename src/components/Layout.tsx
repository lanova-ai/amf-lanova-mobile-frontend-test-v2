import { useState } from "react";
import { Menu, Home, Map, CheckSquare, FileText, BarChart3, Mic, Settings, LogOut, FolderOpen, MapPin, Brain, FileBarChart2, Leaf } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/home') return 'AskMyFarm';
    if (path === '/map') return 'AskMyFarm'; // Show AskMyFarm title on map page
    if (path === '/farm-memory') return 'Farm Memory';
    if (path === '/farm-reports' || path.startsWith('/farm-reports/')) return 'JD Ops Reports';
    // if (path === '/tasks' || path.startsWith('/tasks/')) return 'Tasks';
    // FIELD NOTES - Temporarily commented out (replaced by Scouting Notes)
    // if (path === '/field-notes' || path.startsWith('/field-notes/')) return 'Notes';
    if (path === '/scouting-notes') return 'Scouting Notes';
    if (path === '/scouting-notes/create') return 'New Scouting Note';
    if (path.startsWith('/scouting-notes/')) return 'Scouting Note Details';
    if (path === '/field-plans' || path.startsWith('/field-plans/')) return 'Field Plans';
    if (path === '/recordings' || path.startsWith('/recordings/')) return 'Recordings';
    if (path === '/documents' || path.startsWith('/documents/')) return 'Docs & Photos';
    return 'AskMyFarm';
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Persistent Header */}
      <header className={`sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b z-[100] ${
        location.pathname === '/map' ? 'bg-background/70' : 'bg-background/95'
      }`}>
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => setShowMenu(true)} className="p-2">
            <Menu className="h-6 w-6" />
          </button>
          {(location.pathname === '/home' || location.pathname === '/map') ? (
            <h1 className="text-xl font-bold">
              <span className="text-primary">Ask</span>
              <span className="text-yellow-400">My</span>
              <span className="text-primary">Farm</span>
            </h1>
          ) : (
            getPageTitle() && <h1 className="text-xl font-bold">{getPageTitle()}</h1>
          )}
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
      </header>

      {/* Hamburger Menu Drawer */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[9998]"
            onClick={() => setShowMenu(false)}
          />
          <div className="fixed top-0 left-0 bottom-0 w-56 bg-farm-dark border-r border-farm-accent/20 shadow-xl z-[9999] animate-slide-in-left flex flex-col h-full">
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
  );
};

export default Layout;

