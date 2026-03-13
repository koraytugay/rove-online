let activeElement = null;
let offsetX = 0;
let offsetY = 0;
let selectedImages = new Set();
let relativePositions = [];
let savedState = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let originalDragPosition = { left: 0, top: 0 };

// Undo/Redo system
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Zoom system
let zoomLevel = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

// Grid configuration - spacing based on initial layout
const GRID_SPACING_X = 250; // Horizontal spacing between image centers
const GRID_SPACING_Y = 175; // Vertical spacing between image centers
let GRID_ORIGIN_X = 0;
let GRID_ORIGIN_Y = 0;
let IMAGE_WIDTH = 0; // Store actual unscaled image width
let IMAGE_HEIGHT = 0; // Store actual unscaled image height

const imageWrappers = document.querySelectorAll('.image-wrapper');

// Now we drag the wrappers, not the images
imageWrappers.forEach((wrapper, index) => {
    const img = wrapper.querySelector('.draggable');

    img.addEventListener('mousedown', (e) => {
        startDrag(e, wrapper);
    });
    img.addEventListener('click', (e) => {
        handleImageClick(e, wrapper);
    });
});

// Add flip button handlers
document.querySelectorAll('.flip-btn').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wrapper = imageWrappers[index];
        const img = wrapper.querySelector('.draggable');
        flipImage(img);
    });
});

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);
document.addEventListener('click', handleBackgroundClick);
document.addEventListener('keydown', handleKeyPress);

// Add button event listeners
document.getElementById('centerBtn').addEventListener('click', centerImages);
document.getElementById('selectAllBtn').addEventListener('click', toggleSelectAll);
document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('saveBtn').addEventListener('click', saveState);
document.getElementById('restoreBtn').addEventListener('click', restoreState);
document.getElementById('copyLinkBtn').addEventListener('click', copyLinkToClipboard);
document.getElementById('gridBtn').addEventListener('click', toggleGridOverlay);
document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
document.getElementById('hideBtn').addEventListener('click', toggleButtons);

function handleBackgroundClick(e) {
    // Check if click is not on an image or button
    const isImage = e.target.classList.contains('draggable');
    const isButton = e.target.tagName === 'BUTTON' || e.target.closest('.button-container') || e.target.closest('.flip-btn');

    if (!isImage && !isButton && selectedImages.size > 0) {
        // Deselect all
        selectedImages.clear();
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('.draggable');
            img.classList.remove('selected');
        });
    }
}

function handleKeyPress(e) {
    if (e.key === 'a' || e.key === 'A') {
        toggleSelectAll();
    } else if (e.key === 'c' || e.key === 'C') {
        centerImages();
    } else if (e.key === 'n' || e.key === 'N') {
        newGame();
    } else if (e.key === 's' || e.key === 'S') {
        saveState();
    } else if (e.key === 'r' || e.key === 'R') {
        restoreState();
    } else if (e.key === 'l' || e.key === 'L') {
        copyLinkToClipboard();
    } else if (e.key === 'g' || e.key === 'G') {
        toggleGridOverlay();
    } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
    } else if (e.key === 'h' || e.key === 'H') {
        toggleButtons();
    } else if (e.key === 'ArrowLeft') {
        undo();
    } else if (e.key === 'ArrowRight') {
        redo();
    } else if (e.key === '+' || e.key === '=') {
        zoomIn();
    } else if (e.key === '-' || e.key === '_') {
        zoomOut();
    }
}

function saveState() {
    savedState = {
        images: Array.from(imageWrappers).map(wrapper => {
            const img = wrapper.querySelector('.draggable');
            return {
                id: wrapper.id,
                left: wrapper.style.left,
                top: wrapper.style.top,
                src: img.src
            };
        }),
        gridOrigin: {
            x: GRID_ORIGIN_X,
            y: GRID_ORIGIN_Y
        }
    };

    showToast('State Saved');
}

function restoreState() {
    if (savedState) {
        // Clear selections
        selectedImages.clear();
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('.draggable');
            img.classList.remove('selected');
        });

        // Use applyState for consistency
        applyState(savedState);

        // Add to history after restore
        addToHistory();

        showToast('State Restored');
    }
}

function copyLinkToClipboard() {
    const state = captureState();
    const stateJson = JSON.stringify(state);
    const stateBase64 = btoa(stateJson);

    const url = window.location.origin + window.location.pathname + '#' + stateBase64;

    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link Copied to Clipboard');
    }).catch(err => {
        showToast('Failed to Copy Link');
    });
}

