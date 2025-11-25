import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { observationsAPI, fieldsAPI } from "@/lib/api";
import { toast } from "sonner";
import { 
  Plus, 
  MapPin, 
  Calendar, 
  Mic, 
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Eye,
  Sprout,
  Wrench,
  MoreVertical,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface FieldNote {
  id: string;
  title: string;
  description?: string;
  type: string;
  text: string;
  score?: string;
  observed_at: string;
  created_at: string;
  field_name: string;
  has_voice: boolean;
  has_images: boolean;
  image_count: number;
  thumbnail_url?: string;
  status: string;
  location?: { lat: number; lng: number };
}

const FieldNotesList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState<FieldNote[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [allFields, setAllFields] = useState<any[]>([]); // Store all fields
  const [availableTypes, setAvailableTypes] = useState<string[]>([]); // Store available note types
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [total, setTotal] = useState(0);

  // Load all observations and fields on mount and when location changes
  useEffect(() => {
    loadInitialData();
  }, [location.key]); // Reload when navigating back to this page

  // Filter when selections change
  useEffect(() => {
    if (allFields.length > 0) {
      filterData();
    }
  }, [selectedField, selectedType]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Check if there's a field parameter in URL
      const fieldParam = searchParams.get('field');
      if (fieldParam && fieldParam !== 'all') {
        setSelectedField(fieldParam);
      }

      // Load all observations (no filters) - max limit is 100
      const response = await observationsAPI.getAllObservations({ limit: 100 });
      const allNotes = response.observations || [];
      setNotes(allNotes);
      setTotal(response.total || 0);
      
      // Extract unique types from observations
      const typesWithNotes = [...new Set(allNotes.map((note: any) => note.type).filter(Boolean))];
      setAvailableTypes(typesWithNotes);
      
      // Load all fields - show ALL fields in dropdown, not just ones with notes
      const fieldsResponse = await fieldsAPI.getFields();
      const loadedFields = fieldsResponse.fields || [];
      setAllFields(loadedFields);
      setFields(loadedFields); // Show all fields in dropdown

    } catch (err: any) {
      console.error("Failed to load field notes:", err);
      toast.error(err.message || "Failed to load field notes");
    } finally {
      setLoading(false);
    }
  };

  const filterData = async () => {
    try {
      // Load observations with filters - max limit is 100
      const params: any = { limit: 100 };
      if (selectedField !== "all") params.field_id = selectedField;
      if (selectedType !== "all") params.type = selectedType;

      const response = await observationsAPI.getAllObservations(params);
      setNotes(response.observations || []);
      setTotal(response.total || 0);
    } catch (err: any) {
      console.error("Failed to filter field notes:", err);
      toast.error(err.message || "Failed to filter field notes");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "inspection":
        return <Eye className="w-4 h-4" />;
      case "issue":
        return <AlertCircle className="w-4 h-4" />;
      case "crop_stage":
        return <Sprout className="w-4 h-4" />;
      case "maintenance":
        return <Wrench className="w-4 h-4" />;
      case "voice_note":
        return <Mic className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      inspection: "Inspection",
      issue: "Issue",
      crop_stage: "Crop Stage",
      maintenance: "Maintenance",
      voice_note: "Voice Note",
      other: "Other"
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      modified: "bg-blue-100 text-blue-800 border-blue-200"
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleDelete = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (!confirm("Are you sure you want to delete this field note?")) {
      return;
    }

    try {
      await observationsAPI.deleteObservation(noteId);
      toast.success("Field note deleted successfully");
      
      // Remove from list
      setNotes(prev => prev.filter(note => note.id !== noteId));
      setTotal(prev => prev - 1);
    } catch (err: any) {
      console.error("Failed to delete field note:", err);
      toast.error(err.message || "Failed to delete field note");
    }
  };

  const handleViewDetails = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    navigate(`/field-notes/${noteId}`);
  };

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="body-text">Loading field notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide page-background">
      <div className="min-h-full flex flex-col">
        {/* Filters */}
        <div className="px-4 py-4 border-b bg-farm-dark/95 backdrop-blur sticky top-0 z-10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Field Filter */}
            <Select value={selectedField} onValueChange={setSelectedField}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedField === "all" 
                    ? "All Fields" 
                    : fields.find(f => f.field_id === selectedField)?.name || "All Fields"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                {fields.map((field) => (
                  <SelectItem key={field.field_id} value={field.field_id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Note Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedType === "all" ? "All Types" : getTypeLabel(selectedType)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="label-text text-center">
            {total} {total === 1 ? 'note' : 'notes'} found
          </p>
        </div>

        {/* Notes List */}
        <main className="flex-1 px-4 py-4">
          {notes.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="icon-brand mx-auto">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="section-heading">No Field Notes</h3>
                <p className="body-text max-w-sm mx-auto">
                  Start documenting your field observations, crop conditions, and maintenance activities.
                </p>
              </div>
              <Button onClick={() => navigate("/field-notes/new")} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Field Note
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => navigate(`/field-notes/${note.id}`)}
                  className="card-interactive"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail or Type Icon */}
                    <div className="flex-shrink-0">
                      {note.thumbnail_url ? (
                        <img
                          src={note.thumbnail_url}
                          alt={note.title}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="icon-small bg-primary/5">
                          {getTypeIcon(note.type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="card-title truncate">
                          {note.title || "Untitled Observation"}
                        </h3>
                        
                        {/* Three-dot menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-1 hover:bg-muted rounded-lg transition-colors">
                              <MoreVertical className="w-4 h-4 text-farm-muted" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => handleViewDetails(note.id, e)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => handleDelete(note.id, e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Field Name, Type, Date, Voice & Images - All Same Line */}
                      <div className="flex items-center gap-2 flex-wrap text-xs text-farm-muted">
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          📍 {note.field_name}
                        </span>
                        <span>•</span>
                        <span>{getTypeLabel(note.type)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(note.observed_at)}
                        </span>
                        {note.has_voice && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary">
                              <Mic className="w-3 h-3" />
                              Voice
                            </span>
                          </>
                        )}
                        {note.has_images && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-primary">
                              <ImageIcon className="w-3 h-3" />
                              {note.image_count}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-20">
          <Button
            onClick={() => navigate("/field-notes/new")}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FieldNotesList;

