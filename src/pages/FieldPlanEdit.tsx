import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fieldPlansAPI, fieldsAPI } from "@/lib/api";

interface Field {
  field_id: string;
  name: string;
  acreage?: number;
  farm_name?: string;
  crop_name?: string;
}

const FieldPlanEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreateMode = !id || id === 'new';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);
  
  const [formData, setFormData] = useState({
    plan_name: "",
    field_id: "",
    plan_status: "draft",
    crop_type: "",
    plan_year: new Date().getFullYear(),
    notes: "",
  });
  const [isManualPlanName, setIsManualPlanName] = useState(false);

  useEffect(() => {
    if (isCreateMode) {
      loadFields();
    } else {
      loadPlanAndFields();
    }
  }, [id, isCreateMode]);

  // Auto-generate plan name when field, crop, or year changes (unless manually edited)
  useEffect(() => {
    if (!isManualPlanName && fields.length > 0 && formData.field_id) {
      const field = fields.find(f => f.field_id === formData.field_id);
      
      if (field) {
        const fieldName = field.name || `Field ${formData.field_id.substring(0, 8)}`;
        const cropType = formData.crop_type || "Unknown Crop";
        const year = formData.plan_year;
        
        const generatedName = `${fieldName} - ${cropType} ${year} Plan`;
        
        // Only update plan_name if it's different to avoid infinite loops
        setFormData(prev => {
          if (prev.plan_name !== generatedName) {
            return { ...prev, plan_name: generatedName };
          }
          return prev;
        });
      }
    }
  }, [formData.field_id, formData.crop_type, formData.plan_year, fields, isManualPlanName]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const fieldsResponse = await fieldsAPI.getFields();
      setFields(fieldsResponse.fields || []);
    } catch (error: any) {
      console.error("Error loading fields:", error);
      toast.error("Failed to load fields");
    } finally {
      setLoading(false);
    }
  };

  const loadPlanAndFields = async () => {
    try {
      setLoading(true);
      const [planResponse, fieldsResponse] = await Promise.all([
        fieldPlansAPI.getFieldPlan(id!),
        fieldsAPI.getFields(),
      ]);
      
      console.log("📊 Plan data:", planResponse);
      console.log("📊 Fields data:", fieldsResponse);
      
      setFormData({
        plan_name: planResponse.plan_name || "",
        field_id: planResponse.field_id || "",
        plan_status: planResponse.plan_status || "draft",
        crop_type: planResponse.crop_type || "",
        plan_year: planResponse.plan_year || new Date().getFullYear(),
        notes: planResponse.notes || "",
      });
      
      setFields(fieldsResponse.fields || []);
    } catch (error: any) {
      console.error("Error loading plan:", error);
      toast.error("Failed to load field plan");
      navigate("/field-plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.plan_name.trim()) {
      toast.error("Plan name is required");
      return;
    }

    if (!formData.field_id) {
      toast.error("Please select a field");
      return;
    }

    try {
      setSaving(true);
      
      const planData = {
        plan_name: formData.plan_name,
        field_id: formData.field_id,
        crop_type: formData.crop_type || null,
        plan_year: formData.plan_year,
        plan_status: formData.plan_status,
        notes: formData.notes || null,
      };
      
      if (isCreateMode) {
        // Create new plan
        const newPlan = await fieldPlansAPI.createFieldPlanManual(planData);
        toast.success("Field plan created successfully");
        navigate(`/field-plans/${newPlan.id}`);
      } else {
        // Update existing plan
        await fieldPlansAPI.updateFieldPlan(id!, planData);
        toast.success("Field plan updated");
        navigate('/field-plans');
      }
    } catch (error: any) {
      console.error(`❌ Error ${isCreateMode ? 'creating' : 'updating'} plan:`, error);
      toast.error(`Failed to ${isCreateMode ? 'create' : 'update'} field plan`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark overflow-y-auto scrollbar-hide">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/field-plans")}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">{isCreateMode ? 'Create' : 'Edit'} Field Plan</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isCreateMode ? "Creating..." : "Saving...") : (isCreateMode ? "Create Plan" : "Save")}
          </Button>
        </div>
      </header>

      {/* Form */}
      <main className="px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Plan Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Plan Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={formData.plan_name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, plan_name: e.target.value }));
                setIsManualPlanName(true); // Mark as manually edited
              }}
              className="w-full px-3 py-2 bg-farm-dark border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., 2025 Corn Plan"
              disabled={saving}
            />
            <p className="text-xs text-farm-muted mt-1">
              {isManualPlanName ? "Manually edited" : "Auto-generated from field, crop, and year"}
            </p>
          </div>

          {/* Field */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Field <span className="text-destructive">*</span>
            </label>
            <Select
              value={formData.field_id}
              onValueChange={(value) => {
                setFormData(prev => ({ ...prev, field_id: value }));
              }}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {fields.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No fields available
                  </SelectItem>
                ) : (
                  fields.map((field) => (
                    <SelectItem key={field.field_id} value={field.field_id}>
                      {field.name} ({field.farm_name || 'Unknown Farm'})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-farm-muted mt-1">
              {formData.field_id ? "Field can be changed if needed" : "Assign a field to this plan"}
            </p>
          </div>

          {/* Crop Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Crop Type
            </label>
            <input
              type="text"
              value={formData.crop_type}
              onChange={(e) => setFormData(prev => ({ ...prev, crop_type: e.target.value }))}
              className="w-full px-3 py-2 bg-farm-dark border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Corn, Soybeans"
              disabled={saving}
            />
          </div>

          {/* Plan Year */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Plan Year
            </label>
            <input
              type="number"
              value={formData.plan_year}
              onChange={(e) => setFormData(prev => ({ ...prev, plan_year: parseInt(e.target.value) || new Date().getFullYear() }))}
              className="w-full px-3 py-2 bg-farm-dark border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., 2025"
              disabled={saving}
              min="2020"
              max="2030"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Plan Status
            </label>
            <select
              value={formData.plan_status}
              onChange={(e) => setFormData(prev => ({ ...prev, plan_status: e.target.value }))}
              className="w-full px-3 py-2 bg-farm-dark border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 bg-farm-dark border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              placeholder="Add any additional notes about this plan..."
              disabled={saving}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/field-plans")}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FieldPlanEdit;

