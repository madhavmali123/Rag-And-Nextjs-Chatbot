import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { upsertChunks } from '@/lib/vectorStore';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

interface NextApiRequestWithFile extends NextApiRequest {
  file?: Express.Multer.File;
}

const upload = multer({
  storage: multer.diskStorage({
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
  })
});

const createExpressRequest = (req: NextApiRequest): ExpressRequest => {
  return {
    ...req,
    get: (name: string) => {
      const header = req.headers[name];
      return Array.isArray(header) ? header[0] : header;
    },
    header: (name: string) => {
      const header = req.headers[name];
      return Array.isArray(header) ? header[0] : header;
    },
    accepts: () => [],
    acceptsCharsets: () => [],
    // Add other minimal required Express methods
  } as unknown as ExpressRequest;
};

const runMiddleware = (req: NextApiRequestWithFile, res: NextApiResponse) => {
  return new Promise<void>((resolve, reject) => {
    const expressReq = createExpressRequest(req);
    const expressRes = {
      ...res,
      status: (code: number) => ({ json: () => expressRes }),
      json: () => expressRes
    } as unknown as ExpressResponse;

    upload.single('file')(expressReq, expressRes, (err: unknown) => {
      if (err) return reject(err);
      if (expressReq.file) {
        req.file = expressReq.file;
      }
      resolve();
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

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

export default async function handler(
  req: NextApiRequestWithFile,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await runMiddleware(req, res);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
    const fileBuffer = fs.readFileSync(filePath);

    const pdfData = await pdfParse(fileBuffer);
    const chunks = chunkText(pdfData.text);

    await upsertChunks(chunks);

    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('File cleanup error:', err);
    }

    return res.status(200).json({ 
      message: 'File uploaded and embedded successfully', 
      chunksCount: chunks.length 
    });
  } catch (err) {
    console.error('Upload error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
    return res.status(500).json({ error: errorMessage });
  }
}