function loadStateFromHash() {
    const hash = window.location.hash.substring(1); // Remove the '#'

    if (hash) {
        try {
            const stateJson = atob(hash);
            const state = JSON.parse(stateJson);
            applyState(state);
            // Center images to fix any positioning issues
            centerImages();
            recalculateGridOrigin();
            // Delay toast slightly to ensure page is ready
            setTimeout(() => {
                showToast('Loaded State from URL');
            }, 100);
        } catch (err) {
            console.error('Failed to load state from hash:', err);
        }
    }
}

// Track if shuffle is in progress to prevent multiple simultaneous shuffles
let isShuffling = false;

function newGame() {
    // Prevent multiple shuffles at once
    if (isShuffling) return;
    isShuffling = true;

    // Clear URL hash
    window.history.replaceState(null, '', window.location.pathname);

    // Reset all images to front side
    imageWrappers.forEach((wrapper, index) => {
        const img = wrapper.querySelector('.draggable');
        const imageName = img.dataset.name;
        img.src = `resources/${imageName}-front.png`;
        img.classList.remove('selected');
    });

    // Clear selections
    selectedImages.clear();

    showToast('Shuffling...');

    // Shuffle 10 times with 0.2 second delay between each
    let shuffleCount = 0;
    const shuffleInterval = setInterval(() => {
        shuffleImagePositions();
        centerImages();
        recalculateGridOrigin();

        shuffleCount++;
        if (shuffleCount >= 10) {
            clearInterval(shuffleInterval);
            // Add final state to history
            addToHistory();
            showToast('New Game Started');
            isShuffling = false;
        }
    }, 200);
}

// Randomize which image goes in which position
function shuffleImagePositions() {
    const positions = [
        { top: '150px', left: '200px' },
        { top: '150px', left: '450px' },
        { top: '150px', left: '700px' },
        { top: '325px', left: '200px' },
        { top: '325px', left: '450px' },
        { top: '325px', left: '700px' }
    ];

    // Shuffle positions array
    for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    // Assign shuffled positions to wrappers
    imageWrappers.forEach((wrapper, index) => {
        wrapper.style.top = positions[index].top;
        wrapper.style.left = positions[index].left;
    });
}

// Initialize grid and positions
function initializeGrid() {

    // Shuffle positions first
    shuffleImagePositions();

    // Store image dimensions from the first wrapper
    const firstWrapper = imageWrappers[0];
    const rect = firstWrapper.getBoundingClientRect();
    IMAGE_WIDTH = rect.width;
    IMAGE_HEIGHT = rect.height;

    // Calculate initial grid origin
    recalculateGridOrigin();
}

// Recalculate grid origin based on current image positions
function recalculateGridOrigin() {
    // Use the first wrapper's center as grid origin
    const firstWrapper = imageWrappers[0];
    const firstLeft = parseFloat(firstWrapper.style.left);
    const firstTop = parseFloat(firstWrapper.style.top);

    // Set grid origin to the center of the first wrapper
    GRID_ORIGIN_X = firstLeft + IMAGE_WIDTH / 2;
    GRID_ORIGIN_Y = firstTop + IMAGE_HEIGHT / 2;

    // Update grid overlay if visible
    updateGridOverlayIfVisible();
}

// Preload all back images
function preloadBackImages() {
    const imageNames = ['brain', 'coil', 'gripper', 'laser', 'motor', 'sensor'];
    imageNames.forEach(name => {
        const img = new Image();
        img.src = `resources/${name}-back.png`;
    });
}

preloadBackImages();

// Check if loading from URL hash
const hasUrlState = window.location.hash.length > 1;

if (!hasUrlState) {
    // Normal initialization - shuffle and center
    initializeGrid();
    centerImages();
    recalculateGridOrigin();
} else {
    // Loading from URL - just initialize grid structure
    initializeGrid();
}

// Load state from URL hash if present
loadStateFromHash();

// Show images after positioning is complete
imageWrappers.forEach(wrapper => {
    wrapper.classList.add('loaded');
});

// Initialize history with initial state
addToHistory();

