import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { contactsAPI, ContactCreate, ContactUpdate } from "@/lib/api";
import {
  Page,
  PageHeader,
  PageContent,
  PageLoading,
  Section,
  FormField,
  TextareaField,
  SelectField,
  Button,
  LoadingButton
} from "@/components/ui";

const CONTACT_ROLE_GROUPS = [
  {
    label: "Family & Personal",
    options: [
      { value: "spouse", label: "Spouse/Partner" },
      { value: "family_member", label: "Family Member" },
      { value: "business_partner", label: "Business Partner" },
    ]
  },
  {
    label: "Labor & Employees",
    options: [
      { value: "farm_manager", label: "Farm Manager" },
      { value: "employee", label: "Employee" },
      { value: "seasonal_worker", label: "Seasonal Worker" },
    ]
  },
  {
    label: "Crop Services",
    options: [
      { value: "agronomist", label: "Agronomist" },
      { value: "crop_consultant", label: "Crop Consultant" },
      { value: "custom_applicator", label: "Custom Applicator" },
      { value: "crop_scout", label: "Crop Scout" },
    ]
  },
  {
    label: "Input Suppliers",
    options: [
      { value: "seed_dealer", label: "Seed Dealer" },
      { value: "chemical_dealer", label: "Chemical Dealer" },
      { value: "fertilizer_dealer", label: "Fertilizer Dealer" },
    ]
  },
  {
    label: "Marketing & Sales",
    options: [
      { value: "grain_buyer", label: "Grain Buyer" },
      { value: "elevator_manager", label: "Elevator Manager" },
      { value: "coop_rep", label: "Co-op Representative" },
      { value: "marketing_advisor", label: "Marketing Advisor" },
    ]
  },
  {
    label: "Equipment",
    options: [
      { value: "equipment_dealer", label: "Equipment Dealer" },
      { value: "mechanic", label: "Mechanic" },
      { value: "precision_ag_specialist", label: "Precision Ag Specialist" },
    ]
  },
  {
    label: "Financial & Insurance",
    options: [
      { value: "crop_insurance_agent", label: "Crop Insurance Agent" },
      { value: "banker", label: "Farm Banker" },
      { value: "accountant", label: "Accountant/CPA" },
    ]
  },
  {
    label: "Land & Legal",
    options: [
      { value: "landowner", label: "Landowner" },
      { value: "attorney", label: "Attorney" },
      { value: "real_estate_agent", label: "Real Estate Agent" },
    ]
  },
  {
    label: "Government & Extension",
    options: [
      { value: "fsa_rep", label: "FSA Representative" },
      { value: "nrcs_specialist", label: "NRCS Specialist" },
      { value: "extension_agent", label: "County Extension Agent" },
    ]
  },
  {
    label: "Other",
    options: [
      { value: "veterinarian", label: "Veterinarian" },
      { value: "other", label: "Other" },
    ]
  }
];

export default function ContactForm() {
  const navigate = useNavigate();
  const { contactId } = useParams();
  const isEditMode = !!contactId;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact_type: "",
    phone: "",
    email: "",
    company: "",
    notes: ""
  });
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<string>("");

  useEffect(() => {
    if (isEditMode) {
      loadContact();
    }
  }, [contactId]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const contact = await contactsAPI.getContact(contactId!);
      setFormData({
        name: contact.name,
        contact_type: contact.contact_type,
        phone: contact.phone || "",
        email: contact.email || "",
        company: contact.company || "",
        notes: contact.notes || ""
      });
      
      // Auto-select the role group based on the contact_type
      const group = CONTACT_ROLE_GROUPS.find(g => 
        g.options.some(opt => opt.value === contact.contact_type)
      );
      if (group) {
        setSelectedRoleGroup(group.label);
      }
    } catch (error: any) {
      console.error("Failed to load contact:", error);
      toast.error("Failed to load contact");
      navigate("/settings/contacts");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.contact_type) {
      toast.error("Role is required");
      return;
    }

    try {
      setSaving(true);
      
      if (isEditMode) {
        await contactsAPI.updateContact(contactId!, formData);
        toast.success("Contact updated successfully");
      } else {
        await contactsAPI.createContact(formData as ContactCreate);
        toast.success("Contact added successfully");
      }
      
      // Go back to previous page (Home or Contacts list)
      // Fallback to contacts list if no history (e.g., direct URL visit)
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/settings/contacts");
      }
    } catch (error: any) {
      console.error("Failed to save contact:", error);
      toast.error(error.message || "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  const roleGroupOptions = CONTACT_ROLE_GROUPS.map(g => ({ value: g.label, label: g.label }));
  const specificRoleOptions = selectedRoleGroup
    ? CONTACT_ROLE_GROUPS.find(g => g.label === selectedRoleGroup)?.options || []
    : [];

  return (
    <Page>
      <PageHeader
        title={isEditMode ? "Edit Contact" : "Add Contact"}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate("/settings/contacts");
          }
        }}
        action={
          <Button 
            onClick={handleSubmit} 
            disabled={saving}
            className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
          >
            <LoadingButton loading={saving} loadingText="Saving...">
              Save
            </LoadingButton>
          </Button>
        }
      />

      <PageContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Section title="Basic Information">
            <FormField
              label="Name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="John Doe"
              required
            />

            <SelectField
              label="Role Type"
              value={selectedRoleGroup}
              onChange={(value) => {
                setSelectedRoleGroup(value);
                setFormData({ ...formData, contact_type: "" });
              }}
              options={roleGroupOptions}
              placeholder="Select role type"
              required
            />

            {selectedRoleGroup && (
              <SelectField
                label="Specific Role"
                value={formData.contact_type}
                onChange={(value) => setFormData({ ...formData, contact_type: value })}
                options={specificRoleOptions}
                placeholder="Select specific role"
                required
              />
            )}

            <FormField
              label="Company"
              value={formData.company}
              onChange={(value) => setFormData({ ...formData, company: value })}
              placeholder="Ag Consulting Group"
            />
          </Section>

          {/* Contact Information */}
          <Section title="Contact Information">
            <FormField
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              placeholder="+1 (555) 123-4567"
            />

            <FormField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(value) => setFormData({ ...formData, email: value })}
              placeholder="john.doe@example.com"
            />
          </Section>

          {/* Additional Notes */}
          <Section title="Notes">
            <TextareaField
              label="Additional Information"
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any relevant notes about this contact..."
              rows={4}
            />
          </Section>
        </form>
      </PageContent>
    </Page>
  );
}

