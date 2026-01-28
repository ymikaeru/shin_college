// ============================================
// STATE MANAGEMENT
// ============================================
let data = [];
let currentVolume = null;
let currentTheme = null;
let searchTerm = '';
let currentFontSize = localStorage.getItem('modalFontSize') || 'medium';
let showTranslation = false;
let currentTitleData = null;

// ============================================
// DATA LOADING
// ============================================
async function loadData() {
    try {
        const response = await fetch('data/shin_college_data.json');
        data = await response.json();

        // Sort themes numerically within each volume
        data.forEach(volume => {
            if (volume.themes) {
                volume.themes.sort((a, b) => {
                    const numA = extractThemeNumber(a.theme);
                    const numB = extractThemeNumber(b.theme);
                    if (numA !== null && numB !== null) {
                        return numA - numB;
                    }
                    // Fallback to string comparison if numbers are missing
                    return a.theme.localeCompare(b.theme);
                });
            }
        });

        initializeApp();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').innerHTML = `
            <div style="text-align: center; color: var(--text-secondary);">
                <p style="font-size: 3rem; margin-bottom: 1rem;">⚠️</p>
                <p>データの読み込みエラー</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-tertiary);">${error.message}</p>
            </div>
        `;
    }
}

// ============================================
// INITIALIZATION
// ============================================
function initializeApp() {
    updateStatistics();
    showVolumes();
    setupEventListeners();
    hideLoading();
}

function setupEventListeners() {
    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Back buttons
    document.getElementById('backToVolumes').addEventListener('click', showVolumes);
    document.getElementById('backToThemes').addEventListener('click', () => showThemes(currentVolume));

    // Modal close
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('contentModal').addEventListener('click', (e) => {
        if (e.target.id === 'contentModal') closeModal();
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Font size controls
    document.getElementById('decreaseFontSize').addEventListener('click', () => changeFontSize('decrease'));
    document.getElementById('resetFontSize').addEventListener('click', () => changeFontSize('reset'));
    document.getElementById('increaseFontSize').addEventListener('click', () => changeFontSize('increase'));

    // Translation button
    document.getElementById('translationButton').addEventListener('click', toggleTranslation);
}

// ============================================
// STATISTICS
// ============================================
function updateStatistics(contextData = null) {
    let stats = {
        volumes: 0,
        themes: 0,
        titles: 0,
        articles: 0
    };
    const uniqueContent = new Set();
    const source = contextData || data;

    // Helper functions
    const processTitles = (titlesList) => {
        stats.titles += titlesList.length;
        titlesList.forEach(title => {
            title.publications.forEach(pub => {
                if (pub.content && pub.content.trim()) {
                    uniqueContent.add(pub.content.trim());
                }
            });
        });
    };

    const processThemes = (themesList) => {
        stats.themes += themesList.length;
        themesList.forEach(theme => processTitles(theme.titles));
    };

    // Determine data type and calculate
    if (Array.isArray(source)) {
        // Build-in detection for search results vs standard data
        if (source.length > 0 && source[0].matchType) {
            // Search Results
            const uniqueVolumes = new Set();
            const uniqueThemes = new Set();

            source.forEach(result => {
                uniqueVolumes.add(result.volume);
                uniqueThemes.add(`${result.volume}-${result.theme}`);

                // For titles/articles in search, we iterate the result items
                stats.titles++;
                result.title.publications.forEach(pub => {
                    if (pub.content && pub.content.trim()) {
                        uniqueContent.add(pub.content.trim());
                    }
                });
            });

            stats.volumes = uniqueVolumes.size;
            stats.themes = uniqueThemes.size;
        } else {
            // Global Data (Array of Volumes)
            stats.volumes = source.length;
            source.forEach(volume => processThemes(volume.themes));
        }
    } else if (source.themes) {
        // Single Volume
        stats.volumes = 0; // Don't show volumes count when viewing a single volume
        processThemes(source.themes);
    } else if (source.titles) {
        // Single Theme
        stats.volumes = 0; // Not aggregating volumes
        stats.themes = 0; // Don't show themes count when viewing a single theme
        processTitles(source.titles);
    }

    stats.articles = uniqueContent.size;


    animateCounter('totalThemes', stats.themes);
    animateCounter('totalTitles', stats.titles);
    animateCounter('totalArticles', stats.articles);
}

function animateCounter(elementId, target) {
    const element = document.getElementById(elementId);
    element.textContent = target;
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
function handleSearch(e) {
    searchTerm = e.target.value.toLowerCase().trim();

    if (!searchTerm) {
        showVolumes();
        return;
    }

    const results = searchContent(searchTerm);
    displaySearchResults(results);
}

function searchContent(term) {
    const results = [];

    data.forEach(volume => {
        volume.themes.forEach(theme => {
            theme.titles.forEach(title => {
                const matchVolume = volume.volume.toLowerCase().includes(term);
                const matchTheme = theme.theme.toLowerCase().includes(term);
                const matchTitle = title.title.toLowerCase().includes(term);

                if (matchVolume || matchTheme || matchTitle) {
                    results.push({
                        volume: volume.volume,
                        theme: theme.theme,
                        title: title,
                        matchType: matchTitle ? 'title' : (matchTheme ? 'theme' : 'volume')
                    });
                }
            });
        });
    });

    return results;
}

function displaySearchResults(results) {
    hideAllViews();
    updateStatistics(results);
    const view = document.getElementById('titlesView');
    view.classList.remove('hidden');

    document.getElementById('themeTitle').textContent = `検索結果: "${searchTerm}"`;
    document.getElementById('backToThemes').style.display = 'none';

    const container = document.getElementById('titlesList');
    window.currentSearchResults = results;

    if (results.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-tertiary);">
                <p style="font-size: 3rem; margin-bottom: 1rem;">🔍</p>
                <p>見つかりませんでした</p>
            </div>
        `;
        return;
    }

    container.innerHTML = results.map((result, index) => `
        <div class="title-item" onclick="openSearchResultByIndex(${index})">
            <div class="title-item-header">
                <div class="title-item-name">${result.title.title}</div>
                <div class="title-item-badge">${result.title.publications.length} 文献</div>
            </div>
        </div>
    `).join('');

    updateBreadcrumb([
        { text: '巻一覧', action: () => { document.getElementById('searchInput').value = ''; showVolumes(); } },
        { text: `検索: "${searchTerm}"`, active: true }
    ]);
}

