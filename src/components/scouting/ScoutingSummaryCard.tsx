import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreVertical } from "lucide-react";
import { type ScoutingNote } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScoutingSummaryCardProps {
  note: ScoutingNote;
  onClick: () => void;
  onEdit?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
}

export function ScoutingSummaryCard({ note, onClick, onEdit, onDelete }: ScoutingSummaryCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Extract issue count and severity
  const issuesDetected = note.issues_detected || [];
  const criticalIssues = issuesDetected.filter((i: any) => i.severity === 'critical').length;
  const highIssues = issuesDetected.filter((i: any) => i.severity === 'high').length;

  // Truncate summary for preview
  const summaryPreview = note.ai_summary 
    ? note.ai_summary.substring(0, 150) + (note.ai_summary.length > 150 ? '...' : '')
    : 'No summary available';

  return (
    <Card 
      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer relative"
      onClick={onClick}
    >
      {/* Three-dot menu */}
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
              View Details
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(note.id); }}>
                Edit Summary
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Field and Farm Info */}
      <div className="mb-2 pr-8">
        <h3 className="font-semibold text-sm">
          {note.field_name || 'Unknown Field'}
          {note.farm_name && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              ({note.farm_name})
            </span>
          )}
        </h3>
        
        {/* Date and Basic Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-1">
          <span>{formatDate(note.scouting_date)}</span>
        </div>
        
        {/* Field Badge & Insights Count */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {/* Field Name Badge */}
          {note.field_name && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
              📍 {note.field_name}
            </span>
          )}
          
          {/* Issues Count */}
          {issuesDetected.length > 0 && (
            <>
              {criticalIssues > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-500/20">
                  🔴 {criticalIssues} critical issue{criticalIssues !== 1 ? 's' : ''}
                </span>
              ) : highIssues > 0 ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20">
                  ⚠️ {highIssues} high issue{highIssues !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {issuesDetected.length} issue{issuesDetected.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
          
          {/* Recommendations Count */}
          {note.recommendations && note.recommendations.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {note.recommendations.length} recommendation{note.recommendations.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

