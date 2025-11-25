import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { userAPI, UserProfile } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Page,
  PageHeader,
  PageContent,
  PageLoading,
  Section,
  FormField,
  SelectField,
  Button,
  LoadingButton
} from "@/components/ui";

const ACRES_RANGES = [
  { value: "0-50", label: "Less than 50 acres" },
  { value: "50-100", label: "50 - 100 acres" },
  { value: "100-500", label: "100 - 500 acres" },
  { value: "500-1000", label: "500 - 1,000 acres" },
  { value: "1000-5000", label: "1,000 - 5,000 acres" },
  { value: "5000+", label: "5,000+ acres" }
];

const CROPS = [
  "Corn",
  "Soybeans",
  "Wheat",
  "Cotton",
  "Rice",
  "Hay",
  "Alfalfa",
  "Sorghum",
  "Barley",
  "Oats",
  "Other"
];

const OPERATION_TYPES = [
  { value: "cash_crop", label: "Cash Crop" },
  { value: "livestock", label: "Livestock" },
  { value: "mixed", label: "Mixed Crop & Livestock" },
  { value: "dairy", label: "Dairy" },
  { value: "specialty", label: "Specialty Crops" },
  { value: "organic", label: "Organic" },
  { value: "other", label: "Other" }
];

const PLANNING_APPROACHES = [
  { value: "traditional", label: "Traditional" },
  { value: "precision", label: "Precision Agriculture" },
  { value: "organic", label: "Organic" },
  { value: "regenerative", label: "Regenerative" },
  { value: "conventional", label: "Conventional" },
  { value: "sustainable", label: "Sustainable" }
];

export default function FarmDetailsEdit() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    farm_name: "",
    total_acres_range: "",
    primary_crops: [] as string[],
    operation_type: "",
    planning_approach: ""
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await userAPI.getProfile();
      setProfile(data);
      setFormData({
        farm_name: data.farm_name || "",
        total_acres_range: data.total_acres_range || "",
        primary_crops: data.primary_crops || [],
        operation_type: data.operation_type || "",
        planning_approach: data.planning_approach || ""
      });
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load farm details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.farm_name.trim()) {
      toast.error("Farm name is required");
      return;
    }

    try {
      setSaving(true);
      await userAPI.updateFullProfile(formData);
      
      // Refresh user context
      await refreshUser();
      
      toast.success("Farm details updated successfully");
      navigate("/settings");
    } catch (error: any) {
      console.error("Failed to update farm details:", error);
      toast.error(error.message || "Failed to update farm details");
    } finally {
      setSaving(false);
    }
  };

  const toggleCrop = (crop: string) => {
    setFormData(prev => ({
      ...prev,
      primary_crops: prev.primary_crops.includes(crop)
        ? prev.primary_crops.filter(c => c !== crop)
        : [...prev.primary_crops, crop]
    }));
  };

  if (loading) return <PageLoading />;

  return (
    <Page>
      <PageHeader
        title="Farm Details"
        backTo="/settings"
        action={
          <Button onClick={handleSubmit} disabled={saving}>
            <LoadingButton loading={saving} loadingText="Saving...">
              Save
            </LoadingButton>
          </Button>
        }
      />

      <PageContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Farm Information */}
          <Section title="Farm Information">
            <FormField
              label="Farm Name"
              value={formData.farm_name}
              onChange={(value) => setFormData({ ...formData, farm_name: value })}
              placeholder="Green Valley Farm"
              required
            />

            <SelectField
              label="Total Acres"
              value={formData.total_acres_range}
              onChange={(value) => setFormData({ ...formData, total_acres_range: value })}
              options={ACRES_RANGES}
              placeholder="Select acreage range"
            />

            <SelectField
              label="Operation Type"
              value={formData.operation_type}
              onChange={(value) => setFormData({ ...formData, operation_type: value })}
              options={OPERATION_TYPES}
              placeholder="Select operation type"
            />

            <SelectField
              label="Planning Approach"
              value={formData.planning_approach}
              onChange={(value) => setFormData({ ...formData, planning_approach: value })}
              options={PLANNING_APPROACHES}
              placeholder="Select planning approach"
            />
          </Section>

          {/* Primary Crops */}
          <Section title="Primary Crops" description="Select all that apply">
            <div className="flex flex-wrap gap-2">
              {CROPS.map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => toggleCrop(crop)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${formData.primary_crops.includes(crop)
                      ? 'bg-farm-accent text-white border-farm-accent'
                      : 'bg-farm-dark border-farm-accent/20 hover:bg-farm-accent/10 text-farm-text'
                    }
                  `}
                >
                  {formData.primary_crops.includes(crop) && (
                    <X className="inline-block h-3 w-3 mr-1" />
                  )}
                  {crop}
                </button>
              ))}
            </div>

            {formData.primary_crops.length > 0 && (
              <div className="pt-2">
                <p className="text-sm text-farm-muted">
                  Selected: {formData.primary_crops.join(", ")}
                </p>
              </div>
            )}
          </Section>
        </form>
      </PageContent>
    </Page>
  );
}