function openSearchResultByIndex(index) {
    if (window.currentSearchResults && window.currentSearchResults[index]) {
        const result = window.currentSearchResults[index];

        // Find volume and theme indices
        const volumeIndex = data.findIndex(v => v.volume === result.volume);
        const themeIndex = volumeIndex >= 0 ? data[volumeIndex].themes.findIndex(t => t.theme === result.theme) : -1;

        // Inject path info into the title object for the modal
        const titleWithContext = {
            ...result.title,
            pathInfo: {
                volume: formatVolumeName(result.volume),
                theme: result.theme,
                volumeIndex: volumeIndex,
                themeIndex: themeIndex
            }
        };
        showContent(titleWithContext);
    }
}

// ============================================
// NAVIGATION VIEWS
// ============================================
function showVolumes() {
    hideAllViews();
    currentVolume = null;
    currentTheme = null;
    document.getElementById('searchInput').value = '';
    searchTerm = '';

    const view = document.getElementById('volumesView');
    view.classList.remove('hidden');

    // Show statistics only on home page
    document.getElementById('statsFooter').style.display = 'block';

    const container = document.getElementById('volumesList');
    updateStatistics(); // Reset to global stats
    container.innerHTML = data.map((volume, index) => {
        const themeCount = volume.themes.length;
        let titleCount = 0;
        volume.themes.forEach(theme => titleCount += theme.titles.length);

        return `
            <div class="card" onclick="showThemes(${index})">
                <div class="card-title">${formatVolumeName(volume.volume)}</div>
                <div class="card-subtitle">
                    ${themeCount} カテゴリ · ${titleCount} トピック
                </div>
            </div>
        `;
    }).join('');

    updateBreadcrumb([{ text: '巻一覧', active: true }]);
}

