import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Mic, 
  Camera, 
  ClipboardList, 
  Tractor, 
  ChevronRight,
  RefreshCw,
  Share2,
  Loader2,
  Clock,
  MapPin,
  Eye,
  ArrowLeft,
  Calendar,
  Leaf,
  Pencil,
  Check,
  X,
  MoreVertical,
  Trash2,
  ExternalLink,
  FileBarChart2,
  BarChart3,
  FolderOpen
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { 
  fieldsAPI, 
  fieldReportsAPI, 
  Field, 
  FieldReportSummary,
  FieldReportGenerated,
  FieldReportListItem
} from '@/lib/api';

type ViewMode = 'reports' | 'summary' | 'shared';

export default function AMFReports() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Get initial values from URL params or navigation state
  const urlFieldId = searchParams.get('field');
  const urlYear = searchParams.get('year');
  const urlTab = searchParams.get('tab') as ViewMode | null;
  const urlReportView = searchParams.get('view'); // 'detail' to show detail view directly
  
  // View mode state - check for initial tab from URL params, navigation state, or default
  const initialTab = urlTab || (location.state as { activeTab?: ViewMode })?.activeTab || 'reports';
  const [viewMode, setViewMode] = useState<ViewMode>(initialTab);
  
  // State
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string>('');
  const [selectedFieldId, setSelectedFieldId] = useState<string>(urlFieldId || '');
  const [selectedYear, setSelectedYear] = useState<number>(urlYear ? parseInt(urlYear) : new Date().getFullYear());
  
  const [reportSummary, setReportSummary] = useState<FieldReportSummary | null>(null);
  const [generatedReport, setGeneratedReport] = useState<FieldReportGenerated | null>(null);
  
  // Summary tab state - list of all reports
  const [allReports, setAllReports] = useState<FieldReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<FieldReportGenerated | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  
  // Shared tab state
  interface ShareHistoryItem {
    id: string;
    field_id: string;
    field_name: string;
    farm_name?: string;
    year: number;
    recipient_names: string;
    communication_method: string;
    share_link: string;
    message_subject?: string;
    message_body?: string;
    view_count: number;
    last_viewed_at?: string;
    shared_at: string;
  }
  const [sharedReports, setSharedReports] = useState<ShareHistoryItem[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [selectedShare, setSelectedShare] = useState<ShareHistoryItem | null>(null);
  const [shareToDelete, setShareToDelete] = useState<ShareHistoryItem | null>(null);
  const [deletingShare, setDeletingShare] = useState(false);
  
  // Report delete state
  const [reportToDelete, setReportToDelete] = useState<FieldReportListItem | null>(null);
  const [deletingReport, setDeletingReport] = useState(false);
  
  // Summary tab filters (derived from list items)
  const [summaryFilterOrg, setSummaryFilterOrg] = useState<string>('all');
  const [summaryFilterField, setSummaryFilterField] = useState<string>('all');
  const [summaryFilterYear, setSummaryFilterYear] = useState<string>('current');
  
  // Shared tab filters (derived from list items)
  const [sharedFilterOrg, setSharedFilterOrg] = useState<string>('all');
  const [sharedFilterField, setSharedFilterField] = useState<string>('all');
  const [sharedFilterYear, setSharedFilterYear] = useState<string>('current');
  
  const [loadingFields, setLoadingFields] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [editedHighlights, setEditedHighlights] = useState<string[]>([]);
  const [editedIssues, setEditedIssues] = useState<string[]>([]);
  const [editedRecommendations, setEditedRecommendations] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Available years (current year and 2 previous)
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  
  // Clear navigation state after reading it (prevents stale tab on refresh)
  useEffect(() => {
    if (location.state?.activeTab) {
      window.history.replaceState({}, document.title);
    }
  }, []);
  
  // Load fields on mount
  useEffect(() => {
    loadFields();
  }, []);
  
  // Load report summary when field/year changes
  useEffect(() => {
    if (selectedFieldId) {
      loadReportSummary();
    }
  }, [selectedFieldId, selectedYear]);
  
  // Auto-load report detail when navigating from search with view=detail
  useEffect(() => {
    const loadReportDetail = async () => {
      if (urlReportView === 'detail' && urlFieldId && urlYear) {
        try {
          const report = await fieldReportsAPI.getReport(urlFieldId, parseInt(urlYear));
          if ('executive_summary' in report) {
            setSelectedReport(report as FieldReportGenerated);
            setViewMode('summary');
          }
        } catch (error) {
          console.error('Failed to load report detail from URL:', error);
          // Fall back to list view
          setViewMode('summary');
        }
      }
    };
    loadReportDetail();
  }, [urlReportView, urlFieldId, urlYear]);
  
  // Load all reports when switching to Summary tab
  useEffect(() => {
    if (viewMode === 'summary') {
      loadAllReports();
    }
  }, [viewMode]);
  
  // Load shared reports when switching to Shared tab
  useEffect(() => {
    if (viewMode === 'shared') {
      loadSharedReports();
    }
  }, [viewMode]);
  
  const loadFields = async () => {
    try {
      setLoadingFields(true);
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const sortedFields = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
      
      // If field ID provided via URL, auto-select its organization
      if (urlFieldId) {
        const selectedField = sortedFields.find((f: Field) => f.field_id === urlFieldId);
        if (selectedField) {
          setSelectedOperationId(selectedField.operation_id);
        }
      }
      // Don't auto-select otherwise - let user choose
    } catch (error) {
      console.error('Failed to load fields:', error);
      toast.error('Failed to load fields');
    } finally {
      setLoadingFields(false);
    }
  };
  
  // Get unique organizations
  const organizations = Array.from(
    new Map(fields.map(f => [f.operation_id, { id: f.operation_id || '', name: f.operation_name || 'Unknown' }])).values()
  ).filter(org => org.id).sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter fields by selected organization
  const fieldsInOrganization = selectedOperationId
    ? fields.filter(f => f.operation_id === selectedOperationId)
    : fields;

  // === Summary Tab Filter Options (derived from allReports) ===
  const summaryOrganizations = Array.from(
    new Map(allReports.map(r => [r.farm_name, { id: r.farm_name || 'unknown', name: r.farm_name || 'Unknown' }])).values()
  ).filter(org => org.id !== 'unknown').sort((a, b) => a.name.localeCompare(b.name));
  
  const summaryFields = summaryFilterOrg === 'all'
    ? Array.from(new Map(allReports.map(r => [r.field_id, { id: r.field_id, name: r.field_name }])).values())
    : Array.from(new Map(allReports.filter(r => r.farm_name === summaryFilterOrg).map(r => [r.field_id, { id: r.field_id, name: r.field_name }])).values());
  
  const summaryYears = Array.from(new Set(allReports.map(r => r.year))).sort((a, b) => b - a);
  
  // Filtered summary reports
  const filteredSummaryReports = allReports.filter(report => {
    if (summaryFilterOrg !== 'all' && report.farm_name !== summaryFilterOrg) return false;
    if (summaryFilterField !== 'all' && report.field_id !== summaryFilterField) return false;
    if (summaryFilterYear !== 'all') {
      const yearVal = summaryFilterYear === 'current' ? currentYear : parseInt(summaryFilterYear);
      if (report.year !== yearVal) return false;
    }
    return true;
  });

  // === Shared Tab Filter Options (derived from sharedReports) ===
  const sharedOrganizations = Array.from(
    new Map(sharedReports.map(s => [s.farm_name, { id: s.farm_name || 'unknown', name: s.farm_name || 'Unknown' }])).values()
  ).filter(org => org.id !== 'unknown').sort((a, b) => a.name.localeCompare(b.name));
  
  const sharedFields = sharedFilterOrg === 'all'
    ? Array.from(new Map(sharedReports.map(s => [s.field_id, { id: s.field_id, name: s.field_name }])).values())
    : Array.from(new Map(sharedReports.filter(s => s.farm_name === sharedFilterOrg).map(s => [s.field_id, { id: s.field_id, name: s.field_name }])).values());
  
  const sharedYears = Array.from(new Set(sharedReports.map(s => s.year))).sort((a, b) => b - a);
  
  // Filtered shared reports
  const filteredSharedReports = sharedReports.filter(share => {
    if (sharedFilterOrg !== 'all' && share.farm_name !== sharedFilterOrg) return false;
    if (sharedFilterField !== 'all' && share.field_id !== sharedFilterField) return false;
    if (sharedFilterYear !== 'all') {
      const yearVal = sharedFilterYear === 'current' ? currentYear : parseInt(sharedFilterYear);
      if (share.year !== yearVal) return false;
    }
    return true;
  });

  // Handle organization change
  const handleOrganizationChange = (operationId: string) => {
    setSelectedOperationId(operationId);
    // Auto-select first field in new organization
    const orgFields = fields.filter(f => f.operation_id === operationId);
    if (orgFields.length > 0) {
      setSelectedFieldId(orgFields[0].field_id);
    } else {
      setSelectedFieldId('');
    }
  };
  
  const loadReportSummary = async () => {
    if (!selectedFieldId) return;
    
    try {
      setLoadingSummary(true);
      setGeneratedReport(null);
      
      const summary = await fieldReportsAPI.getReportSummary(selectedFieldId, selectedYear);
      setReportSummary(summary);
      
      // If report already exists, load it
      if (summary.generated_report?.exists) {
        loadGeneratedReport();
      }
    } catch (error: any) {
      console.error('Failed to load report summary:', error);
      if (error.message?.includes('404')) {
        setReportSummary(null);
      } else {
        toast.error('Failed to load report summary');
      }
    } finally {
      setLoadingSummary(false);
    }
  };
  
  const loadAllReports = async () => {
    try {
      setLoadingReports(true);
      const response = await fieldReportsAPI.listReports();
      setAllReports(response.reports || []);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoadingReports(false);
    }
  };
  
  const loadSharedReports = async () => {
    try {
      setLoadingShared(true);
      const response = await fieldReportsAPI.getShareHistory();
      setSharedReports(response.shares || []);
    } catch (error) {
      console.error('Failed to load shared reports:', error);
      // Don't show error toast - it may just be empty
    } finally {
      setLoadingShared(false);
    }
  };
  
  const handleDeleteShare = async () => {
    if (!shareToDelete) return;
    
    try {
      setDeletingShare(true);
      await fieldReportsAPI.deleteShare(shareToDelete.id);
      toast.success('Share deleted successfully');
      setShareToDelete(null);
      // Refresh the list
      loadSharedReports();
    } catch (error) {
      console.error('Failed to delete share:', error);
      toast.error('Failed to delete share');
    } finally {
      setDeletingShare(false);
    }
  };
  
  const handleDeleteReport = async () => {
    if (!reportToDelete) return;
    
    try {
      setDeletingReport(true);
      await fieldReportsAPI.deleteReport(reportToDelete.id);
      toast.success('Report deleted successfully');
      setReportToDelete(null);
      // Refresh the list
      loadAllReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
    } finally {
      setDeletingReport(false);
    }
  };
  
  const loadReportDetail = async (fieldId: string, year: number) => {
    try {
      const report = await fieldReportsAPI.getReport(fieldId, year);
      if ('executive_summary' in report) {
        setSelectedReport(report as FieldReportGenerated);
      }
    } catch (error) {
      console.error('Failed to load report detail:', error);
      toast.error('Failed to load report');
    }
  };
  
  const loadGeneratedReport = async () => {
    if (!selectedFieldId) return;
    
    try {
      const report = await fieldReportsAPI.getReport(selectedFieldId, selectedYear);
      
      if ('executive_summary' in report) {
        setGeneratedReport(report as FieldReportGenerated);
      } else if ('status' in report && report.status === 'generating') {
        // Poll for completion
        setTimeout(loadGeneratedReport, 3000);
      }
    } catch (error: any) {
      if (!error.message?.includes('404')) {
        console.error('Failed to load generated report:', error);
      }
    }
  };
  
  const handleGenerateReport = async () => {
    if (!selectedFieldId) return;
    
    try {
      setGenerating(true);
      await fieldReportsAPI.generateReport(
        selectedFieldId, 
        selectedYear, 
        !!generatedReport // Regenerate if report exists
      );
      
      toast.success('Report generation started');
      
      // Start polling for completion
      pollReportStatus();
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
      setGenerating(false);
    }
  };
  
  const pollReportStatus = async (retryCount = 0) => {
    if (!selectedFieldId) return;
    
    try {
      const report = await fieldReportsAPI.getReport(selectedFieldId, selectedYear);
      
      if ('executive_summary' in report) {
        setGeneratedReport(report as FieldReportGenerated);
        setGenerating(false);
        toast.success('Report generated successfully');
        loadReportSummary(); // Refresh summary
      } else if ('status' in report) {
        if (report.status === 'generating') {
          setTimeout(() => pollReportStatus(0), 3000);
        } else if (report.status === 'failed') {
          setGenerating(false);
          toast.error('Report generation failed. Please try again.');
        }
      }
    } catch (error) {
      // Retry up to 3 times on network errors, then stop
      if (retryCount < 3) {
        setTimeout(() => pollReportStatus(retryCount + 1), 3000);
      } else {
        setGenerating(false);
        toast.error('Failed to check report status. Please refresh.');
      }
    }
  };
  
  // Simple data section card - shows top 3 items, click to navigate
  const DataSectionCard = ({ 
    icon: Icon, 
    title, 
    count, 
    items,
    summaryPreview,
    navigateTo
  }: { 
    icon: any; 
    title: string; 
    count: number; 
    items?: { id: string; title?: string; date?: string }[];
    summaryPreview?: string;
    navigateTo: string;
  }) => (
    <Card 
      className="bg-farm-card border-farm-accent/10 cursor-pointer hover:border-farm-accent/30 transition-colors"
      onClick={() => navigate(navigateTo)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-farm-accent/10">
              <Icon className="w-5 h-5 text-farm-accent" />
            </div>
            <div>
              <div className="font-medium text-farm-text">{title}</div>
              <div className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'item' : 'items'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
        
        {/* Summary preview for JD Ops */}
        {summaryPreview && (
          <div className="mt-3 pt-3 border-t border-farm-accent/10">
            <p className="text-xs text-muted-foreground line-clamp-2">{summaryPreview}</p>
          </div>
        )}
        
        {/* Top 3 items preview */}
        {items && items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-farm-accent/10 space-y-1">
            {items.slice(0, 3).map(item => (
              <div key={item.id} className="text-xs text-muted-foreground truncate">
                • {item.title || 'Untitled'}
              </div>
            ))}
            {items.length > 3 && (
              <div className="text-xs text-farm-accent">+{items.length - 3} more</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  return (
    <div className="absolute inset-0 flex flex-col page-background">
      {/* Fixed Header: Tabs */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-farm-accent/20 bg-farm-dark z-30">
        <div className="inline-flex items-center justify-center w-full bg-farm-card border border-farm-accent/20 p-1 rounded-full">
          <button
            onClick={() => setViewMode('reports')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
              viewMode === 'reports'
                ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                : 'text-farm-muted hover:text-farm-text'
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
              viewMode === 'summary'
                ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                : 'text-farm-muted hover:text-farm-text'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('shared')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-all ${
              viewMode === 'shared'
                ? 'bg-farm-accent/10 text-farm-accent shadow-sm'
                : 'text-farm-muted hover:text-farm-text'
            }`}
          >
            Shared
          </button>
        </div>
      </div>
      
      {/* Filters - Different filters for each tab */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-farm-accent/10">
        {viewMode === 'reports' ? (
          <>
            {/* Reports Tab Filters - Organization, Field, Year */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-farm-text">Organization</label>
              <Select 
                value={selectedOperationId} 
                onValueChange={handleOrganizationChange}
                disabled={loadingFields}
              >
                <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                  <SelectValue placeholder={loadingFields ? "Loading..." : "Select an organization"} />
                </SelectTrigger>
                <SelectContent className="bg-farm-card border-farm-accent/20">
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Field (Farm)</label>
                <Select 
                  value={selectedFieldId} 
                  onValueChange={setSelectedFieldId}
                  disabled={!selectedOperationId || loadingFields}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    {fieldsInOrganization
                      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                      .map(field => (
                        <SelectItem key={field.field_id} value={field.field_id}>
                          {field.name} ({field.farm_name || 'Unknown Farm'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-28 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Year</label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === currentYear && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : viewMode === 'summary' ? (
          <>
            {/* Summary Tab Filters - same layout as Reports */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-farm-text">Farm</label>
              <Select 
                value={summaryFilterOrg} 
                onValueChange={(v) => {
                  setSummaryFilterOrg(v);
                  setSummaryFilterField('all');
                }}
              >
                <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                  <SelectValue placeholder="All Farms" />
                </SelectTrigger>
                <SelectContent className="bg-farm-card border-farm-accent/20">
                  <SelectItem value="all">All Farms</SelectItem>
                  {summaryOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Field</label>
                <Select 
                  value={summaryFilterField} 
                  onValueChange={setSummaryFilterField}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue placeholder="All Fields" />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    <SelectItem value="all">All Fields</SelectItem>
                    {summaryFields.map(field => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-28 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Year</label>
                <Select 
                  value={summaryFilterYear} 
                  onValueChange={setSummaryFilterYear}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    <SelectItem value="current">{currentYear} (Current)</SelectItem>
                    <SelectItem value="all">All Years</SelectItem>
                    {summaryYears.filter(y => y !== currentYear).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Shared Tab Filters - same layout as Reports */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-farm-text">Farm</label>
              <Select 
                value={sharedFilterOrg} 
                onValueChange={(v) => {
                  setSharedFilterOrg(v);
                  setSharedFilterField('all');
                }}
              >
                <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                  <SelectValue placeholder="All Farms" />
                </SelectTrigger>
                <SelectContent className="bg-farm-card border-farm-accent/20">
                  <SelectItem value="all">All Farms</SelectItem>
                  {sharedOrganizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Field</label>
                <Select 
                  value={sharedFilterField} 
                  onValueChange={setSharedFilterField}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue placeholder="All Fields" />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    <SelectItem value="all">All Fields</SelectItem>
                    {sharedFields.map(field => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-28 space-y-1.5">
                <label className="text-sm font-medium text-farm-text">Year</label>
                <Select 
                  value={sharedFilterYear} 
                  onValueChange={setSharedFilterYear}
                >
                  <SelectTrigger className="bg-farm-card border-farm-accent/20 text-farm-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-farm-card border-farm-accent/20">
                    <SelectItem value="current">{currentYear} (Current)</SelectItem>
                    <SelectItem value="all">All Years</SelectItem>
                    {sharedYears.filter(y => y !== currentYear).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Reports Tab Content */}
    {viewMode === 'reports' && (
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {loadingSummary ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full bg-farm-card" />
                <Skeleton className="h-20 w-full bg-farm-card" />
                <Skeleton className="h-20 w-full bg-farm-card" />
                <Skeleton className="h-20 w-full bg-farm-card" />
                <Skeleton className="h-20 w-full bg-farm-card" />
              </div>
            ) : !selectedFieldId ? (
              <div className="text-center py-12 text-muted-foreground">
                Select a field to view the report
              </div>
            ) : reportSummary ? (
              <>
                {/* Field Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2">
                  <MapPin className="w-4 h-4" />
                  <span>{reportSummary.field_name}</span>
                  {reportSummary.farm_name && <span>• {reportSummary.farm_name}</span>}
                  {reportSummary.acreage && <span>• {reportSummary.acreage.toFixed(1)} ac</span>}
                </div>
                
                {/* Data Section Cards */}
                <DataSectionCard 
                  icon={Tractor}
                  title="JD Ops Reports"
                  count={reportSummary.jd_ops.count}
                  navigateTo={`/farm-reports?field=${selectedFieldId}&year=${selectedYear}`}
                />
                
                <DataSectionCard 
                  icon={Mic}
                  title="Recordings"
                  count={reportSummary.voice_notes.count}
                  items={reportSummary.voice_notes.items}
                  navigateTo={`/recordings?field=${selectedFieldId}&year=${selectedYear}`}
                />
                
                <DataSectionCard 
                  icon={Camera}
                  title="Docs & Photos"
                  count={reportSummary.documents.count}
                  items={reportSummary.documents.items}
                  navigateTo={`/documents?field=${selectedFieldId}&year=${selectedYear}`}
                />
                
                <DataSectionCard 
                  icon={ClipboardList}
                  title="Scouting Notes"
                  count={reportSummary.scouting_notes.count}
                  items={reportSummary.scouting_notes.items}
                  navigateTo={`/scouting-notes?field=${selectedFieldId}&year=${selectedYear}`}
                />
                
                <DataSectionCard 
                  icon={FileText}
                  title="Field Plans"
                  count={reportSummary.field_plans.count}
                  items={reportSummary.field_plans.items}
                  navigateTo={`/field-plans?field=${selectedFieldId}&year=${selectedYear}`}
                />
                
                {/* Generate Report Button - Inline */}
                <div className="pt-4 pb-8">
                  <Button 
                    variant="outline"
                    className="w-full border-farm-accent/30 text-farm-text hover:bg-farm-accent/10 py-6"
                    onClick={handleGenerateReport}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating Report...
                      </>
                    ) : generatedReport ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2" />
                        Regenerate Report
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                  
                  {generatedReport && (
                    <Button 
                      variant="outline"
                      className="w-full mt-2 border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
                      onClick={() => {
                        setSelectedReport(generatedReport);
                        setViewMode('summary');
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Report
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No data found for this field and year
              </div>
            )}
      </div>
    )}
      
    {/* Summary Tab Content */}
      {viewMode === 'summary' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Detail View - when a report is selected */}
          {selectedReport ? (
            <>
              {/* Header with Back Button, Edit, and Share */}
              <div className="flex items-center justify-between pb-3 border-b border-farm-accent/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedReport(null);
                    setIsEditing(false);
                  }}
                  className="flex items-center gap-2 text-farm-muted hover:text-farm-text"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
                      onClick={() => {
                        setIsEditing(true);
                        setEditedSummary(selectedReport.executive_summary || '');
                        setEditedHighlights([...(selectedReport.key_highlights || [])]);
                        setEditedIssues([...(selectedReport.issues_encountered || [])]);
                        setEditedRecommendations([...(selectedReport.recommendations || [])]);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedSummary('');
                          setEditedHighlights([]);
                          setEditedIssues([]);
                          setEditedRecommendations([]);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                        onClick={async () => {
                          if (!selectedReport) return;
                          setSavingEdit(true);
                          try {
                            // TODO: Add API endpoint to update report
                            // For now, just update locally
                            setSelectedReport({
                              ...selectedReport,
                              executive_summary: editedSummary,
                              key_highlights: editedHighlights.filter(h => h.trim()),
                              issues_encountered: editedIssues.filter(i => i.trim()),
                              recommendations: editedRecommendations.filter(r => r.trim())
                            });
                            setIsEditing(false);
                            toast.success('Report updated!');
                          } catch (error) {
                            toast.error('Failed to save changes');
                          } finally {
                            setSavingEdit(false);
                          }
                        }}
                        disabled={savingEdit}
                      >
                        {savingEdit ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
                    onClick={() => navigate(`/share-field-report?field_id=${selectedReport.field_id}&year=${selectedReport.year}`)}
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
              
              {/* Report Title */}
              <div className="pt-2 pb-3 border-b border-farm-accent/10">
                <h2 className="text-lg font-semibold text-farm-text">
                  {selectedReport.field_name} - {selectedReport.year}
                </h2>
                {selectedReport.farm_name && (
                  <p className="text-sm text-muted-foreground">{selectedReport.farm_name}</p>
                )}
              </div>
              
              {/* Inline Report Content */}
              <div className="space-y-4 pt-2">
                {/* Executive Summary */}
                <div>
                  <h4 className="text-sm font-semibold text-farm-accent mb-1">Summary</h4>
                  {isEditing ? (
                    <Textarea
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      className="bg-farm-card border-farm-accent/20 text-farm-text min-h-[120px]"
                      placeholder="Enter executive summary..."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedReport.executive_summary || 'No summary available'}
                    </p>
                  )}
                </div>
                  
                  {/* Key Highlights */}
                  {(isEditing || (selectedReport.key_highlights && selectedReport.key_highlights.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-semibold text-farm-accent mb-1">Key Highlights</h4>
                      {isEditing ? (
                        <div className="space-y-2">
                          {editedHighlights.map((h, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={h}
                                onChange={(e) => {
                                  const updated = [...editedHighlights];
                                  updated[i] = e.target.value;
                                  setEditedHighlights(updated);
                                }}
                                className="flex-1 bg-farm-card border border-farm-accent/20 rounded px-2 py-1 text-sm text-farm-text"
                                placeholder="Enter highlight..."
                              />
                              <button
                                onClick={() => setEditedHighlights(editedHighlights.filter((_, idx) => idx !== i))}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setEditedHighlights([...editedHighlights, ''])}
                            className="text-xs text-farm-accent hover:text-farm-accent/80"
                          >
                            + Add Highlight
                          </button>
                        </div>
                      ) : (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {selectedReport.key_highlights?.map((h, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-farm-accent">•</span>
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {/* Timeline Events */}
                  {selectedReport.timeline_events && selectedReport.timeline_events.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-farm-accent mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Season Timeline
                      </h4>
                      <div className="space-y-1.5">
                        {selectedReport.timeline_events.map((event, i) => {
                          // Determine icon based on source and event text
                          let SourceIcon = Calendar;
                          if (event.source === 'jd_ops') {
                            SourceIcon = Tractor;
                          } else if (event.source === 'recording') {
                            SourceIcon = Mic;
                          } else if (event.source === 'document') {
                            // Differentiate between Photo and Document
                            SourceIcon = event.event?.toLowerCase().startsWith('photo') ? Camera : FileText;
                          } else if (event.source === 'scouting') {
                            SourceIcon = Leaf;
                          } else if (event.source === 'plan') {
                            SourceIcon = FileText;
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
                              <span className="text-muted-foreground">{event.event}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Issues */}
                  {(isEditing || (selectedReport.issues_encountered && selectedReport.issues_encountered.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-semibold text-amber-500 mb-1">Issues Encountered</h4>
                      {isEditing ? (
                        <div className="space-y-2">
                          {editedIssues.map((issue, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={issue}
                                onChange={(e) => {
                                  const updated = [...editedIssues];
                                  updated[i] = e.target.value;
                                  setEditedIssues(updated);
                                }}
                                className="flex-1 bg-farm-card border border-farm-accent/20 rounded px-2 py-1 text-sm text-farm-text"
                                placeholder="Enter issue..."
                              />
                              <button
                                onClick={() => setEditedIssues(editedIssues.filter((_, idx) => idx !== i))}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setEditedIssues([...editedIssues, ''])}
                            className="text-xs text-amber-500 hover:text-amber-400"
                          >
                            + Add Issue
                          </button>
                        </div>
                      ) : (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {selectedReport.issues_encountered?.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {/* Recommendations */}
                  {(isEditing || (selectedReport.recommendations && selectedReport.recommendations.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-semibold text-blue-400 mb-1">Recommendations</h4>
                      {isEditing ? (
                        <div className="space-y-2">
                          {editedRecommendations.map((rec, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={rec}
                                onChange={(e) => {
                                  const updated = [...editedRecommendations];
                                  updated[i] = e.target.value;
                                  setEditedRecommendations(updated);
                                }}
                                className="flex-1 bg-farm-card border border-farm-accent/20 rounded px-2 py-1 text-sm text-farm-text"
                                placeholder="Enter recommendation..."
                              />
                              <button
                                onClick={() => setEditedRecommendations(editedRecommendations.filter((_, idx) => idx !== i))}
                                className="text-red-400 hover:text-red-300 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setEditedRecommendations([...editedRecommendations, ''])}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            + Add Recommendation
                          </button>
                        </div>
                      ) : (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {selectedReport.recommendations?.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-400">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  
                  {/* Source counts */}
                  {selectedReport.source_counts && (
                    <div className="pt-2 border-t border-farm-accent/10">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Data Sources</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedReport.source_counts.jd_ops_operations > 0 && (
                          <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                            {selectedReport.source_counts.jd_ops_operations} JD Ops Reports
                          </span>
                        )}
                        {selectedReport.source_counts.voice_notes > 0 && (
                          <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                            {selectedReport.source_counts.voice_notes} Recordings
                          </span>
                        )}
                        {selectedReport.source_counts.documents > 0 && (
                          <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                            {selectedReport.source_counts.documents} Docs & Photos
                          </span>
                        )}
                        {selectedReport.source_counts.scouting_notes > 0 && (
                          <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                            {selectedReport.source_counts.scouting_notes} Scouting Notes
                          </span>
                        )}
                        {selectedReport.source_counts.field_plans > 0 && (
                          <span className="text-xs bg-farm-accent/10 text-farm-accent px-2 py-1 rounded">
                            {selectedReport.source_counts.field_plans} Field Plans
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                {/* Generated timestamp */}
                {selectedReport.generated_at && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 pt-3 mt-3 border-t border-farm-accent/10">
                    <Clock className="w-3 h-3" />
                    Generated {new Date(selectedReport.generated_at).toLocaleString()}
                  </div>
                )}
                
                {/* Regenerate Button */}
                <div className="pt-4">
                  <Button
                    variant="outline"
                    className="w-full border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
                    onClick={async () => {
                      setGenerating(true);
                      try {
                        await fieldReportsAPI.generateReport(selectedReport.field_id, selectedReport.year, true);
                        toast.success('Regenerating report...');
                        // Poll for completion
                        const pollInterval = setInterval(async () => {
                          const report = await fieldReportsAPI.getReport(selectedReport.field_id, selectedReport.year);
                          if ('executive_summary' in report) {
                            setSelectedReport(report as any);
                            setGenerating(false);
                            clearInterval(pollInterval);
                            toast.success('Report regenerated!');
                          }
                        }, 3000);
                      } catch (error) {
                        setGenerating(false);
                        toast.error('Failed to regenerate report');
                      }
                    }}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : loadingReports ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full bg-farm-card" />
              <Skeleton className="h-20 w-full bg-farm-card" />
              <Skeleton className="h-20 w-full bg-farm-card" />
            </div>
          ) : allReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No generated reports yet</p>
              <Button
                variant="outline"
                className="border-farm-accent/30 text-farm-text"
                onClick={() => setViewMode('reports')}
              >
                Go to Reports Tab
              </Button>
            </div>
          ) : filteredSummaryReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No reports match the selected filters</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your filter criteria
              </p>
            </div>
          ) : (
            /* List View - show filtered reports */
            <div className="space-y-2">
              {filteredSummaryReports.map(report => (
                <div 
                  key={report.id}
                  className="relative flex items-center justify-between py-3 px-3 bg-farm-card rounded-lg cursor-pointer hover:bg-farm-card/80 transition-colors"
                  onClick={() => loadReportDetail(report.field_id, report.year)}
                >
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="font-medium text-farm-text truncate">
                      {report.field_name} • {report.farm_name || 'Unknown Farm'} • {report.year}
                    </div>
                    <div className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {report.generated_at 
                        ? new Date(report.generated_at).toLocaleDateString() 
                        : 'Generated recently'}
                    </div>
                    <div className="text-xs text-farm-accent mt-0.5 flex items-center gap-2 flex-wrap">
                      {report.source_counts.jd_ops_operations > 0 && (
                        <span className="flex items-center gap-0.5">
                          <FileBarChart2 className="w-3 h-3" />
                          {report.source_counts.jd_ops_operations}
                        </span>
                      )}
                      {report.source_counts.voice_notes > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Mic className="w-3 h-3" />
                          {report.source_counts.voice_notes}
                        </span>
                      )}
                      {report.source_counts.documents > 0 && (
                        <span className="flex items-center gap-0.5">
                          <FolderOpen className="w-3 h-3" />
                          {report.source_counts.documents}
                        </span>
                      )}
                      {report.source_counts.scouting_notes > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Leaf className="w-3 h-3" />
                          {report.source_counts.scouting_notes}
                        </span>
                      )}
                      {report.source_counts.field_plans > 0 && (
                        <span className="flex items-center gap-0.5">
                          <BarChart3 className="w-3 h-3" />
                          {report.source_counts.field_plans}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-farm-accent/10">
                          <MoreVertical className="h-4 w-4 text-farm-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          loadReportDetail(report.field_id, report.year);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/share-field-report?field_id=${report.field_id}&year=${report.year}`);
                        }}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share Report
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportToDelete(report);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Shared Tab Content */}
      {viewMode === 'shared' && (
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {selectedShare ? (
            /* Detail View */
            <div className="space-y-4">
              {/* Header with Back Button */}
              <div className="flex items-center gap-3 pb-3 border-b border-farm-accent/10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedShare(null)}
                  className="flex items-center gap-2 text-farm-muted hover:text-farm-text"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>

              {/* Share Header */}
              <div className="space-y-2 pb-3 border-b border-farm-accent/10">
                <span className="text-xs px-2 py-0.5 bg-farm-accent/20 text-farm-accent rounded">
                  Field Report
                </span>
                <h2 className="text-xl font-bold text-farm-text">
                  {selectedShare.field_name} {selectedShare.farm_name ? `(${selectedShare.farm_name})` : ''}
                </h2>
                <div className="flex items-center gap-2 text-sm text-farm-muted flex-wrap">
                  <span>Year: {selectedShare.year}</span>
                  <span>•</span>
                  <span>{selectedShare.communication_method === 'sms' ? '📱 SMS' : '✉️ Email'}</span>
                  <span>•</span>
                  <span>Shared {new Date(selectedShare.shared_at).toLocaleDateString()}</span>
                </div>
                <div className="text-sm">
                  <span className="text-farm-muted">Recipients:</span>{' '}
                  <span className="font-medium text-farm-text">{selectedShare.recipient_names}</span>
                </div>
                {selectedShare.view_count > 0 && (
                  <div className="text-xs text-farm-muted flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Viewed {selectedShare.view_count} time{selectedShare.view_count !== 1 ? 's' : ''}
                    {selectedShare.last_viewed_at && (
                      <> • Last viewed {new Date(selectedShare.last_viewed_at).toLocaleDateString()}</>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedShare.share_link, '_blank')}
                  className="mt-2 border-farm-accent/30"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Shared Report
                </Button>
              </div>

              {/* Email Subject (if email) */}
              {selectedShare.communication_method === 'email' && selectedShare.message_subject && (
                <div className="bg-farm-card rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm text-farm-muted">Subject</h3>
                  <p className="font-medium text-farm-text">{selectedShare.message_subject}</p>
                </div>
              )}

              {/* Message Content */}
              {selectedShare.message_body && (
                <div className="bg-farm-card rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-sm text-farm-muted">Message</h3>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedShare.message_body}
                  </div>
                </div>
              )}
            </div>
          ) : loadingShared ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full bg-farm-card" />
              <Skeleton className="h-16 w-full bg-farm-card" />
              <Skeleton className="h-16 w-full bg-farm-card" />
            </div>
          ) : sharedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Share2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                No shared reports yet
              </p>
              <p className="text-xs text-muted-foreground">
                Generate a report and share it with stakeholders
              </p>
            </div>
          ) : filteredSharedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Share2 className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                No shares match the selected filters
              </p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your filter criteria
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSharedReports.map(share => (
                <div 
                  key={share.id}
                  className="relative flex items-center justify-between py-3 px-3 bg-farm-card rounded-lg cursor-pointer hover:bg-farm-card/80 transition-colors"
                  onClick={() => setSelectedShare(share)}
                >
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="font-medium text-farm-text truncate">
                      {share.field_name} • {share.farm_name || 'Unknown Farm'} • {share.year}
                    </div>
                    <div className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(share.shared_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-farm-accent mt-0.5 flex items-center gap-2">
                      <span>{share.communication_method === 'sms' ? '📱' : '✉️'}</span>
                      <span>→</span>
                      <span className="truncate">{share.recipient_names}</span>
                      {share.view_count > 0 && (
                        <span className="flex items-center gap-1 ml-2">
                          <Eye className="w-3 h-3" />
                          {share.view_count}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Three-dot menu */}
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-farm-accent/10">
                          <MoreVertical className="h-4 w-4 text-farm-muted" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedShare(share);
                        }}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          window.open(share.share_link, '_blank');
                        }}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Share Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareToDelete(share);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Delete Share Confirmation Dialog */}
      <AlertDialog open={!!shareToDelete} onOpenChange={(open) => !open && setShareToDelete(null)}>
        <AlertDialogContent className="bg-farm-dark border-farm-accent/20 max-w-sm mx-auto rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-farm-text">Delete Share</AlertDialogTitle>
            <AlertDialogDescription className="text-farm-muted">
              Are you sure you want to delete this share? This will remove the share link and it will no longer be accessible.
              {shareToDelete && (
                <span className="block mt-2 font-medium text-farm-text">
                  {shareToDelete.field_name} • {shareToDelete.year} → {shareToDelete.recipient_names}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
              disabled={deletingShare}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShare}
              disabled={deletingShare}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingShare ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Report Confirmation Dialog */}
      <AlertDialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <AlertDialogContent className="bg-farm-dark border-farm-accent/20 max-w-sm mx-auto rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-farm-text">Delete Report</AlertDialogTitle>
            <AlertDialogDescription className="text-farm-muted">
              Are you sure you want to delete this report? This will also remove any shared links associated with it.
              {reportToDelete && (
                <span className="block mt-2 font-medium text-farm-text">
                  {reportToDelete.field_name} • {reportToDelete.farm_name || 'Unknown Farm'} • {reportToDelete.year}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-farm-accent/30 text-farm-text hover:bg-farm-accent/10"
              disabled={deletingReport}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteReport}
              disabled={deletingReport}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingReport ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
