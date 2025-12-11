import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { publicAPI, FieldPlanSummaryPublicView } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Sprout, MapPin, Calendar, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SharedFieldPlanSummaryPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [summary, setSummary] = useState<FieldPlanSummaryPublicView | null>(null);
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
        const data = await publicAPI.getFieldPlanSummary(shareToken);
        setSummary(data);
      } catch (err: any) {
        setError(err?.message || "Field plan summary not found or link has expired");
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
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

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <Sprout className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-lg font-semibold">Field Plan Summary Not Found</h1>
          <p className="text-farm-muted">{error}</p>
        </div>
      </div>
    );
  }

  const formattedDate = summary.shared_at
    ? new Date(summary.shared_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

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
              <Sprout className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{summary.summary_name}</h1>
              <p className="text-xs text-farm-muted">
                Shared by {summary.shared_by}
                {formattedDate && ` on ${formattedDate}`}
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-farm-muted" />
              <span>{summary.year} Season</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-farm-muted" />
              <span>{summary.total_plans} {summary.total_plans === 1 ? 'Plan' : 'Plans'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-farm-muted" />
              <span>{summary.total_fields} {summary.total_fields === 1 ? 'Field' : 'Fields'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Summary Text */}
        {summary.summary_text && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Summary</h3>
            <ul className="text-sm text-muted-foreground leading-relaxed space-y-1.5 list-none">
              {summary.summary_text.split(/[•\n]/).filter((line: string) => line.trim()).map((line: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span className="[&_strong]:text-green-500 [&_strong]:font-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      p: ({children}) => <>{children}</>
                    }}>
                      {line.trim()}
                    </ReactMarkdown>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Product Totals */}
        {summary.product_totals && summary.product_totals.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Products ({summary.product_totals.length})</h3>
            <div className="space-y-3">
              {summary.product_totals.map((product: any, index: number) => (
                <div
                  key={index}
                  className="border-l-4 border-green-500/30 pl-3 py-2"
                >
                  <div className="font-medium text-sm mb-1">
                    {product.product_name || product.name || 'Unknown Product'}
                  </div>
                  
                  <div className="text-sm space-y-2">
                    <div className="font-medium text-green-600">
                      {Number(product.total_quantity || product.quantity || 0).toFixed(1)} {product.quantity_unit || product.unit || 'units'}
                    </div>
                    
                    {product.used_in_fields && product.used_in_fields.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.used_in_fields.map((fieldName: string, fidx: number) => (
                          <span
                            key={fidx}
                            className="inline-block px-2 py-0.5 bg-green-500/10 text-xs rounded text-green-600"
                          >
                            {fieldName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fields & Plans */}
        {summary.plans && summary.plans.length > 0 && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Field Plans ({summary.plans.length})</h3>
            <div className="space-y-3">
              {summary.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border-l-4 border-blue-500/30 pl-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        {plan.field_name || 'Unknown Field'}
                      </div>
                        {plan.farm_name && (
                          <div className="text-xs text-farm-muted">{plan.farm_name}</div>
                        )}
                      </div>
                      {plan.crop && (
                        <Badge variant="secondary" className="text-xs">{plan.crop}</Badge>
                      )}
                    </div>
                    {plan.plan_name && (
                      <div className="text-xs text-muted-foreground mt-1">{plan.plan_name}</div>
                    )}
                  </div>
                ))}
              </div>
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
      </div>
    </div>
  );
};

export default SharedFieldPlanSummaryPage;

