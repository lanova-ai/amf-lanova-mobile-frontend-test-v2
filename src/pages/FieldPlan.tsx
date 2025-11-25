import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const FieldPlan = () => {
  const navigate = useNavigate();
  const { planId } = useParams();

  return (
    <div className="absolute inset-0 overflow-auto scrollbar-hide">
      <div className="px-6 py-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-6">📋</div>
          <h2 className="text-2xl font-bold mb-3">No Field Plan Selected</h2>
          <p className="text-farm-muted mb-8 max-w-md mx-auto">
            Field plans help you organize your inputs, passes, and costs for each growing season.
            Create plans for your fields to get started.
          </p>

          <div className="space-y-3 max-w-sm mx-auto">
            <Button
              onClick={() => navigate("/home")} 
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => toast.info("Field plan creation coming soon!")}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Field Plan
            </Button>
          </div>

          {/* Feature Preview */}
          <div className="mt-12 p-6 bg-muted/50 rounded-lg text-left max-w-md mx-auto">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">✨</span>
              Coming Soon: Field Planning
            </h3>
            <ul className="space-y-2 text-sm text-farm-muted">
              <li className="flex items-start gap-2">
                <span>🌱</span>
                <span>Plan passes: fertilizer, spraying, planting</span>
              </li>
              <li className="flex items-start gap-2">
                <span>💰</span>
                <span>Track costs per product and per acre</span>
              </li>
              <li className="flex items-start gap-2">
                <span>📊</span>
                <span>Variable rate zones and recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🎤</span>
                <span>Create plans from voice notes</span>
              </li>
              <li className="flex items-start gap-2">
                <span>📤</span>
                <span>Share with team and export to PDF</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldPlan;