function showThemes(volumeIndex) {
    hideAllViews();
    currentVolume = volumeIndex;
    const volume = data[volumeIndex];

    const view = document.getElementById('themesView');
    view.classList.remove('hidden');

    // Hide statistics on themes view
    document.getElementById('statsFooter').style.display = 'none';

    document.getElementById('volumeTitle').textContent = formatVolumeName(volume.volume);
    document.getElementById('backToThemes').style.display = 'none';
    document.getElementById('backToVolumes').style.display = 'inline-flex';

    const container = document.getElementById('themesList');
    container.innerHTML = volume.themes.map((theme, themeIndex) => {
        const titleCount = theme.titles.length;

        return `
            <div id="theme-card-${themeIndex}" class="card" onclick="toggleTheme(${volumeIndex}, ${themeIndex})">
                <div class="card-header-content">
                    <div class="card-info">
                        <div class="card-title">${theme.theme}</div>
                        <div class="card-subtitle">
                            ${titleCount} トピック
                        </div>
                    </div>
                    <div class="accordion-icon">▼</div>
                </div>
                <div id="theme-titles-${themeIndex}" class="titles-container"></div>
            </div>
        `;
    }).join('');

    updateBreadcrumb([
        { text: '巻一覧', action: showVolumes },
        { text: formatVolumeName(volume.volume), active: true }
    ]);

    updateToggleAllButtonState();
}

function toggleTheme(volumeIndex, themeIndex) {
    const card = document.getElementById(`theme-card-${themeIndex}`);
    const container = document.getElementById(`theme-titles-${themeIndex}`);
    const volume = data[volumeIndex];
    const theme = volume.themes[themeIndex];

    const isExpanded = card.classList.contains('expanded');

    if (isExpanded) {
        card.classList.remove('expanded');
    } else {
        card.classList.add('expanded');
        if (container.innerHTML.trim() === '') {
            renderTitlesInTheme(container, theme.titles);
        }
    }
    updateToggleAllButtonState();
}

function toggleAllThemes() {
    const container = document.getElementById('themesList');
    if (!container) return;
    const cards = container.querySelectorAll('.card');
    const btn = document.getElementById('closeAllThemesBtn');

    const anyExpanded = Array.from(cards).some(card => card.classList.contains('expanded'));

    if (anyExpanded) {
        // Close all
        cards.forEach(card => card.classList.remove('expanded'));
        btn.textContent = '全て開く';
    } else {
        // Open all
        const volume = data[data.findIndex(v => v.volume === document.getElementById('volumeTitle').textContent)] || data[currentVolume];

        cards.forEach((card, index) => {
            card.classList.add('expanded');
            const titlesContainer = card.querySelector('.titles-container');
            if (titlesContainer && titlesContainer.innerHTML.trim() === '') {
                // Determine index match. themesList maps directly to volume.themes
                const theme = volume.themes[index];
                renderTitlesInTheme(titlesContainer, theme.titles);
            }
        });
        btn.textContent = '全て閉じる';
    }
}

function updateToggleAllButtonState() {
    const container = document.getElementById('themesList');
    if (!container) return;
    const cards = container.querySelectorAll('.card');
    const btn = document.getElementById('closeAllThemesBtn');

    const anyExpanded = Array.from(cards).some(card => card.classList.contains('expanded'));

    if (anyExpanded) {
        btn.textContent = '全て閉じる';
    } else {
        btn.textContent = '全て開く';
    }
}

function renderTitlesInTheme(container, titles) {
    const groupedTitles = groupNumberedTitles(titles);

    container.innerHTML = groupedTitles.map((title, index) => {
        if (title.title === '---') {
            return `<div class="separator-item"></div>`;
        }

        return `
        <div class="title-item" onclick="event.stopPropagation(); showContentFromAccordion('${title.title.replace(/'/g, "\\'")}')">
            <div class="title-item-header">
                <div class="title-item-name">${title.title}</div>
                <div class="title-item-badge">${title.publications.length} 文献</div>
            </div>
        </div>
    `}).join('');
}

function showContentFromAccordion(titleString) {
    if (currentVolume === null) return;
    const volume = data[currentVolume];

    for (let t = 0; t < volume.themes.length; t++) {
        const theme = volume.themes[t];
        const grouped = groupNumberedTitles(theme.titles);
        const found = grouped.find(g => g.title === titleString);
        if (found) {
            const titleWithContext = {
                ...found,
                pathInfo: {
                    volume: formatVolumeName(volume.volume),
                    theme: theme.theme,
                    volumeIndex: currentVolume,
                    themeIndex: t
                }
            };
            showContent(titleWithContext);
            return;
        }
    }
}


