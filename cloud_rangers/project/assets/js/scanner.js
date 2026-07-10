let codeReader = null;
let activeTab = 'camera';
let scanHandled = false;
let cameraStream = null;

window.addEventListener('DOMContentLoaded', () => {
    initializeScannerUI();
    startCamera();
});

function initializeScannerUI() {
    document.querySelectorAll('.method-tab').forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab || 'camera');
        });
    });

    const manualInput = document.getElementById('manualBarcodeInput');
    if (manualInput) {
        manualInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                goWithBarcode();
            }
        });
    }
}

function switchTab(tab) {
    activeTab = tab;
    scanHandled = false;

    document.querySelectorAll('.method-tab').forEach(tabButton => {
        tabButton.classList.toggle('active', tabButton.dataset.tab === tab);
    });

    document.querySelectorAll('.method-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tab}`);
    });

    if (tab === 'camera') {
        startCamera();
    } else {
        stopCamera();
    }
}

async function startCamera() {
    if (activeTab !== 'camera') return;

    const video = document.getElementById('video');
    const status = document.getElementById('scan-status');

    if (!video) {
        return;
    }

    if (!window.ZXing) {
        if (status) {
            status.textContent = '⚠️ Scanner library did not load. Please use manual entry.';
        }
        return;
    }

    if (codeReader) {
        if (status) {
            status.textContent = '📷 Camera is already running.';
        }
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (status) {
            status.textContent = '⚠️ Camera is not supported in this browser. Please enter the barcode manually.';
        }
        return;
    }

    if (status) {
        status.textContent = '📷 Opening camera…';
    }

    try {
        stopCamera();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' }
            }
        });

        cameraStream = stream;
        video.srcObject = stream;
        await video.play();

        codeReader = new window.ZXing.BrowserMultiFormatReader();
        codeReader.decodeFromVideoElement(video, (result, error) => {
            if (result) {
                handleBarcodeResult(result.getText());
            }

            if (error && !(error instanceof window.ZXing.NotFoundException)) {
                console.error(error);
                if (status) {
                    status.textContent = '⚠️ Camera error. Please try again or use manual entry.';
                }
            }
        });

        if (status) {
            status.textContent = '📷 Camera ready — scanning live.';
        }
    } catch (error) {
        console.error(error);
        if (status) {
            status.textContent = '⚠️ Camera access was blocked. Please allow access once and try again, or enter the barcode manually.';
        }
    }
}

function stopCamera() {
    if (codeReader) {
        try {
            codeReader.reset();
        } catch (error) {
            console.warn('Scanner reset warning:', error);
        }
        codeReader = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    const video = document.getElementById('video');
    if (video) {
        video.pause();
        video.srcObject = null;
    }
}

function handleBarcodeResult(barcode) {
    const normalized = String(barcode || '').trim();
    if (!normalized || scanHandled) return;

    scanHandled = true;
    const status = document.getElementById('scan-status');
    if (status) {
        status.textContent = `✅ Barcode detected: ${normalized}`;
    }

    localStorage.setItem('scannedBarcode', normalized);
    const targetUrl = `product-result.html?barcode=${encodeURIComponent(normalized)}`;
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 300);
}

function goWithBarcode() {
    const barcode = document.getElementById('manualBarcodeInput')?.value?.trim();
    if (!barcode) {
        alert('Please enter a barcode number.');
        return;
    }

    localStorage.setItem('scannedBarcode', barcode);
    window.location.href = `product-result.html?barcode=${encodeURIComponent(barcode)}`;
}

function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const base64Str = reader.result.split(',')[1];
        localStorage.setItem('scannedImageBase64', base64Str);
        localStorage.removeItem('scannedBarcode');
        window.location.href = 'product-result.html';
    };
    reader.readAsDataURL(file);
}
