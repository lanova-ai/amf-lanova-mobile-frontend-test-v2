import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fieldPlanSummariesAPI, FieldPlanSummaryResponse } from "@/lib/api";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  MapPin,
  Package,
  Share2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FieldPlanSummaryDetail() {
  const { summaryId } = useParams<{ summaryId: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<FieldPlanSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummaryText, setEditedSummaryText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (summaryId) {
      loadSummary();
    }
  }, [summaryId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await fieldPlanSummariesAPI.getSummary(summaryId!);
      setSummary(data);
    } catch (error: any) {
      console.error("Failed to load summary:", error);
      
      // Show user-friendly error message
      const errorMessage = error?.message || "Failed to load summary";
      toast.error(errorMessage, {
        description: "This summary may be from an older version. Try generating a new summary.",
        duration: 5000
      });
      
      // Navigate back after a delay to let user see the message
      setTimeout(() => navigate(-1), 2000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleEdit = () => {
    setEditedSummaryText(summary?.summary_text || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedSummaryText("");
  };

  const handleSave = async () => {
    if (!summary) return;
    
    try {
      setSaving(true);
      await fieldPlanSummariesAPI.updateSummary(summary.id.toString(), {
        summary_text: editedSummaryText
      });
      
      // Update local state
      setSummary({
        ...summary,
        summary_text: editedSummaryText
      });
      
      setIsEditing(false);
      toast.success("Summary updated successfully");
    } catch (error) {
      console.error("Error updating summary:", error);
      toast.error("Failed to update summary");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-farm-accent" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-farm-muted mx-auto mb-4" />
          <p className="text-farm-muted">Summary not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark/95 backdrop-blur supports-[backdrop-filter]:bg-farm-dark/80 border-b border-farm-accent/20">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-farm-accent/10 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-farm-text" />
          </button>
          <h1 className="text-lg font-semibold text-farm-text">Field Plan Summary</h1>
          
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="flex items-center gap-2 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate(`/field-plans/summary/${summary.id}/share`);
                }}
                className="flex items-center gap-2 border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-farm-text">
            {summary.summary_name}
          </h2>
          <div className="flex items-center gap-4 text-sm text-farm-muted">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              <span>{summary.year}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{summary.total_fields} field{summary.total_fields !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{summary.total_plans} plan{summary.total_plans !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* AI Summary - Inline bullet points */}
        {(summary.summary_text || isEditing) && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-farm-accent" />
              <h3 className="text-sm font-semibold text-farm-muted">Summary</h3>
            </div>
            {isEditing ? (
              <textarea
                value={editedSummaryText}
                onChange={(e) => setEditedSummaryText(e.target.value)}
                className="w-full min-h-[200px] p-3 border border-farm-accent/20 rounded-md text-sm bg-farm-dark text-farm-text resize-y focus:outline-none focus:ring-2 focus:ring-farm-accent"
                autoFocus
                rows={10}
              />
            ) : (
              <ul className="text-sm text-farm-text leading-relaxed space-y-1.5 list-none">
                {summary.summary_text.split(/[•\n]/).filter((line: string) => line.trim()).map((line: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-farm-accent mt-0.5">•</span>
                    <span className="[&_strong]:text-farm-accent [&_strong]:font-semibold">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        p: ({children}) => <>{children}</>
                      }}>
                        {line.trim()}
                      </ReactMarkdown>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Products List */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-farm-accent" />
              <h3 className="font-semibold text-farm-text">Products ({summary.total_products})</h3>
            </div>
          </div>

          <div className="space-y-3">
            {summary.aggregated_products.map((product, idx) => (
              <div
                key={`${product.product_name}-${idx}`}
                className="border-l-4 border-farm-accent/20 pl-3 py-2"
              >
                <div className="font-medium text-sm mb-1 text-farm-text">
                  {product.product_name}
                </div>
                
                <div className="text-sm space-y-2">
                  <div className="font-medium text-farm-text">
                    {Number(product.total_quantity).toFixed(1)} {product.quantity_unit}
                  </div>
                  
                  {product.used_in_fields.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.used_in_fields.map((fieldName, fidx) => (
                        <span
                          key={fidx}
                          className="inline-block px-2 py-0.5 bg-farm-accent/10 text-xs rounded text-farm-accent"
                        >
                          {fieldName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details - Collapsible */}
        <div className="bg-farm-card rounded-lg border border-farm-accent/20 overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full p-4 flex items-center justify-between hover:bg-farm-accent/10 transition-colors"
          >
            <h3 className="font-semibold text-farm-text">Details</h3>
            {showDetails ? (
              <ChevronUp className="h-5 w-5 text-farm-muted" />
            ) : (
              <ChevronDown className="h-5 w-5 text-farm-muted" />
            )}
          </button>

          {showDetails && (
            <div className="px-4 pb-4 space-y-2 text-sm border-t border-farm-accent/20 pt-3">
              <div className="flex justify-between">
                <span className="text-farm-muted">Year:</span>
                <span className="font-medium text-farm-text">{summary.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Total Fields:</span>
                <span className="font-medium text-farm-text">{summary.total_fields}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Total Plans:</span>
                <span className="font-medium text-farm-text">{summary.total_plans}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Total Products:</span>
                <span className="font-medium text-farm-text">{summary.total_products}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-farm-muted">Created:</span>
                <span className="font-medium text-farm-text">{formatDate(summary.created_at)}</span>
              </div>
              {summary.updated_at !== summary.created_at && (
                <div className="flex justify-between">
                  <span className="text-farm-muted">Updated:</span>
                  <span className="font-medium text-farm-text">{formatDate(summary.updated_at)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

