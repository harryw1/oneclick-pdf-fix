#!/usr/bin/env node

/**
 * Utility script to extract the Google Cloud project ID from a service account JSON file.
 * 
 * Usage:
 *   node scripts/get-project-id.js path/to/service-account.json
 *   
 * This helps users identify their project ID for creating the GCS bucket.
 */

const fs = require('fs');
const path = require('path');

/**
 * Returns the Google Cloud project ID from a service account JSON file.
 * @param {string} jsonPath Path to the service account JSON file.
 * @returns {string} The project ID.
 */
function getProjectIdFromServiceAccount(jsonPath) {
  try {
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Service account file not found: ${jsonPath}`);
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!data.project_id) {
      throw new Error('No project_id found in service account JSON file');
    }
    
    return data.project_id;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Service account file not found: ${jsonPath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in service account file: ${jsonPath}`);
    }
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.error('Usage: node scripts/get-project-id.js <path-to-service-account.json>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/get-project-id.js ./my-service-account.json');
    process.exit(1);
  }
  
  const jsonPath = path.resolve(args[0]);
  
  try {
    const projectId = getProjectIdFromServiceAccount(jsonPath);
    console.log('Google Cloud Project ID:', projectId);
    console.log('');
    console.log('Create your GCS bucket with:');
    console.log(`  gsutil mb -p ${projectId} gs://${projectId}-pdf-processing`);
    console.log('');
    console.log('Or using the Google Cloud Console:');
    console.log('  https://console.cloud.google.com/storage/browser');
    console.log(`  Bucket name: ${projectId}-pdf-processing`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { getProjectIdFromServiceAccount };