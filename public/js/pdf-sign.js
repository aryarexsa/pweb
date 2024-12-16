const pdfContainer = document.getElementById('pdfContainer');
const pdfFileInput = document.getElementById('pdfFile');
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
const scale = 1.5;

// Fungsi untuk render halaman PDF
async function renderPage(pageNum) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Buat canvas untuk merender PDF
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Bersihkan container
    pdfContainer.innerHTML = '';
    pdfContainer.appendChild(canvas);

    // Render halaman PDF
    await page.render({ canvasContext: context, viewport }).promise;

    // Update informasi halaman
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;

    // Tangkap posisi klik
    canvas.addEventListener('click', function (event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Simpan posisi klik
      document.getElementById('positionX').value = x;
      document.getElementById('positionY').value = y;
      document.getElementById('pageNumber').value = pageNum;

      // Tandai posisi klik
      const marker = document.createElement('div');
      marker.style.position = 'absolute';
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      marker.style.width = '10px';
      marker.style.height = '10px';
      marker.style.backgroundColor = 'red';
      marker.style.borderRadius = '50%';
      marker.style.zIndex = '10';
      pdfContainer.appendChild(marker);
    });
  } catch (error) {
    console.error('Error rendering page:', error);
  }
}

// Fungsi untuk load PDF file
async function loadPDF(file) {
  const fileReader = new FileReader();

  fileReader.onload = async function () {
    try {
      const typedarray = new Uint8Array(this.result);
      pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
      totalPages = pdfDoc.numPages;
      currentPage = 1;
      renderPage(currentPage);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  fileReader.readAsArrayBuffer(file);
}

// Event listener untuk input file
pdfFileInput.addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    loadPDF(file);
  } else {
    alert('Please select a valid PDF file.');
  }
});

// Navigasi halaman
document.getElementById('prevPage').addEventListener('click', function () {
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
});

document.getElementById('nextPage').addEventListener('click', function () {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage(currentPage);
  }
});
