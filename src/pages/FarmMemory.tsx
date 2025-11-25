import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Sparkles, Mic, FileText, ClipboardList, Tractor, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { farmMemoryAPI } from '../lib/api';

// Cache keys for localStorage
const CACHE_QUERY_KEY = 'farm_memory_query';
const CACHE_RESULTS_KEY = 'farm_memory_results';
const CACHE_AI_RANKING_KEY = 'farm_memory_ai_ranking';

// Relevance score thresholds (0.0 to 1.0)
// Note: Advanced Search only uses results ≥50% to prevent AI hallucination
const RELEVANCE_THRESHOLD_HIGH = 0.70;  // ≥70% = High confidence (green)
const RELEVANCE_THRESHOLD_MEDIUM = 0.50; // 50-69% = Medium confidence (amber)
const RELEVANCE_THRESHOLD_LOW = 0.50;    // <50% = Low confidence, show warning (red)

const FarmMemory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [useAiRanking, setUseAiRanking] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load cached search on mount
  useEffect(() => {
    try {
      const cachedQuery = localStorage.getItem(CACHE_QUERY_KEY);
      const cachedResults = localStorage.getItem(CACHE_RESULTS_KEY);
      const cachedAiRanking = localStorage.getItem(CACHE_AI_RANKING_KEY);
      
      if (cachedQuery) {
        setQuery(cachedQuery);
      }
      if (cachedResults) {
        setSearchResults(JSON.parse(cachedResults));
      }
      if (cachedAiRanking) {
        setUseAiRanking(cachedAiRanking === 'true');
      }
    } catch (err) {
      console.error('Failed to load cached search:', err);
    }
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const results = await farmMemoryAPI.search({
        query: searchQuery,
        limit: 10,
        use_ai_ranking: useAiRanking,
      });

      setSearchResults(results);
      
      // Cache the search query, results, and AI ranking setting
      localStorage.setItem(CACHE_QUERY_KEY, searchQuery);
      localStorage.setItem(CACHE_RESULTS_KEY, JSON.stringify(results));
      localStorage.setItem(CACHE_AI_RANKING_KEY, useAiRanking.toString());
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    // Clear state
    setQuery('');
    setSearchResults(null);
    setError(null);
    setUseAiRanking(false);
    
    // Clear cache
    localStorage.removeItem(CACHE_QUERY_KEY);
    localStorage.removeItem(CACHE_RESULTS_KEY);
    localStorage.removeItem(CACHE_AI_RANKING_KEY);
  };

  // Auto-trigger search if query is passed from Home page (only once on mount)
  useEffect(() => {
    const incomingQuery = (location.state as any)?.query;
    if (incomingQuery && incomingQuery.trim()) {
      setQuery(incomingQuery);
      handleSearch(incomingQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount, ignore handleSearch dependency

  const suggestedSearches = [
    { query: 'nitrogen applications', icon: '🚜' },
    { query: 'corn planting varieties', icon: '🌽' },
    { query: 'harvest operations', icon: '🌾' },
    { query: 'soil test results', icon: '🧪' },
  ];

  const handleSuggestedSearch = (suggestedQuery: string) => {
    setQuery(suggestedQuery);
    handleSearch(suggestedQuery);
  };

  const getSourceIcon = (sourceType: string, result?: any) => {
    // Priority Architecture: Show what's most actionable
    if (result?.field_plan_id) {
      return <ClipboardList className="h-4 w-4 text-green-600" />;  // 🏆 Priority 1
    }
    if (result?.scouting_note_id) {
      return <Mic className="h-4 w-4 text-blue-600" />;  // 📍 Priority 2
    }
    
    // Default icons by source type
    switch (sourceType) {
      case 'voice_note':
        return <Mic className="h-4 w-4 text-blue-500" />;
      case 'document':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'field_plan':
        return <ClipboardList className="h-4 w-4 text-purple-500" />;
      case 'field_operations_yearly':
      case 'field_operations_alltime':
        return <Tractor className="h-4 w-4 text-primary" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatSourceType = (sourceType: string, result?: any) => {
    // Priority Architecture: Show what's linked
    if (result?.field_plan_id) {
      return 'Field Plan Available';  // 🏆 Priority 1
    }
    if (result?.scouting_note_id) {
      return 'Scouting Note';  // 📍 Priority 2
    }
    
    // For field operations, show organization name instead of "Field Operations"
    if ((sourceType === 'field_operations_yearly' || sourceType === 'field_operations_alltime') && result) {
      return result.operation_name || result.farm_name || 'Field Operations';
    }
    
    switch (sourceType) {
      case 'voice_note':
        return 'Voice Note';
      case 'document':
        return 'Document';
      case 'field_plan':
        return 'Field Plan';
      case 'field_operations_yearly':
        return 'Field Operations';
      case 'field_operations_alltime':
        return 'Field History';
      default:
        return sourceType;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-farm-dark pb-20">
      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Search Bar - Enhanced Visibility */}
        <div className="space-y-3">
          <div className="relative bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-primary" />
            <Input
              type="text"
              placeholder="Search farm memory..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(query);
                }
              }}
              className="pl-12 h-14 text-base font-medium bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isSearching}
            />
          </div>

          {/* Advanced Search Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${useAiRanking ? 'text-green-600' : 'text-farm-muted'}`} />
              <Label htmlFor="ai-ranking" className="cursor-pointer">
                Advanced Search (AI-powered)
              </Label>
            </div>
            <Switch
              id="ai-ranking"
              checked={useAiRanking}
              onCheckedChange={setUseAiRanking}
              disabled={isSearching}
              className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-200 data-[state=unchecked]:border-red-300"
            />
          </div>

          {useAiRanking && (
            <p className="text-xs text-farm-muted text-center">
              AI will re-rank results and provide a synthesized answer
            </p>
          )}

          {/* Search Button */}
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => handleSearch(query)}
              disabled={!query.trim() || isSearching}
              className="h-12 px-12 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              {isSearching ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            
            {/* Clear/Refresh Button - only show when there are results */}
            {searchResults && (
              <Button
                onClick={handleClearSearch}
                disabled={isSearching}
                variant="outline"
                className="h-12 px-6 border-farm-accent/30 text-farm-accent hover:bg-farm-accent/10"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Suggested Searches */}
        {!searchResults && !error && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-farm-muted">
              💡 Suggested Searches:
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {suggestedSearches.map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  onClick={() => handleSuggestedSearch(suggestion.query)}
                  disabled={isSearching}
                  className="justify-start h-auto py-3"
                >
                  <span className="mr-2">{suggestion.icon}</span>
                  <span className="text-sm">{suggestion.query}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600">Search Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {searchResults && (
          <div className="space-y-4">
            {/* Answer Card (if Advanced Search) */}
            {searchResults.answer && (
              <Card className="border-green-600/30 bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm leading-relaxed">{searchResults.answer}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {searchResults.total_results} {searchResults.total_results === 1 ? 'result' : 'results'}
              </h3>
              {!useAiRanking && searchResults.search_time_ms && (
                <p className="text-xs text-farm-muted">
                  {Math.round(searchResults.search_time_ms)}ms
                </p>
              )}
            </div>

            {/* Low Relevance Warning */}
            {searchResults.results && 
             searchResults.results.length > 0 && 
             searchResults.results[0].similarity_score < RELEVANCE_THRESHOLD_LOW && (
              <Card className="border-amber-500/50 bg-card">
                <CardContent className="py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-500 text-lg">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Low confidence results
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        The top result has only {Math.round(searchResults.results[0].similarity_score * 100)}% relevance. 
                        These results may not be directly related to "{searchResults.query}". 
                        Try using different keywords or more specific field names.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Result Cards */}
            {searchResults.results && searchResults.results.length > 0 ? (
              <div className="space-y-3">
                {searchResults.results.map((result: any, idx: number) => (
                  <Card
                    key={result.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      // Priority Architecture: Navigate to most actionable resource
                      if (result.field_plan_id) {
                        // 🏆 Priority 1: Go to field plan
                        navigate(`/field-plans/${result.field_plan_id}`);
                      } else if (result.scouting_note_id) {
                        // 📍 Priority 2: Go to scouting note
                        navigate(`/scouting-notes/${result.scouting_note_id}`);
                      } else if (result.source_type === 'field_operations_yearly' || result.source_type === 'field_operations_alltime') {
                        // 🚜 Field Operations: Navigate to Farm Reports with field pre-selected
                        const fieldId = result.field_id || result.source_id;
                        const year = result.metadata?.year || result.year || new Date().getFullYear();
                        if (fieldId) {
                          navigate(`/farm-reports?field=${fieldId}&year=${year}`);
                        } else {
                          // Fallback: just go to farm reports page
                          navigate('/farm-reports');
                        }
                      } else if (result.url && result.url !== '#') {
                        // 📝 Go to original source (skip placeholder URLs like "#")
                        navigate(result.url);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2 flex-1">
                          {getSourceIcon(result.source_type, result)}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base line-clamp-2">
                              {result.title}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <span>{formatSourceType(result.source_type, result)}</span>
                              {result.field_name && (
                                <>
                                  <span>•</span>
                                  <span>{result.field_name}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{formatDate(result.date)}</span>
                            </CardDescription>
                          </div>
                        </div>
                        {result.gemini_rank && (
                          <Badge variant="secondary" className="ml-2">
                            #{result.gemini_rank}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-farm-muted line-clamp-3">
                        {result.excerpt}
                      </p>
                      {result.gemini_reason && (
                        <p className="text-xs text-blue-600 mt-2 italic">
                          💡 {result.gemini_reason}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        {/* Relevance Badge - Color coded by confidence level */}
                        {(() => {
                          const scorePercent = Math.round(result.similarity_score * 100);
                          let badgeClass = "text-xs";
                          let emoji = "";
                          
                          if (result.similarity_score >= RELEVANCE_THRESHOLD_HIGH) {
                            // High confidence: ≥70%
                            badgeClass += " bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200";
                            emoji = "✅ ";
                          } else if (result.similarity_score >= RELEVANCE_THRESHOLD_MEDIUM) {
                            // Medium confidence: 50-69%
                            badgeClass += " bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200";
                            emoji = "⚠️ ";
                          } else {
                            // Low confidence: <50%
                            badgeClass += " bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200";
                            emoji = "⚠️ ";
                          }
                          
                          return (
                            <Badge variant="outline" className={badgeClass}>
                              {emoji}{scorePercent}% match
                            </Badge>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-farm-muted">No results found</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmMemory;