// Grid overlay functionality
function createGridOverlay() {
    const gridOverlay = document.getElementById('gridOverlay');
    if (!gridOverlay) return;

    // Clear existing overlays
    gridOverlay.innerHTML = '';

    // Calculate viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get all current image positions to avoid showing previews there
    const occupiedPositions = new Set();
    imageWrappers.forEach(wrapper => {
        const wrapperLeft = parseFloat(wrapper.style.left);
        const wrapperTop = parseFloat(wrapper.style.top);
        const centerX = wrapperLeft + IMAGE_WIDTH / 2;
        const centerY = wrapperTop + IMAGE_HEIGHT / 2;

        const offsetFromOriginX = centerX - GRID_ORIGIN_X;
        const offsetFromOriginY = centerY - GRID_ORIGIN_Y;

        const gridIndexX = Math.round(offsetFromOriginX / GRID_SPACING_X);
        const gridIndexY = Math.round(offsetFromOriginY / GRID_SPACING_Y);

        occupiedPositions.add(`${gridIndexX},${gridIndexY}`);
    });

    // Show rectangles at all grid positions that aren't occupied
    const startX = Math.floor((0 - GRID_ORIGIN_X) / GRID_SPACING_X) - 1;
    const endX = Math.ceil((viewportWidth - GRID_ORIGIN_X) / GRID_SPACING_X) + 1;
    const startY = Math.floor((0 - GRID_ORIGIN_Y) / GRID_SPACING_Y) - 1;
    const endY = Math.ceil((viewportHeight - GRID_ORIGIN_Y) / GRID_SPACING_Y) + 1;

    for (let gridX = startX; gridX <= endX; gridX++) {
        for (let gridY = startY; gridY <= endY; gridY++) {
            // Skip if this position is occupied
            if (occupiedPositions.has(`${gridX},${gridY}`)) {
                continue;
            }

            const centerX = GRID_ORIGIN_X + gridX * GRID_SPACING_X;
            const centerY = GRID_ORIGIN_Y + gridY * GRID_SPACING_Y;

            const rectLeft = centerX - IMAGE_WIDTH / 2;
            const rectTop = centerY - IMAGE_HEIGHT / 2;

            // Only show if within viewport
            if (rectLeft + IMAGE_WIDTH > 0 && rectLeft < viewportWidth &&
                rectTop + IMAGE_HEIGHT > 0 && rectTop < viewportHeight) {

                const rect = document.createElement('div');
                rect.className = 'grid-rect';
                rect.style.position = 'absolute';
                rect.style.width = IMAGE_WIDTH + 'px';
                rect.style.height = IMAGE_HEIGHT + 'px';
                rect.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
                rect.style.borderRadius = '8px';
                rect.style.pointerEvents = 'none';
                rect.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                rect.style.left = rectLeft + 'px';
                rect.style.top = rectTop + 'px';

                gridOverlay.appendChild(rect);
            }
        }
    }
}

function toggleGridOverlay() {
    const gridOverlay = document.getElementById('gridOverlay');
    if (!gridOverlay) return;

    if (gridOverlay.classList.contains('visible')) {
        // Hide grid
        gridOverlay.classList.remove('visible');
    } else {
        // Show grid
        createGridOverlay();
        gridOverlay.classList.add('visible');
    }
}

function updateGridOverlayIfVisible() {
    const gridOverlay = document.getElementById('gridOverlay');
    if (gridOverlay && gridOverlay.classList.contains('visible')) {
        createGridOverlay();
    }
}

// Initialize grid overlay on page load
setTimeout(() => {
    createGridOverlay();
    const gridOverlay = document.getElementById('gridOverlay');
    if (gridOverlay) {
        gridOverlay.classList.add('visible');
    }
}, 100);

// Fullscreen functionality
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Toggle button visibility
function toggleButtons() {
    const buttonContainer = document.querySelector('.button-container');
    if (buttonContainer) {
        buttonContainer.classList.toggle('hidden');
    }
}

// Toast notification
let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    // Clear existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Hide after 3 seconds
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        toastTimeout = null;
    }, 3000);
}

// Undo/Redo system
function captureState() {
    return {
        images: Array.from(imageWrappers).map(wrapper => {
            const img = wrapper.querySelector('.draggable');
            return {
                id: wrapper.id,
                left: wrapper.style.left,
                top: wrapper.style.top,
                src: img.src
            };
        }),
        gridOrigin: {
            x: GRID_ORIGIN_X,
            y: GRID_ORIGIN_Y
        }
    };
}

function applyState(state) {
    if (!state) return;

    state.images.forEach(imgState => {
        const wrapper = document.getElementById(imgState.id);
        if (wrapper) {
            wrapper.style.left = imgState.left;
            wrapper.style.top = imgState.top;
            const img = wrapper.querySelector('.draggable');
            if (img) {
                img.src = imgState.src;
            }
        }
    });

    if (state.gridOrigin) {
        GRID_ORIGIN_X = state.gridOrigin.x;
        GRID_ORIGIN_Y = state.gridOrigin.y;

        // Update grid overlay if visible
        updateGridOverlayIfVisible();
    }
}

