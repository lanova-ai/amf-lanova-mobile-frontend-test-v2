import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { scoutingNotesAPI } from "@/lib/api";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ScoutingLocationPicker } from "@/components/scouting/ScoutingLocationPicker";
import { ScoutingVoiceRecorder } from "@/components/scouting/ScoutingVoiceRecorder";
import { ScoutingPhotoCapture } from "@/components/scouting/ScoutingPhotoCapture";

interface ScoutingNoteData {
  // Location data (Step 1)
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_description: string;
  field_id: string | null;
  
  // Voice data (Step 2)
  voice_blob: Blob | null;
  
  // Photo data (Step 3)
  photo_blobs: Blob[];
  
  // Metadata
  scouting_date: string;
  growth_stage: string;
  plant_height_inches: number | null;
  user_notes: string;
}

export default function ScoutingNoteCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processWithAI, setProcessWithAI] = useState(true); // Default to true for convenience
  
  const [noteData, setNoteData] = useState<ScoutingNoteData>({
    latitude: null,
    longitude: null,
    location_accuracy: null,
    location_description: "",
    field_id: null,
    voice_blob: null,
    photo_blobs: [],
    scouting_date: new Date().toISOString().split('T')[0],
    growth_stage: "",
    plant_height_inches: null,
    user_notes: "",
  });

  // Pre-fill location data from URL query parameters (from map)
  useEffect(() => {
    const fieldId = searchParams.get('field_id');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    if (fieldId && lat && lng) {
      setNoteData(prev => ({
        ...prev,
        field_id: fieldId,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        location_accuracy: 0, // From map marker, so exact
      }));
      
      // Skip step 1 (location) since it's already set from the map
      setCurrentStep(2);
    }
  }, [searchParams]);

  const updateNoteData = (updates: Partial<ScoutingNoteData>) => {
    setNoteData(prev => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Must have location
        return noteData.latitude !== null && noteData.longitude !== null;
      case 2:
        // Voice is optional
        return true;
      case 3:
        // Photos are optional
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    // Check if user came from map (has pre-filled location from URL)
    const cameFromMap = searchParams.get('field_id') && searchParams.get('lat') && searchParams.get('lng');
    
    if (currentStep === 1) {
      navigate(-1); // Go back to previous page (Home or Scouting Notes)
    } else if (currentStep === 2 && cameFromMap) {
      navigate(-1); // Go back to map if location was pre-filled
    } else {
      setCurrentStep(prev => Math.max(prev - 1, 1));
    }
  };

  const handleSave = async () => {
    if (!canProceed()) {
      toast.error("Please complete the required fields");
      return;
    }

    try {
      setSaving(true);

      // Step 1: Create the scouting note
      const createResponse = await scoutingNotesAPI.createScoutingNote({
        latitude: noteData.latitude!,
        longitude: noteData.longitude!,
        location_accuracy: noteData.location_accuracy,
        location_description: noteData.location_description,
        field_id: noteData.field_id,
        scouting_date: noteData.scouting_date,
        growth_stage: noteData.growth_stage || undefined,
        plant_height_inches: noteData.plant_height_inches || undefined,
        user_notes: noteData.user_notes || undefined,
      });

      const noteId = createResponse.id;
      
      // ✅ Navigate IMMEDIATELY after note creation
      toast.success("Scouting note saved!");
      navigate("/scouting-notes", { 
        replace: true,
        state: { 
          newNoteId: noteId,
          processing: processWithAI && (noteData.voice_blob || noteData.photo_blobs.length > 0)
        } 
      });
      
      // ✅ Continue uploads and AI processing in background (don't await)
      (async () => {
        let voiceUploaded = false;
        let photosUploaded = false;

        // Step 2: Upload voice if exists
        console.log("Checking voice blob:", noteData.voice_blob ? `Blob size: ${noteData.voice_blob.size} bytes` : "No voice blob");
        if (noteData.voice_blob) {
          try {
            console.log("Uploading voice recording...");
            await scoutingNotesAPI.uploadVoiceRecording(noteId, noteData.voice_blob, noteData.field_id);
            console.log("Voice recording uploaded successfully");
            voiceUploaded = true;
          } catch (voiceError: any) {
            console.error("Voice upload failed:", voiceError);
            toast.error("Voice recording upload failed");
          }
        }

        // Step 3: Upload photos if exist
        if (noteData.photo_blobs.length > 0) {
          try {
            await scoutingNotesAPI.uploadPhotos(noteId, noteData.photo_blobs, noteData.field_id);
            console.log("Photos uploaded successfully");
            photosUploaded = true;
          } catch (photoError: any) {
            console.error("Photo upload failed:", photoError);
            toast.error("Photo upload failed");
          }
        }

        // Step 4: Trigger AI processing if requested and content was uploaded
        if (processWithAI && (voiceUploaded || photosUploaded)) {
          try {
            await scoutingNotesAPI.triggerAIAnalysis(noteId, false);
            toast.success("AI processing started!");
          } catch (aiError: any) {
            console.error("AI processing trigger failed:", aiError);
          }
        }
      })();
    } catch (error: any) {
      console.error("Failed to save scouting note:", error);
      toast.error(error.message || "Failed to save scouting note");
    } finally {
      setSaving(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Pin Location";
      case 2:
        return "Voice Recording";
      case 3:
        return "Photos";
      default:
        return "";
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-farm-dark overflow-hidden">
      {/* Progress Header */}
      <div className="flex-shrink-0 bg-farm-dark border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold">New Scouting Note</p>
            <p className="text-xs text-farm-muted">
              Step {currentStep} of 3 • {getStepTitle()}
            </p>
          </div>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Progress Indicator */}
        <div className="flex gap-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                step <= currentStep
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {currentStep === 1 && (
          <ScoutingLocationPicker
            latitude={noteData.latitude}
            longitude={noteData.longitude}
            locationAccuracy={noteData.location_accuracy}
            locationDescription={noteData.location_description}
            fieldId={noteData.field_id}
            onUpdate={updateNoteData}
          />
        )}

        {currentStep === 2 && (
          <ScoutingVoiceRecorder
            voiceBlob={noteData.voice_blob}
            onUpdate={updateNoteData}
            fieldId={noteData.field_id}
            latitude={noteData.latitude}
            longitude={noteData.longitude}
            onRecordingStateChange={setIsRecording}
          />
        )}

        {currentStep === 3 && (
          <ScoutingPhotoCapture
            photoBlobs={noteData.photo_blobs}
            onUpdate={updateNoteData}
          />
        )}
      </div>

      {/* Footer Actions - Hidden during recording */}
      {!(isRecording && currentStep === 2) && (
        <div className="flex-shrink-0 bg-farm-dark border-t p-4 space-y-2">
          {currentStep < 3 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              size="lg"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              {/* AI Processing Option */}
              <div className="flex items-center space-x-2 px-1 pb-2">
                <Checkbox
                  id="process-ai"
                  checked={processWithAI}
                  onCheckedChange={(checked) => setProcessWithAI(checked as boolean)}
                  disabled={!noteData.voice_blob && noteData.photo_blobs.length === 0}
                />
                <label
                  htmlFor="process-ai"
                  className={`text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5 ${
                    !noteData.voice_blob && noteData.photo_blobs.length === 0 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Process with AI immediately
                  {!noteData.voice_blob && noteData.photo_blobs.length === 0 && (
                    <span className="text-xs text-farm-muted ml-1">(add voice or photos)</span>
                  )}
                </label>
              </div>
              
              <Button
                onClick={handleSave}
                disabled={saving || !canProceed()}
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                size="lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-farm-dark border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Scouting Note
                  </>
                )}
              </Button>
            </>
          )}
          
          {currentStep === 2 && (
            <Button
              onClick={handleNext}
              variant="ghost"
              className="w-full"
            >
              Skip Voice Recording →
            </Button>
          )}
          
          {currentStep === 3 && (
            <Button
              onClick={handleSave}
              variant="ghost"
              className="w-full"
              disabled={saving}
            >
              Save Without Photos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

