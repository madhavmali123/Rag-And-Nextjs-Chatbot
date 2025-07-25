import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { upsertChunks } from '@/lib/vectorStore';

interface NextApiRequestWithFile extends NextApiRequest {
  file?: Express.Multer.File;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware handler
const runMiddleware = (req: NextApiRequest, res: NextApiResponse, middleware: any) => {
  return new Promise((resolve, reject) => {
    middleware(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export const config = {
  api: {
    bodyParser: false, // Disable default bodyParser
  },
};

export default async function handler(
  req: NextApiRequestWithFile,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded' });
    }

    console.log('Uploaded file:', req.file); // Debug log

    const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
    const fileBuffer = fs.readFileSync(filePath);

    // Process PDF
    const pdfData = await pdfParse(fileBuffer);
    const chunks = chunkText(pdfData.text);

    // Store in vector DB
    await upsertChunks(chunks);

    // Clean up
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error deleting file:', err);
    }

    return res.status(200).json({ 
      success: true,
      chunksCount: chunks.length 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    });
  }
}

// Helper function to chunk text
function chunkText(text: string, maxLength = 1000): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const sentence of text.split('. ')) {
    if ((current + sentence).length > maxLength) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence + '. ';
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
}