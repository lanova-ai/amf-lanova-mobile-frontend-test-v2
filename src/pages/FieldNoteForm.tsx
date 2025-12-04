import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { observationsAPI, fieldsAPI, voiceAPI, documentsAPI } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Save, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoUploadModal } from "@/components/PhotoUploadModal";

const FieldNoteForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  
  // Get URL parameters from map
  const urlFieldId = searchParams.get('field_id');
  const urlFieldNoteId = searchParams.get('field_note_id');
  const urlLat = searchParams.get('lat');
  const urlLng = searchParams.get('lng');
  const isFromMap = !!(urlFieldId && urlLat && urlLng);

  const [fields, setFields] = useState<any[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    field_id: "",
    title: "",
    description: "",
    type: "inspection",
    text: "",
    score: "",
    status: "draft",
    voice_note_id: ""
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load fields and voice notes in parallel
      const [fieldsResponse, voiceNotesResponse] = await Promise.all([
        fieldsAPI.getFields(),
        voiceAPI.getVoiceNotes({ limit: 50 })
      ]);
      
      // Sort fields alphabetically by name
      const sortedFields = (fieldsResponse.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
      setVoiceNotes(voiceNotesResponse.voice_notes || []);

      // If editing, load observation data
      if (isEditing && id) {
        const observation = await observationsAPI.getObservationDetail(id);
        setFormData({
          field_id: observation.field_id,
          title: observation.title || "",
          description: observation.description || "",
          type: observation.type,
          text: observation.text,
          score: observation.score || "",
          status: observation.status,
          voice_note_id: observation.voice_note?.id || ""
        });
      } else if (urlFieldId) {
        // Pre-fill field_id from URL parameters (from map)
        console.log('Pre-filling field from map:', urlFieldId);
        setFormData(prev => ({
          ...prev,
          field_id: urlFieldId
        }));
      }
    } catch (err: any) {
      console.error("Failed to load data:", err);
      toast.error(err.message || "Failed to load data");
      if (isEditing) {
        // Go back or to field notes list
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/field-notes");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhotosSelected = (files: File[]) => {
    // Create previews
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
    setSelectedImages(files);
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.field_id) {
      toast.error("Please select a field");
      return;
    }

    if (!formData.type) {
      toast.error("Please select observation type");
      return;
    }

    if (!formData.text.trim()) {
      toast.error("Please enter observation notes");
      return;
    }

    try {
      setSaving(true);

      const observationData = {
        title: formData.title.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        text: formData.text.trim(),
        score: formData.score.trim() || undefined,
        status: formData.status,
        voice_note_id: formData.voice_note_id || undefined,
        observed_at: new Date().toISOString()
      };

      if (isEditing && id) {
        // Update existing observation
        await observationsAPI.updateObservation(id, observationData);
        
        // Upload new images if any selected
        if (selectedImages.length > 0) {
          try {
            const uploadPromises = selectedImages.map(file =>
              documentsAPI.uploadDocument(file, {
                document_type: 'photo',
                observation_id: id,
              })
            );
            await Promise.all(uploadPromises);
            toast.success(`Field note updated with ${selectedImages.length} photo(s)`);
          } catch (uploadErr) {
            console.error("Failed to upload photos:", uploadErr);
            toast.warning("Field note updated but some photos failed to upload");
          }
        } else {
          toast.success("Field note updated");
        }
      } else {
        // Create new observation
        const response = await observationsAPI.createObservation(
          formData.field_id,
          observationData
        );
        
        const observationId = response.observation_id;
        
        // Upload images if any selected
        if (selectedImages.length > 0) {
          try {
            const uploadPromises = selectedImages.map(file =>
              documentsAPI.uploadDocument(file, {
                document_type: 'photo',
                observation_id: observationId,
              })
            );
            await Promise.all(uploadPromises);
            toast.success(`Field note created with ${selectedImages.length} photo(s)`);
          } catch (uploadErr) {
            console.error("Failed to upload photos:", uploadErr);
            toast.warning("Field note created but some photos failed to upload");
          }
        } else {
          toast.success("Field note created");
        }
        
        // Navigate to detail page
        navigate(`/field-notes/${observationId}`);
        return;
      }

      // Navigate back to previous page or field notes list
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/field-notes");
      }
    } catch (err: any) {
      console.error("Failed to save field note:", err);
      toast.error(err.message || "Failed to save field note");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex flex-col">
        <header className="px-4 py-4 border-b flex items-center gap-3">
          <button 
            onClick={() => {
              // Go back to previous page
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/field-notes");
              }
            }} 
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Field Note" : "New Field Note"}
          </h2>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="body-text">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b flex items-center justify-between sticky top-0 bg-farm-dark z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              // Go back to previous page
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/field-notes");
              }
            }} 
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Field Note" : "New Field Note"}
          </h2>
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={saving}
          size="sm"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </header>

      {/* Form */}
      <main className="flex-1 overflow-y-auto px-4 py-6 page-background">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
          {/* Field Selection */}
          <div className="space-y-2">
            <Label htmlFor="field">Field *</Label>
            <Select
              value={formData.field_id}
              onValueChange={(value) => handleChange("field_id", value)}
              disabled={isEditing || isFromMap}
            >
              <SelectTrigger id="field">
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {fields.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No fields available
                  </SelectItem>
                ) : (
                  fields.map((field) => (
                    <SelectItem key={field.field_id || field.id} value={field.field_id || field.id}>
                      {field.name} ({field.farm_name || 'Unknown Farm'})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {isFromMap ? (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Field automatically selected from map location (Lat: {urlLat}, Lng: {urlLng})
              </p>
            ) : (
              <p className="text-xs text-farm-muted">
                {isEditing ? "Field cannot be changed when editing" : "Select the field for this observation"}
              </p>
            )}
          </div>

          {/* Observation Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange("type", value)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inspection">📋 Inspection</SelectItem>
                <SelectItem value="issue">⚠️ Issue</SelectItem>
                <SelectItem value="crop_stage">🌱 Crop Stage</SelectItem>
                <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                <SelectItem value="other">📝 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Brief title for this observation"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description (optional)"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Notes (Required) */}
          <div className="space-y-2">
            <Label htmlFor="text">Notes *</Label>
            <Textarea
              id="text"
              placeholder="What did you observe? (Required)"
              value={formData.text}
              onChange={(e) => handleChange("text", e.target.value)}
              rows={6}
              maxLength={2000}
              required
            />
            <p className="text-xs text-farm-muted">
              {formData.text.length} / 2000 characters
            </p>
          </div>

          {/* Score/Rating */}
          <div className="space-y-2">
            <Label htmlFor="score">Score/Rating</Label>
            <Input
              id="score"
              placeholder="e.g., 7/10, Good, Moderate"
              value={formData.score}
              onChange={(e) => handleChange("score", e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-farm-muted">
              Optional rating or assessment
            </p>
          </div>

          {/* Voice Note Linking */}
          <div className="space-y-2">
            <Label htmlFor="voice_note">Link Voice Note</Label>
            <Select
              value={formData.voice_note_id || "none"}
              onValueChange={(value) => handleChange("voice_note_id", value === "none" ? "" : value)}
            >
              <SelectTrigger id="voice_note">
                <SelectValue placeholder="None selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {voiceNotes.map((note) => (
                  <SelectItem key={note.id} value={note.id}>
                    {note.title || `Recording ${note.created_at}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-farm-muted">
              Link an existing voice recording to this observation
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhotoModalOpen(true)}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Add Photos
              </Button>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90 shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-farm-muted">
                {selectedImages.length > 0
                  ? `${selectedImages.length} photo(s) selected`
                  : "No photos selected"}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange("status", value)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Action Buttons */}
          <div className="flex gap-3 pt-4 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Go back to previous page
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/field-notes");
                }
              }}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving}
            >
              {saving ? "Saving..." : (isEditing ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </main>

      {/* Photo Upload Modal */}
      <PhotoUploadModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onPhotosSelected={handlePhotosSelected}
      />
    </div>
  );
};

export default FieldNoteForm;

