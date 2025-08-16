import Head from 'next/head';
import { FileText, Calendar, Download } from 'lucide-react';

export default function DashboardPage() {
  return (
    <>
      <Head>
        <title>Dashboard - OneClick PDF Fixer</title>
        <meta name="description" content="Manage your PDF processing history and account" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <a href="/" className="text-2xl font-bold text-gray-900">OneClick PDF Fixer</a>
              <div className="flex space-x-4">
                <a href="/pricing" className="btn-secondary">Pricing</a>
                <button className="btn-primary">Sign Out</button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Manage your PDF processing history</p>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-primary-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pages This Week</p>
                  <p className="text-2xl font-bold text-gray-900">3 / 10</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Plan</p>
                  <p className="text-2xl font-bold text-gray-900">Free</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Download className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Processed</p>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Files */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Files</h2>
            </div>
            
            <div className="p-6">
              <div className="text-center text-gray-500 py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No files processed yet</p>
                <a href="/" className="btn-primary mt-4 inline-block">
                  Process Your First PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}