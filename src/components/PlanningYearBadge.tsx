import { useState, useEffect } from "react";
import { planningAPI, CurrentPlanningContext } from "@/lib/api";
import { Calendar } from "lucide-react";

export function PlanningYearBadge() {
  const [planningContext, setPlanningContext] = useState<CurrentPlanningContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlanningContext();
  }, []);

  const loadPlanningContext = async () => {
    try {
      const context = await planningAPI.getCurrentSeason();
      setPlanningContext(context);
    } catch (error) {
      console.error("Failed to load planning context:", error);
      // Default to next year if API fails
      const defaultYear = new Date().getFullYear() + 1;
      setPlanningContext({
        current_year: defaultYear,
        has_active_season: false,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!planningContext) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium">
      <Calendar className="h-4 w-4" />
      <span>Planning: {planningContext.current_year}</span>
      {planningContext.progress && (
        <span className="text-xs opacity-75">
          ({planningContext.progress.planning_progress_percent}%)
        </span>
      )}
    </div>
  );
}

