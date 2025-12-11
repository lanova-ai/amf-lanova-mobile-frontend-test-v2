import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Trash2, MoreVertical, Calendar, Share2, ArrowLeft, X, ChevronRight } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { fieldPlansAPI, sharePlansAPI, fieldPlanSummariesAPI, FieldPlanSummaryListItem, FieldPlanSummaryResponse, handlePageError } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// fieldPlansAPI is imported from @/lib/api

interface FieldPlan {
  id: string;
  plan_name: string;
  field_name: string;
  field_id: string;
  plan_year: number;
  crop_type?: string;
  plan_status: string;
  passes_count: number;
  completed_passes: number;
  estimated_cost?: number;
  actual_cost?: number;
  source_voice_note_title?: string;
  source_document_title?: string;
  created_at: string;
  updated_at: string;
}

const FieldPlans = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<FieldPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planToDelete, setPlanToDelete] = useState<FieldPlan | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // View mode toggle - URL param takes precedence, then sessionStorage
  const [viewMode, setViewMode] = useState<'plans' | 'shared' | 'summary'>(() => {
    // URL param takes precedence (e.g., /field-plans?view=plans)
    const viewParam = searchParams.get('view');
    if (viewParam && ['plans', 'shared', 'summary'].includes(viewParam)) {
      return viewParam as 'plans' | 'shared' | 'summary';
    }
    const saved = sessionStorage.getItem('fieldPlansViewMode');
    return (saved as 'plans' | 'shared' | 'summary') || 'plans';
  });
  const [sharedPlans, setSharedPlans] = useState<any[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [selectedSharedPlan, setSelectedSharedPlan] = useState<any | null>(null);
  const [shareToDelete, setShareToDelete] = useState<any | null>(null);
  const [showDeleteShareDialog, setShowDeleteShareDialog] = useState(false);
  
  // Summary state
  const [summaries, setSummaries] = useState<FieldPlanSummaryListItem[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  // Removed selectedSummary and summaryLoading - now navigating to detail page
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryToDelete, setSummaryToDelete] = useState<FieldPlanSummaryListItem | null>(null);
  const [showDeleteSummaryDialog, setShowDeleteSummaryDialog] = useState(false);
  const [summaryToEdit, setSummaryToEdit] = useState<FieldPlanSummaryListItem | null>(null);
  const [showEditTitleDialog, setShowEditTitleDialog] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  
  // Multi-select for sharing/summary generation
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Filters - initialize from URL params
  const [fieldFilter, setFieldFilter] = useState<string>(searchParams.get('field') || "all");
  const [yearFilter, setYearFilter] = useState<string>(searchParams.get('year') || "all");
  const [availableFields, setAvailableFields] = useState<{field_id: string, field_name: string}[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Fetch plans from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const plansResponse = await fieldPlansAPI.getFieldPlans();
        
        const plansArray = Array.isArray(plansResponse) ? plansResponse : [];
        setPlans(plansArray);

        // Extract unique years from plans
        const years = [...new Set(plansArray.map((p: any) => p.plan_year))].sort((a, b) => b - a);
        setAvailableYears(years);

        // Extract unique fields from plans
        const fieldsMap = new Map();
        plansArray.forEach((p: any) => {
          if (p.field_id && p.field_name && !fieldsMap.has(p.field_id)) {
            fieldsMap.set(p.field_id, { field_id: p.field_id, field_name: p.field_name });
          }
        });
        const fields = Array.from(fieldsMap.values()).sort((a, b) => a.field_name.localeCompare(b.field_name));
        setAvailableFields(fields);
      } catch (error: any) {
        console.error("Error fetching data:", error);
        const errorMsg = handlePageError(error, "Failed to load field plans");
        if (errorMsg) toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Save viewMode to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('fieldPlansViewMode', viewMode);
  }, [viewMode]);

  // Fetch shared plans when viewing shared tab
  useEffect(() => {
    if (viewMode === 'shared') {
      const fetchShared = async () => {
        try {
          setSharedLoading(true);
          
          // Fetch only summary shares (not individual plan shares)
          const summarySharesResponse = await fieldPlanSummariesAPI.getSharedSummariesHistory();
          
          setSharedPlans(summarySharesResponse.shares || []);
        } catch (error) {
          console.error("Error fetching shared summaries:", error);
          toast.error("Failed to load shared summaries");
        } finally {
          setSharedLoading(false);
        }
      };
      fetchShared();
    }
  }, [viewMode]);


  const filteredPlans = plans.filter((plan) => {
    // Field filter
    if (fieldFilter !== "all" && plan.field_id !== fieldFilter) return false;
    
    // Year filter
    if (yearFilter !== "all" && plan.plan_year !== parseInt(yearFilter)) return false;
    
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-yellow-500';
      case 'active':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'archived':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'active':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'archived':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getProgressPercentage = (plan: FieldPlan) => {
    if (plan.passes_count === 0) return 0;
    return Math.round((plan.completed_passes / plan.passes_count) * 100);
  };

  const handleViewDetails = (planId: string) => {
    navigate(`/field-plans/${planId}`);
  };

  const handleEditPlan = (planId: string) => {
    navigate(`/field-plans/${planId}/edit`);
  };

  const togglePlanSelection = (planId: string) => {
    setSelectedPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedPlans.size === filteredPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(filteredPlans.map(p => p.id)));
    }
  };

  const handleSharePlans = () => {
    if (selectedPlans.size === 0) {
      toast.error("Please select at least one plan");
      return;
    }
    
    // Navigate to share page with plan IDs as URL params
    const planIdsParam = Array.from(selectedPlans).join(",");
    navigate(`/field-plans/share?plans=${planIdsParam}`);
  };

  const handleGenerateSummary = async () => {
    if (selectedPlans.size === 0) {
      toast.error("Please select at least one plan");
      return;
    }
    
    try {
      setGeneratingSummary(true);
      const planIds = Array.from(selectedPlans);
      const response = await fieldPlanSummariesAPI.generateSummary({ plan_ids: planIds });
      
      toast.success(`Summary generated successfully!`);
      
      // Clear selection and exit selection mode
      setSelectedPlans(new Set());
      setIsSelectionMode(false);
      
      // Switch to Summary tab and reload summaries
      setViewMode('summary');
      await loadSummaries();
    } catch (error: any) {
      console.error("Error generating summary:", error);
      // API errors have .message property with the detail
      const errorMessage = error?.message || error?.details?.detail || "Failed to generate summary";
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setGeneratingSummary(false);
    }
  };

  const loadSummaries = async () => {
    try {
      setSummariesLoading(true);
      const summariesList = await fieldPlanSummariesAPI.listSummaries();
      setSummaries(summariesList);
    } catch (error) {
      console.error("Error loading summaries:", error);
      toast.error("Failed to load summaries");
    } finally {
      setSummariesLoading(false);
    }
  };

  // Removed loadSummaryDetails - now navigating directly to detail page

  // Load summaries when Summary tab is selected
  useEffect(() => {
    if (viewMode === 'summary') {
      loadSummaries();
    }
  }, [viewMode]);

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    
    try {
      await fieldPlansAPI.deleteFieldPlan(planToDelete.id);
      setPlans(prevPlans => prevPlans.filter(p => p.id !== planToDelete.id));
      
      toast.success("Field plan deleted successfully");
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete field plan");
    } finally {
      setShowDeleteDialog(false);
      setPlanToDelete(null);
    }
  };

  const handleDeleteShare = async () => {
    if (!shareToDelete) return;
    
    try {
      await sharePlansAPI.deleteSharedPlan(shareToDelete.id);
      setSharedPlans(prevShares => prevShares.filter(s => s.id !== shareToDelete.id));
      
      toast.success("Shared plan deleted successfully");
    } catch (error) {
      console.error("Error deleting shared plan:", error);
      toast.error("Failed to delete shared plan");
    } finally {
      setShowDeleteShareDialog(false);
      setShareToDelete(null);
    }
  };

  const handleDeleteSummary = async () => {
    if (!summaryToDelete) return;
    
    try {
      await fieldPlanSummariesAPI.deleteSummary(summaryToDelete.id);
      setSummaries(prevSummaries => prevSummaries.filter(s => s.id !== summaryToDelete.id));
      
      toast.success("Summary deleted successfully");
    } catch (error) {
      console.error("Error deleting summary:", error);
      toast.error("Failed to delete summary");
    } finally {
      setShowDeleteSummaryDialog(false);
      setSummaryToDelete(null);
    }
  };

  const handleEditTitle = (summary: FieldPlanSummaryListItem) => {
    setSummaryToEdit(summary);
    setEditedTitle(summary.summary_name || "");
    setShowEditTitleDialog(true);
  };

  const handleSaveTitle = async () => {
    if (!summaryToEdit) return;
    
    try {
      await fieldPlanSummariesAPI.updateSummary(summaryToEdit.id, {
        summary_name: editedTitle
      });
      
      // Update local state
      setSummaries(prevSummaries => prevSummaries.map(s => 
        s.id === summaryToEdit.id ? { ...s, summary_name: editedTitle } : s
      ));
      
      toast.success("Summary title updated");
    } catch (error) {
      console.error("Error updating summary title:", error);
      toast.error("Failed to update summary title");
    } finally {
      setShowEditTitleDialog(false);
      setSummaryToEdit(null);
      setEditedTitle("");
    }
  };

  const formatCost = (cost?: number) => {
    if (!cost) return "—";
    return `$${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide page-background">
      <div className="min-h-full flex flex-col">
        {/* Selection Actions */}
        {isSelectionMode && (
          <div className="px-4 py-3 border-b bg-primary/5 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {selectedPlans.size === filteredPlans.length ? "Deselect All" : "Select All"}
                </button>
                <span className="text-sm text-farm-muted">
                  {selectedPlans.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedPlans(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={selectedPlans.size === 0 || generatingSummary}
                  className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
                >
                  {generatingSummary ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-farm-dark mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className={`px-4 py-4 border-b border-farm-accent/20 bg-farm-dark/95 backdrop-blur sticky z-10 ${isSelectionMode ? 'top-[54px]' : 'top-0'}`}>
          <div className="inline-flex items-center justify-center w-full bg-farm-card border border-farm-accent/20 p-1 rounded-full mb-3">
            <button
              onClick={() => setViewMode('plans')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'plans'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Field Plans
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'summary'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('shared')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                viewMode === 'shared'
                  ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                  : 'text-farm-muted hover:text-farm-text'
              }`}
            >
              Shared
            </button>
          </div>

          {/* Filters - Only for Plans and Summary tabs */}
          {(viewMode === 'plans' || viewMode === 'summary') && (
            <div className="space-y-3">
              <div className={viewMode === 'summary' ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
                {/* Field Filter - Only for Plans */}
                {viewMode === 'plans' && (
                  <Select value={fieldFilter} onValueChange={setFieldFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {fieldFilter === "all" ? "All Fields" : availableFields.find(f => f.field_id === fieldFilter)?.field_name || "All Fields"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      {availableFields.map((field) => (
                        <SelectItem key={field.field_id} value={field.field_id}>
                          {field.field_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Year Filter - For both Plans and Summary */}
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {yearFilter === "all" ? "All Years" : yearFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Results count and actions - Only for Plans */}
              {viewMode === 'plans' && (
                <div className="flex items-center justify-between">
                  <p className="label-text">
                    {filteredPlans.length} {filteredPlans.length === 1 ? 'plan' : 'plans'} found
                  </p>
                  {!isSelectionMode && filteredPlans.length > 0 && (
                    <button
                      onClick={() => setIsSelectionMode(true)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Select Field Plans
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

            {/* Field Plans List */}
            <main className="flex-1 px-4 py-4 pb-24">
          {viewMode === 'plans' && (
            <>
              {loading ? (
                <div className="text-center py-12 space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="body-text">Loading field plans...</p>
                </div>
              ) : filteredPlans.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-6xl">📋</div>
              <div className="space-y-2">
                <h3 className="section-heading">No field plans found</h3>
                <p className="body-text max-w-sm mx-auto">
                  {fieldFilter !== "all" || yearFilter !== "all" 
                    ? "Try adjusting your filters"
                    : "Create your first field plan to get started"}
                </p>
              </div>
              {fieldFilter === "all" && yearFilter === "all" && (
                <Button onClick={() => navigate("/field-plans/new")} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Field Plan
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => isSelectionMode ? togglePlanSelection(plan.id) : handleViewDetails(plan.id)}
                  className="card-interactive relative"
                >
                  {/* Three-Dot Menu - Top Right */}
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 hover:bg-accent/50 rounded transition-colors"
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(plan.id);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlanToDelete(plan);
                            setShowDeleteDialog(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
              <div className="flex items-start gap-3 pr-8">
                {/* Checkbox for Selection Mode */}
                {isSelectionMode && (
                  <div className="flex-shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedPlans.has(plan.id)}
                      onChange={() => togglePlanSelection(plan.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                )}
                
                {/* Plan Content */}
                <div className="flex-1 min-w-0">
                  {/* Title with Status Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-base flex-1 truncate">
                      {plan.plan_name}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(plan.plan_status)}`}>
                      {plan.plan_status.toUpperCase()}
                    </span>
                  </div>

                  {/* Field Name, Year, Crop, Passes - All on Same Line */}
                  <div className="flex items-center gap-2 text-sm text-farm-muted flex-wrap">
                    <span className="text-primary font-medium">📍 {plan.field_name}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {plan.plan_year}
                    </span>
                    {plan.crop_type && (
                      <>
                        <span>•</span>
                        <span>🌾 {plan.crop_type}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{plan.passes_count} pass{plan.passes_count !== 1 ? 'es' : ''}</span>
                  </div>

                  {/* Source Voice Note (if exists) */}
                  {plan.source_voice_note_title && (
                    <div className="mt-2">
                      <span className="text-xs text-farm-muted">
                        📝 From: <span className="text-farm-text font-medium">{plan.source_voice_note_title}</span>
                      </span>
                    </div>
                  )}

                  {/* Source Document (if exists) */}
                  {plan.source_document_title && (
                    <div className="mt-2">
                      <span className="text-xs text-farm-muted">
                        📄 From: <span className="text-farm-text font-medium">{plan.source_document_title}</span>
                      </span>
                    </div>
                  )}
                </div>
                </div>
              </div>
              ))}
            </div>
              )}
            </>
          )}
          {viewMode === 'shared' && (
            /* Shared Plans View */
            <>
              {selectedSharedPlan ? (
                /* Detail View */
                <div className="space-y-6">
                  {/* Back Button */}
                  <button
                    onClick={() => setSelectedSharedPlan(null)}
                    className="flex items-center gap-2 text-sm text-farm-muted hover:text-farm-text transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to shared summaries
                  </button>

                  {/* Header */}
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold">
                      {selectedSharedPlan.summary_name || `${selectedSharedPlan.year} Field Plans Summary`}
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-farm-muted flex-wrap">
                      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {selectedSharedPlan.communication_method === 'email' ? '📧 Email' : '📱 SMS'}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-secondary/50 text-secondary-foreground font-medium">
                        📊 Summary
                      </span>
                      <span>{new Date(selectedSharedPlan.created_at).toLocaleDateString()}</span>
                      <span>👁 Viewed {selectedSharedPlan.view_count || 0} time{(selectedSharedPlan.view_count || 0) !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Recipients */}
                  {selectedSharedPlan.recipient_names && (
                    <Card className="p-4">
                      <p className="text-sm">
                        <span className="font-semibold">To:</span> {selectedSharedPlan.recipient_names}
                      </p>
                    </Card>
                  )}

                  {/* Summary Info */}
                  <Card className="p-4">
                    <p className="text-sm">
                      <span className="font-semibold">Year:</span> {selectedSharedPlan.year} • <span className="font-semibold">Plans:</span> {selectedSharedPlan.total_plans} • <span className="font-semibold">Fields:</span> {selectedSharedPlan.total_fields}
                    </p>
                  </Card>

                  {/* Message Content */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2 text-sm text-farm-muted">Message</h3>
                    <div className="text-sm leading-relaxed whitespace-pre-line text-farm-text">
                      {selectedSharedPlan.message_body || 'No message content'}
                    </div>
                  </Card>
                </div>
              ) : (
                /* List View */
                <>
                  {sharedLoading ? (
                    <div className="text-center py-12 space-y-3">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="body-text">Loading shared summaries...</p>
                    </div>
                  ) : sharedPlans.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="text-6xl">📊</div>
                      <div className="space-y-2">
                        <h3 className="section-heading">No shared summaries yet</h3>
                        <p className="body-text max-w-sm mx-auto">
                          Share your field plan summaries with advisors to see them here
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sharedPlans.map((share: any) => (
                        <div
                          key={share.id}
                          className="card-interactive"
                        >
                          <div className="flex items-center justify-between gap-3">
                            {/* Content - clickable to view details */}
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setSelectedSharedPlan(share)}
                            >
                              <h3 className="font-semibold text-base truncate mb-1">
                                {share.summary_name || `${share.year} Field Plans Summary`}
                              </h3>
                              <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap">
                                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {share.communication_method === 'email' ? '📧' : '📱'}
                                </span>
                                <span>{new Date(share.created_at).toLocaleDateString()}</span>
                                {share.recipient_names && (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium text-farm-text">To: {share.recipient_names}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span>{share.total_plans} {share.total_plans === 1 ? 'plan' : 'plans'} • {share.total_fields} {share.total_fields === 1 ? 'field' : 'fields'}</span>
                              </div>
                            </div>
                            
                            {/* Three-Dot Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button 
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                  <MoreVertical className="h-5 w-5 text-farm-muted" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSharedPlan(share);
                                }}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShareToDelete(share);
                                    setShowDeleteShareDialog(true);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {viewMode === 'summary' && (
            <>
              {summariesLoading ? (
                <div className="text-center py-12 space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="body-text">Loading summaries...</p>
                </div>
              ) : summaries.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="text-6xl">📊</div>
                  <div className="space-y-2">
                    <h3 className="section-heading">No summaries yet</h3>
                    <p className="body-text max-w-sm mx-auto">
                      Select field plans and generate a summary to see aggregated product totals
                    </p>
                  </div>
                  {filteredPlans.length > 0 && (
                    <Button 
                      onClick={() => {
                        setViewMode('plans');
                        setIsSelectionMode(true);
                      }} 
                      className="mt-4 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Generate Summary
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {summaries
                    .filter(summary => yearFilter === "all" || summary.year.toString() === yearFilter)
                    .map((summary) => (
                    <div
                      key={summary.id}
                      className="card-interactive"
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Content - clickable to view details */}
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/field-plans/summary/${summary.id}`)}
                        >
                          <h3 className="font-semibold text-base mb-1">
                            {summary.summary_name || `${summary.year} Field Plans Summary`}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-farm-muted flex-wrap">
                            <span>{summary.year}</span>
                            <span>•</span>
                            <span>{summary.total_plans} {summary.total_plans === 1 ? 'plan' : 'plans'}</span>
                            <span>•</span>
                            <span>{summary.total_fields} {summary.total_fields === 1 ? 'field' : 'fields'}</span>
                            <span>•</span>
                            <span>{summary.total_products} {summary.total_products === 1 ? 'product' : 'products'}</span>
                            <span>•</span>
                            <span>{new Date(summary.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {/* Three-Dot Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              onClick={(e) => e.stopPropagation()}
                              className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                              <MoreVertical className="h-5 w-5 text-farm-muted" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/field-plans/summary/${summary.id}`);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEditTitle(summary);
                            }}>
                              <Calendar className="mr-2 h-4 w-4" />
                              Edit Title
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSummaryToDelete(summary);
                                setShowDeleteSummaryDialog(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* FAB Action Button - Only show on Field Plans tab */}
        {viewMode === 'plans' && (
          <button
            onClick={() => navigate("/field-plans/new")}
            className="fixed bottom-6 right-6 lg:right-[calc(50%-256px+1.5rem)] w-14 h-14 rounded-full bg-farm-accent text-farm-dark shadow-lg hover:shadow-xl transition-all hover:scale-110 z-20 flex items-center justify-center"
            style={{ boxShadow: "var(--shadow-elevated)" }}
            aria-label="Create new field plan"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full !top-[50vh] !-translate-y-1/2">
          <button
            onClick={() => setShowDeleteDialog(false)}
            className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <div className="max-h-[80vh] overflow-y-auto pr-2">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Field Plan?</AlertDialogTitle>
              <AlertDialogDescription>
                {planToDelete && (
                  <>
                    <div className="mb-3">
                      Are you sure you want to delete the field plan for{" "}
                      <span className="font-semibold">"{planToDelete.field_name}"</span>?
                    </div>
                    <div className="text-sm">
                      This will permanently delete:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{planToDelete.passes_count} pass{planToDelete.passes_count !== 1 ? 'es' : ''}</li>
                        <li>All associated products and costs</li>
                        <li>Variable rate zones (if any)</li>
                      </ul>
                      <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePlan}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Shared Plan Confirmation Dialog */}
      <AlertDialog open={showDeleteShareDialog} onOpenChange={setShowDeleteShareDialog}>
        <AlertDialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full !top-[50vh] !-translate-y-1/2">
          <button
            onClick={() => setShowDeleteShareDialog(false)}
            className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <div className="max-h-[80vh] overflow-y-auto pr-2">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Shared Plan?</AlertDialogTitle>
              <AlertDialogDescription>
                {shareToDelete && (
                  <>
                    <div className="mb-3">
                      Are you sure you want to delete this shared plan?
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold mb-2">{shareToDelete.message_subject || 'Field Plans Shared'}</p>
                      <p>Sent to: <span className="font-medium">{shareToDelete.recipient_names}</span></p>
                      <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteShare}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary Details Dialog */}
      {/* Summary modal removed - now navigating to detail page */}

      {/* Delete Summary Confirmation Dialog */}
      <AlertDialog open={showDeleteSummaryDialog} onOpenChange={setShowDeleteSummaryDialog}>
        <AlertDialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full !top-[50vh] !-translate-y-1/2">
          <button
            onClick={() => setShowDeleteSummaryDialog(false)}
            className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <div className="max-h-[80vh] overflow-y-auto pr-2">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Summary?</AlertDialogTitle>
              <AlertDialogDescription>
                {summaryToDelete && (
                  <>
                    <div className="mb-3">
                      Are you sure you want to delete this field plan summary?
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold mb-2">{summaryToDelete.summary_name || `${summaryToDelete.year} Field Plans Summary`}</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>{summaryToDelete.total_plans} plan{summaryToDelete.total_plans !== 1 ? 's' : ''} aggregated</li>
                        <li>{summaryToDelete.total_fields} field{summaryToDelete.total_fields !== 1 ? 's' : ''} covered</li>
                        <li>{summaryToDelete.total_products} product{summaryToDelete.total_products !== 1 ? 's' : ''} tracked</li>
                      </ul>
                      <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSummary}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Summary Title Dialog */}
      <Dialog open={showEditTitleDialog} onOpenChange={setShowEditTitleDialog}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit Summary Title</DialogTitle>
            <DialogDescription>
              Enter a custom title for this summary
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Enter title..."
              className="w-full px-3 py-2 border rounded-md bg-farm-dark focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTitleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTitle}>
              Save Title
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FieldPlans;


