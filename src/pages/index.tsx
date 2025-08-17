import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RotateCcw, 
  Minimize2, 
  Sparkles, 
  Star,
  Upload,
  Eye,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const features = [
  {
    icon: RotateCcw,
    title: 'Auto-Rotation',
    description: 'Automatically detects and fixes sideways or upside-down pages',
    color: 'text-blue-500'
  },
  {
    icon: Minimize2,
    title: 'Smart Compression',
    description: 'Reduces file size while maintaining document quality',
    color: 'text-green-500'
  },
  {
    icon: Eye,
    title: 'Skew Correction',
    description: 'Straightens crooked scans for professional appearance',
    color: 'text-purple-500'
  },
  {
    icon: Sparkles,
    title: 'OCR & Classification',
    description: 'Advanced text extraction and document analysis',
    color: 'text-orange-500'
  }
];

const benefits = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Most documents processed in under 30 seconds with enterprise-grade infrastructure.'
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your documents are encrypted in transit and automatically deleted after processing.'
  },
  {
    icon: Sparkles,
    title: 'AI-Powered',
    description: 'Advanced machine learning algorithms detect and fix document issues automatically.'
  }
];

export default function HomePage() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <Layout 
      title="OneClick PDF Fixer - Professional Document Processing"
      description="Transform poorly scanned documents into professional, readable PDFs with AI-powered processing"
    >
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="h-4 w-4" />
            <span>Professional PDF Processing</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Transform Poor Scans Into{' '}
            <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
              Perfect PDFs
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Advanced AI technology automatically corrects orientation, removes skew, and optimizes quality. 
            Turn unusable scanned documents into professional, readable PDFs in seconds.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Button asChild size="lg" className="shadow-lg px-8 py-4 text-lg">
                <Link href="/upload">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload PDF to Process
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="shadow-lg px-8 py-4 text-lg">
                <Link href="/auth">
                  Get Started Free
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            )}
            <Button variant="outline" size="lg" asChild className="px-8 py-4 text-lg">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
          
          {!user && (
            <p className="text-sm text-muted-foreground mt-4">
              Start with 5 pages per week • No credit card required
            </p>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={feature.title} className="group hover:shadow-lg transition-all duration-300 animate-slide-up border-0 bg-white/80 backdrop-blur-sm" style={{ animationDelay: `${index * 100}ms` }}>
              <CardContent className="p-6 text-center">
                <feature.icon className={cn("h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110", feature.color)} />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div key={benefit.title} className="text-center animate-slide-up" style={{ animationDelay: `${index * 200}ms` }}>
              <div className="mx-auto mb-4 h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
                <benefit.icon className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Use Cases */}
        <Card className="bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200">
          <CardContent className="p-8 sm:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">Perfect For</h2>
              <p className="text-lg text-muted-foreground">Common document processing challenges</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                'Sideways scanned receipts',
                'Crooked legal documents', 
                'Blurry business contracts',
                'Rotated insurance forms',
                'Skewed invoices',
                'Oversized presentation slides'
              ].map((useCase) => (
                <div key={useCase} className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium">{useCase}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Fix Your PDFs?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who trust OneClick PDF Fixer for their document processing needs.
          </p>
          
          {user ? (
            <Button asChild size="lg" className="shadow-lg px-8 py-4 text-lg">
              <Link href="/upload">
                Start Processing
                <ArrowRight className="h-5 w-5 ml-2" />
              </Link>
            </Button>
          ) : (
            <div className="space-y-4">
              <Button asChild size="lg" className="shadow-lg px-8 py-4 text-lg">
                <Link href="/auth">
                  Create Free Account
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
              <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
                <span>✓ No setup required</span>
                <span>✓ Instant results</span>
                <span>✓ Secure processing</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}