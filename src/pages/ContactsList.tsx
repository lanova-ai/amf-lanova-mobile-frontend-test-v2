import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Mail, Phone, User, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { contactsAPI, Contact } from "@/lib/api";
import {
  Page,
  PageHeader,
  PageContent,
  PageLoading,
  ListItem,
  ListContainer,
  EmptyState,
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";

// Flatten groups for easy lookup
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

// Flatten for filter dropdown
const ALL_ROLES = [
  { value: "all", label: "All Contacts" },
  ...CONTACT_ROLE_GROUPS.flatMap(group => group.options)
];

// Create lookup map for displaying labels
const ROLE_LABELS: Record<string, string> = {};
CONTACT_ROLE_GROUPS.forEach(group => {
  group.options.forEach(option => {
    ROLE_LABELS[option.value] = option.label;
  });
});

export default function ContactsList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchQuery, roleFilter]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await contactsAPI.listContacts({ status: 'active' });
      setContacts(data);
    } catch (error: any) {
      console.error("Failed to load contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(c => c.contact_type === roleFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query)
      );
    }

    setFilteredContacts(filtered);
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await contactsAPI.deleteContact(contactId);
      setContacts(prev => prev.filter(c => c.id !== contactId));
      toast.success("Contact deleted successfully");
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      toast.error(error.message || "Failed to delete contact");
    } finally {
      setDeleteContactId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLE_LABELS[role] || role;
  };

  if (loading) return <PageLoading />;

  return (
    <Page>
      <PageHeader
        title="My Contacts"
        backTo="/settings"
        action={
          <Button 
            onClick={() => navigate("/settings/contacts/new")}
            className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        }
      />

      <PageContent noPadding>
        {/* Filters */}
        <div className="sticky top-0 z-30 bg-farm-dark border-b border-farm-accent/20 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-farm-muted" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              {ALL_ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-sm text-farm-muted">
            {filteredContacts.length} {filteredContacts.length === 1 ? 'contact' : 'contacts'}
          </div>
        </div>

        {/* Contacts List */}
        <div className="p-4">
          {filteredContacts.length === 0 ? (
            <EmptyState
              icon={User}
              title={searchQuery || roleFilter !== "all" ? "No contacts found" : "No contacts yet"}
              description={searchQuery || roleFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Add your first contact to get started"}
              action={!searchQuery && roleFilter === "all" ? {
                label: "Add Contact",
                onClick: () => navigate("/settings/contacts/new"),
                icon: Plus
              } : undefined}
            />
          ) : (
            <ListContainer>
              {filteredContacts.map((contact) => (
                <ListItem key={contact.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-farm-text">{contact.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="accent">
                          {getRoleLabel(contact.contact_type)}
                        </Badge>
                        {contact.company && (
                          <span className="text-sm text-farm-muted">
                            • {contact.company}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/settings/contacts/${contact.id}/edit`)}
                      >
                        <Edit className="h-4 w-4 text-farm-accent" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteContactId(contact.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-3">
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-farm-muted" />
                        <a href={`tel:${contact.phone}`} className="text-farm-accent hover:underline">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-farm-muted" />
                        <a href={`mailto:${contact.email}`} className="text-farm-accent hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.notes && (
                      <p className="text-sm text-farm-muted pt-2 border-t border-farm-accent/10">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                </ListItem>
              ))}
            </ListContainer>
          )}
        </div>
      </PageContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this contact. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContactId && handleDeleteContact(deleteContactId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

