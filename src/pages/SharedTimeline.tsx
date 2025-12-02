import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { publicAPI, TimelinePublicView } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Calendar, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SharedTimelinePage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [timeline, setTimeline] = useState<TimelinePublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTimeline = async () => {
      if (!shareToken) {
        setError("Invalid timeline link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await publicAPI.getTimelineSummary(shareToken);
        setTimeline(data);
      } catch (err: any) {
        setError(err?.message || "Timeline not found or link has expired");
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [shareToken]);

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

  if (error || !timeline) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <Clock className="h-16 w-16 text-blue-500 mx-auto" />
          <h1 className="text-lg font-semibold">Timeline Not Found</h1>
          <p className="text-farm-muted">{error}</p>
        </div>
      </div>
    );
  }

  const formattedDate = timeline.shared_at
    ? new Date(timeline.shared_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const getTimePeriodLabel = (period: string | null) => {
    if (!period) return 'All Time';
    const labels: Record<string, string> = {
      'ytd': 'Year to Date',
      'last_30_days': 'Last 30 Days',
      'last_90_days': 'Last 90 Days',
      'all_time': 'All Time',
    };
    return labels[period] || period;
  };

  const title = timeline.custom_title || 
    `${timeline.field_name || 'Field'} Timeline${timeline.year ? ` (${timeline.year})` : ''}`;

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

      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              <p className="text-xs text-farm-muted">
                Shared by {timeline.shared_by}
                {formattedDate && ` on ${formattedDate}`}
              </p>
            </div>
          </div>

          {/* Timeline Info */}
          <div className="flex flex-wrap gap-3 text-xs">
            {timeline.field_name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-farm-muted" />
                <span>
                  {timeline.field_name}
                  {timeline.farm_name && ` (${timeline.farm_name})`}
                </span>
              </div>
            )}
            {timeline.year && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-farm-muted" />
                <span>{timeline.year}</span>
              </div>
            )}
            {timeline.time_period && (
              <Badge variant="outline">{getTimePeriodLabel(timeline.time_period)}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Document Stats */}
        {timeline.total_documents > 0 && (
          <Card className="bg-farm-card border-farm-accent/20">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 bg-farm-accent/10 rounded-lg">
                <FileText className="h-5 w-5 text-farm-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-farm-text">{timeline.total_documents}</p>
                <p className="text-sm text-farm-muted">Documents Analyzed</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Summary */}
        {timeline.summary_text && (
          <Card className="bg-farm-card border-farm-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-farm-accent">
                <FileText className="h-4 w-4" />
                Complete Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-farm-text leading-relaxed">{timeline.summary_text}</p>
            </CardContent>
          </Card>
        )}

        {/* Key Observations */}
        {timeline.key_observations && timeline.key_observations.length > 0 && (
          <Card className="bg-farm-card border-farm-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-farm-accent">Key Observations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {timeline.key_observations.map((obs, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-farm-accent mt-1">•</span>
                    <span className="text-farm-text leading-relaxed">{obs}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Trends */}
        {timeline.trends && timeline.trends.length > 0 && (
          <Card className="bg-farm-card border-farm-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-farm-accent">Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {timeline.trends.map((trend, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-farm-accent mt-1">•</span>
                    <span className="text-farm-text leading-relaxed">{trend}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {timeline.recommendations && timeline.recommendations.length > 0 && (
          <Card className="bg-farm-card border-farm-accent/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-farm-accent">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {timeline.recommendations.map((rec, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-farm-accent mt-1">•</span>
                    <span className="text-farm-text leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
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
      </div>
    </div>
  );
};

export default SharedTimelinePage;

