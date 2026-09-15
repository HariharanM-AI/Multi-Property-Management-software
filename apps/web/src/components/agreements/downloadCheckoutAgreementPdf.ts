import React from 'react';
import { createRoot } from 'react-dom/client';
import { CheckoutAgreementDocumentSheets } from './CheckoutAgreementDocumentSheets';
import { CheckoutAgreementData } from '../../lib/agreementStorage';

/**
 * Downloads an authentic 2-Page A4 Checkout Handover & Deposit Settlement Agreement PDF
 * with exact typography, schedule table, terms, declarations, verified signatures,
 * and witness boxes matching the uploaded final templates.
 */
export async function downloadCheckoutAgreementPdf(agreementData: CheckoutAgreementData): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadCheckoutAgreementPdf must be called in a browser environment');
  }

  // 1. Create dedicated off-screen container matching standard document width
  const container = document.createElement('div');
  container.id = 'offscreen-checkout-pdf-render';
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
        const docPrefix = isPG ? 'PG_Handover_Settlement' : 'Residential_Handover_Settlement';
        const fileName = `${docPrefix}_${cleanTenantName}.pdf`;

        pdf.save(fileName);

        // Clean up DOM and root
        setTimeout(() => {
          root.unmount();
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 100);

        resolve(fileName);
      } catch (error) {
        console.error('Failed to export checkout agreement PDF:', error);
        root.unmount();
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
        reject(error);
      }
    };

    root.render(
      React.createElement(CheckoutAgreementDocumentSheets, {
        agreementData,
        isExportingPdf: true,
        onReady: executePdfGeneration,
      })
    );

    // Fallback safety timeout if onReady callback is delayed
    setTimeout(() => {
      if (!hasResolved) {
        const p1 = container.querySelector('[data-page="1"]') as HTMLDivElement;
        const p2 = container.querySelector('[data-page="2"]') as HTMLDivElement;
        if (p1 && p2) {
          executePdfGeneration(p1, p2);
        } else {
          root.unmount();
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
          reject(new Error('Timed out waiting for checkout agreement sheets to render for PDF generation.'));
        }
      }
    }, 6000);
  });
}
