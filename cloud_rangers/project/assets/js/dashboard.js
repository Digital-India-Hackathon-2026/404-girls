// Show Manual Search Modal
function showManualSearch() {
    const modalEl = document.getElementById('manualSearchModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Focus the input
        const input = modalEl.querySelector('#productSearch');
        if (input) input.focus();
    }
}

// Perform Manual Search
async function performManualSearch() {
    const query = document.getElementById('productSearch').value.trim();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (!query) {
        resultsContainer.innerHTML = '<p class="text-danger">Please enter a product name or barcode.</p>';
        return;
    }

    resultsContainer.innerHTML = '<p>Searching...</p>';

    // Pass the query format (name or barcode) to the product page where engine handles it
    localStorage.setItem("scannedBarcode", query);
    window.location.href = "product-result.html";
}

// Add event listener to modal search button
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('manualSearchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', performManualSearch);
    }

    // Press Enter to search
    const input = document.getElementById('productSearch');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performManualSearch();
        });
    }

    // Wire up the top navbar search bar to open manual search modal
    const navbarSearchInput = document.querySelector('.search-bar input');
    if (navbarSearchInput) {
        navbarSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = navbarSearchInput.value.trim();
                if (query) {
                    localStorage.setItem("scannedBarcode", query);
                    window.location.href = "product-result.html";
                }
            }
        });
        navbarSearchInput.addEventListener('focus', showManualSearch);
    }
});

// Reset State Department Modal dropdown when shown
document.addEventListener('DOMContentLoaded', () => {
    const modalEl = document.getElementById('stateDepartmentModal');
    if (modalEl) {
        modalEl.addEventListener('show.bs.modal', () => {
            const select = document.getElementById('stateSelect');
            const placeholder = document.getElementById('stateContactPlaceholder');
            if (select) select.value = '';
            if (placeholder) placeholder.style.display = 'none';
        });
    }
});

// Handle State Selection
function handleStateSelection() {
    const select = document.getElementById('stateSelect');
    const placeholder = document.getElementById('stateContactPlaceholder');
    if (select && placeholder) {
        if (select.value) {
            placeholder.style.display = 'block';
        } else {
            placeholder.style.display = 'none';
        }
    }
}
