import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { shareScoutingSummariesAPI, ScoutingSummaryPublicView } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, MapPin, Calendar, AlertTriangle, CheckCircle2, Info, Navigation, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const ScoutingSummaryPublicViewPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [summary, setSummary] = useState<ScoutingSummaryPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      if (!shareToken) {
        setError("Invalid summary link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await shareScoutingSummariesAPI.getPublicSummary(shareToken);
        setSummary(data);
      } catch (err: any) {
        setError(err?.message || "Scouting summary not found or link has expired");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [shareToken]);

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'bg-red-500/10 text-red-500';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'low':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <Info className="h-4 w-4" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
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

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <Leaf className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-lg font-semibold">Scouting Summary Not Found</h1>
          <p className="text-farm-muted">{error}</p>
        </div>
      </div>
    );
  }

  const formattedDate = summary.scouting_date
    ? new Date(summary.scouting_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown Date';

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
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Leaf className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Field Scouting Report</h1>
              <p className="text-xs text-farm-muted">
                Shared by {summary.shared_by}
              </p>
            </div>
          </div>

          {/* Field Info */}
          <div className="flex flex-wrap gap-3 text-xs items-center">
            {summary.field_name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-farm-muted" />
                <span>
                  {summary.field_name}
                  {summary.farm_name && ` (${summary.farm_name})`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-farm-muted" />
              <span>{formattedDate}</span>
            </div>
            {summary.growth_stage && (
              <Badge variant="outline">{summary.growth_stage}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Location Map - First for visual context */}
        {summary.latitude && summary.longitude && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-4 w-4 text-green-500" />
                Scouting Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Embedded Hybrid Map */}
              <div className="rounded-lg overflow-hidden border aspect-video">
                <iframe
                  src={`https://maps.google.com/maps?q=${summary.latitude},${summary.longitude}&t=h&z=17&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Scouting Location Map"
                />
              </div>
              {summary.location_description && (
                <p className="text-sm text-farm-muted">
                  📍 {summary.location_description}
                </p>
              )}
              <p className="text-xs text-farm-muted">
                Coordinates: {summary.latitude?.toFixed(6)}, {summary.longitude?.toFixed(6)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {summary.ai_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-farm-muted leading-relaxed">
                {summary.ai_summary}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Issues Detected */}
        {summary.issues_detected && summary.issues_detected.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issues Detected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.issues_detected.map((issue, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-4 rounded-lg border bg-card"
                >
                  <div className="mt-1">
                    {getSeverityIcon(issue.severity)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getSeverityColor(issue.severity)}>
                        {issue.severity || 'Unknown'} Severity
                      </Badge>
                      {issue.type && (
                        <Badge variant="outline">{issue.type}</Badge>
                      )}
                    </div>
                    <p className="font-medium">{issue.description}</p>
                    {issue.location && (
                      <p className="text-sm text-farm-muted">
                        Location: {issue.location}
                      </p>
                    )}
                    {issue.evidence_source && (
                      <p className="text-xs text-farm-muted">
                        Source: {issue.evidence_source}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {summary.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-farm-muted">
                      {recommendation}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Location Description (only if no coordinates) */}
        {!summary.latitude && summary.location_description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location Details</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-farm-muted">
                {summary.location_description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Overall Assessment */}
        {summary.overall_assessment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overall Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-farm-muted">
                {summary.overall_assessment}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {summary.photos && summary.photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {summary.photos.map((photoUrl, index) => (
                  <div key={index} className="aspect-square rounded-lg overflow-hidden border">
                    <img
                      src={photoUrl}
                      alt={`Field photo ${index + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(photoUrl, '_blank')}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Voice Recordings */}
        {summary.voice_recordings && summary.voice_recordings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Observations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.voice_recordings.map((voiceUrl, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <span className="text-green-500 font-semibold">{index + 1}</span>
                    </div>
                  </div>
                  <audio controls className="flex-1">
                    <source src={voiceUrl} type="audio/webm" />
                    <source src={voiceUrl} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              ))}
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

export default ScoutingSummaryPublicViewPage;

