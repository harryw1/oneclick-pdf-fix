import Head from 'next/head';
import { Check, Zap } from 'lucide-react';

export default function PricingPage() {
  return (
    <>
      <Head>
        <title>Pricing - OneClick PDF Fixer</title>
        <meta name="description" content="Choose your plan for unlimited PDF processing" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <a href="/" className="text-2xl font-bold text-gray-900">OneClick PDF Fixer</a>
              <a href="/dashboard" className="btn-primary">Dashboard</a>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
            <p className="text-xl text-gray-600">Start free, upgrade when you need more</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Free</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-gray-500">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>10 pages per week</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Basic PDF processing</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Auto-rotation & compression</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Instant download</span>
                </li>
              </ul>
              
              <button className="w-full btn-secondary">
                Get Started Free
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-primary-600 rounded-lg shadow-lg p-8 text-white relative">
              <div className="absolute top-4 right-4">
                <span className="bg-primary-500 text-xs font-bold px-2 py-1 rounded">POPULAR</span>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold">Pro</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$4</span>
                  <span className="text-primary-200">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-200 mr-3" />
                  <span>Unlimited pages</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-200 mr-3" />
                  <span>Advanced OCR & deskewing</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-200 mr-3" />
                  <span>90-day document storage</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-primary-200 mr-3" />
                  <span>Priority processing</span>
                </li>
                <li className="flex items-center">
                  <Zap className="h-5 w-5 text-primary-200 mr-3" />
                  <span>Batch processing</span>
                </li>
              </ul>
              
              <button className="w-full bg-white text-primary-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}