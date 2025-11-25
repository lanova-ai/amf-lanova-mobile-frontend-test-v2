import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { shareScoutingSummariesAPI, ScoutingSummaryPublicView } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, MapPin, Calendar, AlertTriangle, CheckCircle2, Info } from "lucide-react";
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
          <h1 className="text-2xl font-bold">Scouting Summary Not Found</h1>
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
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Leaf className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Field Scouting Report</h1>
              <p className="text-sm text-farm-muted">
                Shared by {summary.shared_by}
              </p>
            </div>
          </div>

          {/* Field Info */}
          <div className="flex flex-wrap gap-4 text-sm">
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
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Summary */}
        {summary.ai_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
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
              <CardTitle className="text-lg">Issues Detected</CardTitle>
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
              <CardTitle className="text-lg">Recommendations</CardTitle>
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

        {/* Location Description */}
        {summary.location_description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location Details</CardTitle>
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
              <CardTitle className="text-lg">Overall Assessment</CardTitle>
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
              <CardTitle className="text-lg">Field Photos</CardTitle>
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
              <CardTitle className="text-lg">Voice Observations</CardTitle>
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

        {/* Footer */}
        <div className="text-center text-sm text-farm-muted pt-8 pb-4">
          <p>This report was generated using AskMyFarm AI</p>
          <p className="mt-2">
            <a
              href="https://www.askmyfarm.us"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-600 transition-colors"
            >
              Learn more about AskMyFarm
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScoutingSummaryPublicViewPage;

