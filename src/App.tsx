import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { InstallPrompt } from "@/components/InstallPrompt";
import { offlineQueue } from "@/services/offlineQueue";
import { voiceAPI } from "@/lib/api";
import { toast } from "sonner";
import Welcome from "./pages/Welcome";
import WelcomeNew from "./pages/WelcomeNew";
import Login from "./pages/Login";
import PhoneAuth from "./pages/PhoneAuth";
import JohnDeereConnect from "./pages/JohnDeereConnect";
import JDImporting from "./pages/JDImporting";
import ConnectionSuccess from "./pages/ConnectionSuccess";
import Home from "./pages/Home";
import VoiceCapture from "./pages/VoiceCapture";
import Recordings from "./pages/Recordings";
import RecordingDetail from "./pages/RecordingDetail";
// FIELD NOTES - Temporarily commented out (replaced by Scouting Notes)
// import FieldNotesList from "./pages/FieldNotesList";
// import FieldNoteDetail from "./pages/FieldNoteDetail";
// import FieldNoteForm from "./pages/FieldNoteForm";
// import Tasks from "./pages/Tasks";
// import TaskDetail from "./pages/TaskDetail";
// import TaskForm from "./pages/TaskForm";
import FieldPlans from "./pages/FieldPlans";
import FieldPlanDetail from "./pages/FieldPlanDetail";
import FieldPlanEdit from "./pages/FieldPlanEdit";
import FieldPlanSummaryDetail from "./pages/FieldPlanSummaryDetail";
import ShareFieldPlanSummary from "./pages/ShareFieldPlanSummary";
import SharePlans from "./pages/SharePlans";
import ShareTimeline from "./pages/ShareTimeline";
import ShareDocument from "./pages/ShareDocument";
import GeneratePrescription from "./pages/GeneratePrescription";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import FieldsMap from "./pages/FieldsMap";
import BriefingView from "./pages/BriefingView";
import Settings from "./pages/Settings";
import ProfileEdit from "./pages/ProfileEdit";
import FarmDetailsEdit from "./pages/FarmDetailsEdit";
import ConnectionDetails from "./pages/ConnectionDetails";
import ChangePassword from "./pages/ChangePassword";
import SetPassword from "./pages/SetPassword";
import ContactsList from "./pages/ContactsList";
import ContactForm from "./pages/ContactForm";
import FarmMemory from "./pages/FarmMemory";
import FarmReports from "./pages/FarmReports";
import FoundingFarmerApply from "./pages/FoundingFarmerApply";
import FoundingFarmerSignup from "./pages/FoundingFarmerSignup";
import ScoutingNotes from "./pages/ScoutingNotes";
import ScoutingNoteDetail from "./pages/ScoutingNoteDetail";
import ScoutingNoteCreate from "./pages/ScoutingNoteCreate";
import ScoutingSummaryDetail from "./pages/ScoutingSummaryDetail";
import ShareScoutingSummary from "./pages/ShareScoutingSummary";
import ScoutingSummaryPublicView from "./pages/ScoutingSummaryPublicView";
import SharedFieldPlanSummary from "./pages/SharedFieldPlanSummary";
import SharedTimeline from "./pages/SharedTimeline";
import SharedDocument from "./pages/SharedDocument";
import AMFReports from "./pages/AMFReports";
import ShareFieldReport from "./pages/ShareFieldReport";
import SharedFieldReport from "./pages/SharedFieldReport";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Auto-sync component
const OfflineSync = () => {
  useEffect(() => {
    const handleOnline = async () => {
      const queueSize = await offlineQueue.getQueueSize();
      if (queueSize === 0) {
        return;
      }
      
      toast.info(`🔄 Syncing ${queueSize} recording(s)...`);
      
      const { success, failed } = await offlineQueue.processQueue(
        async (recording) => {
          const metadata: any = {
            duration_seconds: recording.metadata.duration,
            source: 'quick_record',
            recorded_at: recording.metadata.recorded_at,
          };
          
          const response = await voiceAPI.uploadVoiceNote(recording.audioBlob, metadata);
          
          // Trigger processing
          if (response.voice_note_id) {
            voiceAPI.processVoiceNote(response.voice_note_id).catch(console.error);
          }
        },
        (current, total) => {
          console.log(`📤 Uploading ${current}/${total}...`);
        }
      );
      
      if (success > 0) {
        toast.success(`✅ Synced ${success} recording(s)`);
      }
      if (failed > 0) {
        toast.error(`❌ Failed to sync ${failed} recording(s)`);
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    // Check immediately on mount if online
    if (navigator.onLine) {
      handleOnline();
    }
    
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <OfflineSync />
          <InstallPrompt />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            {/* Auth & Onboarding Routes (no layout) */}
            <Route path="/" element={<Welcome />} />
            <Route path="/welcome-new" element={<WelcomeNew />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/auto-token" element={<PhoneAuth />} />
            <Route path="/auth/phone" element={<PhoneAuth />} />
            <Route path="/connect/john-deere" element={<JohnDeereConnect />} />
            <Route path="/auth/jdops/importing" element={<JDImporting />} />
            <Route path="/connections/success" element={<ConnectionSuccess />} />
            
            {/* Main App Routes (with layout, protected) */}
            <Route path="/home" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><Layout><FieldsMap /></Layout></ProtectedRoute>} />
            <Route path="/farm-memory" element={<ProtectedRoute><Layout><FarmMemory /></Layout></ProtectedRoute>} />
            <Route path="/farm-reports" element={<ProtectedRoute><Layout><FarmReports /></Layout></ProtectedRoute>} />
            <Route path="/amf-reports" element={<ProtectedRoute><Layout><AMFReports /></Layout></ProtectedRoute>} />
            <Route path="/share-field-report" element={<ProtectedRoute><Layout><ShareFieldReport /></Layout></ProtectedRoute>} />
            <Route path="/recordings" element={<ProtectedRoute><Layout><Recordings /></Layout></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Layout><Documents /></Layout></ProtectedRoute>} />
              <Route path="/documents/:id" element={<ProtectedRoute><Layout><DocumentDetail /></Layout></ProtectedRoute>} />
              <Route path="/documents/:id/share" element={<ProtectedRoute><Layout><ShareDocument /></Layout></ProtectedRoute>} />
            {/* <Route path="/tasks" element={<ProtectedRoute><Layout><Tasks /></Layout></ProtectedRoute>} /> */}
            {/* FIELD NOTES - Temporarily commented out (replaced by Scouting Notes) */}
            {/* <Route path="/field-notes" element={<ProtectedRoute><Layout><FieldNotesList /></Layout></ProtectedRoute>} /> */}
            <Route path="/scouting-notes" element={<ProtectedRoute><Layout><ScoutingNotes /></Layout></ProtectedRoute>} />
            <Route path="/field-plans" element={<ProtectedRoute><Layout><FieldPlans /></Layout></ProtectedRoute>} />
            
            {/* Settings (with layout, protected) */}
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/settings/profile" element={<ProtectedRoute><Layout><ProfileEdit /></Layout></ProtectedRoute>} />
            <Route path="/settings/change-password" element={<ProtectedRoute><Layout><ChangePassword /></Layout></ProtectedRoute>} />
            <Route path="/set-password" element={<ProtectedRoute><Layout><SetPassword /></Layout></ProtectedRoute>} />
            <Route path="/settings/farm" element={<ProtectedRoute><Layout><FarmDetailsEdit /></Layout></ProtectedRoute>} />
            <Route path="/settings/connections/johndeere" element={<ProtectedRoute><Layout><ConnectionDetails /></Layout></ProtectedRoute>} />
            <Route path="/settings/contacts" element={<ProtectedRoute><Layout><ContactsList /></Layout></ProtectedRoute>} />
            <Route path="/settings/contacts/new" element={<ProtectedRoute><Layout><ContactForm /></Layout></ProtectedRoute>} />
            <Route path="/settings/contacts/:contactId/edit" element={<ProtectedRoute><Layout><ContactForm /></Layout></ProtectedRoute>} />
            <Route path="/voice-capture" element={<ProtectedRoute><Layout><VoiceCapture /></Layout></ProtectedRoute>} />
            <Route path="/recordings/:id" element={<ProtectedRoute><Layout><RecordingDetail /></Layout></ProtectedRoute>} />
            {/* <Route path="/tasks/new" element={<ProtectedRoute><TaskForm /></ProtectedRoute>} /> */}
            {/* <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} /> */}
            {/* <Route path="/tasks/:id/edit" element={<ProtectedRoute><TaskForm /></ProtectedRoute>} /> */}
            {/* FIELD NOTES - Temporarily commented out (replaced by Scouting Notes) */}
            {/* <Route path="/field-notes/new" element={<ProtectedRoute><FieldNoteForm /></ProtectedRoute>} /> */}
            {/* <Route path="/field-notes/:id" element={<ProtectedRoute><FieldNoteDetail /></ProtectedRoute>} /> */}
            {/* <Route path="/field-notes/:id/edit" element={<ProtectedRoute><FieldNoteForm /></ProtectedRoute>} /> */}
            <Route path="/scouting-notes/create" element={<ProtectedRoute><Layout><ScoutingNoteCreate /></Layout></ProtectedRoute>} />
            <Route path="/scouting-notes/summary/:noteId" element={<ProtectedRoute><Layout><ScoutingSummaryDetail /></Layout></ProtectedRoute>} />
            <Route path="/scouting-notes/share-summary" element={<ProtectedRoute><Layout><ShareScoutingSummary /></Layout></ProtectedRoute>} />
            <Route path="/scouting-notes/:id" element={<ProtectedRoute><Layout><ScoutingNoteDetail /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/new" element={<ProtectedRoute><Layout><FieldPlanEdit /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/share" element={<ProtectedRoute><Layout><SharePlans /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/summary/:summaryId" element={<ProtectedRoute><Layout><FieldPlanSummaryDetail /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/summary/:summaryId/share" element={<ProtectedRoute><Layout><ShareFieldPlanSummary /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/:id" element={<ProtectedRoute><Layout><FieldPlanDetail /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/:id/edit" element={<ProtectedRoute><Layout><FieldPlanEdit /></Layout></ProtectedRoute>} />
            <Route path="/documents/share-timeline" element={<ProtectedRoute><Layout><ShareTimeline /></Layout></ProtectedRoute>} />
            <Route path="/field-plans/:planId/generate-prescription" element={<ProtectedRoute><Layout><GeneratePrescription /></Layout></ProtectedRoute>} />
            
            {/* Public Routes (no authentication) */}
            <Route path="/briefings/:shareToken" element={<BriefingView />} />
            <Route path="/shared/scouting/:shareToken" element={<ScoutingSummaryPublicView />} />
            <Route path="/shared/summary/:shareToken" element={<SharedFieldPlanSummary />} />
            <Route path="/shared/timeline/:shareToken" element={<SharedTimeline />} />
            <Route path="/shared/document/:shareToken" element={<SharedDocument />} />
            <Route path="/shared/field-report/:shareToken" element={<SharedFieldReport />} />
            <Route path="/founding-farmers/apply" element={<FoundingFarmerApply />} />
            <Route path="/founding-farmers/signup" element={<FoundingFarmerSignup />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
