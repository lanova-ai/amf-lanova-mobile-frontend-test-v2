import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { publicAPI, DocumentPublicView } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, MapPin, Calendar, File, FileImage, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

const SharedDocumentPage = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [document, setDocument] = useState<DocumentPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      if (!shareToken) {
        setError("Invalid document link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await publicAPI.getDocumentSummary(shareToken);
        setDocument(data);
      } catch (err: any) {
        setError(err?.message || "Document not found or link has expired");
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [shareToken]);

  const getDocumentIcon = (type: string | null) => {
    switch (type?.toLowerCase()) {
      case 'photo':
      case 'image':
        return <FileImage className="h-6 w-6 text-green-500" />;
      case 'pdf':
        return <File className="h-6 w-6 text-red-500" />;
      default:
        return <FileText className="h-6 w-6 text-blue-500" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  if (error || !document) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <FileText className="h-16 w-16 text-blue-500 mx-auto" />
          <h1 className="text-lg font-semibold">Document Not Found</h1>
          <p className="text-farm-muted">{error}</p>
        </div>
      </div>
    );
  }

  const formattedDate = document.shared_at
    ? new Date(document.shared_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const documentDate = document.document_date
    ? new Date(document.document_date).toLocaleDateString('en-US', {
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
            <div className="p-2 bg-blue-500/10 rounded-lg">
              {getDocumentIcon(document.document_type)}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{document.document_name || 'Document'}</h1>
              <p className="text-xs text-farm-muted">
                Shared by {document.shared_by}
                {formattedDate && ` on ${formattedDate}`}
              </p>
            </div>
          </div>

          {/* Document Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {document.field_name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-farm-muted" />
                <span>
                  {document.field_name}
                  {document.farm_name && ` (${document.farm_name})`}
                </span>
              </div>
            )}
            {documentDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-farm-muted" />
                <span>{documentDate}</span>
              </div>
            )}
            {document.document_type && (
              <Badge variant="outline" className="capitalize">{document.document_type}</Badge>
            )}
            {document.file_size && (
              <Badge variant="secondary">{formatFileSize(document.file_size)}</Badge>
            )}
          </div>

          {/* Download Button */}
          {document.download_url && (
            <div className="mt-4">
              <Button
                asChild
                className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                <a 
                  href={document.download_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download={document.document_name || 'document'}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Document
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Preview Image */}
        {document.preview_url && (document.document_type === 'photo' || document.document_type === 'image') && (
          <Card className="bg-farm-card border-farm-accent/20 overflow-hidden">
            <CardContent className="p-0">
              <img
                src={document.preview_url}
                alt={document.document_name || 'Document preview'}
                className="w-full"
              />
            </CardContent>
          </Card>
        )}

        {/* AI Summary */}
        {document.ai_summary && (
          <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4">
            <h3 className="font-semibold mb-3">AI Summary</h3>
            <div className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:font-semibold prose-headings:text-farm-accent prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-sm prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2
              prose-strong:text-farm-accent prose-strong:font-semibold
              prose-ul:my-2 prose-ul:ml-5 prose-ul:list-disc
              prose-ol:my-2 prose-ol:ml-5 prose-ol:list-decimal
              prose-li:text-sm prose-li:text-muted-foreground prose-li:my-1 prose-li:leading-relaxed prose-li:marker:text-farm-accent
              [&_strong]:text-farm-accent [&_strong]:font-semibold
              [&_ul]:list-disc [&_ul]:ml-5
              [&_ol]:list-decimal [&_ol]:ml-5
              [&_ul+p]:mt-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
              >
                {document.ai_summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* No Summary */}
        {!document.ai_summary && !document.preview_url && (
          <div className="bg-farm-card border border-farm-accent/20 rounded-lg p-4 py-12 text-center">
            <FileText className="h-12 w-12 text-farm-muted mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">No summary available for this document.</p>
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

export default SharedDocumentPage;