function addToHistory() {
    const currentState = captureState();

    // Check if state actually changed compared to last history entry
    if (history.length > 0) {
        const lastState = history[historyIndex];
        if (statesAreEqual(currentState, lastState)) {
            // No change, don't add to history
            return;
        }
    }

    // Remove any states after current index (when making new change after undo)
    history = history.slice(0, historyIndex + 1);

    // Add new state
    history.push(currentState);

    // Limit history size
    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyIndex++;
    }
}

function statesAreEqual(state1, state2) {
    if (!state1 || !state2) return false;

    // Check if grid origins are the same
    if (state1.gridOrigin.x !== state2.gridOrigin.x ||
        state1.gridOrigin.y !== state2.gridOrigin.y) {
        return false;
    }

    // Check if all image positions and sources are the same
    if (state1.images.length !== state2.images.length) return false;

    for (let i = 0; i < state1.images.length; i++) {
        const img1 = state1.images[i];
        const img2 = state2.images[i];

        if (img1.id !== img2.id ||
            img1.left !== img2.left ||
            img1.top !== img2.top ||
            img1.src !== img2.src) {
            return false;
        }
    }

    return true;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        applyState(history[historyIndex]);
        showToast('Undo');
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        applyState(history[historyIndex]);
        showToast('Redo');
    }
}