function showTitles(volumeIndex, themeIndex) {
    hideAllViews();
    currentVolume = volumeIndex;
    currentTheme = themeIndex;

    const volume = data[volumeIndex];
    const theme = volume.themes[themeIndex];

    const view = document.getElementById('titlesView');
    view.classList.remove('hidden');

    // Hide statistics on titles view
    document.getElementById('statsFooter').style.display = 'none';

    // Agrupa títulos numerados
    const groupedTitles = groupNumberedTitles(theme.titles);
    window.currentGroupedTitles = groupedTitles;

    document.getElementById('themeTitle').textContent = theme.theme;
    document.getElementById('backToThemes').style.display = 'inline-flex';

    const container = document.getElementById('titlesList');
    container.innerHTML = groupedTitles.map((title, index) => {
        if (title.title === '---') {
            return `<div class="separator-item"></div>`;
        }
        return `
        <div class="title-item" onclick="openContentByIndex(${index})">
            <div class="title-item-header">
                <div class="title-item-name">${title.title}</div>
                <div class="title-item-badge">${title.publications.length} 文献</div>
            </div>
        </div>
    `}).join('');

    updateBreadcrumb([
        { text: '巻一覧', action: showVolumes },
        { text: formatVolumeName(volume.volume), action: () => showThemes(volumeIndex) },
        { text: theme.theme, active: true }
    ]);
}

function openContentByIndex(index) {
    if (window.currentGroupedTitles && window.currentGroupedTitles[index]) {
        const titleData = window.currentGroupedTitles[index];

        // Inject path info if missing and we have context
        if (!titleData.pathInfo && typeof currentVolume === 'number' && typeof currentTheme === 'number') {
            const vol = data[currentVolume];
            const thm = vol ? vol.themes[currentTheme] : null;
            if (vol && thm) {
                titleData.pathInfo = {
                    volume: formatVolumeName(vol.volume),
                    theme: thm.theme,
                    volumeIndex: currentVolume,
                    themeIndex: currentTheme
                };
            }
        }

        showContent(titleData);
    }
}

