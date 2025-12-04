import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Calendar, MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { tasksAPI, fieldsAPI } from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Tasks = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, completed: 0, total: 0 });
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Filters
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [fields, setFields] = useState<any[]>([]);

  // Fetch tasks and fields from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tasksResponse, fieldsResponse] = await Promise.all([
          tasksAPI.getTasks({ limit: 100 }),
          fieldsAPI.getFields(),
        ]);
        
        setTasks(tasksResponse.tasks || []);
        // Sort fields alphabetically by name
        const sortedFields = (fieldsResponse.fields || []).sort((a: any, b: any) => 
          (a.name || '').localeCompare(b.name || '')
        );
        setFields(sortedFields);

        const tasksList = tasksResponse.tasks || [];
        const activeCount = tasksList.filter((t: any) =>
          t.status !== 'completed' && t.status !== 'cancelled'
        ).length;
        const completedCount = tasksList.filter((t: any) =>
          t.status === 'completed'
        ).length;

        setStats({
          active: activeCount,
          completed: completedCount,
          total: tasksResponse.total || tasksList.length
        });
      } catch (error: any) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location.key]); // Reload when navigating back to this page

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await tasksAPI.updateTask(taskId, { status: newStatus });

      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      const activeCount = tasks.filter(t =>
        (t.id === taskId ? newStatus !== 'completed' : t.status !== 'completed' && t.status !== 'cancelled')
      ).length;
      const completedCount = tasks.filter(t =>
        (t.id === taskId ? newStatus === 'completed' : t.status === 'completed')
      ).length;

      setStats({ ...stats, active: activeCount, completed: completedCount });
      toast.success(newStatus === 'completed' ? "Task completed!" : "Task reopened");
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  const filteredTasks = tasks
    .filter((task) => {
      // Status filter
      if (filter === "active" && (task.status === 'completed' || task.status === 'cancelled')) return false;
      if (filter === "completed" && task.status !== 'completed') return false;
      
      // Priority filter
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      
      // Field filter
      if (fieldFilter !== "all" && task.field_id !== fieldFilter) return false;
      
      return true;
    })
    .sort((a, b) => {
      // Default sort by due date
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

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

  const getPriorityText = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const isOverdue = (task: any) => {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString();
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    
    try {
      await tasksAPI.deleteTask(taskToDelete.id);
      setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete.id));
      
      // Update stats
      const activeCount = stats.active - (taskToDelete.status !== 'completed' ? 1 : 0);
      const completedCount = stats.completed - (taskToDelete.status === 'completed' ? 1 : 0);
      setStats({ active: activeCount, completed: completedCount, total: stats.total - 1 });
      
      toast.success("Task deleted successfully");
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    } finally {
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    }
  };

  const handleViewDetails = (taskId: string) => {
    navigate(`/tasks/${taskId}`);
  };

  const handleEditTask = (taskId: string) => {
    navigate(`/tasks/${taskId}/edit`);
  };


  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-hide page-background">
      <div className="min-h-full flex flex-col">
        {/* Status Filter Tabs */}
        <div className="px-4 pt-4 pb-3 border-b bg-farm-dark/95 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-farm-muted hover:bg-muted/80"
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === "completed"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-farm-muted hover:bg-muted/80"
              }`}
            >
              Completed ({stats.completed})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-farm-muted hover:bg-muted/80"
              }`}
            >
              All ({stats.total})
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-4 border-b bg-farm-dark/95 backdrop-blur sticky top-14 z-10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {priorityFilter === "all" && "All Priorities"}
                  {priorityFilter === "urgent" && "🔴 Urgent"}
                  {priorityFilter === "high" && "🟠 High"}
                  {priorityFilter === "medium" && "🟡 Medium"}
                  {priorityFilter === "low" && "🟢 Low"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">🔴 Urgent</SelectItem>
                <SelectItem value="high">🟠 High</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Field Filter */}
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {fieldFilter === "all" ? "All Fields" : fields.find(f => f.field_id === fieldFilter)?.name || "All Fields"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                {fields.map((field) => (
                  <SelectItem key={field.field_id} value={field.field_id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <p className="label-text text-center">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found
          </p>
        </div>

        {/* Tasks List */}
        <main className="flex-1 px-4 py-4">
          {loading ? (
            <div className="text-center py-12 space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="body-text">Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="text-6xl">✅</div>
              <div className="space-y-2">
                <h3 className="section-heading">No {filter} tasks</h3>
                <p className="body-text max-w-sm mx-auto">
                  {filter === "active" && "You're all caught up!"}
                  {filter === "completed" && "No completed tasks yet"}
                  {filter === "all" && "No tasks found"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleViewDetails(task.id)}
                  className="card-interactive"
                >
              <div className="flex items-start gap-3">
                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`font-semibold flex-1 ${task.status === 'completed' ? 'line-through text-farm-muted' : ''}`}>
                      {task.title}
                    </h3>
                    {isOverdue(task) && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full animate-pulse">
                        OVERDUE
                      </span>
                    )}
                  </div>

                  {/* Field Name & Status - Same Line */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {task.field_name && (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          📍 {task.field_name}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    
                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5">
                      <div 
                        className={`w-2 h-2 rounded-full ${
                          task.status === 'completed' 
                            ? 'bg-green-500' 
                            : task.status === 'in_progress'
                            ? 'bg-blue-500'
                            : task.status === 'cancelled'
                            ? 'bg-gray-400'
                            : task.status === 'draft'
                            ? 'bg-orange-500'
                            : isOverdue(task)
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                        }`}
                      />
                      <span className="text-xs text-farm-muted capitalize">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    {task.source_type === 'voice_note' && (
                      <span className="text-xs text-farm-muted">
                        🎤 Voice Note
                      </span>
                    )}
                    {task.source_type === 'observation' && (
                      <span className="text-xs text-farm-muted">
                        📝 Field Notes
                      </span>
                    )}
                    {task.due_date && (
                      <span className={`text-xs flex items-center gap-1 ${isOverdue(task) ? 'text-destructive font-medium' : 'text-farm-muted'}`}>
                        <Calendar className="h-3 w-3" />
                        {formatDueDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Three-Dot Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <MoreVertical className="h-5 w-5 text-farm-muted" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(task.id);
                    }}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleEditTask(task.id);
                    }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    {task.status !== 'completed' && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task.id, task.status);
                      }}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaskToDelete(task);
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* FAB Action Button */}
      <button
        onClick={() => navigate("/tasks/new")}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all z-20 flex items-center justify-center"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete && (
                <>
                  <div className="mb-3">
                    Are you sure you want to delete <span className="font-semibold">"{taskToDelete.title}"</span>?
                  </div>
                  <div className="text-sm">
                    This action cannot be undone.
                    {taskToDelete.source_type === 'voice_note' && (
                      <span className="block mt-2 text-blue-600">
                        Note: The original voice note will remain unchanged.
                      </span>
                    )}
                    {taskToDelete.source_type === 'observation' && (
                      <span className="block mt-2 text-blue-600">
                        Note: The original field note will remain unchanged.
                      </span>
                    )}
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
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

export default Tasks;
