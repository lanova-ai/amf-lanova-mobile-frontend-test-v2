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
import { contactsAPI, shareTimelinesAPI, fieldsAPI, ShareMessageResponse } from "@/lib/api";
import type { Contact } from "@/lib/api";
import { toast } from "sonner";
import { FEATURES } from "@/config/features";

const CONTEXT_SUGGESTIONS = [
  "Please review this field summary",
  "Looking for your recommendations",
  "Need feedback on field conditions",
  "Requesting your professional input",
  "Share for your records",
];

export default function ShareTimeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get timeline params from URL - prefer summary_id if available
  const summaryId = searchParams.get("summary_id") || null;
  const fieldId = searchParams.get("field_id") || "";
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
  const timePeriod = searchParams.get("time_period") || "full_season";
  const documentId = searchParams.get("document_id") || null;
  
  // Timeline data
  const [timeline, setTimeline] = useState<any | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  
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
  const [shareError, setShareError] = useState("");

  // Load timeline and contacts on mount
  useEffect(() => {
    // If summary_id is provided, we can load directly. Otherwise need field_id
    if (!summaryId && !fieldId) {
      toast.error("Missing summary or field information");
      navigate("/documents");
      return;
    }
    loadTimeline();
    loadContacts();
  }, []);

  const loadTimeline = async () => {
    try {
      setLoadingTimeline(true);
      
      // If summary_id is provided, use the summary_id endpoint (preferred)
      if (summaryId) {
        const data = await fieldsAPI.getDocumentTimelineById(summaryId);
        setTimeline(data);
      } else if (fieldId) {
        // Fallback: Only use field_id/year/time_period if we have a document_id
        // Otherwise, we shouldn't be calling this endpoint without summary_id
        if (documentId) {
          // If document_id is provided, pass it as document_ids (single ID)
          // This is more precise than date filtering
          const data = await fieldsAPI.getFieldDocumentTimeline(
            fieldId,
            timePeriod as any,
            year,
            false, // regenerate
            undefined, // startDate - not needed when filtering by document_ids
            undefined, // endDate - not needed when filtering by document_ids
            documentId // Pass as document_ids (single ID, comma-separated format)
          );
          setTimeline(data);
        } else {
          // No document_id and no summary_id - this shouldn't happen
          // Try to find an existing summary for this field/year
          toast.error("Please select a specific summary or document to share");
          navigate("/documents");
        }
      } else {
        throw new Error("Missing summary_id or field_id");
      }
    } catch (err) {
      console.error("Error loading timeline:", err);
      toast.error("Failed to load timeline");
      setShareError("Failed to load timeline data");
    } finally {
      setLoadingTimeline(false);
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await contactsAPI.listContacts();
      setContacts(data);
    } catch (err) {
      console.error("Error loading contacts:", err);
      setShareError("Failed to load contacts");
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

    if (!timeline) {
      setShareError("Timeline data not loaded");
      return;
    }

    try {
      setIsGenerating(true);
      setShareError("");

      const response = await shareTimelinesAPI.generateMessage({
        summary_id: summaryId || (timeline?.id ? timeline.id : undefined),
        field_id: summaryId ? undefined : fieldId, // Only pass if no summary_id
        year: summaryId ? undefined : year, // Only pass if no summary_id
        time_period: summaryId ? undefined : timePeriod, // Only pass if no summary_id
        recipient_name: contact.name,
        recipient_type: contact.contact_type,
        communication_method: communicationMethod,
        user_context: userContext,
      });

      setGeneratedMessage(response);
      setEditedSubject(response.subject || "");
      setEditedBody(response.body);
    } catch (err: any) {
      console.error("Error generating message:", err);
      setShareError(err.message || "Failed to generate message");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!generatedMessage || !selectedContact) return;

    try {
      setIsSending(true);
      setShareError("");

      const messageToSend = isEditing
        ? {
            subject: communicationMethod === "email" ? editedSubject : undefined,
            body: editedBody,
          }
        : {
            subject: generatedMessage.subject,
            body: generatedMessage.body,
          };

      await shareTimelinesAPI.shareTimeline({
        summary_id: summaryId || (timeline?.id ? timeline.id : undefined),
        field_id: summaryId ? undefined : fieldId, // Only pass if no summary_id
        year: summaryId ? undefined : year, // Only pass if no summary_id
        time_period: summaryId ? undefined : timePeriod, // Only pass if no summary_id
        contact_ids: [selectedContact],
        communication_method: communicationMethod,
        message: messageToSend,
        share_link: generatedMessage.share_link,
      });

      toast.success("Timeline shared successfully!");
      navigate("/documents", { state: { tab: 'shared', refresh: true } });
    } catch (err: any) {
      console.error("Error sending message:", err);
      // Display user-friendly error message from backend
      const errorMessage = 
        err?.message || 
        err?.details?.detail || 
        err?.details?.message || 
        err?.detail || 
        "Failed to send message. Please try again.";
      toast.error(errorMessage);
      setShareError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const selectedContactData = contacts.find((c) => c.id === selectedContact);

  if (loadingTimeline) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="body-text">Loading timeline...</p>
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
              onClick={() => navigate("/documents?tab=summary")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h2 className="font-semibold">Share Timeline Summary</h2>
              {timeline && (
                <p className="text-xs text-farm-muted">
                  {timeline.field_name} • {year} • {timeline.total_documents} documents
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Share Form */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">
          {/* No Contacts Warning */}
          {!loadingContacts && contacts.length === 0 && (
            <div className="border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-yellow-600 dark:text-farm-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-sm">No Contacts Found</h4>
                  <p className="text-sm text-farm-muted">
                    You need to add at least one contact before you can share. Add agronomists, advisors, or other contacts to your network.
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
                <Select 
                  value={selectedContact} 
                  onValueChange={setSelectedContact}
                >
                  <SelectTrigger id="contact">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
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
                  className={`flex-1 ${communicationMethod === "email" ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark" : ""}`}
                  disabled={selectedContactData && !selectedContactData.email}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={communicationMethod === "sms" ? "default" : "outline"}
                  onClick={() => setCommunicationMethod("sms")}
                  className={`flex-1 ${communicationMethod === "sms" ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark" : ""}`}
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
                placeholder="e.g., Please review this field summary"
                rows={3}
                className="resize-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTEXT_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUserContext(suggestion)}
                    className="text-xs px-2 py-1 bg-muted rounded-full hover:bg-muted/80 transition-colors"
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
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Message Preview</h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    {isEditing ? "Preview" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerateMessage}
                    disabled={isGenerating}
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
                      <Label htmlFor="edit-subject" className="text-xs font-medium mb-1.5 block">
                        Subject Line
                      </Label>
                      <Input
                        id="edit-subject"
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="text-sm"
                        placeholder="Enter email subject"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="edit-message" className="text-xs font-medium mb-1.5 block">
                      Message Body
                    </Label>
                    <Textarea
                      id="edit-message"
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="resize-none text-sm"
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
                      <div className="mt-1 font-medium">{generatedMessage.subject}</div>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-xs text-farm-muted uppercase tracking-wide">
                      Message:
                    </span>
                    <div className="mt-1 whitespace-pre-wrap">
                      {generatedMessage.body}
                    </div>
                  </div>
                  <div className="text-xs text-farm-muted pt-2 border-t">
                    {generatedMessage.metadata.estimated_length}{" "}
                    {communicationMethod === "email" ? "words" : "characters"} •{" "}
                    Generated by {generatedMessage.metadata.generated_by === "ai" ? "AI" : "Template"}
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
                    Send Message
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {shareError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
              {shareError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

