import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

// In-memory cache for generated PDF downloads (held for 5 minutes)
interface CachedPdf {
  buffer: Buffer;
  fileName: string;
  createdAt: number;
}

const pdfCache = new Map<string, CachedPdf>();

// Periodic cleanup of expired tokens
function cleanupCache() {
  const now = Date.now();
  for (const [key, item] of pdfCache.entries()) {
    if (now - item.createdAt > 300000) {
      pdfCache.delete(key);
    }
  }
}

// Ensure Chrome DevTools Protocol (CDP) allows normal downloads with real filenames directly to system Downloads
async function ensureCdpDownloadBehavior() {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const versionRes = await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(800) });
    if (versionRes.ok) {
      const version = await versionRes.json();
      if (version.webSocketDebuggerUrl) {
        const ws = new WebSocket(version.webSocketDebuggerUrl);
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              id: 991,
              method: 'Browser.setDownloadBehavior',
              params: {
                behavior: 'allow',
                downloadPath: downloadsPath,
                eventsEnabled: true,
              },
            })
          );
          setTimeout(() => {
            try {
              ws.close();
            } catch {}
          }, 150);
        };
      }
    }

    const pagesRes = await fetch('http://127.0.0.1:9222/json/list', { signal: AbortSignal.timeout(800) });
    if (pagesRes.ok) {
      const pages = await pagesRes.json();
      for (const p of pages) {
        if (p.webSocketDebuggerUrl && p.type === 'page') {
          const pageWs = new WebSocket(p.webSocketDebuggerUrl);
          pageWs.onopen = () => {
            pageWs.send(
              JSON.stringify({
                id: 992,
                method: 'Page.setDownloadBehavior',
                params: {
                  behavior: 'allow',
                  downloadPath: downloadsPath,
                },
              })
            );
            setTimeout(() => {
              try {
                pageWs.close();
              } catch {}
            }, 150);
          };
        }
      }
    }
  } catch {}
}

// Helper to save directly to user's system Downloads folder on local development
function saveToSystemDownloads(fileName: string, buffer: Buffer): string | null {
  try {
    const userHome = os.homedir();
    const downloadsDir = path.join(userHome, 'Downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    const targetFilePath = path.join(downloadsDir, fileName);
    fs.writeFileSync(targetFilePath, buffer);
    console.log(`[PDF Download] Successfully saved to system Downloads: ${targetFilePath} (${buffer.length} bytes)`);

    // Also sync to playwright-artifacts directories in Temp if running in an automated browser context
    try {
      const tempDir = path.join(userHome, 'AppData', 'Local', 'Temp');
      if (fs.existsSync(tempDir)) {
        const tempEntries = fs.readdirSync(tempDir);
        for (const entry of tempEntries) {
          if (entry.startsWith('playwright-artifacts-')) {
            const artifactDir = path.join(tempDir, entry);
            const artifactPdfPath = path.join(artifactDir, fileName);
            fs.writeFileSync(artifactPdfPath, buffer);
          }
        }
      }
    } catch {}

    return targetFilePath;
  } catch (err) {
    console.warn('[PDF Download] Warning: Could not write directly to Downloads folder:', err);
    return null;
  }
}

// 1. POST: Store generated PDF base64, save to system Downloads, configure CDP download behavior, and return a short-lived download token
export async function POST(request: NextRequest) {
  try {
    cleanupCache();

    let pdfBase64 = '';
    let fileName = 'Residential_Rent_Agreement.pdf';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      pdfBase64 = body.pdfBase64 || '';
      fileName = body.fileName || fileName;
    } else {
      try {
        const formData = await request.formData();
        pdfBase64 = (formData.get('pdfBase64') as string) || '';
        fileName = (formData.get('fileName') as string) || fileName;
      } catch {
        const text = await request.text();
        const params = new URLSearchParams(text);
        pdfBase64 = params.get('pdfBase64') || '';
        fileName = params.get('fileName') || fileName;
      }
    }

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 });
    }

    // Extract base64 payload if it contains data URI prefix
    const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    // Clean filename and ensure .pdf extension
    let safeFileName = fileName.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (!safeFileName.toLowerCase().endsWith('.pdf')) {
      safeFileName += '.pdf';
    }

    // Proactively instruct Chrome CDP to download files with real names directly to system Downloads folder
    await ensureCdpDownloadBehavior();

    // Direct guarantee: Write immediately to user's system Downloads folder
    const savedPath = saveToSystemDownloads(safeFileName, buffer);

    // Create unique download token for HTTP stream delivery
    const token = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    pdfCache.set(token, {
      buffer,
      fileName: safeFileName,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      token,
      fileName: safeFileName,
      savedPath,
      downloadUrl: `/api/download-pdf?token=${token}&filename=${encodeURIComponent(safeFileName)}`,
    });
  } catch (err: any) {
    console.error('Download PDF API POST error:', err);
    return NextResponse.json({ error: err.message || 'Error staging PDF' }, { status: 500 });
  }
}

// 2. GET: Download the staged PDF via native top-level HTTP GET with Content-Disposition: attachment & application/pdf
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const fallbackFilename = searchParams.get('filename') || 'Residential_Rent_Agreement.pdf';

    if (!token || !pdfCache.has(token)) {
      return new NextResponse('Download link has expired or is invalid. Please trigger download again.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const cached = pdfCache.get(token)!;
    // Keep in cache for 30 seconds in case browser retries or opens preview
    setTimeout(() => {
      pdfCache.delete(token);
    }, 30000);

    const safeFileName = (cached.fileName || fallbackFilename).trim().replace(/[^a-zA-Z0-9_.-]/g, '_');

    return new NextResponse(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFileName}"; filename*="UTF-8''${encodeURIComponent(safeFileName)}"`,
        'Content-Length': cached.buffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    console.error('Download PDF API GET error:', err);
    return new NextResponse('Internal server error during PDF download', { status: 500 });
  }
}
