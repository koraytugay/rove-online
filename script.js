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

// Grid configuration - spacing based on initial layout
const GRID_SPACING_X = 250; // Horizontal spacing between image centers
const GRID_SPACING_Y = 175; // Vertical spacing between image centers
let GRID_ORIGIN_X = 0;
let GRID_ORIGIN_Y = 0;
let IMAGE_WIDTH = 0; // Store actual unscaled image width
let IMAGE_HEIGHT = 0; // Store actual unscaled image height

const imageWrappers = document.querySelectorAll('.image-wrapper');
const draggables = document.querySelectorAll('.draggable');

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
document.getElementById('saveBtn').addEventListener('click', saveState);
document.getElementById('restoreBtn').addEventListener('click', restoreState);

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
    } else if (e.key === 's' || e.key === 'S') {
        saveState();
    } else if (e.key === 'r' || e.key === 'R') {
        restoreState();
    }
}

function saveState() {
    savedState = Array.from(imageWrappers).map(wrapper => ({
        id: wrapper.id,
        left: wrapper.style.left,
        top: wrapper.style.top
    }));
    console.log('State saved!');
}

function restoreState() {
    if (savedState) {
        savedState.forEach(state => {
            const wrapper = document.getElementById(state.id);
            if (wrapper) {
                wrapper.style.left = state.left;
                wrapper.style.top = state.top;
            }
        });
        console.log('State restored!');
    } else {
        console.log('No saved state found!');
    }
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
    console.log('=== INITIALIZE GRID START ===');

    // Shuffle positions first
    shuffleImagePositions();
    console.log('Positions shuffled');

    // Store image dimensions from the first wrapper
    const firstWrapper = imageWrappers[0];
    const rect = firstWrapper.getBoundingClientRect();
    IMAGE_WIDTH = rect.width;
    IMAGE_HEIGHT = rect.height;
    console.log('Wrapper dimensions stored (width, height):', IMAGE_WIDTH, IMAGE_HEIGHT);

    // Calculate initial grid origin
    recalculateGridOrigin();
    console.log('=== INITIALIZE GRID END ===\n');
}

// Recalculate grid origin based on current image positions
function recalculateGridOrigin() {
    console.log('=== RECALCULATE GRID ORIGIN ===');

    // Use the first wrapper's center as grid origin
    const firstWrapper = imageWrappers[0];
    const firstLeft = parseFloat(firstWrapper.style.left);
    const firstTop = parseFloat(firstWrapper.style.top);
    console.log('First wrapper position (left, top):', firstLeft, firstTop);

    // Set grid origin to the center of the first wrapper
    GRID_ORIGIN_X = firstLeft + IMAGE_WIDTH / 2;
    GRID_ORIGIN_Y = firstTop + IMAGE_HEIGHT / 2;

    console.log(`Grid origin updated: (${GRID_ORIGIN_X}, ${GRID_ORIGIN_Y}), spacing (${GRID_SPACING_X}, ${GRID_SPACING_Y})`);

    // Log all wrapper centers to verify grid alignment
    console.log('--- All wrapper centers ---');
    imageWrappers.forEach((wrapper, idx) => {
        const wrapperLeft = parseFloat(wrapper.style.left);
        const wrapperTop = parseFloat(wrapper.style.top);
        const wrapperCenterX = wrapperLeft + IMAGE_WIDTH / 2;
        const wrapperCenterY = wrapperTop + IMAGE_HEIGHT / 2;
        console.log(`Wrapper ${idx} (${wrapper.id}): center (${wrapperCenterX}, ${wrapperCenterY})`);
    });
    console.log('=== RECALCULATE GRID ORIGIN END ===\n');
}