// ============================================
// MODAL CONTENT
// ============================================
function showContent(title) {
    const modal = document.getElementById('contentModal');
    document.getElementById('modalTitle').textContent = title.title;

    // Store current title data for translation toggle
    currentTitleData = title;
    showTranslation = false;

    // Processa os dados para navegação e conteúdo
    const processedPubs = title.publications
        .filter(pub => pub.content && pub.content.trim()) // Filter out empty content
        .map((pub, index) => ({
            ...pub,
            id: `pub-${index}`,
            displayTitle: pub.header || (pub.type === 'intro' ? 'はじめに' : '無題')
        }));

    // Check if any publication has translation
    const hasTranslation = processedPubs.some(pub => pub.translation && pub.translation.trim());
    const translationButton = document.getElementById('translationButton');
    if (hasTranslation) {
        translationButton.classList.remove('hidden');
        translationButton.classList.remove('active');
    } else {
        translationButton.classList.add('hidden');
    }

    // Conta ocorrências de cada título para numerar duplicatas
    const titleCounts = {};
    processedPubs.forEach(pub => {
        titleCounts[pub.displayTitle] = (titleCounts[pub.displayTitle] || 0) + 1;
    });

    const currentCounts = {};
    const navigationItems = processedPubs.map(pub => {
        let label = pub.displayTitle;
        if (titleCounts[pub.displayTitle] > 1) {
            currentCounts[pub.displayTitle] = (currentCounts[pub.displayTitle] || 0) + 1;
            label = `${pub.displayTitle} ${currentCounts[pub.displayTitle]}`;
        }
        return { ...pub, label };
    });

    // Gera o HTML da navegação
    // Only show if there is more than 1 item
    let navHTML = '';
    if (navigationItems.length > 1) {
        navHTML = `
            <div class="modal-nav-container">
                <button class="modal-nav-toggle" onclick="toggleModalNav(this)">
                    <span>目次 (${navigationItems.length})</span>
                    <span class="chevron">▼</span>
                </button>
                <div class="modal-nav-content" id="modalNavContent">
                    <div class="modal-nav">
                        ${navigationItems.map(item => `
                            <button class="modal-nav-item" onclick="document.getElementById('${item.id}').scrollIntoView({ behavior: 'smooth' })">
                                ${parseMarkdown(item.label)}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Metadados - Caminho do conteúdo
    const metaContainer = document.getElementById('modalMeta');
    if (title.pathInfo) {
        metaContainer.innerHTML = `
            <div class="modal-meta-item modal-meta-link" onclick="closeModalAndNavigate('volume', ${title.pathInfo.volumeIndex})">${title.pathInfo.volume}</div>
            <div class="modal-meta-item">→</div>
            <div class="modal-meta-item modal-meta-link" onclick="closeModalAndNavigate('theme', ${title.pathInfo.volumeIndex}, ${title.pathInfo.themeIndex})">${title.pathInfo.theme}</div>
        `;
    } else {
        metaContainer.innerHTML = '';
    }

    // Save to history
    saveHistory(title);

    // Gera o HTML do conteúdo
    const publicationsHTML = navigationItems.map(pub => {
        const contentToShow = showTranslation && pub.translation ? pub.translation : pub.content;
        return `
        <div id="${pub.id}" class="publication">
            <div class="publication-header">${parseMarkdown(pub.displayTitle)}</div>
            <div class="publication-content">${parseMarkdown(contentToShow || '内容がありません')}</div>
        </div>
    `}).join('');

    document.getElementById('modalBody').innerHTML = navHTML + publicationsHTML;

    // Apply font size
    applyFontSize();

    // Update Footer Navigation
    updateModalFooter(title);

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function toggleModalNav(btn) {
    const content = document.getElementById('modalNavContent');
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.classList.remove('open');
        btn.classList.remove('active');
    } else {
        content.classList.add('open');
        content.style.maxHeight = content.scrollHeight + "px";
        btn.classList.add('active');
    }
}

function parseMarkdown(text) {
    if (!text) return '';

    // Bold: **text** or ＊＊text＊＊
    // Handles optional whitespace inside the bold tags
    let html = text.replace(/(?:\*\*|＊＊)\s*(.*?)\s*(?:\*\*|＊＊)/g, '<strong>$1</strong>');

    // Italic: *text* or ＊text＊
    html = html.replace(/(?:\*|＊)\s*(.*?)\s*(?:\*|＊)/g, '<em>$1</em>');

    return html;
}



function closeModal() {
    document.getElementById('contentModal').classList.add('hidden');
    document.body.style.overflow = '';
    // Hide footer when modal closes
    const footer = document.getElementById('modalNavFooter');
    if (footer) footer.classList.add('hidden');
}

// ============================================
// BREADCRUMB
// ============================================
// ============================================
// BREADCRUMB
// ============================================
function updateBreadcrumb(items) {
    const breadcrumb = document.getElementById('breadcrumb');
    window.breadcrumbActions = []; // Reset actions

    breadcrumb.innerHTML = items.map((item, index) => {
        if (item.action) {
            window.breadcrumbActions[index] = item.action;
        }

        return `
            <span class="breadcrumb-item ${item.active ? 'active' : ''}" 
                  ${item.action ? `onclick="window.breadcrumbActions[${index}]()"` : ''}>
                ${item.text}
            </span>
        `;
    }).join('');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function hideAllViews() {
    document.getElementById('volumesView').classList.add('hidden');
    document.getElementById('themesView').classList.add('hidden');
    document.getElementById('titlesView').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function formatVolumeName(name) {
    // Remove volume number prefix for cleaner display
    return name.replace(/^\d+\./, '').trim();
}

function extractThemeNumber(themeName) {
    // Extracts number from "1 - Theme Name" or "10. Theme Name"
    const match = themeName.match(/^(\d+)[-.\s]/);
    return match ? parseInt(match[1], 10) : null;
}

function groupNumberedTitles(titles) {
    const grouped = new Map();

    titles.forEach((title, index) => {
        // Special handling for separators to prevent merging
        if (title.title === '---') {
            grouped.set(`___SEPARATOR___${index}`, {
                title: '---',
                publications: []
            });
            return;
        }

        // Remove números do final do título (suporta 1, 2, ３, ４, etc.)
        const baseTitle = title.title.replace(/[　\s]*[0-9０-９１-９]+\s*$/, '').trim();

        if (grouped.has(baseTitle)) {
            // Adiciona publicações ao título existente
            grouped.get(baseTitle).publications.push(...title.publications);
        } else {
            // Cria nova entrada com o título base
            grouped.set(baseTitle, {
                title: baseTitle,
                publications: [...title.publications]
            });
        }
    });

    return Array.from(grouped.values());
}

// ============================================
// FONT SIZE CONTROL
// ============================================
function changeFontSize(action) {
    const sizes = ['small', 'medium', 'large', 'x-large'];
    const currentIndex = sizes.indexOf(currentFontSize);

    if (action === 'decrease' && currentIndex > 0) {
        currentFontSize = sizes[currentIndex - 1];
    } else if (action === 'increase' && currentIndex < sizes.length - 1) {
        currentFontSize = sizes[currentIndex + 1];
    } else if (action === 'reset') {
        currentFontSize = 'medium';
    }

    localStorage.setItem('modalFontSize', currentFontSize);
    applyFontSize();
}

function applyFontSize() {
    const modalBody = document.getElementById('modalBody');
    const fontSizes = {
        'small': '0.9rem',
        'medium': '1rem',
        'large': '1.1rem',
        'x-large': '1.2rem'
    };

    if (modalBody) {
        modalBody.style.fontSize = fontSizes[currentFontSize] || fontSizes['medium'];
    }
}

// ============================================
// MODAL NAVIGATION HELPERS
// ============================================
function closeModalAndNavigate(type, volumeIndex, themeIndex) {
    closeModal();

    if (type === 'volume' && volumeIndex >= 0) {
        showThemes(volumeIndex);
    } else if (type === 'theme' && volumeIndex >= 0 && themeIndex >= 0) {
        showTitles(volumeIndex, themeIndex);
    }
}

// ============================================
// TRANSLATION TOGGLE
// ============================================
function toggleTranslation() {
    showTranslation = !showTranslation;
    const translationButton = document.getElementById('translationButton');

    if (showTranslation) {
        translationButton.classList.add('active');
    } else {
        translationButton.classList.remove('active');
    }

    // Reload content with translation toggle
    if (currentTitleData) {
        showContent(currentTitleData);
    }
}

// ============================================
// SCROLL TO TOP
// ============================================
function setupScrollToTop() {
    const goToTopBtn = document.getElementById('goToTopBtn');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            goToTopBtn.classList.add('visible');
        } else {
            goToTopBtn.classList.remove('visible');
        }
    });

    goToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ============================================
// MOBILE FOOTER NAVIGATION
// ============================================
let currentNavContext = { list: null, index: -1 };
let footerHideTimeout;

function updateModalFooter(titleData) {
    const footer = document.getElementById('modalNavFooter');
    if (!footer) return;

    // Determine context
    currentNavContext.list = null;

    // Check if in current grouped titles (Theme)
    if (window.currentGroupedTitles && window.currentGroupedTitles.some(t => t.title === titleData.title)) {
        currentNavContext.list = window.currentGroupedTitles;
    }
    // Check if in search results
    else if (window.currentSearchResults && window.currentSearchResults.some(r => r.title.title === titleData.title)) {
        currentNavContext.list = window.currentSearchResults.map(r => r.title);
    }

    // Find index
    if (currentNavContext.list) {
        currentNavContext.index = currentNavContext.list.findIndex(t => t.title === titleData.title);
    } else {
        currentNavContext.index = -1;
    }

    // Update UI
    const prevBtn = document.getElementById('prevTitleBtn');
    const nextBtn = document.getElementById('nextTitleBtn');

    if (currentNavContext.index !== -1) {
        prevBtn.disabled = currentNavContext.index <= 0;
        nextBtn.disabled = currentNavContext.index >= currentNavContext.list.length - 1;
    } else {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }

    resetFooterHideTimer();
}

function navigateModal(direction) {
    if (!currentNavContext.list || currentNavContext.index === -1) return;

    const newIndex = currentNavContext.index + direction;
    if (newIndex >= 0 && newIndex < currentNavContext.list.length) {
        // Need to ensure pathInfo preservation if possible, but showContent takes titleData.
        // The objects in currentGroupedTitles usually have pathInfo if it was set? 
        // In openContentByIndex we injected it. We should inject it here too if missing.
        // But simpler: just pass the object from the list. 
        // Wait, currentGroupedTitles objects don't store the pathInfo permanently unless we modified them in place?
        // openContentByIndex modified the object in the array? Yes: `titleData = ...; titleData.pathInfo = ...`
        // So safe to assume it's good.

        // For search results, we constructed a new object in openSearchResultByIndex?
        // Let's check openSearchResultByIndex. It passed titleWithContext to showContent.
        // It did NOT modify window.currentSearchResults items.
        // So navigating via search results might lose pathInfo unless we reconstruct it.
        // However, if we reuse the logic...

        let nextTitle = currentNavContext.list[newIndex];

        // If coming from search results, nextTitle is just the raw title object from JSON.
        // We need to re-inject path info if it's missing.
        if (!nextTitle.pathInfo && window.currentSearchResults) {
            // Try to find it in search results to get metadata
            const res = window.currentSearchResults.find(r => r.title.title === nextTitle.title);
            if (res) {
                // Reconstruct context
                // Note: we can't easily call openSearchResultByIndex because it takes index in search list.
                // But we have the index in the mapped list, which corresponds to search results index.
                // So we CAN call openSearchResultByIndex if we are in search mode!

                // BUT currentNavContext.list is just a map of titles.
                // If we are in search mode, we should just use openSearchResultByIndex(newIndex).
                if (window.currentSearchResults.length === currentNavContext.list.length) {
                    openSearchResultByIndex(newIndex);
                    return;
                }
            }
        }

        // Check if we are in Theme mode
        if (window.currentGroupedTitles && window.currentGroupedTitles.length === currentNavContext.list.length) {
            openContentByIndex(newIndex);
            return;
        }

        // Fallback
        showContent(nextTitle);
    }
}

function resetFooterHideTimer() {
    const footer = document.getElementById('modalNavFooter');
    if (!footer) return;

    footer.classList.remove('hidden');

    if (footerHideTimeout) clearTimeout(footerHideTimeout);

    footerHideTimeout = setTimeout(() => {
        // Only hide if modal is still open
        if (!document.getElementById('contentModal').classList.contains('hidden')) {
            footer.classList.add('hidden');
        }
    }, 3000);
}

function setupModalFooter() {
    const footer = document.getElementById('modalNavFooter');
    const prevBtn = document.getElementById('prevTitleBtn');
    const nextBtn = document.getElementById('nextTitleBtn');
    const closeBtn = document.getElementById('closeModalFooterBtn');
    const modalBody = document.getElementById('modalBody');

    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateModal(-1);
    });

    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateModal(1);
    });

    if (closeBtn) closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });

    // Auto-hide triggers
    const reset = () => resetFooterHideTimer();

    if (modalBody) {
        modalBody.addEventListener('scroll', reset, { passive: true });
        modalBody.addEventListener('click', reset);
        modalBody.addEventListener('touchstart', reset, { passive: true });
    }
}

