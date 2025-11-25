import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Sprout, Ruler, MoreVertical, Eye, RefreshCw, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScoutingNote } from "@/lib/api";

interface ScoutingNoteCardProps {
  note: ScoutingNote;
  onClick: () => void;
  onReprocess?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

export function ScoutingNoteCard({ note, onClick, onReprocess, onDelete }: ScoutingNoteCardProps) {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Generate note title
  const getNoteTitle = () => {
    // If field name exists, use "Field Name - Date"
    if (note.field_name) {
      return `${note.field_name} - ${formatDate(note.scouting_date)}`;
    }
    
    // Fallback to location description or generic title
    return note.location_description || 'Scouting Location';
  };

  // Get sync status badge
  const getSyncBadge = () => {
    switch (note.sync_status) {
      case 'synced':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">Synced</Badge>;
      case 'syncing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">Syncing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">Pending</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Error</Badge>;
      default:
        return null;
    }
  };

  // Get AI status badge
  const getAIBadge = () => {
    switch (note.ai_status) {
      case 'completed':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">AI Analyzed</Badge>;
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing
          </Badge>
        );
      case 'pending':
        return <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted">Not Analyzed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">Analysis Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card
      className="p-4 hover:border-primary/50 transition-colors cursor-pointer relative"
      onClick={onClick}
    >
      {/* Three-dot menu - Top Right */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 hover:bg-accent/50 rounded transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {onReprocess && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReprocess(note.id); }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {note.ai_status === 'completed' ? 'Reprocess' : 'Process with AI'}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 pr-8">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate flex items-center gap-2">
            <MapPin className="w-4 h-4 flex-shrink-0 text-primary" />
            {getNoteTitle()}
          </h3>
          {note.farm_name && (
            <p className="text-sm text-muted-foreground mt-1">
              {note.farm_name}
            </p>
          )}
        </div>
      </div>

      {/* Metadata Row with Status */}
      <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          {formatDate(note.scouting_date)}
        </span>
        {getSyncBadge()}
        {getAIBadge()}
        {note.growth_stage && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Sprout className="w-4 h-4" />
            {note.growth_stage}
          </span>
        )}
        {note.plant_height_inches && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Ruler className="w-4 h-4" />
            {note.plant_height_inches}"
          </span>
        )}
      </div>

      {/* Media Indicators */}
      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        {note.voice_recordings && note.voice_recordings.length > 0 && (
          <span className="flex items-center gap-1">
            🎤 Voice
          </span>
        )}
        {note.photos && note.photos.length > 0 && (
          <span className="flex items-center gap-1">
            📷 {note.photos.length} {note.photos.length === 1 ? 'photo' : 'photos'}
          </span>
        )}
      </div>
    </Card>
  );
}

