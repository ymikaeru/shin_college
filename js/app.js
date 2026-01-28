// ============================================
// STATE MANAGEMENT
// ============================================
let data = [];
let currentVolume = null;
let currentTheme = null;
let searchTerm = '';

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
            <div class="title-item-publications">
                ${result.volume} / ${result.theme}
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
        // Inject path info into the title object for the modal
        const titleWithContext = {
            ...result.title,
            pathInfo: {
                volume: formatVolumeName(result.volume),
                theme: result.theme
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
                    ${themeCount} カテゴリ · ${titleCount} 文献
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
    document.getElementById('backToVolumes').style.display = 'inline-flex';

    const container = document.getElementById('themesList');
    container.innerHTML = volume.themes.map((theme, themeIndex) => {
        const titleCount = theme.titles.length;

        return `
            <div class="card" onclick="showTitles(${volumeIndex}, ${themeIndex})">
                <div class="card-title">${theme.theme}</div>
                <div class="card-subtitle">
                    ${titleCount} 文献
                </div>
            </div>
        `;
    }).join('');

    updateBreadcrumb([
        { text: '巻一覧', action: showVolumes },
        { text: formatVolumeName(volume.volume), active: true }
    ]);
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
            <div class="title-item-publications">
                ${title.publications.slice(0, 2).map(pub => parseMarkdown(pub.source)).join(' · ')}
                ${title.publications.length > 2 ? ` · +${title.publications.length - 2}` : ''}
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
        showContent(window.currentGroupedTitles[index]);
    }
}

// ============================================
// MODAL CONTENT
// ============================================
function showContent(title) {
    const modal = document.getElementById('contentModal');
    document.getElementById('modalTitle').textContent = title.title;

    // Processa os dados para navegação e conteúdo
    const processedPubs = title.publications
        .filter(pub => pub.content && pub.content.trim()) // Filter out empty content
        .map((pub, index) => ({
            ...pub,
            id: `pub-${index}`,
            displayTitle: pub.header || (pub.type === 'intro' ? 'はじめに' : '無題')
        }));

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
    const navHTML = `
        <div class="modal-nav">
            ${navigationItems.map(item => `
                <button class="modal-nav-item" onclick="document.getElementById('${item.id}').scrollIntoView({ behavior: 'smooth' })">
                    ${parseMarkdown(item.label)}
                </button>
            `).join('')}
        </div>
    `;

    // Metadados - Caminho do conteúdo
    const metaContainer = document.getElementById('modalMeta');
    if (title.pathInfo) {
        metaContainer.innerHTML = `
            <div class="modal-meta-item">${title.pathInfo.volume}</div>
            <div class="modal-meta-item">${title.pathInfo.theme}</div>
        `;
    } else {
        metaContainer.innerHTML = '';
    }

    // Gera o HTML do conteúdo
    const publicationsHTML = navigationItems.map(pub => `
        <div id="${pub.id}" class="publication">
            <div class="publication-header">${parseMarkdown(pub.displayTitle)}</div>
            <div class="publication-content">${parseMarkdown(pub.content || '内容がありません')}</div>
        </div>
    `).join('');

    document.getElementById('modalBody').innerHTML = navHTML + publicationsHTML;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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
// INITIALIZE ON LOAD
// ============================================
document.addEventListener('DOMContentLoaded', loadData);
