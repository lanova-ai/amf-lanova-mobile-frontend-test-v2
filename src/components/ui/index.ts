/**
 * Centralized UI Component Library
 * Import all theme-aware components from here
 */

// Layout Components
export { Page, PageHeader, PageContent, PageLoading } from "./page";
export { Section, SectionGroup } from "./section";

// Loading Components
export { LoadingSpinner, LoadingOverlay, LoadingButton } from "./loading";

// Form Components
export { FormField, TextareaField, SelectField } from "./form-field";

// List Components
export { ListItem, ListContainer } from "./list-item";

// State Components
export { EmptyState } from "./empty-state";

// Existing shadcn components (re-exported for convenience)
export { Button } from "./button";
export { Input } from "./input";
export { Label } from "./label";
export { Textarea } from "./textarea";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
export { Badge } from "./badge";
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

