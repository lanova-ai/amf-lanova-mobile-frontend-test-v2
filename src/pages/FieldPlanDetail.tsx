import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Plus, X, Calendar as CalendarIcon, TrendingUp, CheckCircle2, Circle, ChevronDown, ChevronUp, MoreVertical, Sprout, Droplets, Wheat, Tractor, Wrench, FileText, Eye, Download, RotateCcw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fieldPlansAPI, fieldsAPI, fieldOperationsAPI, ActivityPassesResponse, handlePageError } from "@/lib/api";
import { useManagementZones } from "@/hooks/useManagementZones";
import { ManagementZonesLayer } from "@/components/ManagementZonesLayer";
import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";

// fieldPlansAPI is imported from @/lib/api

interface Product {
  id?: string;
  product_name: string;
  product_brand?: string;
  active_ingredient?: string;
  rate?: number;
  rate_unit?: string;
  total_quantity?: number;
  quantity_unit?: string;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
}

interface Pass {
  id: string;
  pass_type: string;
  pass_name: string;
  pass_status: string;
  pass_order: number;
  pass_description?: string;
  timing_type?: string;
  scheduled_date?: string;  // Planned date for the pass
  timing_growth_stage?: string;
  equipment?: string;
  application_method?: string;
  completion_percentage?: number;
  actual_date?: string;
  products_count: number;
  products?: Product[];
  estimated_cost?: number;
  actual_cost?: number;
  sequence_order: number;
  notes?: string;
  prescriptions_count?: number; // Number of prescriptions generated for this pass
}

interface FieldPlanDetail {
  id: string;
  plan_name: string;
  field_name?: string | null;
  field_id: string;
  plan_year: number;
  crop_type?: string;
  plan_status: string;
  total_acres?: number;
  passes_count: number; // Backend returns passes_count, not total_passes
  completed_passes: number;
  estimated_cost?: number;
  actual_cost?: number;
  source_voice_note_title?: string;
  source_voice_note_id?: string;
  source_document_title?: string;
  source_document_id?: string;
  created_at: string;
  updated_at: string;
  passes: Pass[];
  notes?: string;
}

const FieldPlanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<FieldPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [expandedPasses, setExpandedPasses] = useState<Set<string>>(new Set());
  
  // Inline editing state
  const [editingStatus, setEditingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Plan Overview inline editing state
  const [editingOverview, setEditingOverview] = useState(false);
  const [editedPlanName, setEditedPlanName] = useState("");
  const [editedFieldId, setEditedFieldId] = useState<string | null>(null);
  const [editedCropType, setEditedCropType] = useState("");
  const [editedPlanYear, setEditedPlanYear] = useState<number>(new Date().getFullYear());
  const [editedNotes, setEditedNotes] = useState("");
  const [availableFields, setAvailableFields] = useState<any[]>([]);
  
  // Product editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editedProduct, setEditedProduct] = useState<Partial<Product>>({});
  
  // Pass editing state
  const [editingPassId, setEditingPassId] = useState<string | null>(null);
  const [editedPass, setEditedPass] = useState<{ pass_name: string; pass_type: string; pass_order?: number; equipment?: string }>({ pass_name: "", pass_type: "" });
  
  // Add Pass dialog state
  const [showAddPassDialog, setShowAddPassDialog] = useState(false);
  const [newPass, setNewPass] = useState({ pass_type: "", pass_name: "", pass_order: 1 });
  const [newPassProducts, setNewPassProducts] = useState<Array<{ product_name: string; rate: string; rate_unit: string }>>([]);
  
  // Add Product dialog state
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [addProductPassId, setAddProductPassId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ product_name: "", rate: "", rate_unit: "lbs/acre" });
  
  // Delete confirmation state
  const [passToDelete, setPassToDelete] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<{ passId: string; productId: string } | null>(null);
  
  // Pass completion date popover state
  const [completionPopoverOpen, setCompletionPopoverOpen] = useState<string | null>(null);
  const [selectedCompletionDate, setSelectedCompletionDate] = useState<Date>(new Date());
  
  // Pass status popover state
  const [statusPopoverOpen, setStatusPopoverOpen] = useState<string | null>(null);
  const [selectedPassStatus, setSelectedPassStatus] = useState<string>('completed');
  
  // Prescription state (latest prescription per pass)
  const [passPrescriptions, setPassPrescriptions] = useState<Record<string, any>>({});
  
  // Delete prescription confirmation
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<{ passId: string; prescriptionId: string } | null>(null);

  // JD Ops Activity Passes
  const [activityPasses, setActivityPasses] = useState<ActivityPassesResponse | null>(null);
  const [loadingActivityPasses, setLoadingActivityPasses] = useState(false);
  const [showActivityPasses, setShowActivityPasses] = useState(false);

  useEffect(() => {
    loadPlan();
    loadAvailableFields();
  }, [id]);
  
  const loadAvailableFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name for easier selection
      const sortedFields = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setAvailableFields(sortedFields);
    } catch (error) {
      console.error("Failed to load fields:", error);
    }
  };
  
  // Load prescriptions for all passes that have them
  useEffect(() => {
    if (plan?.passes) {
      plan.passes.forEach(pass => {
        if (pass.prescriptions_count && pass.prescriptions_count > 0) {
          loadPrescription(pass.id);
        }
      });
    }
  }, [plan?.passes]);

  // Load JD Ops activity passes when field_id and plan_year are available
  useEffect(() => {
    if (plan?.field_id && plan?.plan_year) {
      loadActivityPasses();
    }
  }, [plan?.field_id, plan?.plan_year]);

  /**
   * Get the effective year for JD Ops activity display.
   * 
   * Agricultural season logic:
   * - Future years (plan year > current year): Use previous year's data (most recent complete season)
   * - Before March: Show previous year's data (last season's harvest/activity is most relevant)
   * - March onwards: Show current year's data (new planting season started)
   * 
   * This handles the transition period where farmers are still reviewing
   * last season's data in Jan-Feb before the new planting season begins.
   */
  const getEffectiveActivityYear = (planYear: number): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12 (January = 1)
    const currentYear = now.getFullYear();
    
    // If plan year is in the future, show the most recent complete season
    // (current year - 1 if before March, otherwise current year)
    if (planYear > currentYear) {
      return currentMonth < 3 ? currentYear - 1 : currentYear;
    }
    
    // If plan is for current year but we're before March,
    // the previous year's data is more relevant (last season)
    if (planYear === currentYear && currentMonth < 3) {
      return currentYear - 1;
    }
    
    return planYear;
  };

  const loadActivityPasses = async () => {
    if (!plan?.field_id || !plan?.plan_year) return;
    
    const effectiveYear = getEffectiveActivityYear(plan.plan_year);
    
    try {
      setLoadingActivityPasses(true);
      
      // Try to load activity for the effective year
      let response = await fieldOperationsAPI.getActivityPasses(plan.field_id, effectiveYear);
      
      // If no data found, try previous years as fallback (up to 2 years back)
      if (!response.has_jd_data) {
        for (let yearOffset = 1; yearOffset <= 2; yearOffset++) {
          const fallbackYear = effectiveYear - yearOffset;
          console.log(`No JD Ops data for ${effectiveYear}, trying ${fallbackYear}`);
          response = await fieldOperationsAPI.getActivityPasses(plan.field_id, fallbackYear);
          if (response.has_jd_data) {
            break;
          }
        }
      }
      
      setActivityPasses(response);
    } catch (error) {
      console.error("Failed to load JD Ops activity:", error);
      // Silently fail - JD Ops data is optional
      setActivityPasses(null);
    } finally {
      setLoadingActivityPasses(false);
    }
  };

  const loadPlan = async () => {
    try {
      setLoading(true);
      const response = await fieldPlansAPI.getFieldPlan(id!);
      setPlan(response);
    } catch (error: any) {
      console.error("Error loading plan:", error);
      toast.error("Failed to load field plan");
      navigate("/field-plans");
    } finally {
      setLoading(false);
    }
  };
  
  const loadPrescription = async (passId: string) => {
    try {
      const prescription = await fieldPlansAPI.getPrescription(passId);
      setPassPrescriptions(prev => ({ ...prev, [passId]: prescription }));
    } catch (error: any) {
      // Silently handle 404 (no prescription yet)
      if (error?.status !== 404) {
        console.error("Error loading prescription:", error);
      }
    }
  };
  
  const handleDeletePrescription = async () => {
    if (!prescriptionToDelete) return;
    
    const { passId, prescriptionId } = prescriptionToDelete;
    
    try {
      await fieldPlansAPI.deletePrescription(prescriptionId);
      toast.success("Prescription deleted");
      setPassPrescriptions(prev => {
        const updated = { ...prev };
        delete updated[passId];
        return updated;
      });
      // Reload plan to update prescription count
      loadPlan();
    } catch (error: any) {
      console.error("Error deleting prescription:", error);
      toast.error("Failed to delete prescription");
    } finally {
      setPrescriptionToDelete(null);
    }
  };

  const handleGenerateRx = async (pass: Pass) => {
    // Navigate to dedicated prescription generation page
    navigate(`/field-plans/${id}/generate-prescription`, {
      state: {
        pass,
        fieldId: plan?.field_id,
        fieldName: plan?.field_name,
        totalAcres: plan?.total_acres
      }
    });
  };

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

  const getPassStatusBadge = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getPassTypeIcon = (passType: string) => {
    const className = "h-4 w-4 text-primary";
    switch (passType) {
      case 'planting':
        return <Sprout className={className} />; // Seeds/planting
      case 'fertilizer':
        return <Droplets className={className} />; // Liquid/granular application
      case 'herbicide':
        return <Droplets className={className} />; // Spray application
      case 'insecticide':
        return <Droplets className={className} />; // Spray application
      case 'irrigation':
        return <Droplets className={className} />; // Water/irrigation (same as spraying)
      case 'fungicide':
        return <Droplets className={className} />; // Spray application
      case 'cultivation':
        return <Tractor className={className} />; // Cultivation/tillage
      case 'harvest':
        return <Wheat className={className} />; // Harvest crop
      case 'tillage':
        return <Tractor className={className} />; // Soil working
      default:
        return <Wrench className={className} />; // Custom/other
    }
  };

  // Icon helper for JD Ops activity passes (uses same icons as field plan passes)
  const getActivityPassIcon = (passType: string) => {
    const className = "h-5 w-5 text-farm-accent";
    switch (passType.toLowerCase()) {
      case 'planting':
      case 'seeding':
        return <Sprout className={className} />;
      case 'spraying':
      case 'application':
      case 'herbicide':
      case 'fungicide':
      case 'insecticide':
      case 'fertilizer':
        return <Droplets className={className} />;
      case 'irrigation':
      case 'chemigation':
      case 'fertigation':
        return <Droplets className={className} />;
      case 'tillage':
      case 'cultivation':
        return <Tractor className={className} />;
      case 'harvest':
        return <Wheat className={className} />;
      default:
        return <Wrench className={className} />;
    }
  };

  // Timeline parsing for Previous Season Summary (same as JD Ops Reports)
  interface JDTimelineEvent {
    date?: string;
    category: 'planting' | 'application' | 'harvest' | 'tillage' | 'other';
    description: string;
  }

  const parseJDOpsToTimeline = (text: string): JDTimelineEvent[] => {
    if (!text) return [];
    
    const lines = text.split('\n');
    const timeline: JDTimelineEvent[] = [];
    let currentCategory: JDTimelineEvent['category'] = 'other';
    let currentMonthRange = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and notes
      if (!trimmed || trimmed.startsWith('*Note:') || trimmed === '***' || trimmed === '---') continue;
      
      // Detect section headers (→ Planting, → Application, etc.)
      const arrowMatch = trimmed.match(/^(\*\*)?(→|->|--)\s*(.+?)(\s*\(([^)]+)\))?(\*\*)?$/);
      if (arrowMatch) {
        const title = arrowMatch[3].toLowerCase();
        currentMonthRange = arrowMatch[5] || '';
        
        if (title.includes('plant') || title.includes('seed')) {
          currentCategory = 'planting';
        } else if (title.includes('applic') || title.includes('spray') || title.includes('fertiliz')) {
          currentCategory = 'application';
        } else if (title.includes('harvest')) {
          currentCategory = 'harvest';
        } else if (title.includes('till')) {
          currentCategory = 'tillage';
        } else {
          currentCategory = 'other';
        }
        continue;
      }
      
      // Extract bullet points with dates
      if (trimmed.startsWith('*') || trimmed.startsWith('•')) {
        const bulletText = trimmed.replace(/^[\*•]\s*/, '').replace(/\*\*/g, '');
        
        // Try to extract date from the text
        const dateMatch = bulletText.match(/^([A-Z][a-z]{2}\s+\d{1,2})\s*[:,-]?\s*(.+)/);
        if (dateMatch) {
          const description = dateMatch[2].trim();
          if (description.length > 3) {
            timeline.push({
              date: dateMatch[1],
              category: currentCategory,
              description: description
            });
          }
        } else {
          // Summary items without date prefix
          if (bulletText.toLowerCase().includes('overall mean yield') || 
              bulletText.toLowerCase().includes('overall mean moisture') ||
              bulletText.toLowerCase().includes('yield by hybrid') ||
              bulletText.toLowerCase().includes('hybrids summary') ||
              bulletText.toLowerCase().includes('varieties summary')) {
            timeline.push({
              date: currentMonthRange || 'Summary',
              category: currentCategory,
              description: bulletText
            });
          } else if (bulletText.length > 15) {
            timeline.push({
              date: currentMonthRange || undefined,
              category: currentCategory,
              description: bulletText
            });
          }
        }
      }
    }
    
    return timeline;
  };

  const getCategoryColor = (category: JDTimelineEvent['category']) => {
    switch (category) {
      case 'planting': return 'text-green-500';
      case 'application': return 'text-blue-500';
      case 'harvest': return 'text-orange-500';
      case 'tillage': return 'text-amber-500';
      default: return 'text-farm-muted';
    }
  };

  const formatCost = (cost?: number) => {
    if (!cost) return "—";
    return `$${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    // Parse date parts directly to avoid timezone shift
    // "2026-07-01" should display as "Jul 1, 2026" not "Jun 30, 2026"
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleTogglePassComplete = async (passId: string, currentStatus: string) => {
    if (!plan) return;
    
    // If marking as incomplete, directly toggle
    if (currentStatus === 'completed') {
      try {
        await fieldPlansAPI.updatePassStatus(plan.id, passId, 'planned');
        
        // Update local state
        const updatedPasses = plan.passes.map(p =>
          p.id === passId ? { ...p, pass_status: 'planned', actual_date: undefined } : p
        );
        const completedCount = updatedPasses.filter(p => p.pass_status === 'completed').length;
        setPlan({
          ...plan,
          passes: updatedPasses,
          completed_passes: completedCount,
        });
        
        toast.success("Pass reopened");
      } catch (error) {
        console.error("Error updating pass status:", error);
        toast.error("Failed to update pass status");
      }
    } else {
      // If marking as complete, open the date popover
      setCompletionPopoverOpen(passId);
      setSelectedCompletionDate(new Date());
    }
  };

  const handleOpenStatusPopover = (passId: string) => {
    setStatusPopoverOpen(passId);
    setSelectedPassStatus('completed');
    setSelectedCompletionDate(new Date());
  };

  const handleConfirmStatusChange = async (passId: string) => {
    if (!plan) return;
    
    try {
      // If completed, include date
      if (selectedPassStatus === 'completed') {
        const formattedDate = format(selectedCompletionDate, 'yyyy-MM-dd');
        await fieldPlansAPI.updatePassStatus(plan.id, passId, 'completed', formattedDate);
        
        // Update local state
        const updatedPasses = plan.passes.map(p =>
          p.id === passId ? { ...p, pass_status: 'completed', actual_date: formattedDate } : p
        );
        const completedCount = updatedPasses.filter(p => p.pass_status === 'completed').length;
        setPlan({
          ...plan,
          passes: updatedPasses,
          completed_passes: completedCount,
        });
        
        toast.success("Pass marked as completed!");
      } else {
        // For other statuses, no date needed
        await fieldPlansAPI.updatePassStatus(plan.id, passId, selectedPassStatus);
        
        // Update local state
        const updatedPasses = plan.passes.map(p =>
          p.id === passId ? { ...p, pass_status: selectedPassStatus, actual_date: undefined } : p
        );
        const completedCount = updatedPasses.filter(p => p.pass_status === 'completed').length;
        setPlan({
          ...plan,
          passes: updatedPasses,
          completed_passes: completedCount,
        });
        
        toast.success(`Pass status updated to ${selectedPassStatus.replace('_', ' ')}`);
      }
      
      setStatusPopoverOpen(null);
    } catch (error) {
      console.error("Error updating pass status:", error);
      toast.error("Failed to update pass status");
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    try {
      await fieldPlansAPI.deleteFieldPlan(plan.id);
      toast.success("Field plan deleted successfully");
      navigate("/field-plans");
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete field plan");
    }
  };

  const togglePassExpansion = (passId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedPasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(passId)) {
        newSet.delete(passId);
      } else {
        newSet.add(passId);
      }
      return newSet;
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!plan) return;
    
    try {
      setSaving(true);
      await fieldPlansAPI.updateFieldPlan(plan.id, { plan_status: newStatus });
      setPlan({ ...plan, plan_status: newStatus });
      setEditingStatus(false);
      toast.success("Status updated");
    } catch (error: any) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  // Plan Overview editing handlers
  const handleStartEditOverview = () => {
    if (!plan) return;
    setEditedPlanName(plan.plan_name);
    setEditedFieldId(plan.field_id || null);
    setEditedCropType(plan.crop_type || "");
    setEditedPlanYear(plan.plan_year);
    setEditedNotes(plan.notes || "");
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (!plan) return;
    
    try {
      setSaving(true);
      const updateData: any = {};
      
      if (editedPlanName.trim() !== plan.plan_name) {
        updateData.plan_name = editedPlanName.trim();
      }
      if (editedFieldId !== plan.field_id) {
        updateData.field_id = editedFieldId || null;
      }
      if (editedCropType !== (plan.crop_type || "")) {
        updateData.crop_type = editedCropType.trim() || null;
      }
      if (editedPlanYear !== plan.plan_year) {
        updateData.plan_year = editedPlanYear;
      }
      if (editedNotes !== (plan.notes || "")) {
        updateData.notes = editedNotes.trim() || null;
      }
      
      if (Object.keys(updateData).length > 0) {
        await fieldPlansAPI.updateFieldPlan(plan.id, updateData);
        await loadPlan(); // Reload to get updated field_name
        toast.success("Plan overview updated");
      }
      
      setEditingOverview(false);
    } catch (error: any) {
      console.error("Failed to update plan overview:", error);
      toast.error(error.message || "Failed to update plan overview");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditOverview = () => {
    setEditingOverview(false);
    setEditedPlanName("");
    setEditedFieldId(null);
    setEditedCropType("");
    setEditedPlanYear(new Date().getFullYear());
    setEditedNotes("");
  };

  const handleEditProduct = (passId: string, product: Product) => {
    setEditingProductId(product.id || null);
    setEditedProduct({
      product_name: product.product_name,
      rate: product.rate,
      rate_unit: product.rate_unit,
      total_quantity: product.total_quantity,
      quantity_unit: product.quantity_unit,
    });
  };

  const handleSaveProduct = async (passId: string, productId: string) => {
    if (!plan || !editedProduct.product_name?.trim()) return;
    
    try {
      setSaving(true);
      await fieldPlansAPI.updateProduct(passId, productId, editedProduct);
      
      // Reload the plan to get backend-calculated values (total_quantity, quantity_unit, etc.)
      await loadPlan();
      
      setEditingProductId(null);
      setEditedProduct({});
      toast.success("Product updated");
    } catch (error: any) {
      console.error("Failed to update product:", error);
      toast.error("Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProductEdit = () => {
    setEditingProductId(null);
    setEditedProduct({});
  };

  // Pass editing handlers
  const handleEditPass = (pass: Pass) => {
    setEditingPassId(pass.id);
    setEditedPass({
      pass_name: pass.pass_name,
      pass_type: pass.pass_type,
      pass_order: pass.pass_order,
      equipment: pass.equipment || "",
    });
  };

  const handleSavePass = async (passId: string) => {
    if (!plan || !editedPass.pass_name.trim() || !editedPass.pass_type.trim()) {
      toast.error("Pass name and type are required");
      return;
    }

    try {
      setSaving(true);
      
      const updateData: any = {
        pass_name: editedPass.pass_name,
        pass_type: editedPass.pass_type,
      };
      
      if (editedPass.pass_order !== undefined) {
        updateData.pass_order = editedPass.pass_order;
      }
      
      if (editedPass.equipment !== undefined) {
        updateData.equipment = editedPass.equipment.trim() || null;
      }
      
      await fieldPlansAPI.updatePass(plan.id, passId, updateData);
      
      // Reload plan to get updated order
      await loadPlan();
      setEditingPassId(null);
      setEditedPass({ pass_name: "", pass_type: "" });
      toast.success("Pass updated successfully");
    } catch (error: any) {
      console.error("Failed to update pass:", error);
      toast.error("Failed to update pass");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPassEdit = () => {
    setEditingPassId(null);
    setEditedPass({ pass_name: "", pass_type: "" });
  };

  // Add Pass handlers
  const handleAddPass = async () => {
    if (!plan || !newPass.pass_type.trim() || !newPass.pass_name.trim()) {
      toast.error("Pass type and name are required");
      return;
    }

    try {
      setSaving(true);
      const nextSequence = plan.passes.length > 0 
        ? Math.max(...plan.passes.map(p => p.sequence_order)) + 1 
        : 1;
      
      const createdPass = await fieldPlansAPI.createPass(plan.id, {
        pass_name: newPass.pass_name,
        pass_type: newPass.pass_type,
        pass_order: newPass.pass_order,
        sequence_order: nextSequence,
      });
      
      // Create products if any were added
      if (newPassProducts.length > 0 && createdPass.id) {
        for (const product of newPassProducts) {
          if (product.product_name.trim()) {
            try {
              const rate = product.rate && product.rate.trim() !== '' 
                ? parseFloat(product.rate) 
                : 0;
              
              const productData = {
                product_name: product.product_name.trim(),
                rate: isNaN(rate) ? 0 : rate,
                rate_unit: product.rate_unit || 'lbs/acre',
              };
              
              console.log('Creating product with data:', productData);
              await fieldPlansAPI.createProduct(createdPass.id, productData);
            } catch (error) {
              console.error("Failed to add product:", error);
              // Continue with other products even if one fails
            }
          }
        }
      }
      
      // Reload plan to get updated data
      await loadPlan();
      setShowAddPassDialog(false);
      setNewPass({ pass_type: "", pass_name: "", pass_order: 1 });
      setNewPassProducts([]);
      
      const successMsg = newPassProducts.length > 0 
        ? `Pass added with ${newPassProducts.length} product(s)`
        : "Pass added";
      toast.success(successMsg);
    } catch (error: any) {
      console.error("Failed to add pass:", error);
      toast.error("Failed to add pass");
    } finally {
      setSaving(false);
    }
  };

  // Add Product handlers
  const handleOpenAddProduct = (passId: string) => {
    setAddProductPassId(passId);
    setShowAddProductDialog(true);
  };

  const handleAddProduct = async () => {
    if (!addProductPassId || !newProduct.product_name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      setSaving(true);
      await fieldPlansAPI.createProduct(addProductPassId, {
        product_name: newProduct.product_name,
        rate: parseFloat(newProduct.rate) || 0,
        rate_unit: newProduct.rate_unit,
      });
      
      // Reload plan to get updated data
      await loadPlan();
      setShowAddProductDialog(false);
      setAddProductPassId(null);
      setNewProduct({ product_name: "", rate: "", rate_unit: "lbs/acre" });
      toast.success("Product added");
    } catch (error: any) {
      console.error("Failed to add product:", error);
      toast.error("Failed to add product");
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const handleDeletePass = async (passId: string) => {
    if (!plan) return;

    try {
      setSaving(true);
      await fieldPlansAPI.deletePass(plan.id, passId);
      
      // Reload plan to get updated pass_order values after automatic reordering
      await loadPlan();
      setPassToDelete(null);
      toast.success("Pass deleted");
    } catch (error: any) {
      console.error("Failed to delete pass:", error);
      toast.error("Failed to delete pass");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!plan || !productToDelete) return;

    try {
      setSaving(true);
      await fieldPlansAPI.deleteProduct(productToDelete.passId, productToDelete.productId);
      
      // Update local state
      const updatedPasses = plan.passes.map(pass => {
        if (pass.id === productToDelete.passId && pass.products) {
          return {
            ...pass,
            products: pass.products.filter(p => p.id !== productToDelete.productId),
            products_count: pass.products_count - 1,
          };
        }
        return pass;
      });
      
      setPlan({ ...plan, passes: updatedPasses });
      setProductToDelete(null);
      toast.success("Product deleted");
    } catch (error: any) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    } finally {
      setSaving(false);
    }
  };

  const getProgressPercentage = () => {
    if (!plan || plan.passes_count === 0) return 0;
    return Math.round((plan.completed_passes / plan.passes_count) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <p className="text-farm-muted">Field plan not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark overflow-y-auto scrollbar-hide">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark border-b border-farm-accent/20 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-farm-accent/10 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-farm-text" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate text-farm-text">{plan.plan_name}</h1>
              <p className="text-xs text-farm-muted">{plan.field_name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-6 space-y-6">
        {/* Plan Overview Card */}
        <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-farm-text">Plan Overview</h2>
            <div className="flex items-center gap-2">
              {!editingOverview && (
                <button
                  onClick={handleStartEditOverview}
                  className="p-1 text-farm-muted hover:text-farm-accent hover:bg-farm-accent/10 rounded transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {editingStatus ? (
                <Select
                  value={plan.plan_status}
                  onValueChange={handleStatusChange}
                  disabled={saving}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <button 
                  onClick={() => setEditingStatus(true)}
                  className={`text-xs px-2 py-1 rounded-full border ${getStatusBadge(plan.plan_status)} hover:opacity-80 transition-opacity`}
                >
                  {plan.plan_status.toUpperCase()}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Plan Name */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-farm-muted">Plan Name</span>
              {editingOverview ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input
                    type="text"
                    value={editedPlanName}
                    onChange={(e) => setEditedPlanName(e.target.value)}
                    className="px-2 py-1 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm focus:outline-none focus:ring-2 focus:ring-farm-accent max-w-[200px]"
                    disabled={saving}
                  />
                </div>
              ) : (
                <span className="font-medium text-farm-text">{plan.plan_name}</span>
              )}
            </div>

            {/* Field Name */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-farm-muted">Field</span>
              {editingOverview ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <Select
                    value={editedFieldId || "none"}
                    onValueChange={(val) => setEditedFieldId(val === "none" ? null : val)}
                    disabled={saving}
                  >
                    <SelectTrigger className="w-[200px] h-8">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No field assigned</SelectItem>
                      {availableFields.map((field) => (
                        <SelectItem key={field.field_id} value={field.field_id}>
                          {field.name} ({field.farm_name || 'Unknown Farm'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <span className="font-medium text-farm-text">{plan.field_name || "Not assigned"}</span>
              )}
            </div>
            
            {/* Crop Type */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-farm-muted">Crop</span>
              {editingOverview ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input
                    type="text"
                    value={editedCropType}
                    onChange={(e) => setEditedCropType(e.target.value)}
                    className="px-2 py-1 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm focus:outline-none focus:ring-2 focus:ring-farm-accent max-w-[200px]"
                    placeholder="e.g., Corn, Soybeans"
                    disabled={saving}
                  />
                </div>
              ) : (
                <span className="font-medium">🌾 {plan.crop_type || "Not specified"}</span>
              )}
            </div>
            
            {/* Year */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-farm-muted">Year</span>
              {editingOverview ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <input
                    type="number"
                    value={editedPlanYear}
                    onChange={(e) => setEditedPlanYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="px-2 py-1 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm focus:outline-none focus:ring-2 focus:ring-farm-accent w-[100px]"
                    min="2020"
                    max="2050"
                    disabled={saving}
                  />
                </div>
              ) : (
                <span className="font-medium">
                  <CalendarIcon className="inline h-3 w-3 mr-1" />
                  {plan.plan_year}
                </span>
              )}
            </div>

            {/* Total Acres */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-farm-muted">Total Acres</span>
              <span className="font-medium">
                {plan.total_acres && !isNaN(Number(plan.total_acres)) ? `${Number(plan.total_acres).toFixed(1)} acres` : "Not specified"}
              </span>
            </div>

            {/* Source Voice Note */}
            {plan.source_voice_note_title && (
              <div className="pt-3 border-t">
                <div className="flex flex-col gap-2">
                  <span className="text-farm-muted text-sm">Source Recording</span>
                  <button
                    onClick={() => plan.source_voice_note_id && navigate(`/recordings/${plan.source_voice_note_id}`)}
                    className="flex items-center justify-between w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-farm-text truncate">📝 {plan.source_voice_note_title}</p>
                      <p className="text-xs text-farm-muted">Tap to view recording details</p>
                    </div>
                    <Eye className="h-4 w-4 flex-shrink-0 ml-2 text-farm-muted" />
                  </button>
                </div>
              </div>
            )}

            {/* Source Document */}
            {plan.source_document_title && (
              <div className="pt-3 border-t">
                <div className="flex flex-col gap-2">
                  <span className="text-farm-muted text-sm">Source Document</span>
                  <button
                    onClick={() => plan.source_document_id && navigate(`/documents/${plan.source_document_id}`)}
                    className="flex items-center justify-between w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-farm-text truncate">📄 {plan.source_document_title}</p>
                      <p className="text-xs text-farm-muted">Tap to view document details</p>
                    </div>
                    <Eye className="h-4 w-4 flex-shrink-0 ml-2 text-farm-muted" />
                  </button>
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            {(plan.estimated_cost || plan.actual_cost) && (
              <div className="pt-3 border-t space-y-2">
                {plan.estimated_cost && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-farm-muted">Estimated Cost</span>
                    <span className="font-medium">{formatCost(plan.estimated_cost)}</span>
                  </div>
                )}
                {plan.actual_cost && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-farm-muted">Actual Cost</span>
                    <span className="font-medium">{formatCost(plan.actual_cost)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan Notes - only show if notes exist or editing */}
          {(plan.notes || editingOverview) && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-farm-muted">Notes</h3>
              </div>
              {editingOverview ? (
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full px-2 py-1 bg-farm-dark border border-farm-accent/20 rounded text-farm-text text-sm focus:outline-none focus:ring-2 focus:ring-farm-accent min-h-[80px]"
                  placeholder="Add notes about this plan..."
                  disabled={saving}
                />
              ) : (
                <p className="text-sm text-farm-text leading-relaxed">{plan.notes}</p>
              )}
            </div>
          )}
          
          {/* Save/Cancel buttons */}
          {editingOverview && (
            <div className="flex items-center gap-2 justify-end pt-3 border-t mt-4">
              <button
                onClick={handleCancelEditOverview}
                disabled={saving}
                className="px-3 py-1.5 text-sm border border-farm-accent/20 rounded hover:bg-farm-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverview}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-farm-accent hover:bg-farm-accent/90 text-farm-dark rounded transition-colors"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* Passes List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-farm-text">Passes ({plan.passes?.length || 0})</h2>
            <Button 
              size="sm" 
              onClick={() => setShowAddPassDialog(true)}
              className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Pass
            </Button>
          </div>

          {(!plan.passes || plan.passes.length === 0) ? (
            <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-farm-muted mb-4">No passes added yet</p>
              <Button 
                onClick={() => setShowAddPassDialog(true)}
                className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Pass
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {plan.passes
                .sort((a, b) => (a.pass_order || a.sequence_order || 0) - (b.pass_order || b.sequence_order || 0))
                .map((pass, index) => {
                  const isExpanded = expandedPasses.has(pass.id);
                  return (
                  <div
                    key={pass.id}
                    className="bg-farm-card border border-farm-accent/20 rounded-lg p-3 hover:shadow-md transition-shadow relative"
                  >
                    <div className="flex items-start gap-2">
                      {/* Status Checkbox with Unified Popover */}
                      <Popover 
                        open={statusPopoverOpen === pass.id} 
                        onOpenChange={(open) => {
                          if (open) {
                            handleOpenStatusPopover(pass.id);
                          } else {
                            setStatusPopoverOpen(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="flex-shrink-0 mt-0.5"
                          >
                            {pass.pass_status === 'completed' ? (
                              <CheckCircle2 className="h-5 w-5 text-farm-accent" />
                            ) : pass.pass_status === 'in_progress' ? (
                              <Circle className="h-5 w-5 text-blue-500 fill-blue-100" />
                            ) : pass.pass_status === 'cancelled' ? (
                              <X className="h-5 w-5 text-red-500" />
                            ) : (
                              <Circle className="h-5 w-5 text-farm-muted hover:text-farm-accent transition-colors" />
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-3 space-y-3">
                            <div className="space-y-2">
                              <div className="text-sm font-medium">Update Pass Status</div>
                              <Select
                                value={selectedPassStatus}
                                onValueChange={setSelectedPassStatus}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                  <SelectItem value="planned">Reset to Planned</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {selectedPassStatus === 'completed' && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className="text-xs text-farm-muted">Select completion date:</div>
                                <Calendar
                                  mode="single"
                                  selected={selectedCompletionDate}
                                  onSelect={(date) => date && setSelectedCompletionDate(date)}
                                  initialFocus
                                  fixedWeeks={false}
                                  className="scale-90 origin-top"
                                  classNames={{
                                    months: "flex flex-col sm:flex-row space-y-0",
                                    month: "space-y-2",
                                    caption: "flex justify-center pt-1 relative items-center h-8",
                                    caption_label: "text-xs font-medium",
                                    nav: "space-x-1 flex items-center",
                                    nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                                    nav_button_previous: "absolute left-1",
                                    nav_button_next: "absolute right-1",
                                    table: "w-full border-collapse",
                                    head_row: "flex",
                                    head_cell: "text-farm-muted rounded-md w-8 font-normal text-[0.7rem]",
                                    row: "flex w-full mt-1",
                                    cell: "h-8 w-8 text-center text-xs p-0 relative",
                                    day: "h-8 w-8 p-0 font-normal",
                                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                                    day_today: "bg-accent text-accent-foreground",
                                    day_outside: "text-farm-muted opacity-50",
                                    day_disabled: "text-farm-muted opacity-50",
                                    day_hidden: "invisible",
                                  }}
                                />
                              </div>
                            )}
                            
                            <div className="flex gap-2 pt-2 border-t">
                              <Button 
                                size="sm" 
                                className="flex-1"
                                onClick={() => handleConfirmStatusChange(pass.id)}
                              >
                                Confirm
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setStatusPopoverOpen(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Pass Content */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="cursor-pointer"
                          onClick={(e) => togglePassExpansion(pass.id, e)}
                        >
                          {/* Pass Name Row */}
                          <div className="flex items-center gap-2 pr-8">
                            <div className="flex items-center justify-center">{getPassTypeIcon(pass.pass_type)}</div>
                            <h3 className="font-semibold flex-1 truncate text-sm">
                              {pass.pass_order || index + 1}. {pass.pass_name || pass.pass_type}
                            </h3>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-farm-muted flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-farm-muted flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* Status and Rx Row */}
                          <div className="flex items-center gap-2 mt-1 ml-7">
                            {(pass.prescriptions_count ?? 0) > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {pass.prescriptions_count} Rx
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getPassStatusBadge(pass.pass_status)}`}>
                              {pass.pass_status.toUpperCase().replace('_', ' ')}
                            </span>
                            {pass.pass_status === 'completed' && pass.actual_date && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-farm-accent/10 text-farm-accent border border-farm-accent/20 flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {format(new Date(pass.actual_date), 'MM/dd/yyyy')}
                              </span>
                            )}
                          </div>
                          <div className="absolute top-2 right-2 z-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button 
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 hover:bg-muted rounded"
                                >
                                  <MoreVertical className="h-3.5 w-3.5 text-farm-muted" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditPass(pass);
                                }}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPassToDelete(pass.id);
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

                        {/* Pass Metadata */}
                        {(pass.scheduled_date || pass.timing_growth_stage || pass.products_count > 0) && (
                          <div className="flex items-center gap-2 text-xs text-farm-muted mt-1">
                            {pass.scheduled_date && (
                              <span>{formatDate(pass.scheduled_date)}</span>
                            )}
                            {pass.timing_growth_stage && (
                              <>
                                {pass.scheduled_date && <span>•</span>}
                                <span>{pass.timing_growth_stage}</span>
                              </>
                            )}
                            {pass.products_count > 0 && (
                              <>
                                {(pass.scheduled_date || pass.timing_growth_stage) && <span>•</span>}
                                <span>{pass.products_count} product{pass.products_count !== 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Cost Info */}
                        {(pass.estimated_cost || pass.actual_cost) && (
                          <div className="flex items-center gap-3 text-xs mt-1">
                            {pass.estimated_cost && (
                              <div className="flex items-center gap-1">
                                <span className="text-farm-muted">Est:</span>
                                <span className="font-medium">{formatCost(pass.estimated_cost)}</span>
                              </div>
                            )}
                            {pass.actual_cost && (
                              <div className="flex items-center gap-1">
                                <span className="text-farm-muted">Actual:</span>
                                <span className="font-medium">{formatCost(pass.actual_cost)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {/* Pass Metadata Grid */}
                            <div className="bg-muted/30 rounded-lg p-2 grid grid-cols-2 gap-2 text-sm">
                              {pass.timing_growth_stage && (
                                <div className="flex items-center gap-2">
                                  <span className="text-farm-muted">⏰</span>
                                  <div>
                                    <div className="text-xs text-farm-muted uppercase">Timing</div>
                                    <div className="font-medium">{pass.timing_growth_stage}</div>
                                  </div>
                                </div>
                              )}
                              {pass.equipment && (
                                <div className="flex items-center gap-2">
                                  <span className="text-farm-muted">🚜</span>
                                  <div>
                                    <div className="text-xs text-farm-muted uppercase">Equipment</div>
                                    <div className="font-medium">{pass.equipment}</div>
                                  </div>
                                </div>
                              )}
                              {pass.application_method && (
                                <div className="flex items-center gap-2">
                                  <span className="text-farm-muted">📐</span>
                                  <div>
                                    <div className="text-xs text-farm-muted uppercase">Method</div>
                                    <div className="font-medium">{pass.application_method}</div>
                                  </div>
                                </div>
                              )}
                              {pass.completion_percentage !== undefined && pass.completion_percentage > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-farm-muted">📊</span>
                                  <div className="flex-1">
                                    <div className="text-xs text-farm-muted uppercase mb-1">Progress</div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-primary transition-all"
                                          style={{ width: `${pass.completion_percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium">{pass.completion_percentage}%</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Products Section */}
                            {pass.products && pass.products.length > 0 ? (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-farm-muted">🧪</span>
                                    <h4 className="text-xs font-medium uppercase text-farm-muted">
                                      Products ({pass.products.length})
                                    </h4>
                                  </div>
                                  <button
                                    onClick={() => handleOpenAddProduct(pass.id)}
                                    className="text-xs text-farm-accent hover:underline flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Add
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {pass.products.map((product, productIdx) => {
                                    const isEditing = editingProductId === product.id;
                                    
                                    return (
                                    <div 
                                      key={productIdx}
                                      className="bg-muted/50 border rounded-lg p-2 space-y-1.5"
                                    >
                                      {isEditing ? (
                                        /* Edit Mode */
                                        <div className="space-y-2">
                                          {/* Product Name */}
                                          <div>
                                            <label className="text-xs text-farm-muted">Product Name</label>
                                            <input
                                              type="text"
                                              value={editedProduct.product_name || ""}
                                              onChange={(e) => setEditedProduct({ ...editedProduct, product_name: e.target.value })}
                                              className="w-full px-2 py-1 text-sm bg-farm-dark border rounded mt-0.5"
                                              disabled={saving}
                                            />
                                          </div>
                                          {/* Rate */}
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-xs text-farm-muted">Rate</label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={editedProduct.rate || ""}
                                                onChange={(e) => setEditedProduct({ ...editedProduct, rate: parseFloat(e.target.value) })}
                                                className="w-full px-2 py-1 text-sm bg-farm-dark border rounded mt-0.5"
                                                disabled={saving}
                                              />
                                            </div>
                                            <div>
                                              <label className="text-xs text-farm-muted">Unit</label>
                                              <Select
                                                value={editedProduct.rate_unit || "lbs/acre"}
                                                onValueChange={(value) => setEditedProduct({ ...editedProduct, rate_unit: value })}
                                                disabled={saving}
                                              >
                                                <SelectTrigger className="w-full h-8 text-sm mt-0.5">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="lbs/acre">lbs/acre</SelectItem>
                                                  <SelectItem value="lbs N/acre">lbs N/acre</SelectItem>
                                                  <SelectItem value="tons/acre">tons/acre</SelectItem>
                                                  <SelectItem value="gal/acre">gal/acre</SelectItem>
                                                  <SelectItem value="qt/acre">qt/acre</SelectItem>
                                                  <SelectItem value="qts/acre">qts/acre</SelectItem>
                                                  <SelectItem value="pt/acre">pt/acre</SelectItem>
                                                  <SelectItem value="pts/acre">pts/acre</SelectItem>
                                                  <SelectItem value="fl oz/acre">fl oz/acre</SelectItem>
                                                  <SelectItem value="oz/acre">oz/acre (dry)</SelectItem>
                                                  <SelectItem value="seeds/acre">seeds/acre</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          {/* Quantity */}
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-xs text-farm-muted">Quantity</label>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={editedProduct.total_quantity || ""}
                                                onChange={(e) => setEditedProduct({ ...editedProduct, total_quantity: parseFloat(e.target.value) })}
                                                className="w-full px-2 py-1 text-sm bg-farm-dark border rounded mt-0.5"
                                                disabled={saving}
                                              />
                                            </div>
                                            <div>
                                              <label className="text-xs text-farm-muted">Unit</label>
                                              <Select
                                                value={editedProduct.quantity_unit || "tons"}
                                                onValueChange={(value) => setEditedProduct({ ...editedProduct, quantity_unit: value })}
                                                disabled={saving}
                                              >
                                                <SelectTrigger className="w-full h-8 text-sm mt-0.5">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="tons">tons</SelectItem>
                                                  <SelectItem value="lbs">lbs</SelectItem>
                                                  <SelectItem value="oz">oz</SelectItem>
                                                  <SelectItem value="gallons">gallons</SelectItem>
                                                  <SelectItem value="quarts">quarts</SelectItem>
                                                  <SelectItem value="pints">pints</SelectItem>
                                                  <SelectItem value="bags">bags</SelectItem>
                                                  <SelectItem value="units">units</SelectItem>
                                                  <SelectItem value="80K units">80K units</SelectItem>
                                                  <SelectItem value="140K units">140K units</SelectItem>
                                                  <SelectItem value="50K units">50K units</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          {/* Action Buttons */}
                                          <div className="flex items-center gap-2 pt-1">
                                            <button
                                              onClick={() => handleSaveProduct(pass.id, product.id!)}
                                              disabled={saving}
                                              className="flex-1 px-3 py-1.5 text-xs bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold rounded disabled:opacity-50"
                                            >
                                              {saving ? "Saving..." : "Save"}
                                            </button>
                                            <button
                                              onClick={handleCancelProductEdit}
                                              disabled={saving}
                                              className="flex-1 px-3 py-1.5 text-xs border border-farm-accent/30 rounded hover:bg-farm-accent/10 disabled:opacity-50"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        /* View Mode */
                                        <>
                                          <div className="flex items-center justify-between">
                                            <h5 className="font-medium text-sm flex-1">{product.product_name}</h5>
                                            <div className="flex items-center gap-2">
                                              {product.total_cost && (
                                                <span className="text-xs font-semibold text-farm-accent">
                                                  {formatCost(product.total_cost)}
                                                </span>
                                              )}
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <button className="p-1 hover:bg-muted rounded">
                                                    <MoreVertical className="h-4 w-4 text-farm-muted" />
                                                  </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={() => handleEditProduct(pass.id, product)}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Edit
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    onClick={() => setProductToDelete({ passId: pass.id, productId: product.id! })}
                                                    className="text-destructive focus:text-destructive"
                                                  >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                          
                                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-farm-muted">
                                            {product.product_brand && (
                                              <div><span className="font-medium">Brand:</span> {product.product_brand}</div>
                                            )}
                                            {product.active_ingredient && (
                                              <div><span className="font-medium">Active:</span> {product.active_ingredient}</div>
                                            )}
                                            {product.rate && (
                                              <div><span className="font-medium">Rate:</span> {Number(product.rate).toFixed(2)} {product.rate_unit}</div>
                                            )}
                                            {product.total_quantity && (
                                              <div><span className="font-medium">Quantity:</span> {Number(product.total_quantity).toFixed(1)} {product.quantity_unit}</div>
                                            )}
                                            {product.unit_cost && (
                                              <div><span className="font-medium">Unit Cost:</span> {formatCost(product.unit_cost)}</div>
                                            )}
                                          </div>

                                          {product.notes && (
                                            <p className="text-xs text-farm-muted italic">{product.notes}</p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-muted/30 rounded-lg p-3 text-center">
                                <p className="text-xs text-farm-muted mb-2">No products yet</p>
                                <button
                                  onClick={() => handleOpenAddProduct(pass.id)}
                                  className="text-xs text-farm-accent hover:underline flex items-center gap-1 mx-auto"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Product
                                </button>
                              </div>
                            )}

                            {/* Generate Rx Button (Only for planting passes with products) */}
                            {pass.pass_type === 'planting' && pass.products && pass.products.length > 0 && (
                              <Button 
                                size="sm"
                                onClick={() => handleGenerateRx(pass)}
                                className="w-full justify-start bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                              >
                                {pass.prescriptions_count && pass.prescriptions_count > 0 ? (
                                  <>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Regenerate
                                  </>
                                ) : (
                                  <>
                                    <Sprout className="h-4 w-4 mr-2" />
                                    Generate Prescription
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Latest Prescription Card */}
                            {passPrescriptions[pass.id] && (
                              <div className="bg-green-900/20 dark:bg-green-950/40 border border-green-700/30 dark:border-green-800/50 rounded-lg p-3 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sprout className="h-4 w-4 text-green-500 flex-shrink-0" />
                                      <span className="text-sm font-semibold text-farm-text">Latest Prescription</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        passPrescriptions[pass.id].status === 'generated' 
                                          ? 'bg-green-600 text-white'
                                          : 'bg-gray-600 text-white'
                                      }`}>
                                        {passPrescriptions[pass.id].status}
                                      </span>
                                    </div>
                                    <div className="text-xs text-farm-text/80 font-medium">
                                      {passPrescriptions[pass.id].product_name} • {
                                        new Date(passPrescriptions[pass.id].created_at).toLocaleDateString()
                                      }
                                    </div>
                                  </div>
                                </div>

                                {/* Preview Image */}
                                {passPrescriptions[pass.id].preview_url && (
                                  <div className="rounded-lg border overflow-hidden bg-white">
                                    <img 
                                      src={passPrescriptions[pass.id].preview_url} 
                                      alt="Prescription Preview"
                                      className="w-full h-auto"
                                    />
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                  {passPrescriptions[pass.id].file_url && (
                                    <a
                                      href={passPrescriptions[pass.id].file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                                    >
                                      <Download className="h-3 w-3" />
                                      Download
                                    </a>
                                  )}
                                  <button
                                    onClick={() => setPrescriptionToDelete({ passId: pass.id, prescriptionId: passPrescriptions[pass.id].id })}
                                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Pass Notes */}
                            {pass.notes && (
                              <div className="bg-muted/30 rounded-lg p-2">
                                <div className="text-xs text-farm-muted uppercase mb-0.5">Notes</div>
                                <p className="text-xs text-farm-text">{pass.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Previous Season Summary (from JD Ops) */}
        {plan && plan.field_id && (
          <>
          <div className="mt-6 border-t border-dashed border-farm-accent/30" />
          
          <div className="mt-6 bg-farm-card border border-farm-accent/20 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowActivityPasses(!showActivityPasses)}
              className="w-full flex items-center justify-between p-4 hover:bg-farm-accent/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-farm-accent" />
                <h2 className="text-lg font-semibold text-farm-text">
                  {activityPasses?.has_jd_data 
                    ? `Previous Season Summary (${activityPasses.year})`
                    : 'Previous Season Summary'
                  }
                </h2>
                {activityPasses?.has_jd_data && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    JD Ops
                  </span>
                )}
              </div>
              {showActivityPasses ? (
                <ChevronUp className="h-5 w-5 text-farm-muted" />
              ) : (
                <ChevronDown className="h-5 w-5 text-farm-muted" />
              )}
            </button>
            
            {showActivityPasses && (
              <div className="px-4 pb-4">
                {loadingActivityPasses ? (
                  <div className="py-6 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-farm-accent mx-auto"></div>
                    <p className="text-sm text-farm-muted mt-2">Loading summary...</p>
                  </div>
                ) : activityPasses?.has_jd_data && activityPasses.summary_text ? (
                  <div className="space-y-4">
                    {/* Season Timeline - same format as JD Ops Reports */}
                    <div>
                      <h4 className="text-sm font-semibold text-farm-accent mb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Season Timeline
                      </h4>
                      <div className="space-y-1.5">
                        {parseJDOpsToTimeline(activityPasses.summary_text).map((event, i) => {
                          const colorClass = getCategoryColor(event.category);
                          
                          return (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Tractor className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorClass}`} />
                              {event.date && (
                                <span className="text-farm-muted font-medium min-w-[60px]">
                                  {event.date}
                                </span>
                              )}
                              <span className="text-muted-foreground">{event.description}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* View Full Report - Collapsible */}
                    <details className="mt-3">
                      <summary className="text-xs text-farm-muted cursor-pointer hover:text-farm-accent">
                        View Full Report Details
                      </summary>
                      <div className="mt-3 pt-3 border-t border-farm-accent/10 space-y-3">
                        {activityPasses.passes.map((pass, idx) => (
                          <div 
                            key={idx}
                            className="bg-farm-dark/50 rounded-lg p-3 border border-farm-accent/10"
                          >
                            <div className="flex items-start gap-3">
                              {getActivityPassIcon(pass.pass_type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h3 className="font-semibold text-sm text-farm-text">{pass.title}</h3>
                                  {pass.dates.length > 0 && (
                                    <span className="text-xs text-farm-muted">
                                      {pass.dates.length === 1 
                                        ? pass.dates[0] 
                                        : `${pass.dates[0]} - ${pass.dates[pass.dates.length - 1]}`
                                      }
                                    </span>
                                  )}
                                </div>
                                {pass.details.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {pass.details.map((detail, dIdx) => (
                                      <li key={dIdx} className="text-xs text-farm-muted flex items-start gap-1.5">
                                        <span className="text-farm-accent mt-0.5">•</span>
                                        <span>{detail}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                    
                    {/* View Full Report Link */}
                    <button
                      onClick={() => navigate(`/farm-reports?field=${plan.field_id}&year=${activityPasses?.year || plan.plan_year}`)}
                      className="w-full text-center text-sm text-farm-accent hover:underline py-2 flex items-center justify-center gap-1 border-t border-farm-accent/10 pt-3"
                    >
                      View Full JD Ops Report
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-3">
                    <p className="text-sm text-farm-muted">
                      No JD Ops data available for this field
                    </p>
                    <button
                      onClick={() => navigate(`/farm-reports?field=${plan.field_id}`)}
                      className="text-sm text-farm-accent hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      View JD Ops Reports
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}
      </main>

      {/* Delete Field Plan Confirmation Dialog */}
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
                <div className="mb-3">
                  Are you sure you want to delete the field plan for{" "}
                  <span className="font-semibold">"{plan.field_name}"</span>?
                </div>
                <div className="text-sm">
                  This will permanently delete:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>{plan.passes_count} pass{plan.passes_count !== 1 ? 'es' : ''}</li>
                    <li>All associated products and costs</li>
                    <li>Variable rate zones (if any)</li>
                  </ul>
                  <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Pass Dialog */}
      <Dialog open={editingPassId !== null} onOpenChange={(open) => !open && handleCancelPassEdit()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pass</DialogTitle>
            <DialogDescription>
              Update pass type, name, and order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_pass_type">Pass Type *</Label>
              <Select
                value={editedPass.pass_type}
                onValueChange={(value) => setEditedPass({ ...editedPass, pass_type: value })}
              >
                <SelectTrigger id="edit_pass_type">
                  <SelectValue placeholder="Select pass type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planting">Planting</SelectItem>
                  <SelectItem value="fertilizer">Fertilizer</SelectItem>
                  <SelectItem value="herbicide">Herbicide</SelectItem>
                  <SelectItem value="fungicide">Fungicide</SelectItem>
                  <SelectItem value="insecticide">Insecticide</SelectItem>
                  <SelectItem value="irrigation">Irrigation</SelectItem>
                  <SelectItem value="cultivation">Cultivation</SelectItem>
                  <SelectItem value="tillage">Tillage</SelectItem>
                  <SelectItem value="harvest">Harvest</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_pass_name">Pass Name *</Label>
              <Input
                id="edit_pass_name"
                value={editedPass.pass_name}
                onChange={(e) => setEditedPass({ ...editedPass, pass_name: e.target.value })}
                placeholder="e.g., Pre-emergent herbicide"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_pass_order">Pass Order</Label>
              <Input
                id="edit_pass_order"
                type="number"
                value={editedPass.pass_order || ''}
                onChange={(e) => setEditedPass({ ...editedPass, pass_order: parseFloat(e.target.value) })}
                placeholder="e.g., 1, 2, 3"
              />
              <p className="text-xs text-farm-muted">
                Change the sequence order of this pass (lower numbers appear first)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_pass_equipment">Equipment</Label>
              <Input
                id="edit_pass_equipment"
                value={editedPass.equipment || ''}
                onChange={(e) => setEditedPass({ ...editedPass, equipment: e.target.value })}
                placeholder="e.g., Planter, Sprayer, Combine"
              />
              <p className="text-xs text-farm-muted">
                Optional: Specify the equipment used for this pass
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPassEdit}>
              Cancel
            </Button>
            <Button onClick={() => editingPassId && handleSavePass(editingPassId)} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Pass Dialog */}
      <Dialog open={showAddPassDialog} onOpenChange={(open) => {
        setShowAddPassDialog(open);
        if (!open) {
          setNewPass({ pass_type: "", pass_name: "", pass_order: 1 });
          setNewPassProducts([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Pass</DialogTitle>
            <DialogDescription>
              Add a new pass to this field plan and optionally add products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pass_type">Pass Type *</Label>
              <Select
                value={newPass.pass_type}
                onValueChange={(value) => setNewPass({ ...newPass, pass_type: value })}
              >
                <SelectTrigger id="pass_type">
                  <SelectValue placeholder="Select pass type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planting">Planting</SelectItem>
                  <SelectItem value="fertilizer">Fertilizer</SelectItem>
                  <SelectItem value="herbicide">Herbicide</SelectItem>
                  <SelectItem value="fungicide">Fungicide</SelectItem>
                  <SelectItem value="insecticide">Insecticide</SelectItem>
                  <SelectItem value="irrigation">Irrigation</SelectItem>
                  <SelectItem value="cultivation">Cultivation</SelectItem>
                  <SelectItem value="tillage">Tillage</SelectItem>
                  <SelectItem value="harvest">Harvest</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass_name">Pass Name *</Label>
              <Input
                id="pass_name"
                value={newPass.pass_name}
                onChange={(e) => setNewPass({ ...newPass, pass_name: e.target.value })}
                placeholder="e.g., Pre-emergent herbicide"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pass_order">Pass Order *</Label>
              <Input
                id="pass_order"
                type="number"
                min="1"
                value={newPass.pass_order}
                onChange={(e) => setNewPass({ ...newPass, pass_order: parseInt(e.target.value) || 1 })}
                placeholder="Enter pass order"
              />
              <p className="text-xs text-farm-muted">
                Existing passes will be automatically reordered to make room
              </p>
            </div>

            {/* Products Section */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Products (Optional)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setNewPassProducts([...newPassProducts, { product_name: "", rate: "", rate_unit: "lbs/acre" }])}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Product
                </Button>
              </div>
              
              {newPassProducts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No products added yet. You can add them now or later.</p>
              ) : (
                <div className="space-y-3">
                  {newPassProducts.map((product, index) => (
                    <div key={index} className="bg-muted/50 border rounded-lg p-3 space-y-3">
                      <div className="flex items-start justify-between">
                        <Label className="text-sm font-medium">Product {index + 1}</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setNewPassProducts(newPassProducts.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`product_name_${index}`} className="text-xs">Product Name *</Label>
                        <Input
                          id={`product_name_${index}`}
                          value={product.product_name}
                          onChange={(e) => {
                            const updated = [...newPassProducts];
                            updated[index].product_name = e.target.value;
                            setNewPassProducts(updated);
                          }}
                          placeholder="e.g., MAP, Roundup"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor={`rate_${index}`} className="text-xs">Rate</Label>
                          <Input
                            id={`rate_${index}`}
                            type="number"
                            step="0.01"
                            value={product.rate}
                            onChange={(e) => {
                              const updated = [...newPassProducts];
                              updated[index].rate = e.target.value;
                              setNewPassProducts(updated);
                            }}
                            placeholder="100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`rate_unit_${index}`} className="text-xs">Unit</Label>
                          <Select
                            value={product.rate_unit}
                            onValueChange={(value) => {
                              const updated = [...newPassProducts];
                              updated[index].rate_unit = value;
                              setNewPassProducts(updated);
                            }}
                          >
                            <SelectTrigger id={`rate_unit_${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lbs/acre">lbs/acre</SelectItem>
                              <SelectItem value="lbs N/acre">lbs N/acre</SelectItem>
                              <SelectItem value="tons/acre">tons/acre</SelectItem>
                              <SelectItem value="gal/acre">gal/acre</SelectItem>
                              <SelectItem value="qt/acre">qt/acre</SelectItem>
                              <SelectItem value="qts/acre">qts/acre</SelectItem>
                              <SelectItem value="pt/acre">pt/acre</SelectItem>
                              <SelectItem value="pts/acre">pts/acre</SelectItem>
                              <SelectItem value="fl oz/acre">fl oz/acre</SelectItem>
                              <SelectItem value="oz/acre">oz/acre (dry)</SelectItem>
                              <SelectItem value="seeds/acre">seeds/acre</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddPassDialog(false);
                setNewPassProducts([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddPass} disabled={saving} className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold">
              {saving ? "Adding..." : `Add Pass${newPassProducts.length > 0 ? ` with ${newPassProducts.length} Product(s)` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={showAddProductDialog} onOpenChange={setShowAddProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Add a new product to this pass
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={newProduct.product_name}
                onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                placeholder="e.g., Roundup PowerMax"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Rate</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={newProduct.rate}
                  onChange={(e) => setNewProduct({ ...newProduct, rate: e.target.value })}
                  placeholder="e.g., 32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate_unit">Unit</Label>
                <Select
                  value={newProduct.rate_unit || "lbs/acre"}
                  onValueChange={(value) => setNewProduct({ ...newProduct, rate_unit: value })}
                >
                  <SelectTrigger id="rate_unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs/acre">lbs/acre</SelectItem>
                    <SelectItem value="lbs N/acre">lbs N/acre</SelectItem>
                    <SelectItem value="tons/acre">tons/acre</SelectItem>
                    <SelectItem value="gal/acre">gal/acre</SelectItem>
                    <SelectItem value="qt/acre">qt/acre</SelectItem>
                    <SelectItem value="qts/acre">qts/acre</SelectItem>
                    <SelectItem value="pt/acre">pt/acre</SelectItem>
                    <SelectItem value="pts/acre">pts/acre</SelectItem>
                    <SelectItem value="fl oz/acre">fl oz/acre</SelectItem>
                    <SelectItem value="oz/acre">oz/acre (dry)</SelectItem>
                    <SelectItem value="seeds/acre">seeds/acre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProductDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProduct} disabled={saving} className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold">
              {saving ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pass Confirmation Dialog */}
      <AlertDialog open={passToDelete !== null} onOpenChange={(open) => !open && setPassToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pass?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pass and all its associated products? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => passToDelete && handleDeletePass(passToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Product Confirmation Dialog */}
      <AlertDialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Prescription Confirmation */}
      <AlertDialog open={!!prescriptionToDelete} onOpenChange={(open) => !open && setPrescriptionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prescription?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the prescription file and preview image from storage. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePrescription}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Prescription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FieldPlanDetail;

