const url = '/uploads/sample.pdf'; // Ganti dengan path file PDF sementara
const pdfContainer = document.getElementById('pdfContainer');
let pdfDoc = null;
let currentPage = 1;

// Render halaman PDF
async function renderPDF(pageNum) {
  const pdf = await pdfjsLib.getDocument(url).promise;
  pdfDoc = pdf;

  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  pdfContainer.innerHTML = ''; // Bersihkan container PDF sebelumnya
  pdfContainer.appendChild(canvas);

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  // Tambahkan event listener untuk menangkap klik
  canvas.addEventListener('click', function (event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Simpan koordinat klik dan halaman
    document.getElementById('positionX').value = x;
    document.getElementById('positionY').value = y;
    document.getElementById('pageNumber').value = pageNum;

    // Tandai posisi klik
    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = '20px';
    marker.style.height = '20px';
    marker.style.backgroundColor = 'red';
    marker.style.borderRadius = '50%';
    marker.style.zIndex = '10';
    pdfContainer.appendChild(marker);

    alert(`Position selected at X: ${x}, Y: ${y}, Page: ${pageNum}`);
  });
}

// Render halaman pertama
renderPDF(currentPage);
