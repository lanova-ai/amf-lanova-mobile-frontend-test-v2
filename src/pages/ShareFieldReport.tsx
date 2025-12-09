import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, RefreshCw, Edit, Mail, MessageSquare, Loader2, UserPlus } from "lucide-react";
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
import { contactsAPI, fieldReportsAPI } from "@/lib/api";
import type { Contact, FieldReportGenerated } from "@/lib/api";
import { toast } from "sonner";
import { FEATURES } from "@/config/features";

const CONTEXT_SUGGESTIONS = [
  "Please review this field report",
  "Here's your season summary",
  "Looking for your feedback",
  "For your records",
  "Sharing field status update",
];

interface GeneratedMessage {
  subject?: string;
  body: string;
  share_link: string;
  metadata: {
    estimated_length: number;
    generated_by: string;
  };
}

export default function ShareFieldReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get params from URL
  const fieldId = searchParams.get("field_id") || "";
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  
  // Report data
  const [report, setReport] = useState<FieldReportGenerated | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  
  // Share state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [communicationMethod, setCommunicationMethod] = useState<"sms" | "email">("email");
  const [userContext, setUserContext] = useState("");
  const [generatedMessage, setGeneratedMessage] = useState<GeneratedMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [shareError, setShareError] = useState("");

  // Load report and contacts on mount
  useEffect(() => {
    if (!fieldId) {
      toast.error("Missing field information");
      navigate("/amf-reports");
      return;
    }
    loadReport();
    loadContacts();
  }, []);

  const loadReport = async () => {
    try {
      setLoadingReport(true);
      const data = await fieldReportsAPI.getReport(fieldId, year);
      
      if ('executive_summary' in data) {
        setReport(data as FieldReportGenerated);
      } else {
        toast.error("Report not found");
        navigate("/amf-reports");
      }
    } catch (err) {
      console.error("Error loading report:", err);
      toast.error("Failed to load report");
      navigate("/amf-reports");
    } finally {
      setLoadingReport(false);
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await contactsAPI.listContacts();
      setContacts(data);
    } catch (err) {
      console.error("Error loading contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleGenerateMessage = async () => {
    if (!selectedContact || !userContext.trim()) {
      setShareError("Please select a contact and provide context");
      return;
    }

    const contact = contacts.find((c) => c.id === selectedContact);
    if (!contact) {
      setShareError("Invalid contact selected");
      return;
    }

    if (communicationMethod === "sms" && !contact.phone) {
      setShareError("This contact doesn't have a phone number");
      return;
    }
    if (communicationMethod === "email" && !contact.email) {
      setShareError("This contact doesn't have an email address");
      return;
    }

    if (!report) {
      setShareError("Report data not loaded");
      return;
    }

    try {
      setIsGenerating(true);
      setShareError("");

      // Use AI to generate personalized message
      const messageResponse = await fieldReportsAPI.generateShareMessage({
        field_id: fieldId,
        year: year,
        recipient_name: contact.name,
        recipient_type: contact.contact_type || 'contact',
        communication_method: communicationMethod,
        user_context: userContext,
      });

      setGeneratedMessage({
        subject: messageResponse.subject,
        body: messageResponse.body,
        share_link: messageResponse.share_link,
        metadata: {
          estimated_length: communicationMethod === "email" 
            ? messageResponse.body.split(/\s+/).length 
            : messageResponse.body.length,
          generated_by: (messageResponse.metadata?.generated_by as string) || "ai",
        },
      });
      setEditedSubject(messageResponse.subject || "");
      setEditedBody(messageResponse.body);
    } catch (err: any) {
      console.error("Error generating message:", err);
      setShareError(err.message || "Failed to generate message");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!generatedMessage || !selectedContact) return;

    const contact = contacts.find((c) => c.id === selectedContact);
    if (!contact) {
      setShareError("Invalid contact selected");
      return;
    }

    try {
      setIsSending(true);
      setShareError("");

      // Use edited values if available
      const finalSubject = isEditing ? editedSubject : generatedMessage.subject;
      const finalBody = isEditing ? editedBody : generatedMessage.body;

      // Actually send the message via API
      const sendResponse = await fieldReportsAPI.sendShareMessage({
        field_id: fieldId,
        year: year,
        recipient_ids: [selectedContact],
        communication_method: communicationMethod,
        subject: finalSubject,
        body: finalBody,
        share_link: generatedMessage.share_link,
      });

      if (sendResponse.success) {
        const destination = communicationMethod === "email" 
          ? contact.email 
          : contact.phone;
        
        toast.success(`${communicationMethod === 'email' ? 'Email' : 'SMS'} sent to ${contact.name} at ${destination}`);
        
        // Navigate back to Shared tab after success
        setTimeout(() => {
          navigate("/amf-reports", { state: { activeTab: 'shared' } });
        }, 1500);
      } else {
        const failedResults = sendResponse.results.filter(r => r.status === 'failed');
        const errorMsg = failedResults.length > 0 
          ? failedResults[0].message 
          : 'Failed to send message';
        setShareError(errorMsg);
      }
    } catch (err: any) {
      console.error("Error sending:", err);
      setShareError(err?.message || "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const selectedContactData = contacts.find((c) => c.id === selectedContact);

  if (loadingReport) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="body-text">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <p className="text-farm-text">Report not found</p>
          <Button onClick={() => navigate(-1)}>Back</Button>
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
              <h2 className="font-semibold text-farm-text">Share Field Report</h2>
              <p className="text-xs text-farm-muted">
                {report.field_name} • {report.year}
                {report.farm_name && ` • ${report.farm_name}`}
              </p>
            </div>
          </div>
        </div>

        {/* Share Form */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">
          {/* No Contacts Warning */}
          {!loadingContacts && contacts.length === 0 && (
            <div className="border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-sm">No Contacts Found</h4>
                  <p className="text-sm text-farm-muted">
                    You need to add at least one contact before you can share.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate("/settings/contacts/new")}
                    className="mt-2 bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                  <SelectTrigger id="contact" className="bg-farm-card border-farm-accent/20">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] bg-farm-card border-farm-accent/20">
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-xs text-farm-muted">
                            ({contact.contact_type})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedContactData && (
                <div className="mt-2 text-xs text-farm-muted">
                  {selectedContactData.company && (
                    <div>{selectedContactData.company}</div>
                  )}
                  <div className="flex gap-4 mt-1">
                    {selectedContactData.email && (
                      <span>✉️ {selectedContactData.email}</span>
                    )}
                    {selectedContactData.phone && (
                      <span>📱 {selectedContactData.phone}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Communication Method */}
          {contacts.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Method</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={communicationMethod === "email" ? "default" : "outline"}
                  onClick={() => setCommunicationMethod("email")}
                  className={`flex-1 ${communicationMethod === "email" ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark" : "border-farm-accent/30"}`}
                  disabled={selectedContactData && !selectedContactData.email}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={communicationMethod === "sms" ? "default" : "outline"}
                  onClick={() => setCommunicationMethod("sms")}
                  className={`flex-1 ${communicationMethod === "sms" ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark" : "border-farm-accent/30"}`}
                  disabled={!FEATURES.SMS_ENABLED || (selectedContactData && !selectedContactData.phone)}
                  title={!FEATURES.SMS_ENABLED ? FEATURES.SMS_DISABLED_MESSAGE : undefined}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  SMS {!FEATURES.SMS_ENABLED && <span className="text-xs ml-1">(Soon)</span>}
                </Button>
              </div>
            </div>
          )}

          {/* Context Input */}
          {contacts.length > 0 && (
            <div>
              <Label htmlFor="context" className="text-sm font-medium mb-2 block">
                What do you need?
              </Label>
              <Textarea
                id="context"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="e.g., Please review this field report"
                rows={3}
                className="resize-none bg-farm-card border-farm-accent/20"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTEXT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUserContext(suggestion)}
                    className="text-xs px-2 py-1 bg-farm-accent/10 text-farm-accent rounded-full hover:bg-farm-accent/20 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generate Message Button */}
          {contacts.length > 0 && !generatedMessage && (
            <Button
              onClick={handleGenerateMessage}
              disabled={!selectedContact || !userContext.trim() || isGenerating}
              className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Message"
              )}
            </Button>
          )}

          {/* Preview/Edit Message */}
          {generatedMessage && (
            <div className="border border-farm-accent/20 rounded-lg p-4 space-y-4 bg-farm-card">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-farm-text">Message Preview</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-farm-muted hover:text-farm-text"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {isEditing ? "Preview" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerateMessage}
                    disabled={isGenerating}
                    className="text-farm-muted hover:text-farm-text"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  {communicationMethod === "email" && (
                    <div>
                      <Label htmlFor="edit-subject" className="text-xs font-medium mb-1.5 block text-farm-muted">
                        Subject Line
                      </Label>
                      <Input
                        id="edit-subject"
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="text-sm bg-farm-dark border-farm-accent/20"
                        placeholder="Enter email subject"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="edit-message" className="text-xs font-medium mb-1.5 block text-farm-muted">
                      Message Body
                    </Label>
                    <Textarea
                      id="edit-message"
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="resize-none text-sm bg-farm-dark border-farm-accent/20"
                      placeholder="Enter your message"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {generatedMessage.subject && (
                    <div>
                      <span className="font-medium text-xs text-farm-muted uppercase tracking-wide">
                        Subject:
                      </span>
                      <div className="mt-1 font-medium text-farm-text">{generatedMessage.subject}</div>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-xs text-farm-muted uppercase tracking-wide">
                      Message:
                    </span>
                    <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {generatedMessage.body}
                    </div>
                  </div>
                  <div className="text-xs text-farm-muted pt-2 border-t border-farm-accent/10">
                    {generatedMessage.metadata.estimated_length}{" "}
                    {communicationMethod === "email" ? "words" : "characters"}
                  </div>
                </div>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={isSending}
                className="w-full bg-farm-accent hover:bg-farm-accent/90 text-farm-dark"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {communicationMethod === 'email' ? 'Email' : 'SMS'}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {shareError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {shareError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
