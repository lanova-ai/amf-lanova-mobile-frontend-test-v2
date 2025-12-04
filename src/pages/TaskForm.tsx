import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { tasksAPI, fieldsAPI } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  due_date: string;
  related_field_id: string | null;
}

const TaskForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    related_field_id: null,
  });

  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTask, setLoadingTask] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFields();
    if (isEdit) {
      loadTask();
    }
  }, [id]);

  const loadFields = async () => {
    try {
      const response = await fieldsAPI.getFields();
      // Sort fields alphabetically by name
      const sortedFields = (response.fields || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setFields(sortedFields);
    } catch (error) {
      console.error("Error loading fields:", error);
    }
  };

  const loadTask = async () => {
    try {
      setLoadingTask(true);
      const task = await tasksAPI.getTask(id!);
      setFormData({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority || "medium",
        due_date: task.due_date || "",
        related_field_id: task.field_id || null,
      });
    } catch (error: any) {
      console.error("Error loading task:", error);
      toast.error("Failed to load task");
      navigate("/tasks");
    } finally {
      setLoadingTask(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 255) {
      newErrors.title = "Title must be less than 255 characters";
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.description = "Description must be less than 2000 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    try {
      setLoading(true);

      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        due_date: formData.due_date || null,
        related_field_id: formData.related_field_id,
      };

      if (isEdit) {
        await tasksAPI.updateTask(id!, payload);
        toast.success("Task updated successfully");
      } else {
        await tasksAPI.createTask(payload);
        toast.success("Task created successfully");
      }

      navigate("/tasks");
    } catch (error: any) {
      console.error("Error saving task:", error);
      toast.error(error.message || "Failed to save task");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof TaskFormData, value: string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loadingTask) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark overflow-y-auto scrollbar-hide">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/tasks")}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">
              {isEdit ? "Edit Task" : "Create Task"}
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Enter task title"
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter task description (optional)"
              rows={4}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
            <p className="text-xs text-farm-muted">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              className="w-full h-10 px-3 py-2 bg-farm-dark border border-input rounded-md text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="low">🟢 Low</option>
              <option value="medium">🟡 Medium</option>
              <option value="high">🟠 High</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <label htmlFor="due_date" className="text-sm font-medium">
              Due Date
            </label>
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => handleChange("due_date", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="bg-white dark:bg-white text-gray-900"
            />
            <p className="text-xs text-farm-muted">
              Optional: Set a deadline for this task
            </p>
          </div>

          {/* Related Field */}
          <div className="space-y-2">
            <label htmlFor="field" className="text-sm font-medium">
              Related Field
            </label>
            <select
              id="field"
              value={formData.related_field_id || ""}
              onChange={(e) =>
                handleChange("related_field_id", e.target.value || null)
              }
              className="w-full h-10 px-3 py-2 bg-farm-dark border border-input rounded-md text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">None</option>
              {fields.map((field) => (
                <option key={field.field_id} value={field.field_id}>
                  {field.name} ({field.farm_name || 'Unknown Farm'})
                </option>
              ))}
            </select>
            <p className="text-xs text-farm-muted">
              Optional: Link this task to a specific field
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/tasks")}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>{isEdit ? "Update Task" : "Create Task"}</>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default TaskForm;

