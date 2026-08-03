// documentParser.js
// Strategy: for images → compress to reasonable size AND run client-side Tesseract OCR.
// This guarantees that even if the vision model cannot load the image or is bypassed,
// the parsed text details are still sent to the AI for robust prompt execution.
// For PDFs → extract text with pdf.js, fallback to canvas rendering and OCR if scanned.

/**
 * Performs client-side OCR on an image source (Blob, File, or DataURL) using Tesseract.js
 *
 * @param {File|Blob|string} imageSource
 * @returns {Promise<string>} Extracted text
 */
async function performOCR(imageSource) {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    console.error('Client-side Tesseract OCR failed:', err);
    return '';
  }
}

export async function extractTextFromFile(file) {
  const type = file.type

  if (type.startsWith('image/')) {
    // 1. Resize & compress image to avoid huge base64 payload fetch errors
    const compressedResult = await resizeAndCompressImage(file)

    // 2. Perform client-side OCR as an absolute guarantee/fallback for text analysis
    let ocrText = ''
    try {
      ocrText = await performOCR(file)
    } catch (err) {
      console.warn('OCR processing ignored on load error:', err)
    }

    return {
      mode: 'image',
      base64: compressedResult.base64,
      mimeType: compressedResult.mimeType,
      text: ocrText || null
    }
  }

  if (type === 'application/pdf') {
    try {
      const text = await extractPDFText(file)
      if (text && text.trim().length > 50) {
        return { mode: 'text', text, base64: null }
      }

      // Scanned PDF — render first page as image
      const { base64, mimeType, dataUrl } = await pdfToImage(file)
      let ocrText = ''
      try {
        ocrText = await performOCR(dataUrl)
      } catch (err) {
        console.warn('Scanned PDF OCR failed:', err)
      }

      return { mode: 'image', base64, mimeType, text: ocrText || null }
    } catch {
      const { base64, mimeType, dataUrl } = await pdfToImage(file)
      let ocrText = ''
      try {
        ocrText = await performOCR(dataUrl)
      } catch (err) {
        console.warn('Scanned PDF OCR failed:', err)
      }
      return { mode: 'image', base64, mimeType, text: ocrText || null }
    }
  }

  if (type === 'text/plain') {
    const text = await file.text()
    return { mode: 'text', text, base64: null }
  }

  throw new Error(`Unsupported file type: ${type}. Please use PDF, JPG, PNG, or TXT.`)
}

async function extractPDFText(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map(item => item.str).join(' ')
    fullText += pageText + '\n\n'
  }

  return fullText
}

async function pdfToImage(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  const viewport = page.getViewport({ scale: 2.0 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const base64 = dataUrl.split(',')[1]
  return { base64, mimeType: 'image/jpeg', dataUrl }
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function resizeAndCompressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas compression failed'));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);

      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for resizing'));
    };
  });
}