// Zoom controls
function zoomIn() {
    if (zoomLevel < MAX_ZOOM) {
        zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
        applyZoom();
        showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`);
    }
}

function zoomOut() {
    if (zoomLevel > MIN_ZOOM) {
        zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
        applyZoom();
        showToast(`Zoom: ${Math.round(zoomLevel * 100)}%`);
    }
}

function applyZoom() {
    const container = document.querySelector('.container');
    if (container) {
        container.style.transform = `scale(${zoomLevel})`;
        container.style.transformOrigin = 'center center';
    }
}


function toggleSelectAll() {
    if (selectedImages.size === imageWrappers.length) {
        // Deselect all
        selectedImages.clear();
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('.draggable');
            img.classList.remove('selected');
        });
    } else {
        // Select all
        selectedImages.clear();
        imageWrappers.forEach(wrapper => {
            const img = wrapper.querySelector('.draggable');
            selectedImages.add(wrapper);
            img.classList.add('selected');
        });
    }
}

function handleImageClick(e, wrapper) {
    // Only toggle selection if we didn't drag
    if (!isDragging) {
        e.stopPropagation();
        const img = wrapper.querySelector('.draggable');

        if (selectedImages.has(wrapper)) {
            selectedImages.delete(wrapper);
            img.classList.remove('selected');
        } else {
            selectedImages.add(wrapper);
            img.classList.add('selected');
        }
    }
}

function flipImage(img) {
    const imageName = img.dataset.name;
    const currentSrc = img.src;

    // Add flip animation
    img.classList.add('flipping');

    // Change image at halfway point of animation
    setTimeout(() => {
        if (currentSrc.includes('-front.png')) {
            img.src = `resources/${imageName}-back.png`;
        } else {
            img.src = `resources/${imageName}-front.png`;
        }
    }, 300);

    // Remove animation class after it completes and add to history
    setTimeout(() => {
        img.classList.remove('flipping');
        // Add to history after flip is complete
        addToHistory();
    }, 600);
}

function startDrag(e, wrapper) {
    activeElement = wrapper;
    activeElement.style.zIndex = 1000;
    activeElement.classList.add('dragging');
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // Store original position before dragging
    originalDragPosition.left = parseFloat(activeElement.style.left) || 0;
    originalDragPosition.top = parseFloat(activeElement.style.top) || 0;

    const rect = activeElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // If images are selected and we're dragging one of them, calculate relative positions
    if (selectedImages.size > 0 && selectedImages.has(activeElement)) {
        const activeRect = activeElement.getBoundingClientRect();
        relativePositions = Array.from(selectedImages).map(wrapper => {
            // Add dragging class to all selected images
            wrapper.classList.add('dragging');
            const wrapperRect = wrapper.getBoundingClientRect();
            return {
                element: wrapper,
                dx: wrapperRect.left - activeRect.left,
                dy: wrapperRect.top - activeRect.top
            };
        });
    } else {
        relativePositions = [];
    }

    e.preventDefault();
}

function drag(e) {
    if (activeElement) {
        // Check if mouse has moved enough to be considered a drag
        const distanceMoved = Math.abs(e.clientX - dragStartX) + Math.abs(e.clientY - dragStartY);
        if (distanceMoved > 5) {
            isDragging = true;
        }

        if (isDragging) {
            e.preventDefault();

            if (relativePositions.length > 0) {
                // Move all selected images together
                const newLeft = e.clientX - offsetX;
                const newTop = e.clientY - offsetY;

                relativePositions.forEach(rel => {
                    rel.element.style.left = (newLeft + rel.dx) + 'px';
                    rel.element.style.top = (newTop + rel.dy) + 'px';
                });

                // Only show drag preview if not all images are selected
                if (relativePositions.length < imageWrappers.length) {
                    updateDragPreview(newLeft, newTop);
                }
            } else {
                // Move single image
                const newLeft = e.clientX - offsetX;
                const newTop = e.clientY - offsetY;
                activeElement.style.left = newLeft + 'px';
                activeElement.style.top = newTop + 'px';

                // Update drag preview
                updateDragPreview(newLeft, newTop);
            }
        }
    }
}

function updateDragPreview(left, top) {
    // Calculate where the image will snap to
    const tempWrapper = document.createElement('div');
    tempWrapper.style.left = left + 'px';
    tempWrapper.style.top = top + 'px';

    const centerX = left + IMAGE_WIDTH / 2;
    const centerY = top + IMAGE_HEIGHT / 2;

    const offsetFromOriginX = centerX - GRID_ORIGIN_X;
    const offsetFromOriginY = centerY - GRID_ORIGIN_Y;

    const gridIndexX = Math.round(offsetFromOriginX / GRID_SPACING_X);
    const gridIndexY = Math.round(offsetFromOriginY / GRID_SPACING_Y);

    const nearestGridX = GRID_ORIGIN_X + gridIndexX * GRID_SPACING_X;
    const nearestGridY = GRID_ORIGIN_Y + gridIndexY * GRID_SPACING_Y;

    const snappedLeft = nearestGridX - IMAGE_WIDTH / 2;
    const snappedTop = nearestGridY - IMAGE_HEIGHT / 2;

    // Create or update preview
    let preview = document.getElementById('dragPreview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'dragPreview';
        preview.style.position = 'absolute';
        preview.style.width = IMAGE_WIDTH + 'px';
        preview.style.height = IMAGE_HEIGHT + 'px';
        preview.style.border = '3px dashed rgba(255, 255, 255, 0.5)';
        preview.style.borderRadius = '8px';
        preview.style.pointerEvents = 'none';
        preview.style.zIndex = '999';
        preview.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        document.querySelector('.container').appendChild(preview);
    }

    preview.style.left = snappedLeft + 'px';
    preview.style.top = snappedTop + 'px';
}

function stopDrag(e) {
    // Remove drag preview
    const dragPreview = document.getElementById('dragPreview');
    if (dragPreview) {
        dragPreview.remove();
    }

    if (activeElement && isDragging) {
        // Remove dragging class
        activeElement.classList.remove('dragging');
        if (relativePositions.length > 0) {
            relativePositions.forEach(rel => {
                rel.element.classList.remove('dragging');
            });
        }

        // Check if dropped on another wrapper (only for single wrapper drag, not multiple selection)
        if (relativePositions.length === 0) {
            const dropTarget = getImageUnderMouse(e.clientX, e.clientY, activeElement);
            if (dropTarget && dropTarget !== activeElement) {
                swapImagePositions(activeElement, dropTarget);
                // Add to history after swap
                addToHistory();
                // Update grid overlay if visible
                updateGridOverlayIfVisible();
                activeElement.style.zIndex = 1;
                activeElement = null;
                relativePositions = [];
                return;
            }
        }

        // Check if all images are selected
        const allImagesSelected = relativePositions.length === imageWrappers.length;

        if (allImagesSelected) {
            // If all images were moved together, don't snap - just recalculate grid origin
            recalculateGridOrigin();
        } else {
            // Snap to grid for partial selections
            if (relativePositions.length > 0) {
                // Snap all selected wrappers to grid
                relativePositions.forEach(rel => {
                    snapToGrid(rel.element);
                });
            } else {
                // Snap single wrapper to grid
                snapToGrid(activeElement);
            }
        }

        // Add to history AFTER snapping/grid recalculation
        addToHistory();

        // Update grid overlay if visible
        updateGridOverlayIfVisible();

        activeElement.style.zIndex = 1;
        activeElement = null;
        relativePositions = [];
    } else if (activeElement) {
        activeElement.classList.remove('dragging');
        activeElement.style.zIndex = 1;
        activeElement = null;
        relativePositions = [];
    }
}

function getImageUnderMouse(x, y, excludeElement) {

    // Temporarily hide the dragged element to check what's underneath
    const originalPointerEvents = excludeElement.style.pointerEvents;
    excludeElement.style.pointerEvents = 'none';

    const elementUnderMouse = document.elementFromPoint(x, y);

    excludeElement.style.pointerEvents = originalPointerEvents;

    // Check if it's one of our image wrappers or draggable images
    let targetWrapper = null;
    if (elementUnderMouse) {
        if (elementUnderMouse.classList.contains('image-wrapper')) {
            targetWrapper = elementUnderMouse;
        } else if (elementUnderMouse.classList.contains('draggable')) {
            targetWrapper = elementUnderMouse.closest('.image-wrapper');
        }
    }

    if (targetWrapper) {
        return targetWrapper;
    }
    return null;
}

function swapImagePositions(wrapper1, wrapper2) {

    // Use wrapper1's ORIGINAL position (before drag) and wrapper2's current position
    const wrapper1OriginalLeft = originalDragPosition.left + 'px';
    const wrapper1OriginalTop = originalDragPosition.top + 'px';
    const wrapper2Left = wrapper2.style.left;
    const wrapper2Top = wrapper2.style.top;


    // Move wrapper1 to where wrapper2 was
    wrapper1.style.left = wrapper2Left;
    wrapper1.style.top = wrapper2Top;

    // Move wrapper2 to where wrapper1 originally was
    wrapper2.style.left = wrapper1OriginalLeft;
    wrapper2.style.top = wrapper1OriginalTop;

}

function snapToGrid(element) {

    // Get current position from inline styles
    const currentLeft = parseFloat(element.style.left) || 0;
    const currentTop = parseFloat(element.style.top) || 0;

    // Use stored unscaled dimensions instead of getBoundingClientRect

    // Calculate center of the image using unscaled dimensions
    const centerX = currentLeft + IMAGE_WIDTH / 2;
    const centerY = currentTop + IMAGE_HEIGHT / 2;


    // Calculate offset from grid origin
    const offsetFromOriginX = centerX - GRID_ORIGIN_X;
    const offsetFromOriginY = centerY - GRID_ORIGIN_Y;

    // Calculate grid indices
    const gridIndexX = Math.round(offsetFromOriginX / GRID_SPACING_X);
    const gridIndexY = Math.round(offsetFromOriginY / GRID_SPACING_Y);

    // Find nearest grid node
    const nearestGridX = GRID_ORIGIN_X + gridIndexX * GRID_SPACING_X;
    const nearestGridY = GRID_ORIGIN_Y + gridIndexY * GRID_SPACING_Y;

    // Calculate new position (top-left corner) using unscaled dimensions
    const newLeft = nearestGridX - IMAGE_WIDTH / 2;
    const newTop = nearestGridY - IMAGE_HEIGHT / 2;

    // Set position so center aligns with grid node
    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';
}

function centerImages() {
    const wrappers = Array.from(imageWrappers);

    // Get center positions of all wrappers using inline styles and stored dimensions
    const centers = wrappers.map(wrapper => {
        const left = parseFloat(wrapper.style.left) || 0;
        const top = parseFloat(wrapper.style.top) || 0;
        return {
            x: left + IMAGE_WIDTH / 2,
            y: top + IMAGE_HEIGHT / 2
        };
    });

    // Calculate center of mass
    const centerOfMassX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
    const centerOfMassY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;

    // Calculate page center
    const pageCenterX = window.innerWidth / 2;
    const pageCenterY = window.innerHeight / 2;

    // Calculate offset needed
    const offsetXNeeded = pageCenterX - centerOfMassX;
    const offsetYNeeded = pageCenterY - centerOfMassY;

    // Apply offset to all wrappers using their inline style positions
    wrappers.forEach(wrapper => {
        const currentLeft = parseFloat(wrapper.style.left) || 0;
        const currentTop = parseFloat(wrapper.style.top) || 0;
        wrapper.style.left = (currentLeft + offsetXNeeded) + 'px';
        wrapper.style.top = (currentTop + offsetYNeeded) + 'px';
    });


    // Recalculate grid origin after centering
    recalculateGridOrigin();
}