// ============================================
// INITIALIZE ON LOAD
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupScrollToTop();
    setupModalFooter();
    document.getElementById('closeAllThemesBtn').addEventListener('click', toggleAllThemes);
    renderHistory();
});

// ============================================
// HISTORY NAVIGATION
// ============================================
const HISTORY_KEY = 'shin_college_history';
const MAX_HISTORY = 50;

function saveHistory(titleData) {
    if (!titleData || !titleData.title) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) {
        history = [];
    }

    // Remove if exists to move to top
    history = history.filter(item => item.title !== titleData.title);

    // Store
    history.unshift({
        title: titleData.title,
        volume: titleData.pathInfo ? titleData.pathInfo.volume : '',
        theme: titleData.pathInfo ? titleData.pathInfo.theme : '',
        data: titleData
    });

    if (history.length > MAX_HISTORY) history.pop();

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function clearHistory() {
    if (confirm('閲覧履歴を消去してもよろしいですか？')) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    }
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const container = document.getElementById('historySection');
    const clearBtn = document.getElementById('clearHistoryBtn');

    if (!list || !container) return;

    let history = [];
    try {
        history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch (e) {
        history = [];
    }

    if (history.length === 0) {
        container.classList.add('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
        return;
    }

    // Show components
    container.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.remove('hidden');

    list.innerHTML = history.map((item, index) => `
        <div class="history-item" onclick="openHistoryItem(${index})">
            <div class="history-item-title">${item.title}</div>
            <div class="history-item-path">${item.volume || ''} → ${item.theme || ''}</div>
        </div>
    `).join('');
}

function openHistoryItem(index) {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const item = history[index];
    if (item && item.data) {
        showContent(item.data);
    }
}

function toggleHistory() {
    const list = document.getElementById('historyList');
    const icon = document.getElementById('historyArrow');

    if (list.classList.contains('open')) {
        list.classList.remove('open');
        icon.style.transform = 'rotate(0deg)';
    } else {
        list.classList.add('open');
        icon.style.transform = 'rotate(180deg)';
    }
}



function updateModalFooter(titleData) {
    const footer = document.getElementById('modalNavFooter');
    if (!footer) return;

    // Determine context
    currentNavContext.list = null;

    // Check if in current grouped titles (Theme)
    if (window.currentGroupedTitles && window.currentGroupedTitles.some(t => t.title === titleData.title)) {
        currentNavContext.list = window.currentGroupedTitles;
    }
    // Check if in search results
    else if (window.currentSearchResults && window.currentSearchResults.some(r => r.title.title === titleData.title)) {
        currentNavContext.list = window.currentSearchResults.map(r => r.title);
    }
    // Context Recovery: If missing, attempt to reconstruct from pathInfo
    else if (titleData.pathInfo && typeof data !== 'undefined') {
        const vol = data[titleData.pathInfo.volumeIndex];
        if (vol && vol.themes[titleData.pathInfo.themeIndex]) {
            // Reconstruct the title list for this theme
            currentNavContext.list = vol.themes[titleData.pathInfo.themeIndex].titles;
        }
    }

    // Find index
    if (currentNavContext.list) {
        // Use loose comparison for safety or fallback to string match
        currentNavContext.index = currentNavContext.list.findIndex(t => {
            const tTitle = (t.title || t).toString().trim();
            const currentTitle = (titleData.title || titleData).toString().trim();
            // Try strict match first, then loose
            if (tTitle === currentTitle) return true;
            // Handle cases where title might differ slightly in structure but be logically same
            if (t.pathInfo && titleData.pathInfo) {
                return t.pathInfo.volumeIndex === titleData.pathInfo.volumeIndex &&
                    t.pathInfo.themeIndex === titleData.pathInfo.themeIndex &&
                    t.pathInfo.titleIndex === titleData.pathInfo.titleIndex;
            }
            return false;
        });
    } else {
        currentNavContext.index = -1;
    }

    // Update UI
    const prevBtn = document.getElementById('prevTitleBtn');
    const nextBtn = document.getElementById('nextTitleBtn');

    if (currentNavContext.index !== -1) {
        prevBtn.disabled = currentNavContext.index <= 0;
        nextBtn.disabled = currentNavContext.index >= currentNavContext.list.length - 1;
    } else {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    }

    resetFooterHideTimer();
}

function navigateModal(direction) {
    if (!currentNavContext.list || currentNavContext.index === -1) return;

    const newIndex = currentNavContext.index + direction;
    if (newIndex < 0 || newIndex >= currentNavContext.list.length) return;

    let nextTitle = currentNavContext.list[newIndex];

    // Ensure pathInfo exists by copying from current title if needed
    if (!nextTitle.pathInfo && currentTitleData && currentTitleData.pathInfo) {
        // Calculate the new title index if we know the theme structure
        if (typeof data !== 'undefined') {
            const vol = data[currentTitleData.pathInfo.volumeIndex];
            if (vol && vol.themes[currentTitleData.pathInfo.themeIndex]) {
                const themeList = vol.themes[currentTitleData.pathInfo.themeIndex].titles;
                const actualIndex = themeList.findIndex(t => (t.title || t) === (nextTitle.title || nextTitle));
                if (actualIndex !== -1) {
                    nextTitle = {
                        ...nextTitle,
                        pathInfo: {
                            volume: currentTitleData.pathInfo.volume,
                            theme: currentTitleData.pathInfo.theme,
                            volumeIndex: currentTitleData.pathInfo.volumeIndex,
                            themeIndex: currentTitleData.pathInfo.themeIndex,
                            titleIndex: actualIndex
                        }
                    };
                }
            }
        }
    }

    // Always use showContent - it handles everything correctly
    showContent(nextTitle);
}

function resetFooterHideTimer() {
    const footer = document.getElementById('modalNavFooter');
    if (!footer) return;

    footer.classList.remove('hidden');

    if (footerHideTimeout) clearTimeout(footerHideTimeout);

    footerHideTimeout = setTimeout(() => {
        // Only hide if modal is still open
        if (!document.getElementById('contentModal').classList.contains('hidden')) {
            footer.classList.add('hidden');
        }
    }, 5000);
}

function setupModalFooter() {
    const footer = document.getElementById('modalNavFooter');
    const prevBtn = document.getElementById('prevTitleBtn');
    const nextBtn = document.getElementById('nextTitleBtn');
    const closeBtn = document.getElementById('closeModalFooterBtn');

    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateModal(-1);
    });

    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateModal(1);
    });

    if (closeBtn) closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });

    // Auto-hide triggers - Listen globally for better reliability
    const reset = () => resetFooterHideTimer();

    window.addEventListener('scroll', reset, { passive: true });
    document.addEventListener('click', reset);
    document.addEventListener('touchstart', reset, { passive: true });
    document.addEventListener('mousemove', reset, { passive: true });
}
