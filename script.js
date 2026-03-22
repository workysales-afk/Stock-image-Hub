class ImageStockApp {
    constructor() {
        this.currentPage = 1;
        this.currentQuery = '';
        this.favorites = new Map();
        this.init();
    }

    async init() {
        await this.loadFavorites();
        await this.loadPopularImages();
        this.bindEvents();
        this.updateFavCount();
    }

    bindEvents() {
        document.getElementById('searchBtn').onclick = () => this.searchImages();
        document.getElementById('searchInput').onkeypress = (e) => e.key === 'Enter' && this.searchImages();
        
        document.getElementById('nextPage').onclick = () => this.nextPage();
        document.getElementById('prevPage').onclick = () => this.prevPage();
        
        document.getElementById('favoritesBtn').onclick = () => this.showFavorites();
        document.getElementById('closeModal').onclick = () => this.hideFavorites();
        
        document.querySelector('.image-modal').onclick = (e) => {
            if (e.target.classList.contains('image-modal')) this.closeImageModal();
        };
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('hidden');
        document.getElementById('imagesGrid').innerHTML = '';
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }

    async loadPopularImages() {
        this.showLoading();
        try {
            const response = await fetch(
                `https://api.pexels.com/v1/curated?page=${this.currentPage}&per_page=12`,
                { headers: { Authorization: window.pexelsApiKey } }
            );
            const data = await response.json();
            this.renderImages(data.photos);
            this.updatePagination();
        } catch (error) {
            console.error('Error:', error);
            this.showError('Failed to load images!');
        } finally {
            this.hideLoading();
        }
    }

    async searchImages() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return this.loadPopularImages();

        this.currentQuery = query;
        this.currentPage = 1;
        this.showLoading();

        try {
            const response = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=1&per_page=12`,
                { headers: { Authorization: window.pexelsApiKey } }
            );
            const data = await response.json();
            this.renderImages(data.photos);
            this.updatePagination();
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed!');
        } finally {
            this.hideLoading();
        }
    }

    nextPage() {
        this.currentPage++;
        this.currentQuery ? this.searchImages() : this.loadPopularImages();
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.currentQuery ? this.searchImages() : this.loadPopularImages();
        }
    }

    updatePagination() {
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage}`;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
    }

    renderImages(photos) {
        const grid = document.getElementById('imagesGrid');
        grid.innerHTML = photos.map(photo => `
            <div class="image-card" onclick="app.openImageModal('${photo.src.original}', '${photo.photographer}', '${photo.id}')">
                <img src="${photo.src.medium}" alt="${photo.alt}" loading="lazy">
                <div class="image-info">
                    <h3>${photo.photographer}</h3>
                </div>
                <button class="fav-btn ${this.favorites.has(photo.id) ? 'is-favorite' : ''}" 
                        onclick="event.stopPropagation(); app.toggleFavorite('${photo.id}', '${photo.src.original}', '${photo.photographer}')">
                    ${this.favorites.has(photo.id) ? '❤️' : '🤍'}
                </button>
            </div>
        `).join('');
    }

    async loadFavorites() {
        try {
            const snapshot = await window.firebaseFunctions.getDocs(window.favoritesRef);
            this.favorites.clear();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                this.favorites.set(data.id, { url: data.url, photographer: data.photographer });
            });
            this.updateFavCount();
        } catch (error) {
            console.error('Favorites load error:', error);
        }
    }

    async toggleFavorite(id, url, photographer) {
        if (this.favorites.has(id)) {
            // Remove favorite
            await window.firebaseFunctions.deleteDoc(doc(window.favoritesRef, id));
            this.favorites.delete(id);
        } else {
            // Add favorite
            await window.firebaseFunctions.addDoc(window.favoritesRef, {
                id, url, photographer, timestamp: new Date()
            });
            this.favorites.set(id, { url, photographer });
        }
        this.updateFavCount();
        this.renderImages([]); // Refresh UI
        this.currentQuery ? this.searchImages() : this.loadPopularImages();
    }

    updateFavCount() {
        document.getElementById('favCount').textContent = this.favorites.size;
    }

    showFavorites() {
        const modal = document.getElementById('favoritesModal');
        const grid = document.getElementById('favoritesGrid');
        
        if (this.favorites.size === 0) {
            grid.innerHTML = '<p style="text-align:center;padding:2rem;color:#666;">No favorites yet. Start adding some! 😊</p>';
        } else {
            grid.innerHTML = Array.from(this.favorites.values()).map(fav => `
                <div class="image-card" onclick="app.openImageModal('${fav.url}', '${fav.photographer}')">
                    <img src="${fav.url}" alt="Favorite" style="height:200px;">
                    <div class="image-info">
                        <h3>${fav.photographer}</h3>
                    </div>
                    <button class="fav-btn is-favorite" onclick="event.stopPropagation(); app.removeFavorite('${Array.from(this.favorites.keys()).find(key => this.favorites.get(key).url === fav.url)}')">
                        🗑️
                    </button>
                </div>
            `).join('');
        }
        modal.classList.remove('hidden');
    }

    async removeFavorite(id) {
        await window.firebaseFunctions.deleteDoc(doc(window.favoritesRef, id));
        await this.loadFavorites();
        this.showFavorites();
    }

    hideFavorites() {
        document.getElementById('favoritesModal').classList.add('hidden');
    }

    openImageModal(src, photographer, id = '') {
        document.getElementById('modalImage').src = src;
        document.getElementById('imagePhotographer').textContent = `Photographer: ${photographer}`;
        document.getElementById('downloadBtn').href = src;
        document.getElementById('addToFavModal').onclick = () => this.toggleFavorite(id, src, photographer);
        document.querySelector('.image-modal').classList.remove('hidden');
    }

    closeImageModal() {
        document.querySelector('.image-modal').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('imagesGrid').innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:4rem;color:white;">
                <h3>❌ ${message}</h3>
                <button onclick="location.reload()" style="padding:1rem 2rem;background:#4CAF50;color:white;border:none;border-radius:25px;cursor:pointer;margin-top:1rem;">Retry</button>
            </div>
        `;
    }
}

// Initialize App
const app = new ImageStockApp();
window.app = app;