import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Button,
  LoadingButton
} from "@/components/ui";

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    mailing_address: {
      street: "",
      city: "",
      state: "",
      zip: "",
      country: "USA"
    }
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
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone_number: data.phone_number || "",
        mailing_address: {
          street: data.mailing_address?.street || "",
          city: data.mailing_address?.city || "",
          state: data.mailing_address?.state || "",
          zip: data.mailing_address?.zip || "",
          country: data.mailing_address?.country || "USA"
        }
      });
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    try {
      setSaving(true);
      await userAPI.updateFullProfile(formData);
      
      // Refresh user context
      await refreshUser();
      
      toast.success("Profile updated successfully");
      navigate("/settings");
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  return (
    <Page>
      <PageHeader
        title="Edit Profile"
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
          {/* Basic Information */}
          <Section title="Basic Information">
            <FormField
              label="First Name"
              value={formData.first_name}
              onChange={(value) => setFormData({ ...formData, first_name: value })}
              placeholder="John"
              required
            />

            <FormField
              label="Last Name"
              value={formData.last_name}
              onChange={(value) => setFormData({ ...formData, last_name: value })}
              placeholder="Doe"
              required
            />

            <FormField
              label="Email"
              type="email"
              value={profile?.email || ""}
              onChange={() => {}}
              disabled
              description="Email cannot be changed"
            />

            <FormField
              label="Phone Number"
              type="tel"
              value={formData.phone_number}
              onChange={(value) => setFormData({ ...formData, phone_number: value })}
              placeholder="+1 (555) 123-4567"
            />
          </Section>

          {/* Mailing Address */}
          <Section title="Mailing Address">
            <FormField
              label="Street Address"
              value={formData.mailing_address.street}
              onChange={(value) => setFormData({
                ...formData,
                mailing_address: { ...formData.mailing_address, street: value }
              })}
              placeholder="123 Farm Road"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="City"
                value={formData.mailing_address.city}
                onChange={(value) => setFormData({
                  ...formData,
                  mailing_address: { ...formData.mailing_address, city: value }
                })}
                placeholder="Springfield"
              />

              <FormField
                label="State"
                value={formData.mailing_address.state}
                onChange={(value) => setFormData({
                  ...formData,
                  mailing_address: { ...formData.mailing_address, state: value }
                })}
                placeholder="IL"
                maxLength={2}
              />
            </div>

            <FormField
              label="ZIP Code"
              value={formData.mailing_address.zip}
              onChange={(value) => setFormData({
                ...formData,
                mailing_address: { ...formData.mailing_address, zip: value }
              })}
              placeholder="62701"
              maxLength={10}
            />
          </Section>
        </form>
      </PageContent>
    </Page>
  );
}

