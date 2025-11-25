import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Sprout, FileText, CheckCircle2, Download, ExternalLink, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fieldPlansAPI, managementZonesAPI } from "@/lib/api";
import { useManagementZones } from "@/hooks/useManagementZones";

const GeneratePrescription = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { planId } = useParams();
  
  // Get pass data from location state
  const passData = location.state?.pass;
  const fieldId = location.state?.fieldId;
  const fieldName = location.state?.fieldName;
  const totalAcres = location.state?.totalAcres;
  
  // States for prescription generation
  const [useZones, setUseZones] = useState(false);
  const [zoneSource, setZoneSource] = useState('sentinel2_ndvi_7yr');
  const [rateStrategy, setRateStrategy] = useState<'auto' | 'custom'>('auto');
  const [customZoneRates, setCustomZoneRates] = useState({ low: '', medium: '', high: '' });
  const [availableSources, setAvailableSources] = useState<any[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [generatingRx, setGeneratingRx] = useState(false);
  const [rxResult, setRxResult] = useState<any>(null);
  const [uploadingToJD, setUploadingToJD] = useState(false);
  
  // Fetch management zones if useZones is true
  const { zones, loading: zonesLoading } = useManagementZones(
    useZones ? fieldId : null,
    useZones ? zoneSource : null
  );
  
  const hasZones = zones.length > 0;

  // Redirect if no pass data
  useEffect(() => {
    if (!passData || !planId) {
      toast.error("Invalid prescription generation request");
      navigate("/field-plans");
    }
  }, [passData, planId, navigate]);

  // Load available zone sources when useZones is enabled
  useEffect(() => {
    if (useZones && fieldId && availableSources.length === 0) {
      loadAvailableSources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useZones, fieldId]);

  // Auto-populate custom rates when switching to custom strategy
  useEffect(() => {
    if (rateStrategy === 'custom' && passData?.products?.[0]?.rate) {
      const baseRate = passData.products[0].rate;
      setCustomZoneRates({
        low: Math.round(baseRate * 0.9).toString(),
        medium: Math.round(baseRate).toString(),
        high: Math.round(baseRate * 1.1).toString()
      });
    }
  }, [rateStrategy, passData]);

  const loadAvailableSources = async () => {
    if (!fieldId) return;
    
    setLoadingSources(true);
    try {
      const response = await managementZonesAPI.getAvailableSources();
      if (response.available_sources && response.available_sources.length > 0) {
        setAvailableSources(response.available_sources);
        if (response.available_sources.length === 1) {
          setZoneSource(response.available_sources[0].source_type);
        }
      }
      // Don't show error or disable zones here - let the zones hook handle field-specific validation
    } catch (error: any) {
      console.error("Failed to load zone sources:", error);
      // Only show error on actual API failure, not on empty results
      toast.error("Failed to load zone sources");
    } finally {
      setLoadingSources(false);
    }
  };

  const handleGeneratePrescription = async () => {
    if (!passData || !planId) return;

    setGeneratingRx(true);
    
    try {
      const requestPayload: any = {
        use_zones: useZones,
        push_to_jd: false  // Generate locally first, let user review before uploading
      };

      if (useZones) {
        if (!hasZones) {
          toast.error("No management zones available for selected source");
          setGeneratingRx(false);
          return;
        }

        requestPayload.zone_source = zoneSource;

        if (rateStrategy === 'custom') {
          const lowRate = parseFloat(customZoneRates.low);
          const mediumRate = parseFloat(customZoneRates.medium);
          const highRate = parseFloat(customZoneRates.high);

          if (isNaN(lowRate) || isNaN(mediumRate) || isNaN(highRate)) {
            toast.error("Please provide valid rates for all zones");
            setGeneratingRx(false);
            return;
          }

          requestPayload.zone_rates = {
            low: lowRate,
            medium: mediumRate,
            high: highRate
          };
        }
      }

      const result = await fieldPlansAPI.generatePrescription(
        passData.id,
        requestPayload
      );

      // Show success message (no auto-upload)
      toast.success(
        "Prescription generated successfully! Review and upload to John Deere when ready.",
        { duration: 6000 }
      );
      
      setRxResult(result);
    } catch (error: any) {
      console.error("Failed to generate prescription:", error);
      // Extract error message from various possible formats
      const errorMessage = 
        error.message || 
        error.response?.data?.detail || 
        error.response?.data?.message ||
        error.detail ||
        "Failed to generate prescription";
      
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setGeneratingRx(false);
    }
  };

  const handleUploadToJD = async () => {
    if (!rxResult?.prescription_id) return;

    setUploadingToJD(true);
    
    try {
      const result = await fieldPlansAPI.uploadPrescriptionToJD(rxResult.prescription_id);
      
      toast.success(
        "Prescription uploaded to John Deere Operations Center! Check your Files section to import it.",
        { duration: 8000 }
      );
      
      // Update rxResult with new status
      setRxResult({
        ...rxResult,
        status: 'uploaded_to_jd',
        jd_file_id: result.jd_file_id,
        jd_work_plan_url: result.jd_work_plan_url
      });
    } catch (error: any) {
      console.error("Failed to upload prescription to JD:", error);
      let errorMessage = 
        error.message || 
        error.response?.data?.detail || 
        error.response?.data?.message ||
        error.detail ||
        "Failed to upload prescription to John Deere";
      
      // Clean up technical details (GUIDs, status codes, etc.) for user-friendly display
      // Remove "Failed to upload to John Deere: " prefix if it exists
      errorMessage = errorMessage.replace(/^Failed to upload to John Deere:\s*/i, '');
      
      toast.error(errorMessage, { duration: 8000 });
    } finally {
      setUploadingToJD(false);
    }
  };

  if (!passData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-farm-dark pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-farm-dark border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (rxResult) {
                  // If prescription was generated, navigate to plan to show it
                  navigate(`/field-plans/${planId}`, { replace: true });
                } else {
                  // Otherwise just go back
                  navigate(-1);
                }
              }} 
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Sprout className="h-5 w-5 text-green-600" />
                Generate Prescription
              </h1>
              {fieldName && (
                <p className="text-sm text-farm-muted">{fieldName}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {!rxResult ? (
          /* Generation Form */
          <>
            {/* Product Details */}
            {passData.products && passData.products.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="text-xs font-medium text-farm-muted uppercase">Product Details</div>
                {passData.products.map((product: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <div className="font-medium">{product.product_name}</div>
                    {product.product_brand && (
                      <div className="text-xs text-farm-muted">{product.product_brand}</div>
                    )}
                    {product.rate && (
                      <div className="text-xs text-primary font-medium mt-1">
                        {useZones && rateStrategy === 'auto' ? 'Field Average: ' : 'Rate: '} 
                        {Math.round(product.rate).toLocaleString()} {product.rate_unit || 'seeds/acre'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Variable Rate Zones Toggle */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className={`h-4 w-4 ${useZones ? 'text-green-600' : 'text-farm-muted'}`} />
                  <Label htmlFor="use-zones" className="text-sm font-medium cursor-pointer">
                    Use Zones
                  </Label>
                </div>
                <Switch
                  id="use-zones"
                  checked={useZones}
                  onCheckedChange={setUseZones}
                  disabled={generatingRx}
                  className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-200 data-[state=unchecked]:border-red-300"
                />
              </div>

              {useZones && (
                <div className="space-y-4 pt-2 border-t">
                  {/* Zone Source Selector */}
                  {loadingSources ? (
                    <div className="flex items-center gap-2 text-sm text-farm-muted">
                      <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
                      Loading available sources...
                    </div>
                  ) : availableSources.length > 1 ? (
                    <div className="space-y-2">
                      <Label className="text-xs text-farm-muted">Zone Source</Label>
                      <Select value={zoneSource} onValueChange={setZoneSource} disabled={generatingRx}>
                        <SelectTrigger className="w-full h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSources.map((source) => (
                            <SelectItem key={source.source_type} value={source.source_type}>
                              <div>
                                <div className="font-medium">{source.source_name}</div>
                                <div className="text-xs text-farm-muted">
                                  {source.zone_count} zones
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : availableSources.length === 1 ? (
                    <div className="space-y-1">
                      <Label className="text-xs text-farm-muted">Zone Source</Label>
                      <div className="text-sm font-medium">{availableSources[0].source_name}</div>
                    </div>
                  ) : null}

                  {/* Loading zones indicator */}
                  {zonesLoading && (
                    <div className="flex items-center gap-2 text-sm text-farm-muted">
                      <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
                      Loading zones...
                    </div>
                  )}

                  {/* No zones available warning */}
                  {!zonesLoading && !hasZones && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="text-orange-600 text-lg mt-0.5">⚠️</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-orange-900 mb-1">No Management Zones Available</p>
                          <p className="text-xs text-orange-800">
                            No management zones found for this field with the selected source. You can still generate a flat-rate prescription by disabling "Use Zones".
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show zone details once loaded */}
                  {!zonesLoading && hasZones && (
                    <>
                      {/* Rate Strategy Selector */}
                      <div className="space-y-3">
                        <Label className="text-xs text-farm-muted">Zone Rates</Label>
                        <RadioGroup value={rateStrategy} onValueChange={(val) => setRateStrategy(val as 'auto' | 'custom')}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="auto" id="auto" disabled={generatingRx} />
                            <Label htmlFor="auto" className="text-sm cursor-pointer font-normal">
                              Auto (±10% of field average)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="custom" id="custom" disabled={generatingRx} />
                            <Label htmlFor="custom" className="text-sm cursor-pointer font-normal">
                              Custom Rates
                            </Label>
                          </div>
                        </RadioGroup>

                        {/* Custom Rate Inputs */}
                        {rateStrategy === 'custom' && (
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                                Low
                              </Label>
                              <Input
                                type="number"
                                placeholder="28000"
                                value={customZoneRates.low}
                                onChange={(e) => setCustomZoneRates(prev => ({ ...prev, low: e.target.value }))}
                                disabled={generatingRx}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                                Medium
                              </Label>
                              <Input
                                type="number"
                                placeholder="32000"
                                value={customZoneRates.medium}
                                onChange={(e) => setCustomZoneRates(prev => ({ ...prev, medium: e.target.value }))}
                                disabled={generatingRx}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                High
                              </Label>
                              <Input
                                type="number"
                                placeholder="36000"
                                value={customZoneRates.high}
                                onChange={(e) => setCustomZoneRates(prev => ({ ...prev, high: e.target.value }))}
                                disabled={generatingRx}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Zone Summary */}
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-farm-muted">Zones Available:</span>
                          <span className="font-medium">
                            {zones.length} zones
                            {totalAcres && !isNaN(Number(totalAcres)) && ` • ${Number(totalAcres).toFixed(1)} acres`}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-2 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                            Low: {zones.filter((z: any) => z.zone_class === 'low').length}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                            Medium: {zones.filter((z: any) => z.zone_class === 'medium').length}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                            High: {zones.filter((z: any) => z.zone_class === 'high').length}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-900">
                  <p className="font-medium mb-1">Prescription File Format</p>
                  <p>This will create an ESRI Shapefile prescription that can be uploaded to John Deere Operations Center or loaded directly into compatible displays.</p>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {generatingRx && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  <span>Generating {useZones ? 'variable rate' : 'flat-rate'} prescription...</span>
                </div>
                <div className="text-xs text-farm-muted pl-6">
                  • Creating shapefile with {useZones ? 'zone-based' : 'field'} boundary<br />
                  • Adding product & rate information<br />
                  • Uploading to cloud storage<br />
                  • {useZones ? 'Configuring variable rate zones...' : 'Generating download link...'}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)} 
                disabled={generatingRx}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleGeneratePrescription} 
                disabled={generatingRx || (useZones && !hasZones)}
                className="flex-1 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                {generatingRx ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-farm-dark border-t-transparent rounded-full mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Prescription
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Success Result */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 mb-1">Prescription Generated!</h4>
                  <p className="text-sm text-green-800">{rxResult.message}</p>
                </div>
              </div>
            </div>

            {/* John Deere Status */}
            {rxResult.status === 'uploaded_to_jd' ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-900 mb-1">Uploaded to John Deere</p>
                    <p className="text-xs text-green-800">
                      Prescription file has been uploaded to your John Deere Operations Center. Check your Files section to import it.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 text-lg mt-0.5">ℹ️</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Ready to Upload</p>
                    <p className="text-xs text-blue-800">
                      Review the prescription map below. When ready, upload to John Deere Operations Center or download for manual upload.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Prescription Preview Image */}
            {rxResult.preview_url && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Prescription Preview</div>
                <div className="rounded-lg border overflow-hidden bg-white">
                  <img 
                    src={rxResult.preview_url} 
                    alt="Prescription Map Preview"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Upload to JD Button (only if not uploaded yet) */}
              {rxResult.status !== 'uploaded_to_jd' && (
                <Button 
                  onClick={handleUploadToJD}
                  disabled={uploadingToJD}
                  className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                >
                  {uploadingToJD ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-farm-dark border-t-transparent rounded-full mr-2"></div>
                      Uploading to John Deere...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Upload to John Deere
                    </>
                  )}
                </Button>
              )}

              {/* Download Button */}
              {rxResult.file_url && (
                <a
                  href={rxResult.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm border rounded-lg hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Prescription File
                </a>
              )}

              {/* Done Button */}
              <Button 
                onClick={() => {
                  // Navigate back and trigger reload by using location state
                  navigate(`/field-plans/${planId}`, { replace: true });
                }}
                variant="outline"
                className="w-full"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneratePrescription;

