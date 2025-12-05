import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, 
  MapPin,
  FileText,
  Mic,
  Image,
  ClipboardList,
  Tractor,
  Leaf,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fieldReportsAPI, FieldReportPublic, FieldReportTimelineEvent } from '@/lib/api';

export default function SharedFieldReport() {
  const { shareToken } = useParams<{ shareToken: string }>();
  
  const [report, setReport] = useState<FieldReportPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (shareToken) {
      loadReport();
    }
  }, [shareToken]);
  
  const loadReport = async () => {
    if (!shareToken) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await fieldReportsAPI.getPublicReport(shareToken);
      setReport(data);
    } catch (err: any) {
      console.error('Failed to load report:', err);
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-6">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  
  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <FileText className="h-16 w-16 text-blue-500 mx-auto" />
          <h1 className="text-lg font-semibold">Report Not Found</h1>
          <p className="text-farm-muted">{error || 'This report link may have expired or been removed.'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Top Navigation Bar */}
      <div className="bg-farm-dark border-b border-farm-accent/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-farm-accent hover:bg-farm-accent/10 mr-3"
            onClick={() => window.location.href = 'https://askmyfarm.us'}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <a 
            href="https://askmyfarm.us" 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">🌾</span>
            <span className="font-bold">
              <span className="text-primary">Ask</span>
              <span className="text-farm-gold">My</span>
              <span className="text-primary">Farm</span>
            </span>
          </a>
        </div>
      </div>
      
      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Title & Meta */}
        <div className="pb-3 border-b border-farm-accent/10">
          <h1 className="text-xl font-bold text-farm-text">
            {report.custom_title || `${report.field_name} - ${report.year} Season Report`}
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {report.field_name}
            </span>
            {report.farm_name && (
              <>
                <span>•</span>
                <span>{report.farm_name}</span>
              </>
            )}
            {report.acreage && (
              <>
                <span>•</span>
                <span>{report.acreage.toFixed(0)} acres</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Calendar className="w-3 h-3" />
            <span>{report.year} Season</span>
            <span>•</span>
            <span>Shared by {report.shared_by}</span>
          </div>
        </div>
        
        {/* Executive Summary */}
        {report.executive_summary && (
          <div>
            <h4 className="text-sm font-semibold text-farm-accent mb-1">Summary</h4>
            <p className="text-sm text-muted-foreground">{report.executive_summary}</p>
          </div>
        )}
        
        {/* Key Highlights */}
        {report.key_highlights && report.key_highlights.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-farm-accent mb-1">Key Highlights</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {report.key_highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-farm-accent">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Timeline Events */}
        {report.timeline_events && report.timeline_events.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-farm-accent mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Season Timeline
            </h4>
            <div className="space-y-1.5">
              {report.timeline_events.map((event: FieldReportTimelineEvent, i: number) => {
                // Determine icon based on source and event text
                let SourceIcon = Calendar;
                const isPhoto = event.event?.toLowerCase().startsWith('photo');
                
                if (event.source === 'jd_ops') {
                  SourceIcon = Tractor;
                } else if (event.source === 'recording') {
                  SourceIcon = Mic;
                } else if (event.source === 'document') {
                  // Use Image icon for photos, FileText for documents
                  SourceIcon = isPhoto ? Image : FileText;
                } else if (event.source === 'scouting') {
                  SourceIcon = Leaf;
                } else if (event.source === 'plan') {
                  SourceIcon = FileText;
                }
                
                // Strip prefixes - icons are self-explanatory
                let displayText = event.event || '';
                const prefixes = ['document:', 'photo:', 'recording:', 'uploaded '];
                for (const prefix of prefixes) {
                  if (displayText.toLowerCase().startsWith(prefix)) {
                    displayText = displayText.slice(prefix.length).trim();
                    break;
                  }
                }
                
                const categoryColor = {
                  'planting': 'text-green-500',
                  'application': 'text-blue-500',
                  'scouting': 'text-amber-500',
                  'harvest': 'text-orange-500',
                  'planning': 'text-purple-500',
                  'other': 'text-farm-muted',
                }[event.category] || 'text-farm-muted';
                
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <SourceIcon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${categoryColor}`} />
                    <span className="text-farm-muted font-medium min-w-[52px]">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-muted-foreground">{displayText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Issues Encountered */}
        {report.issues_encountered && report.issues_encountered.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-amber-500 mb-1">Issues Encountered</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {report.issues_encountered.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-500">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Recommendations */}
        {report.recommendations && report.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-1">Recommendations</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Data Sources */}
        <div className="pt-3 border-t border-farm-accent/10">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Data Sources</h4>
          <div className="flex flex-wrap gap-2">
            {report.source_counts.jd_ops_operations > 0 && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded flex items-center gap-1">
                <Tractor className="w-3 h-3" />
                {report.source_counts.jd_ops_operations} JD Ops
              </span>
            )}
            {report.source_counts.voice_notes > 0 && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded flex items-center gap-1">
                <Mic className="w-3 h-3" />
                {report.source_counts.voice_notes} Recordings
              </span>
            )}
            {report.source_counts.documents > 0 && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded flex items-center gap-1">
                <Image className="w-3 h-3" />
                {report.source_counts.documents} Docs
              </span>
            )}
            {report.source_counts.scouting_notes > 0 && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                {report.source_counts.scouting_notes} Scouting
              </span>
            )}
            {report.source_counts.field_plans > 0 && (
              <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {report.source_counts.field_plans} Plans
              </span>
            )}
          </div>
        </div>
        
        {/* Generated timestamp */}
        {report.generated_at && (
          <div className="text-xs text-muted-foreground pt-3 border-t border-farm-accent/10">
            Generated {new Date(report.generated_at).toLocaleString()}
          </div>
        )}
        
        {/* Footer - Branding */}
        <div className="text-center py-8 border-t mt-6">
          <a 
            href="https://askmyfarm.us" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex flex-col items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌾</span>
              <span className="text-lg font-bold">
                <span className="text-primary">Ask</span>
                <span className="text-farm-gold">My</span>
                <span className="text-primary">Farm</span>
              </span>
            </div>
            <span className="text-sm text-farm-muted">
              AI-powered farm management • askmyfarm.us
            </span>
          </a>
        </div>
      </main>
    </div>
  );
}

