import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { tasksAPI } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string;
  created_at: string;
  completed_at?: string;
  field_name?: string;
  field_id?: string;
  source_type?: string;
  source_id?: string;
  notes?: string;
}

const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadTask();
  }, [id]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getTask(id!);
      setTask(response);
    } catch (error: any) {
      console.error("Error loading task:", error);
      toast.error("Failed to load task");
      navigate("/tasks");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-500';
      case 'in_progress':
        return 'text-blue-500';
      case 'pending':
        return 'text-yellow-500';
      case 'cancelled':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isOverdue = () => {
    if (!task?.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const handleToggleComplete = async () => {
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await tasksAPI.updateTask(task.id, { status: newStatus });
      setTask({ ...task, status: newStatus });
      toast.success(newStatus === 'completed' ? "Task completed!" : "Task reopened");
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await tasksAPI.deleteTask(task.id);
      toast.success("Task deleted successfully");
      navigate("/tasks");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const handleEdit = () => {
    navigate(`/tasks/${id}/edit`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-farm-dark flex items-center justify-center">
        <p className="text-farm-muted">Task not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-farm-dark overflow-y-auto scrollbar-hide">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-farm-dark border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/tasks")}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Task Details</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-6 space-y-6">
        {/* Title and Priority */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{getPriorityIcon(task.priority)}</span>
            <h2 className={`text-2xl font-bold flex-1 ${task.status === 'completed' ? 'line-through text-farm-muted' : ''}`}>
              {task.title}
            </h2>
          </div>
          
          {/* Field Badge */}
          {task.field_name && (
            <div className="mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-sm font-medium">
                🌾 {task.field_name}
              </span>
            </div>
          )}

          {/* Status and Priority Row */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-farm-muted">Priority:</span>
              <span className="font-medium capitalize">{task.priority}</span>
            </div>
            <span className="text-farm-muted">•</span>
            <div className="flex items-center gap-2">
              <span className="text-farm-muted">Status:</span>
              <span className={`font-medium capitalize ${getStatusColor(task.status)}`}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
            {isOverdue() && (
              <>
                <span className="text-farm-muted">•</span>
                <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full animate-pulse">
                  OVERDUE
                </span>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-farm-muted mb-2">Description</h3>
            <p className="text-foreground leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-farm-muted mb-2 flex items-center gap-2">
              📅 Created
            </h3>
            <p className="text-foreground">{formatDate(task.created_at)}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-farm-muted mb-2 flex items-center gap-2">
              📋 Due Date
            </h3>
            <p className={`${isOverdue() ? 'text-destructive font-medium' : 'text-foreground'}`}>
              {formatDate(task.due_date)}
            </p>
          </div>

          {task.completed_at && (
            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-medium text-farm-muted mb-2 flex items-center gap-2">
                ✅ Completed
              </h3>
              <p className="text-foreground">{formatDate(task.completed_at)}</p>
            </div>
          )}
        </div>

        {/* Source Information */}
        {task.source_type && task.source_type !== 'manual' && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-farm-muted mb-2 flex items-center gap-2">
              📄 Source
            </h3>
            {task.source_type === 'voice_note' && task.source_id ? (
              <button
                onClick={() => navigate(`/recordings/${task.source_id}`)}
                className="text-primary hover:underline text-left"
              >
                🎤 Voice Note (Click to view)
              </button>
            ) : task.source_type === 'observation' && task.source_id ? (
              <button
                onClick={() => navigate(`/field-observation/${task.source_id}`)}
                className="text-primary hover:underline text-left"
              >
                📝 Field Note (Click to view)
              </button>
            ) : (
              <p className="text-foreground">
                {task.source_type === 'observation' ? '📝 Field Notes Derived' : 
                 task.source_type === 'voice_note' ? '🎤 Voice Notes Derived' : 
                 task.source_type.replace('_', ' ')}
              </p>
            )}
          </div>
        )}

        {/* Additional Notes */}
        {task.notes && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-farm-muted mb-2 flex items-center gap-2">
              📝 Additional Notes
            </h3>
            <p className="text-foreground leading-relaxed">{task.notes}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4">
          <Button
            onClick={handleToggleComplete}
            className="w-full h-14 text-base font-semibold"
            variant={task.status === 'completed' ? 'outline' : 'default'}
          >
            {task.status === 'completed' ? (
              <>
                <Circle className="mr-2 h-5 w-5" />
                Reopen Task
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Mark as Complete
              </>
            )}
          </Button>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="mb-3">
                Are you sure you want to delete <span className="font-semibold">"{task.title}"</span>?
              </div>
              <div className="text-sm">
                This action cannot be undone.
                {task.source_type === 'voice_note' && (
                  <span className="block mt-2 text-blue-600">
                    Note: The original voice note will remain unchanged.
                  </span>
                )}
                {task.source_type === 'observation' && (
                  <span className="block mt-2 text-blue-600">
                    Note: The original field note will remain unchanged.
                  </span>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskDetail;

