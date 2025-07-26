// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { upsertChunks } from '@/lib/vectorStore'; // Now properly exported
import pdfParse from 'pdf-parse';

interface MulterNextApiHandler {
  (req: NextApiRequest, res: NextApiResponse, callback: (err?: unknown) => void): void;
}
// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(
  req: NextApiRequest & { file?: Express.Multer.File },
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Process upload
 await new Promise<void>((resolve, reject) => {
  (upload.single('file') as unknown as MulterNextApiHandler)(req, res, (err) => {
    if (err) return reject(err);
    resolve();
  });
});

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse PDF
    const pdfData = await pdfParse(req.file.buffer);
    const chunks = pdfData.text
      .split('\n')
      .filter(chunk => chunk.trim().length > 0);

    // Store in Pinecone
    await upsertChunks(chunks);

    return res.status(200).json({ 
      success: true,
      chunksCount: chunks.length
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Processing failed'
    });
  }
}