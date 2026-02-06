
import { JsonArticleRepository } from './database/json-repository';

async function migrateData() {
  console.log('Migrating data to new date format...');
  const repo = new JsonArticleRepository();
  
  // We need to access the internal read/write logic, but they are private/local.
  // However, we can use a trick: read all articles (public method doesn't exist to get all, but we can add one or use a workaround).
  // Wait, JsonArticleRepository doesn't have a getAll method.
  
  // But we can define the readJson/writeJson functions here again since they are just file operations.
  // Or better, let's just add a temporary method to JsonArticleRepository or just use fs directly here.
}

// Actually, simpler approach:
// Just read the file, parse it (Date objects will be created if ISO), then write it back using the NEW logic we just added to the repository?
// No, I can't call the repository's writeJson because it's not exported.

// I should add a method to JsonArticleRepository to force save all, or just use fs here to read, 
// convert dates to YYYY-MM-DD strings, and write back.

import * as fs from 'fs';
import * as path from 'path';

const ARTICLES_FILE = path.join(process.cwd(), 'data', 'articles.json');
const LOGS_FILE = path.join(process.cwd(), 'data', 'logs.json');

function formatDate(date: any): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function processFile(file: string) {
  if (!fs.existsSync(file)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  const content = fs.readFileSync(file, 'utf-8');
  const data = JSON.parse(content);
  
  // Recursively format dates
  function formatRecursive(obj: any): any {
    if (typeof obj === 'string') {
      // Check if it looks like an ISO date
      if (/^\d{4}-\d{2}-\d{2}T/.test(obj)) {
        return formatDate(obj);
      }
    }
    
    if (Array.isArray(obj)) {
      return obj.map(formatRecursive);
    }
    
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = formatRecursive(obj[key]);
      }
    }
    return obj;
  }
  
  const newData = formatRecursive(data);
  fs.writeFileSync(file, JSON.stringify(newData, null, 2));
  console.log(`Updated ${file}`);
}

processFile(ARTICLES_FILE);
processFile(LOGS_FILE);
