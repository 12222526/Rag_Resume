import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import { promisify } from 'util';

const openZip = promisify(yauzl.open);

export async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

export async function parseTextFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      text: content,
      pages: 1,
      info: {}
    };
  } catch (error) {
    throw new Error(`Failed to parse text file: ${error.message}`);
  }
}

export async function extractZipFiles(zipPath, extractPath) {
  const extractedFiles = [];
  
  try {
    const zipfile = await openZip(zipPath, { lazyEntries: true });
    
    return new Promise((resolve, reject) => {
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          zipfile.readEntry();
          return;
        }
        
        zipfile.openReadStream(entry, async (err, readStream) => {
          if (err) {
            reject(err);
            return;
          }
          
          const fileName = path.basename(entry.fileName);
          const filePath = path.join(extractPath, fileName);
          
          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          const writeStream = fs.createWriteStream(filePath);
          
          readStream.pipe(writeStream);
          
          writeStream.on('finish', () => {
            extractedFiles.push({
              name: fileName,
              path: filePath,
              originalPath: entry.fileName
            });
            zipfile.readEntry();
          });
          
          writeStream.on('error', reject);
        });
      });
      
      zipfile.on('end', () => {
        resolve(extractedFiles);
      });
      
      zipfile.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to extract ZIP file: ${error.message}`);
  }
}

export function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return {
    extension: ext,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
    isSupported: Object.keys(mimeTypes).includes(ext)
  };
}

export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    
    // Try to break at sentence or word boundary
    if (end < text.length) {
      const lastSentence = chunk.lastIndexOf('.');
      const lastWord = chunk.lastIndexOf(' ');
      
      if (lastSentence > chunkSize * 0.7) {
        chunk = chunk.slice(0, lastSentence + 1);
      } else if (lastWord > chunkSize * 0.8) {
        chunk = chunk.slice(0, lastWord);
      }
    }
    
    chunks.push({
      text: chunk.trim(),
      startIndex: start,
      endIndex: start + chunk.length
    });
    
    start += chunk.length - overlap;
  }
  
  return chunks;
}
