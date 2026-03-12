let activeElement = null;
let offsetX = 0;
let offsetY = 0;
let selectedImages = new Set();
let relativePositions = [];
let savedState = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const draggables = document.querySelectorAll('.draggable');

draggables.forEach(draggable => {
    draggable.addEventListener('mousedown', startDrag);
    draggable.addEventListener('click', handleImageClick);
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
    const isButton = e.target.tagName === 'BUTTON' || e.target.closest('.button-container');

    if (!isImage && !isButton && selectedImages.size > 0) {
        // Deselect all
        selectedImages.clear();
        draggables.forEach(img => img.classList.remove('selected'));
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
    savedState = Array.from(draggables).map(img => ({
        id: img.id,
        left: img.style.left,
        top: img.style.top
    }));
    console.log('State saved!');
}

function restoreState() {
    if (savedState) {
        savedState.forEach(state => {
            const img = document.getElementById(state.id);
            if (img) {
                img.style.left = state.left;
                img.style.top = state.top;
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

    // Assign shuffled positions to images
    draggables.forEach((img, index) => {
        img.style.top = positions[index].top;
        img.style.left = positions[index].left;
    });
}

// Shuffle image positions on page load then center
shuffleImagePositions();
centerImages();

function toggleSelectAll() {
    if (selectedImages.size === draggables.length) {
        // Deselect all
        selectedImages.clear();
        draggables.forEach(img => img.classList.remove('selected'));
    } else {
        // Select all
        selectedImages.clear();
        draggables.forEach(img => {
            selectedImages.add(img);
            img.classList.add('selected');
        });
    }
}

function handleImageClick(e) {
    // Only toggle selection if we didn't drag
    if (!isDragging) {
        e.stopPropagation();
        const img = e.target;

        if (selectedImages.has(img)) {
            selectedImages.delete(img);
            img.classList.remove('selected');
        } else {
            selectedImages.add(img);
            img.classList.add('selected');
        }
    }
}

function startDrag(e) {
    activeElement = e.target;
    activeElement.style.zIndex = 1000;
    isDragging = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = activeElement.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // If images are selected and we're dragging one of them, calculate relative positions
    if (selectedImages.size > 0 && selectedImages.has(activeElement)) {
        const activeRect = activeElement.getBoundingClientRect();
        relativePositions = Array.from(selectedImages).map(img => {
            const imgRect = img.getBoundingClientRect();
            return {
                element: img,
                dx: imgRect.left - activeRect.left,
                dy: imgRect.top - activeRect.top
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

function stopDrag() {
    if (activeElement) {
        activeElement.style.zIndex = 1;
        activeElement = null;
        relativePositions = [];
    }
}

function centerImages() {
    const images = Array.from(draggables);

    // Get center positions of all images
    const centers = images.map(img => {
        const rect = img.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
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

    // Apply offset to all images using their actual current positions
    images.forEach(img => {
        const rect = img.getBoundingClientRect();
        img.style.left = (rect.left + offsetXNeeded) + 'px';
        img.style.top = (rect.top + offsetYNeeded) + 'px';
    });
}
