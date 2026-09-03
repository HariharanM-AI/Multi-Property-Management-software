import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgreementDocumentSheets } from './AgreementDocumentSheets';
import { AgreementDocumentData } from './AgreementDocumentViewerModal';

/**
 * Downloads a high-quality, authentic 2-Page A4 Tenancy Agreement PDF
 * with exact typography, schedule table, terms, declarations, verified signatures,
 * and witness boxes matching the "View Filled Agreement Document" modal.
 */
export async function downloadAgreementPdf(agreementData: AgreementDocumentData): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadAgreementPdf must be called in a browser environment');
  }

  // 1. Create dedicated off-screen container matching standard document width
  const container = document.createElement('div');
  container.id = 'offscreen-agreement-pdf-render';
  container.style.position = 'fixed';
  container.style.left = '0px';
  container.style.top = '0px';
  container.style.width = '850px';
  container.style.minWidth = '850px';
  container.style.maxWidth = '850px';
  container.style.backgroundColor = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const root = createRoot(container);

  return new Promise((resolve, reject) => {
    let hasResolved = false;

    const executePdfGeneration = async (page1El: HTMLDivElement, page2El: HTMLDivElement) => {
      if (hasResolved) return;
      hasResolved = true;

      try {
        const { default: jsPDF } = await import('jspdf');
        const { default: html2canvas } = await import('html2canvas');

        // Ensure document fonts and layouts are settled
        if (typeof document !== 'undefined' && 'fonts' in document) {
          await document.fonts.ready;
        }
        await new Promise((r) => setTimeout(r, 400));

        // Ensure all images (signatures) are completely loaded
        const images = Array.from(container.querySelectorAll('img'));
        await Promise.all(
          images.map(
            (img) =>
              new Promise((res) => {
                if (img.complete && img.naturalHeight !== 0) {
                  res(true);
                } else {
                  img.onload = () => res(true);
                  img.onerror = () => res(true);
                }
              })
          )
        );

        // A4 Dimensions: 210mm x 297mm
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        // Capture Page 1 at High Resolution (2.5x scale for sharp, 300+ DPI official output)
        const canvas1 = await html2canvas(page1El, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
        });
        const imgData1 = canvas1.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        // Capture Page 2 at High Resolution
        pdf.addPage('a4', 'portrait');
        const canvas2 = await html2canvas(page2El, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
        });
        const imgData2 = canvas2.toDataURL('image/jpeg', 0.98);
        pdf.addImage(imgData2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        const isPG = agreementData.propertyType === 'PG';
        const cleanTenantName = (agreementData.tenantName || 'Resident').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const docPrefix = isPG ? 'PG_Accommodation_Agreement' : 'Residential_Rent_Agreement';
        const fileName = `${docPrefix}_${cleanTenantName}.pdf`;

        const dataUri = pdf.output('datauristring');

        try {
          // Stage the PDF through /api/download-pdf.
          // The backend immediately writes the genuine .pdf file directly to the user's system Downloads folder.
          const stageRes = await fetch('/api/download-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: dataUri, fileName }),
          });

          if (stageRes.ok) {
            const data = await stageRes.json();
            if (data.downloadUrl) {
              const anchor = document.createElement('a');
              anchor.href = data.downloadUrl;
              anchor.download = fileName;
              anchor.style.display = 'none';
              document.body.appendChild(anchor);
              anchor.click();
              setTimeout(() => {
                try {
                  document.body.removeChild(anchor);
                } catch {}
              }, 1000);
              resolve(fileName);
              return;
            }
          }
        } catch (postErr) {
          console.warn('API staging download warning:', postErr);
        }

        // Fallback: direct application/pdf blob anchor download
        const blob = pdf.output('blob');
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfBlob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        setTimeout(() => {
          try {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(blobUrl);
          } catch {}
        }, 1500);

        resolve(fileName);
      } catch (err) {
        console.error('Failed to generate high quality agreement PDF:', err);
        reject(err);
      } finally {
        setTimeout(() => {
          try {
            root.unmount();
            container.remove();
          } catch (e) {
            console.warn('Offscreen container cleanup:', e);
          }
        }, 500);
      }
    };

    root.render(
      React.createElement(AgreementDocumentSheets, {
        agreementData,
        isExportingPdf: true,
        onReady: (p1: HTMLDivElement, p2: HTMLDivElement) => {
          executePdfGeneration(p1, p2);
        },
      })
    );
  });
}
