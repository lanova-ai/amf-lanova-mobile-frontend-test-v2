import { useState, useEffect } from 'react';
import { managementZonesAPI, ManagementZone } from '@/lib/api';
import { toast } from 'sonner';

export interface ManagementZonesSummary {
  field_id: string;
  source_type: string;
  zones: ManagementZone[];
  summary: {
    field_id: string;
    source_type: string;
    total_zones: number;
    total_field_acres: number;
    zones_by_class: {
      [key: string]: {
        count: number;
        acres: number;
      };
    };
  };
}

export function useManagementZones(
  fieldId: string | null | undefined,
  sourceType: string = 'sentinel2_ndvi_7yr',
  enabled: boolean = true
) {
  const [data, setData] = useState<ManagementZonesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fieldId || !enabled) {
      setData(null);
      return;
    }

    let mounted = true;

    const fetchZones = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await managementZonesAPI.getForField(fieldId, sourceType);

        if (mounted) {
          setData(response);
        }
      } catch (err) {
        if (mounted) {
          const error = err as Error;
          setError(error);
          
          // Silently handle 404s - fields without zones are expected
          // No toast errors for missing zones to avoid cluttering UX
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchZones();

    return () => {
      mounted = false;
    };
  }, [fieldId, sourceType, enabled]);

  return {
    data,
    zones: data?.zones || [],
    summary: data?.summary,
    loading,
    error,
    hasZones: (data?.zones?.length || 0) > 0,
  };
}

