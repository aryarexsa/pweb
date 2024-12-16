const pdfContainer = document.getElementById('pdfContainer');
const pdfFileInput = document.getElementById('pdfFile');
let pdfDoc = null;

// Fungsi untuk merender PDF berdasarkan file yang dipilih
async function renderPDF(file, pageNum = 1) {
  try {
    const fileReader = new FileReader();

    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      pdfDoc = await pdfjsLib.getDocument(typedarray).promise;

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      // Buat canvas untuk render PDF
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Bersihkan container dan tambahkan canvas
      pdfContainer.innerHTML = '';
      pdfContainer.appendChild(canvas);

      await page.render({ canvasContext: context, viewport: viewport }).promise;

      // Tangkap posisi klik
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

        Swal.fire({
          title: 'Position Selected',
          text: `X: ${x}, Y: ${y}, Page: ${pageNum}`,
          icon: 'success',
        });
      });
    };

    fileReader.readAsArrayBuffer(file);
  } catch (error) {
    console.error('Error rendering PDF:', error);
    Swal.fire({
      title: 'Error',
      text: 'Failed to render PDF file.',
      icon: 'error',
    });
  }
}

// Event listener untuk input file
pdfFileInput.addEventListener('change', function (event) {
  const file = event.target.files[0];

  if (file && file.type === 'application/pdf') {
    renderPDF(file); // Render file PDF yang dipilih
  } else {
    Swal.fire({
      title: 'Invalid File',
      text: 'Please select a valid PDF file.',
      icon: 'error',
    });
  }
});