initializeGrid();
centerImages();
// Recalculate grid origin after centering
recalculateGridOrigin();
console.log('Grid recalculated after centering');

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
    console.log('=== FLIP IMAGE ===');
    console.log('Flipping image:', img.id);

    const imageName = img.dataset.name;
    const currentSrc = img.src;

    console.log('Current src:', currentSrc);
    console.log('Image name:', imageName);

    // Add flip animation
    img.classList.add('flipping');

    // Change image at halfway point of animation
    setTimeout(() => {
        if (currentSrc.includes('-front.png')) {
            img.src = `resources/${imageName}-back.png`;
            console.log('Switched to back');
        } else {
            img.src = `resources/${imageName}-front.png`;
            console.log('Switched to front');
        }
    }, 300);

    // Remove animation class after it completes
    setTimeout(() => {
        img.classList.remove('flipping');
    }, 600);

    console.log('=== FLIP IMAGE END ===\n');
}

function startDrag(e, wrapper) {
    activeElement = wrapper;
    activeElement.style.zIndex = 1000;
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // Store original position before dragging
    originalDragPosition.left = parseFloat(activeElement.style.left) || 0;
    originalDragPosition.top = parseFloat(activeElement.style.top) || 0;
    console.log('Original drag position stored:', originalDragPosition);

    const rect = activeElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // If images are selected and we're dragging one of them, calculate relative positions
    if (selectedImages.size > 0 && selectedImages.has(activeElement)) {
        const activeRect = activeElement.getBoundingClientRect();
        relativePositions = Array.from(selectedImages).map(wrapper => {
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
            } else {
                // Move single image
                activeElement.style.left = (e.clientX - offsetX) + 'px';
                activeElement.style.top = (e.clientY - offsetY) + 'px';
            }
        }
    }
}

function stopDrag(e) {
    console.log('=== STOP DRAG ===');
    console.log('Active element:', activeElement ? activeElement.id : 'none');
    console.log('Is dragging:', isDragging);
    console.log('Number of selected wrappers:', relativePositions.length);

    if (activeElement && isDragging) {
        // Check if dropped on another wrapper (only for single wrapper drag, not multiple selection)
        if (relativePositions.length === 0) {
            const dropTarget = getImageUnderMouse(e.clientX, e.clientY, activeElement);
            if (dropTarget && dropTarget !== activeElement) {
                console.log('Dropped on wrapper:', dropTarget.id);
                swapImagePositions(activeElement, dropTarget);
                activeElement.style.zIndex = 1;
                activeElement = null;
                relativePositions = [];
                console.log('=== STOP DRAG END (SWAPPED) ===\n');
                return;
            }
        }

        // Snap to grid
        if (relativePositions.length > 0) {
            console.log('Snapping multiple selected wrappers to grid');
            // Snap all selected wrappers to grid
            relativePositions.forEach(rel => {
                snapToGrid(rel.element);
            });
        } else {
            console.log('Snapping single wrapper to grid');
            // Snap single wrapper to grid
            snapToGrid(activeElement);
        }

        activeElement.style.zIndex = 1;
        activeElement = null;
        relativePositions = [];
    } else if (activeElement) {
        console.log('No drag occurred (just a click)');
        activeElement.style.zIndex = 1;
        activeElement = null;
        relativePositions = [];
    }
    console.log('=== STOP DRAG END ===\n');
}

function getImageUnderMouse(x, y, excludeElement) {
    console.log('Checking for image under mouse at:', x, y);

    // Temporarily hide the dragged element to check what's underneath
    const originalPointerEvents = excludeElement.style.pointerEvents;
    excludeElement.style.pointerEvents = 'none';

    const elementUnderMouse = document.elementFromPoint(x, y);
    console.log('Element under mouse:', elementUnderMouse);

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
        console.log('Found wrapper:', targetWrapper.id);
        return targetWrapper;
    }
    console.log('No wrapper found under mouse');
    return null;
}

