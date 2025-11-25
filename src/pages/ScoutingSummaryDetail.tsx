import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { scoutingNotesAPI, type ScoutingNote } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit2, Share2, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ScoutingSummaryDetail() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<ScoutingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedRecommendations, setEditedRecommendations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  const loadNote = async () => {
    try {
      setLoading(true);
      const data = await scoutingNotesAPI.getScoutingNote(noteId!);
      setNote(data);
      setEditedSummary(data.ai_summary || "");
      setEditedRecommendations(data.recommendations || []);
    } catch (error: any) {
      console.error("Failed to load note:", error);
      toast.error("Failed to load summary");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedSummary(note?.ai_summary || "");
    setEditedRecommendations(note?.recommendations || []);
  };

  const handleSave = async () => {
    if (!note) return;

    try {
      setSaving(true);
      await scoutingNotesAPI.updateScoutingNote(note.id, {
        ai_summary: editedSummary,
        recommendations: editedRecommendations.filter(r => r.trim() !== ""), // Remove empty recommendations
      });
      toast.success("Summary updated");
      setEditing(false);
      loadNote();
    } catch (error: any) {
      console.error("Failed to save:", error);
      toast.error(error.message || "Failed to save summary");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecommendation = () => {
    setEditedRecommendations([...editedRecommendations, ""]);
  };

  const handleUpdateRecommendation = (index: number, value: string) => {
    const updated = [...editedRecommendations];
    updated[index] = value;
    setEditedRecommendations(updated);
  };

  const handleRemoveRecommendation = (index: number) => {
    const updated = editedRecommendations.filter((_, i) => i !== index);
    setEditedRecommendations(updated);
  };

  const handleShare = () => {
    if (!note) return;
    // Navigate to share page with note ID
    navigate(`/scouting-notes/share-summary?noteId=${note.id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Summary not found</p>
          <Button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const issuesDetected = note.issues_detected || [];

  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide page-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!editing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="text-farm-accent hover:text-farm-accent/90 hover:bg-farm-accent/10"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                  className="text-farm-accent hover:text-farm-accent/90 hover:bg-farm-accent/10"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Field Info */}
        <Card className="p-4">
          <h1 className="text-xl font-bold mb-1">
            {note.field_name || 'Unknown Field'}
          </h1>
          {note.farm_name && (
            <p className="text-sm text-muted-foreground mb-2">
              {note.farm_name}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {formatDate(note.scouting_date)}
          </p>
        </Card>

        {/* Issues Detected */}
        {issuesDetected.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Issues Detected</h2>
            <div className="space-y-3">
              {issuesDetected.map((issue: Record<string, any>, idx: number) => {
                const borderColor = issue.severity === 'critical' ? '#ef4444' : 
                                   issue.severity === 'high' ? '#f97316' : 
                                   issue.severity === 'medium' ? '#eab308' : '#6b7280';
                
                return (
                  <div key={idx} className="border-l-2 pl-3 py-1" style={{ borderColor }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={issue.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">
                        {issue.severity}
                      </Badge>
                      <span className="font-medium text-sm">{issue.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    {issue.location && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Location: {issue.location}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* AI Summary */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Summary</h2>
          {editing ? (
            <Textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Enter summary..."
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm whitespace-pre-wrap">{note.ai_summary}</p>
            </div>
          )}
        </Card>

        {/* Recommendations */}
        {(note.recommendations && note.recommendations.length > 0) || editing ? (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recommendations</h2>
              {editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRecommendation}
                  className="text-xs"
                >
                  + Add
                </Button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                {editedRecommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Textarea
                      value={rec}
                      onChange={(e) => handleUpdateRecommendation(idx, e.target.value)}
                      className="flex-1 min-h-[60px] text-sm"
                      placeholder={`Recommendation ${idx + 1}...`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRecommendation(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {editedRecommendations.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No recommendations yet. Click "+ Add" to create one.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {note.recommendations?.map((rec: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-farm-accent mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {/* Additional Details */}
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Additional Details</h2>
          <div className="space-y-2 text-sm">
            {note.growth_stage && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Growth Stage:</span>
                <span className="font-medium">{note.growth_stage}</span>
              </div>
            )}
            {note.plant_height_inches && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plant Height:</span>
                <span className="font-medium">{note.plant_height_inches}"</span>
              </div>
            )}
            {note.weather_conditions && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Weather:</span>
                <span className="font-medium">
                  {typeof note.weather_conditions === 'string' 
                    ? note.weather_conditions 
                    : JSON.stringify(note.weather_conditions)}
                </span>
              </div>
            )}
            {note.voice_recordings && note.voice_recordings.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Voice Notes:</span>
                <span className="font-medium">{note.voice_recordings.length}</span>
              </div>
            )}
            {note.photos && note.photos.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Photos:</span>
                <span className="font-medium">{note.photos.length}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

