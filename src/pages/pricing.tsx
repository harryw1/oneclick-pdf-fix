import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { GetServerSideProps } from 'next';

export default function PricingPage() {
  const [user, setUser] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        setAuthToken(session.access_token);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          setAuthToken(session.access_token);
        } else {
          setUser(null);
          setAuthToken(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleUpgrade = async () => {
    if (!user || !authToken) {
      // Redirect to sign in
      window.location.href = '/dashboard';
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ action: 'create_checkout' })
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to start checkout process');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout process');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      description: 'Perfect for occasional use',
      features: [
        '10 pages per week',
        'Basic PDF processing',
        'Auto-rotation & compression',
        'Instant download',
        'Email support'
      ],
      cta: 'Get Started Free',
      popular: false
    },
    {
      name: 'Pro',
      price: 4,
      description: 'For power users and professionals',
      features: [
        'Unlimited pages',
        'Advanced OCR & deskewing',
        '90-day document storage',
        'Priority processing',
        'Batch processing',
        'API access',
        'Priority support'
      ],
      cta: 'Upgrade to Pro',
      popular: true
    }
  ];

  return (
    <>
      <Head>
        <title>Pricing - OneClick PDF Fixer</title>
        <meta name="description" content="Choose your plan for unlimited PDF processing" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50">
        <header className="glass-effect border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <a href="/" className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  OneClick PDF Fixer
                </a>
              </div>
              <Button asChild>
                <a href="/dashboard">Dashboard</a>
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16 animate-fade-in">
            <Badge variant="secondary" className="mb-6">
              Simple, transparent pricing
            </Badge>
            <h1 className="text-5xl font-bold text-foreground mb-4">Choose Your Plan</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you need more. No hidden fees, cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={plan.name} className={cn(
                "relative overflow-hidden transition-all duration-300 hover:shadow-xl animate-slide-up",
                plan.popular && "ring-2 ring-primary scale-105 shadow-2xl"
              )} style={{ animationDelay: `${index * 200}ms` }}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-primary-500 to-primary-600 text-white text-xs font-bold px-4 py-2 rounded-bl-lg">
                    <div className="flex items-center space-x-1">
                      <Zap className="h-3 w-3" />
                      <span>MOST POPULAR</span>
                    </div>
                  </div>
                )}
                
                <CardHeader className={cn(
                  "text-center pb-8",
                  plan.popular && "bg-gradient-to-b from-primary-500/5 to-transparent"
                )}>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground ml-1">/month</span>
                  </div>
                  <p className="text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-4">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Check className="h-5 w-5 text-green-500" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    onClick={plan.popular ? handleUpgrade : () => window.location.href = '/dashboard'}
                    disabled={loading}
                    className={cn(
                      "w-full h-12 text-base font-semibold transition-all duration-200",
                      plan.popular && "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg hover:shadow-xl"
                    )}
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {loading && plan.popular ? 'Loading...' : plan.cta}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-8">Frequently Asked Questions</h3>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <Card className="animate-slide-up" style={{ animationDelay: '400ms' }}>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-2">Is my data secure?</h4>
                  <p className="text-sm text-muted-foreground">
                    Yes! All uploads are processed securely and deleted after processing. Pro users get 90-day storage with encrypted backups.
                  </p>
                </CardContent>
              </Card>
              
              <Card className="animate-slide-up" style={{ animationDelay: '500ms' }}>
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-2">Can I cancel anytime?</h4>
                  <p className="text-sm text-muted-foreground">
                    Absolutely! Cancel your Pro subscription anytime. You'll retain Pro features until the end of your billing period.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Force client-side rendering to avoid build issues with Supabase
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};