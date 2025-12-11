import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Edit, Mail, MessageSquare, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contactsAPI, fieldPlanSummariesAPI, ShareMessageResponse } from "@/lib/api";
import type { Contact } from "@/lib/api";
import { toast } from "sonner";
import { FEATURES } from "@/config/features";

const CONTEXT_SUGGESTIONS = [
  "Please review this field plan summary",
  "Looking for your recommendations",
  "Need feedback on the season plan",
  "Requesting your professional input",
  "Share for your records",
];

export default function ShareFieldPlanSummary() {
  const navigate = useNavigate();
  const { summaryId } = useParams<{ summaryId: string }>();
  
  // Summary data
  const [summary, setSummary] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  
  // Share state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [communicationMethod, setCommunicationMethod] = useState<"sms" | "email">("email");
  const [userContext, setUserContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState<ShareMessageResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  // Load summary and contacts on mount
  useEffect(() => {
    if (!summaryId) {
      toast.error("Missing summary information");
      navigate("/field-plans");
      return;
    }
    loadSummary();
    loadContacts();
  }, [summaryId]);

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await fieldPlanSummariesAPI.getSummary(summaryId!);
      setSummary(data);
    } catch (err) {
      console.error("Error loading summary:", err);
      toast.error("Failed to load summary. Please try again.");
      // Navigate back if we can't load the summary
      setTimeout(() => navigate("/field-plans"), 2000);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await contactsAPI.listContacts();
      setContacts(data);
    } catch (err) {
      console.error("Error loading contacts:", err);
      toast.error("Failed to load contacts. You may need to add contacts first.");
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!selectedContact || !userContext.trim()) {
      toast.error("Please select a contact and provide context");
      return;
    }

    const contact = contacts.find(c => c.id === selectedContact);
    if (!contact) {
      toast.error("Invalid contact selected");
      return;
    }

    try {
      setIsGenerating(true);

      // Generate message using the share API
      const response = await fieldPlanSummariesAPI.generateShareMessage(
        summaryId!,
        {
          contact_ids: [selectedContact],
          communication_method: communicationMethod,
          user_context: userContext,
        }
      );

      setGeneratedMessage(response);
      setEditedSubject(response.subject || "");
      setEditedBody(response.body || "");
      toast.success("Message generated successfully");
    } catch (err: any) {
      console.error("Error generating message:", err);
      // Display user-friendly error message from backend
      // Check for APIError format first, then fallback to generic properties
      const errorMessage = 
        err?.message || 
        err?.details?.detail || 
        err?.details?.message || 
        err?.detail || 
        "Failed to generate message. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!generatedMessage) {
      toast.error("Please generate a message first");
      return;
    }

    try {
      setIsSending(true);

      const messageToSend = isEditing
        ? { ...generatedMessage, subject: editedSubject, body: editedBody }
        : generatedMessage;

      // Share the summary
      await fieldPlanSummariesAPI.shareSummary(
        summaryId!,
        {
          contact_ids: [selectedContact],
          communication_method: communicationMethod,
          user_context: userContext,
          message_subject: messageToSend.subject,
        }
      );

      toast.success(`Summary shared successfully via ${communicationMethod === 'email' ? 'email' : 'SMS'}!`);
      navigate("/field-plans", { state: { activeTab: 'summary' } });
    } catch (err: any) {
      console.error("Error sending message:", err);
      // Display user-friendly error message from backend
      // Check for APIError format first, then fallback to generic properties
      const errorMessage = 
        err?.message || 
        err?.details?.detail || 
        err?.details?.message || 
        err?.detail || 
        "Failed to send message. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  if (loadingSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="body-text">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-4">
          <p className="body-text">Summary not found</p>
          <Button onClick={() => navigate("/field-plans")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Field Plans
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col page-background">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b bg-farm-dark/95 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h2 className="font-semibold">Share Field Plan Summary</h2>
              <p className="text-xs text-farm-muted">
                {summary.summary_name || `${summary.year} Field Plans Summary`} • {summary.year} • {summary.total_plans} {summary.total_plans === 1 ? 'plan' : 'plans'}
              </p>
            </div>
          </div>
        </div>

        {/* Share Form */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">

          {/* Contact Selection */}
          {contacts.length > 0 && (
            <div>
              <Label htmlFor="contact" className="text-sm font-medium mb-2 block">
                Send To
              </Label>
              {loadingContacts ? (
                <div className="flex items-center gap-2 text-sm text-farm-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading contacts...
                </div>
              ) : (
                <Select value={selectedContact} onValueChange={setSelectedContact}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name || contact.email || contact.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Communication Method */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCommunicationMethod("email")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  communicationMethod === "email"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Mail className="h-5 w-5" />
                <span>Email</span>
              </button>
              <button
                onClick={() => setCommunicationMethod("sms")}
                disabled={!FEATURES.SMS_ENABLED}
                title={!FEATURES.SMS_ENABLED ? FEATURES.SMS_DISABLED_MESSAGE : undefined}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                  communicationMethod === "sms"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                } ${!FEATURES.SMS_ENABLED ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <MessageSquare className="h-5 w-5" />
                <span>SMS {!FEATURES.SMS_ENABLED && "(Soon)"}</span>
              </button>
            </div>
          </div>

          {/* Context */}
          <div>
            <Label htmlFor="context" className="text-sm font-medium mb-2 block">
              What do you need?
            </Label>
            <Textarea
              id="context"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="e.g., Please review this field summary"
              rows={3}
              className="resize-none"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {CONTEXT_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setUserContext(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-farm-muted hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateMessage}
            disabled={!selectedContact || !userContext.trim() || isGenerating}
            className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Message"
            )}
          </Button>


          {/* Generated Message Preview */}
          {generatedMessage && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Message Preview</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {isEditing ? "Preview" : "Edit"}
                </Button>
              </div>

              <div className="space-y-4">
                {communicationMethod === "email" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-farm-muted uppercase tracking-wide">Subject</Label>
                    {isEditing ? (
                      <Input
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="font-medium"
                      />
                    ) : (
                      <div className="font-medium">
                        {editedSubject || generatedMessage.subject}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-farm-muted uppercase tracking-wide">Message</Label>
                  {isEditing ? (
                    <Textarea
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={12}
                      className="resize-none text-sm"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">
                      {editedBody || generatedMessage.body}
                    </div>
                  )}
                </div>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={isSending}
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                size="lg"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send via {communicationMethod === "email" ? "Email" : "SMS"}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

