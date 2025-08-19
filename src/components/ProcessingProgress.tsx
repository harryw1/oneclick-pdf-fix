import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ProcessingOperation {
  id: string;
  processing_id: string;
  operation_type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  current_page: number;
  total_pages: number;
  metadata?: any;
  last_updated?: string;
  operation_id?: string;
}

interface QueueItem {
  id: string;
  processing_id: string;
  original_filename: string;
  status: 'queued' | 'processing';
  priority: number;
  created_at: string;
  queue_position?: number;
  estimated_wait_time?: number;
}

interface ProcessingStatusData {
  active_operations: ProcessingOperation[];
  queue_items: QueueItem[];
  processing_items: QueueItem[];
  summary: {
    total_active: number;
    total_queued: number;
    total_processing: number;
    estimated_total_wait: number;
  };
}

interface ProcessingProgressProps {
  authToken: string | null;
  onStatusChange?: (hasActiveProcessing: boolean) => void;
}

export default function ProcessingProgress({ authToken, onStatusChange }: ProcessingProgressProps) {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusData | null>(null);
  // const [isLoading, setIsLoading] = useState(false); // For future use
  // const [error, setError] = useState<string | null>(null); // For future use

  // Fetch processing status
  const fetchProcessingStatus = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('/api/processing-status', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProcessingStatus(data.data);
        
        // Notify parent about processing status
        const hasActiveProcessing = data.data.summary.total_active > 0 || data.data.summary.total_processing > 0;
        onStatusChange?.(hasActiveProcessing);
      } else {
        console.error('Failed to fetch processing status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching processing status:', error);
    }
  };

  // Auto-refresh processing status
  useEffect(() => {
    if (!authToken) return;

    fetchProcessingStatus();
    
    // Set up polling interval - more frequent when there's active processing
    const hasActiveWork = processingStatus && (
      processingStatus.summary.total_active > 0 || 
      processingStatus.summary.total_processing > 0 ||
      processingStatus.summary.total_queued > 0
    );
    
    const interval = setInterval(fetchProcessingStatus, hasActiveWork ? 3000 : 10000); // 3s when active, 10s when idle
    
    return () => clearInterval(interval);
  }, [authToken]); // Removed processingStatus dependency to avoid infinite loops

  // Don't render if no processing activity
  if (!processingStatus || (
    processingStatus.summary.total_active === 0 && 
    processingStatus.summary.total_processing === 0 &&
    processingStatus.summary.total_queued === 0
  )) {
    return null;
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getOperationIcon = (operation: ProcessingOperation) => {
    switch (operation.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'running':
      default:
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-0">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <h3 className="text-lg font-medium text-foreground">Processing Status</h3>
            </div>
            {processingStatus.summary.estimated_total_wait > 0 && (
              <Badge variant="outline" className="bg-blue-50">
                ~{formatDuration(processingStatus.summary.estimated_total_wait)} remaining
              </Badge>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Active Operations */}
          {processingStatus.active_operations.map((operation) => (
            <div key={operation.id} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-blue-100/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getOperationIcon(operation)}
                  <span className="font-medium text-foreground">
                    {operation.metadata?.stage || operation.operation_type}
                  </span>
                  <Badge className={getStatusColor(operation.status)}>
                    {operation.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {operation.progress_percent}%
                </span>
              </div>

              <Progress value={operation.progress_percent} className="mb-2" />
              
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {operation.metadata?.message || `Processing page ${operation.current_page}/${operation.total_pages}`}
                </span>
                {operation.last_updated && (
                  <span>
                    Updated {new Date(operation.last_updated).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Processing Items */}
          {processingStatus.processing_items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-green-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
                  <span className="font-medium text-foreground">{item.original_filename}</span>
                  <Badge className="bg-green-100 text-green-800">Processing</Badge>
                  {item.priority === 1 && (
                    <Badge className="bg-purple-100 text-purple-800">Priority</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  Started {new Date(item.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {/* Queue Items */}
          {processingStatus.queue_items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 bg-gradient-to-r from-yellow-50 to-yellow-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-foreground">{item.original_filename}</span>
                  <Badge className="bg-yellow-100 text-yellow-800">
                    #{item.queue_position} in queue
                  </Badge>
                  {item.priority === 1 && (
                    <Badge className="bg-purple-100 text-purple-800">Priority</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  ~{item.estimated_wait_time ? formatDuration(item.estimated_wait_time) : 'calculating...'}
                </span>
              </div>
            </div>
          ))}

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{processingStatus.summary.total_active}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{processingStatus.summary.total_processing}</div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{processingStatus.summary.total_queued}</div>
              <div className="text-sm text-muted-foreground">Queued</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}