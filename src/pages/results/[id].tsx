import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  CheckCircle2, 
  Upload,
  BarChart3,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface ProcessedPDF {
  id: string;
  originalName: string;
  processedUrl: string;
  downloadUrl: string;
  pageCount: number;
  fileSize: number;
  processedAt: Date;
  options: { ocr?: boolean; deskew?: boolean; [key: string]: unknown };
  documentType?: string;
}

export default function ResultsPage() {
  const [result, setResult] = useState<ProcessedPDF | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { id } = router.query;
  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndResult = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }

      // Check if result exists in processing history
      const processingId = Array.isArray(id) ? id[0] : id;
      
      if (!processingId) {
        setError('Invalid processing ID');
        setLoading(false);
        return;
      }

      try {
        const { data: historyRecord } = await supabase
          .from('processing_history')
          .select('*')
          .eq('processing_id', processingId)
          .eq('user_id', session.user.id)
          .single();

        if (!historyRecord || historyRecord.status !== 'completed') {
          setError('Processing record not found or incomplete');
          setLoading(false);
          return;
        }

        // Construct result object from history
        const processedResult: ProcessedPDF = {
          id: processingId,
          originalName: historyRecord.original_filename,
          processedUrl: '', // Not stored for security
          downloadUrl: `/api/download/${processingId}`,
          pageCount: historyRecord.page_count,
          fileSize: historyRecord.file_size_bytes,
          processedAt: new Date(historyRecord.completed_at),
          options: historyRecord.processing_options,
          documentType: historyRecord.processing_options?.documentType
        };

        setResult(processedResult);
      } catch (err) {
        console.error('Error fetching result:', err);
        setError('Failed to load processing results');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      checkAuthAndResult();
    }
  }, [id, router, supabase]);

  if (loading) {
    return (
      <Layout title="Loading Results - OneClick PDF Fixer">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  if (error || !result) {
    return (
      <Layout title="Results Not Found - OneClick PDF Fixer">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-4">Results Not Found</h1>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="space-x-3">
                <Button asChild>
                  <Link href="/upload">Upload New PDF</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title={`Results: ${result.originalName} - OneClick PDF Fixer`}
      description="Your processed PDF is ready for download"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Processing Complete!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your PDF has been successfully processed and optimized.
          </p>
        </div>

        {/* Download Card */}
        <Card className="mb-8 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-green-600" />
              <span>{result.originalName}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {result.pageCount} pages • {(result.fileSize / (1024 * 1024)).toFixed(1)} MB
                  {result.documentType && ` • ${result.documentType}`}
                </p>
                <div className="flex space-x-2">
                  <Badge variant="success">Processed</Badge>
                  <Badge variant="success">Compressed</Badge>
                  <Badge variant="success">Optimized</Badge>
                  {result.documentType && <Badge variant="outline">Classified</Badge>}
                  {result.options?.ocr && <Badge variant="outline">OCR</Badge>}
                  {result.options?.deskew && <Badge variant="outline">Deskewed</Badge>}
                </div>
              </div>
              <Button asChild size="lg" className="shadow-lg">
                <a href={result.downloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processing Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Processing Applied</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Auto-rotation detection</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>File size optimization</span>
                </li>
                {result.options?.deskew && (
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Skew correction</span>
                  </li>
                )}
                {result.options?.ocr && (
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Text extraction (OCR)</span>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">File Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pages:</span>
                  <span className="font-medium">{result.pageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size:</span>
                  <span className="font-medium">{(result.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
                {result.documentType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Document Type:</span>
                    <span className="font-medium">{result.documentType}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processed:</span>
                  <span className="font-medium">{new Date(result.processedAt).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="flex-1">
            <Link href="/upload">
              <Upload className="h-4 w-4 mr-2" />
              Process Another PDF
            </Link>
          </Button>
          <Button variant="outline" asChild size="lg" className="flex-1">
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              View All Results
            </Link>
          </Button>
        </div>

        {/* Security Note */}
        <Card className="mt-8 bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800 text-center">
              🔒 Your processed file will be automatically deleted from our servers within 24 hours for security.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}