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
import { contactsAPI, shareScoutingSummariesAPI, scoutingNotesAPI, ShareMessageResponse } from "@/lib/api";
import type { Contact, ScoutingNote } from "@/lib/api";
import { toast } from "sonner";
import { FEATURES } from "@/config/features";

const CONTEXT_SUGGESTIONS = [
  "Please review this scouting report",
  "Looking for your recommendations",
  "Need feedback on field conditions",
  "Requesting your professional input",
  "Share for your records",
];

export default function ShareScoutingSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get note ID from URL
  const noteId = searchParams.get("noteId") || "";
  
  // Scouting note data
  const [note, setNote] = useState<ScoutingNote | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);
  
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

  // Load scouting note and contacts on mount
  useEffect(() => {
    if (!noteId) {
      toast.error("Missing scouting note information");
      navigate("/scouting-notes");
      return;
    }
    loadNote();
    loadContacts();
  }, []);

  const loadNote = async () => {
    try {
      setLoadingNote(true);
      const data = await scoutingNotesAPI.getScoutingNote(noteId);
      setNote(data);
    } catch (err) {
      console.error("Error loading scouting note:", err);
      toast.error("Failed to load scouting note");
      setShareError("Failed to load scouting note data");
    } finally {
      setLoadingNote(false);
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

    if (!note) {
      setShareError("Scouting note data not loaded");
      return;
    }

    try {
      setIsGenerating(true);
      setShareError("");

      const response = await shareScoutingSummariesAPI.generateMessage({
        note_id: noteId,
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

      await shareScoutingSummariesAPI.shareScoutingSummary({
        note_id: noteId,
        contact_ids: [selectedContact],
        communication_method: communicationMethod,
        message: messageToSend,
        share_link: generatedMessage.share_link,
      });

      toast.success("Scouting summary shared successfully!");
      navigate("/scouting-notes?tab=shared");
    } catch (err: any) {
      console.error("Error sending message:", err);
      setShareError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const selectedContactData = contacts.find((c) => c.id === selectedContact);

  if (loadingNote) {
    return (
      <div className="min-h-screen flex items-center justify-center page-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="body-text">Loading scouting note...</p>
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
              <h2 className="font-semibold">Share Scouting Summary</h2>
              {note && (
                <p className="text-xs text-farm-muted">
                  {note.field_name} • {new Date(note.scouting_date).toLocaleDateString()} • 
                  {note.issues_detected?.length || 0} issues detected
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
                <UserPlus className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-sm">No Contacts Found</h4>
                  <p className="text-sm text-farm-muted">
                    You need to add at least one contact before you can share. Add agronomists, advisors, or other contacts to your network.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate("/settings/contacts/new")}
                    className="mt-2"
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
                  variant="outline"
                  onClick={() => setCommunicationMethod("email")}
                  className={`flex-1 ${
                    communicationMethod === "email" 
                      ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark border-farm-accent" 
                      : "border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  }`}
                  disabled={selectedContactData && !selectedContactData.email}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCommunicationMethod("sms")}
                  className={`flex-1 ${
                    communicationMethod === "sms" 
                      ? "bg-farm-accent hover:bg-farm-accent/90 text-farm-dark border-farm-accent" 
                      : "border-farm-accent/20 text-farm-accent hover:bg-farm-accent/10"
                  }`}
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
                placeholder="e.g., Please review this scouting report"
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
            <div className="border border-farm-accent/20 bg-farm-card rounded-lg p-4 space-y-4">
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

