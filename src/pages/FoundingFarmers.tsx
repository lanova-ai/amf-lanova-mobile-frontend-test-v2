import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function FoundingFarmers() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen page-background flex items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-block mb-6 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold border border-primary/20">
          Limited Spots Available
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          Join an Exclusive <span className="text-primary">Founding Farmer</span> Program
        </h1>
        
        <p className="text-lg md:text-xl text-farm-muted mb-10">
          Be part of an exclusive group shaping the future of farm management
        </p>
        
        <Button
          size="lg"
          onClick={() => navigate("/founding-farmers/apply")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-6 text-lg shadow-lg"
        >
          Apply Now
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        
        <p className="mt-6 text-sm text-farm-muted">
          No credit card required • Free during founding period
        </p>
      </div>
    </div>
  );
}