function swapImagePositions(wrapper1, wrapper2) {
    console.log('=== SWAP POSITIONS ===');
    console.log('Swapping', wrapper1.id, 'with', wrapper2.id);

    // Use wrapper1's ORIGINAL position (before drag) and wrapper2's current position
    const wrapper1OriginalLeft = originalDragPosition.left + 'px';
    const wrapper1OriginalTop = originalDragPosition.top + 'px';
    const wrapper2Left = wrapper2.style.left;
    const wrapper2Top = wrapper2.style.top;

    console.log('wrapper1 original position:', wrapper1OriginalLeft, wrapper1OriginalTop);
    console.log('wrapper2 position:', wrapper2Left, wrapper2Top);

    // Move wrapper1 to where wrapper2 was
    wrapper1.style.left = wrapper2Left;
    wrapper1.style.top = wrapper2Top;

    // Move wrapper2 to where wrapper1 originally was
    wrapper2.style.left = wrapper1OriginalLeft;
    wrapper2.style.top = wrapper1OriginalTop;

    console.log('=== SWAP COMPLETE ===\n');
}

function snapToGrid(element) {
    console.log('=== SNAP TO GRID START ===');
    console.log('Element ID:', element.id);

    // Get current position from inline styles
    const currentLeft = parseFloat(element.style.left) || 0;
    const currentTop = parseFloat(element.style.top) || 0;
    console.log('Current position (left, top):', currentLeft, currentTop);

    // Use stored unscaled dimensions instead of getBoundingClientRect
    console.log('Using stored dimensions (width, height):', IMAGE_WIDTH, IMAGE_HEIGHT);

    // Calculate center of the image using unscaled dimensions
    const centerX = currentLeft + IMAGE_WIDTH / 2;
    const centerY = currentTop + IMAGE_HEIGHT / 2;
    console.log('Image center (x, y):', centerX, centerY);

    console.log('Grid origin (x, y):', GRID_ORIGIN_X, GRID_ORIGIN_Y);
    console.log('Grid spacing (x, y):', GRID_SPACING_X, GRID_SPACING_Y);

    // Calculate offset from grid origin
    const offsetFromOriginX = centerX - GRID_ORIGIN_X;
    const offsetFromOriginY = centerY - GRID_ORIGIN_Y;
    console.log('Offset from origin (x, y):', offsetFromOriginX, offsetFromOriginY);

    // Calculate grid indices
    const gridIndexX = Math.round(offsetFromOriginX / GRID_SPACING_X);
    const gridIndexY = Math.round(offsetFromOriginY / GRID_SPACING_Y);
    console.log('Grid indices (x, y):', gridIndexX, gridIndexY);

    // Find nearest grid node
    const nearestGridX = GRID_ORIGIN_X + gridIndexX * GRID_SPACING_X;
    const nearestGridY = GRID_ORIGIN_Y + gridIndexY * GRID_SPACING_Y;
    console.log('Nearest grid node (x, y):', nearestGridX, nearestGridY);

    // Calculate new position (top-left corner) using unscaled dimensions
    const newLeft = nearestGridX - IMAGE_WIDTH / 2;
    const newTop = nearestGridY - IMAGE_HEIGHT / 2;
    console.log('New position (left, top):', newLeft, newTop);

    // Set position so center aligns with grid node
    element.style.left = newLeft + 'px';
    element.style.top = newTop + 'px';
    console.log('=== SNAP TO GRID END ===\n');
}

function centerImages() {
    console.log('=== CENTER IMAGES START ===');
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
    console.log('Current center of mass:', centerOfMassX, centerOfMassY);

    // Calculate page center
    const pageCenterX = window.innerWidth / 2;
    const pageCenterY = window.innerHeight / 2;
    console.log('Page center:', pageCenterX, pageCenterY);

    // Calculate offset needed
    const offsetXNeeded = pageCenterX - centerOfMassX;
    const offsetYNeeded = pageCenterY - centerOfMassY;
    console.log('Offset needed:', offsetXNeeded, offsetYNeeded);

    // Apply offset to all wrappers using their inline style positions
    wrappers.forEach(wrapper => {
        const currentLeft = parseFloat(wrapper.style.left) || 0;
        const currentTop = parseFloat(wrapper.style.top) || 0;
        wrapper.style.left = (currentLeft + offsetXNeeded) + 'px';
        wrapper.style.top = (currentTop + offsetYNeeded) + 'px';
    });

    console.log('=== CENTER IMAGES END ===\n');

    // Recalculate grid origin after centering
    recalculateGridOrigin();
}
