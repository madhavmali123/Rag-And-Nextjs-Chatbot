import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { upsertChunks } from '@/lib/vectorStore';

// Setup multer
const upload = multer({ dest: 'uploads/' });

// Disable default body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to wrap multer
const runMiddleware = (
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (req: NextApiRequest, res: NextApiResponse, callback: (result: unknown) => void) => void
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });

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

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Only POST allowed' });
    return;
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    const file = (req as any).file as Express.Multer.File;
    const filePath = path.join(process.cwd(), 'uploads', file.filename);
    const fileBuffer = fs.readFileSync(filePath);

    const pdfData = await pdfParse(fileBuffer);
    const chunks = chunkText(pdfData.text);

    await upsertChunks(chunks);

    fs.unlinkSync(filePath);

    res.status(200).json({ message: 'File uploaded and embedded successfully', chunksCount: chunks.length });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: (err as Error).message || 'Something went wrong' });
  }
};

export default handler;
