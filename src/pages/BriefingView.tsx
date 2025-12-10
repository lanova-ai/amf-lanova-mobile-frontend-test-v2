import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { briefingsAPI, BriefingPublicView } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

const BriefingView = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [briefing, setBriefing] = useState<BriefingPublicView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBriefing = async () => {
      if (!shareToken) {
        setError("Invalid briefing link");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await briefingsAPI.getPublicBriefing(shareToken);
        setBriefing(data);
      } catch (err: any) {
        console.error("Error loading briefing:", err);
        setError(err?.message || "Briefing not found or not yet ready");
      } finally {
        setLoading(false);
      }
    };

    loadBriefing();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-farm-muted">Loading briefing...</p>
        </div>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">📊</div>
          <h1 className="text-2xl font-bold">Briefing Not Found</h1>
          <p className="text-farm-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark">
      {/* Header */}
      <header className="border-b bg-farm-dark/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                <span className="text-primary">Ask</span>
                <span className="text-farm-gold">My</span>
                <span className="text-primary">Farm</span>
              </h1>
              <p className="text-sm text-farm-muted">Planning Briefing</p>
            </div>
            {briefing.generated_at && (
              <p className="text-sm text-farm-muted">
                {new Date(briefing.generated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card rounded-lg border p-4 md:p-8 shadow-sm">
          {briefing.title && (
            <h2 className="text-xl md:text-2xl font-bold mb-6 pb-3 border-b">{briefing.title}</h2>
          )}
          
          {/* Mobile-Optimized Markdown Styling */}
          <div className="
            prose prose-sm md:prose-base max-w-none
            prose-headings:font-semibold prose-headings:text-foreground prose-headings:leading-tight
            prose-h1:text-xl md:prose-h1:text-2xl prose-h1:mt-6 prose-h1:mb-4 prose-h1:font-bold
            prose-h2:text-lg md:prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-base md:prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:font-semibold
            prose-h4:text-sm md:prose-h4:text-base prose-h4:mt-4 prose-h4:mb-2 prose-h4:font-semibold
            prose-p:text-sm md:prose-p:text-base prose-p:leading-relaxed prose-p:mb-4 prose-p:text-foreground
            prose-ul:my-4 prose-ul:pl-6 prose-ul:space-y-2 prose-ul:list-disc
            prose-ol:my-4 prose-ol:pl-6 prose-ol:space-y-2 prose-ol:list-decimal
            prose-li:text-sm md:prose-li:text-base prose-li:leading-relaxed prose-li:text-foreground
            prose-li>ul:mt-2 prose-li>ol:mt-2
            prose-strong:font-semibold prose-strong:text-foreground
            prose-em:italic prose-em:text-foreground
            prose-a:text-primary prose-a:underline prose-a:decoration-primary/50 hover:prose-a:decoration-primary
            prose-code:text-xs md:prose-code:text-sm prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
            prose-pre>code:text-xs md:prose-pre>code:text-sm prose-pre>code:bg-transparent
            prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:italic prose-blockquote:text-farm-muted prose-blockquote:my-4
            prose-hr:border-border prose-hr:my-6
            prose-table:text-sm prose-table:w-full prose-table:border-collapse prose-table:my-4
            prose-thead:border-b prose-thead:border-border
            prose-th:text-left prose-th:font-semibold prose-th:p-3 prose-th:bg-muted/50 prose-th:border-r prose-th:border-border prose-th:last:border-r-0
            prose-td:p-3 prose-td:border-r prose-td:border-b prose-td:border-border prose-td:last:border-r-0
            prose-tbody>tr:last:td:border-b-0
            prose-img:rounded-lg prose-img:shadow-sm
            dark:prose-invert
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
            >
              {briefing.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-farm-muted">
          <p>Generated by AskMyFarm Planning Assistant</p>
          <p className="mt-2">
            <a 
              href="https://www.askmyfarm.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Learn more about AskMyFarm
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default BriefingView;

