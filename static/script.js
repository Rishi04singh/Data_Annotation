// ==========================================================================
// APP STATE
// ==========================================================================
let state = {
    images: [],
    classes: [],
    currentImageIndex: -1,
    activeClassIndex: 0,
    boxes: [], // Bounding boxes for current image: { class_id, x_center, y_center, width, height }
    
    // Canvas & Image State
    imgElement: null,
    imgNaturalWidth: 0,
    imgNaturalHeight: 0,
    canvasScale: 1, // Zoom scale
    
    // Interaction State
    drawing: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    
    // Filter & Search State
    filter: 'all', // 'all', 'pending', 'completed'
    searchQuery: '',
    
    // Config
    classColors: [
        '#10b981', // Emerald
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#14b8a6', // Teal
        '#ef4444', // Red
        '#f97316', // Orange
    ]
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const canvas = document.getElementById('annotation-canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const canvasHint = document.getElementById('canvas-hint');
const cursorCoords = document.getElementById('cursor-coords');
const statusMsg = document.getElementById('status-msg');

const imageListEl = document.getElementById('image-list');
const imageSearch = document.getElementById('image-search');
const filterTabs = document.querySelectorAll('.filter-tab');
const imageCountBadge = document.getElementById('image-count-badge');

const currentImageIndexEl = document.getElementById('current-image-index');
const currentImageNameEl = document.getElementById('current-image-name');
const statsNumbersEl = document.getElementById('stats-numbers');
const statsPercentageEl = document.getElementById('stats-percentage');
const progressBarEl = document.getElementById('progress-bar');

const classListEl = document.getElementById('class-list');
const addClassBtn = document.getElementById('add-class-btn');
const classAddWrapper = document.getElementById('class-add-wrapper');
const newClassInput = document.getElementById('new-class-input');
const submitNewClassBtn = document.getElementById('submit-new-class-btn');
const cancelNewClassBtn = document.getElementById('cancel-new-class-btn');

const boxesListEl = document.getElementById('boxes-list');
const boxesCountBadge = document.getElementById('boxes-count-badge');

const saveBtn = document.getElementById('save-btn');
const prevBtn = document.getElementById('prev-btn');
const skipBtn = document.getElementById('skip-btn');
const resetBtn = document.getElementById('reset-btn');
const themeToggle = document.getElementById('theme-toggle');

const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================================================
// THEME MANAGEMENT
// ==========================================================================
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    drawCanvas();
});

// ==========================================================================
// INITIAL DATA LOAD
// ==========================================================================
async function loadDataset() {
    try {
        const response = await fetch('/api/images');
        const data = await response.json();
        
        state.images = data.images;
        state.classes = data.classes;
        
        renderClasses();
        renderImageList();
        updateStats();
        
        // Auto-select first image if not already selected
        if (state.images.length > 0 && state.currentImageIndex === -1) {
            selectImage(0);
        }
    } catch (err) {
        console.error("Failed to load dataset:", err);
        showToast("Error loading dataset files", "error");
    }
}

// ==========================================================================
// SIDEBAR: IMAGE LIST RENDERING & FILTERING
// ==========================================================================
function renderImageList() {
    imageListEl.innerHTML = '';
    
    const filtered = state.images.filter((img, idx) => {
        // Search filter
        if (state.searchQuery && !img.filename.toLowerCase().includes(state.searchQuery.toLowerCase())) {
            return false;
        }
        // Tabs filter
        if (state.filter === 'pending') return !img.annotated;
        if (state.filter === 'completed') return img.annotated;
        return true;
    });
    
    imageCountBadge.textContent = filtered.length;
    
    if (filtered.length === 0) {
        imageListEl.innerHTML = `<li class="loading-state"><span>No images found</span></li>`;
        return;
    }
    
    filtered.forEach(img => {
        // Find original index
        const originalIndex = state.images.findIndex(i => i.filename === img.filename);
        const li = document.createElement('li');
        li.className = `image-item ${originalIndex === state.currentImageIndex ? 'active' : ''}`;
        
        const statusClass = img.annotated ? 'completed' : 'pending';
        const statusIcon = img.annotated ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-crop-simple"></i>';
        
        li.innerHTML = `
            <div class="img-name-wrapper">
                <span class="img-name" title="${img.filename}">${img.filename}</span>
                <span class="img-path">dataset/images/${img.filename}</span>
            </div>
            <div class="status-badge ${statusClass}">
                ${statusIcon}
            </div>
        `;
        
        li.addEventListener('click', () => selectImage(originalIndex));
        imageListEl.appendChild(li);
    });
}

// Search and Tab Filter listeners
imageSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderImageList();
});

filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.filter = tab.dataset.filter;
        renderImageList();
    });
});

// ==========================================================================
// STATISTICS UPDATE
// ==========================================================================
function updateStats() {
    const total = state.images.length;
    const completed = state.images.filter(img => img.annotated).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    statsNumbersEl.textContent = `${completed} / ${total} Annotated`;
    statsPercentageEl.textContent = `${percentage}% Done`;
    progressBarEl.style.width = `${percentage}%`;
}

// ==========================================================================
// IMAGE SELECTION & LOADING
// ==========================================================================
function selectImage(index) {
    if (index < 0 || index >= state.images.length) return;
    
    // Save current active state index
    state.currentImageIndex = index;
    
    // Highlight in list
    const items = imageListEl.querySelectorAll('.image-item');
    items.forEach((item, idx) => {
        const itemFilename = item.querySelector('.img-name').textContent;
        if (itemFilename === state.images[index].filename) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const activeImage = state.images[index];
    currentImageIndexEl.textContent = `Image [${index + 1}/${state.images.length}]`;
    currentImageNameEl.textContent = activeImage.filename;
    currentImageNameEl.title = activeImage.filename;
    
    // Load boxes
    state.boxes = JSON.parse(JSON.stringify(activeImage.boxes || []));
    renderBoxesList();
    
    // Load image into Canvas
    canvasHint.classList.add('hidden');
    state.imgElement = new Image();
    state.imgElement.src = `/images/${encodeURIComponent(activeImage.filename)}`;
    state.imgElement.onload = function() {
        state.imgNaturalWidth = this.naturalWidth;
        state.imgNaturalHeight = this.naturalHeight;
        
        // Reset scale
        state.canvasScale = 1;
        
        resizeCanvas();
        drawCanvas();
    };
    state.imgElement.onerror = function() {
        showToast(`Failed to load image: ${activeImage.filename}`, "error");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvasHint.classList.remove('hidden');
    };
}

// ==========================================================================
// CANVAS RESIZING & DRAWING SYSTEM
// ==========================================================================
function resizeCanvas() {
    if (!state.imgElement) return;
    
    // Get container dimensions
    const containerWidth = canvasContainer.clientWidth - 48; // padding
    const containerHeight = canvasContainer.clientHeight - 48;
    
    // Calculate aspect ratio fit
    const imgRatio = state.imgNaturalWidth / state.imgNaturalHeight;
    const containerRatio = containerWidth / containerHeight;
    
    let w, h;
    if (imgRatio > containerRatio) {
        w = containerWidth;
        h = containerWidth / imgRatio;
    } else {
        h = containerHeight;
        w = containerHeight * imgRatio;
    }
    
    // Apply zoom scale factor
    canvas.width = w * state.canvasScale;
    canvas.height = h * state.canvasScale;
    
    // Match visual display styles
    canvas.style.width = `${w * state.canvasScale}px`;
    canvas.style.height = `${h * state.canvasScale}px`;
}

function drawCanvas() {
    if (!state.imgElement) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw original image scaled to display dimensions
    ctx.drawImage(state.imgElement, 0, 0, canvas.width, canvas.height);
    
    // 2. Draw existing bounding boxes
    state.boxes.forEach((box, index) => {
        drawBox(box, index);
    });
    
    // 3. Draw active drawing box preview
    if (state.drawing) {
        const x1 = state.startPoint.x;
        const y1 = state.startPoint.y;
        const x2 = state.currentPoint.x;
        const y2 = state.currentPoint.y;
        
        const w = x2 - x1;
        const h = y2 - y1;
        
        const color = getClassColor(state.activeClassIndex);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]); // dashed lines for active drawing
        ctx.strokeRect(x1, y1, w, h);
        
        ctx.fillStyle = hexToRgba(color, 0.1);
        ctx.fillRect(x1, y1, w, h);
        ctx.setLineDash([]); // reset
    }
}

function drawBox(box, index) {
    const w = box.width * canvas.width;
    const h = box.height * canvas.height;
    const x = (box.x_center * canvas.width) - (w / 2);
    const y = (box.y_center * canvas.height) - (h / 2);
    
    const color = getClassColor(box.class_id);
    const className = state.classes[box.class_id] || `Class ${box.class_id}`;
    
    // Draw box border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    
    // Fill translucent box
    ctx.fillStyle = hexToRgba(color, 0.15);
    ctx.fillRect(x, y, w, h);
    
    // Draw Class Label above
    ctx.fillStyle = color;
    ctx.font = "bold 11px sans-serif";
    const textWidth = ctx.measureText(className).width;
    
    // Label Background
    ctx.fillRect(x - 1, y - 18, textWidth + 12, 18);
    
    // Label Text
    ctx.fillStyle = "#ffffff";
    ctx.fillText(className, x + 6, y - 5);
}

function getClassColor(classId) {
    return state.classColors[classId % state.classColors.length];
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Window resizing
window.addEventListener('resize', () => {
    if (state.imgElement) {
        resizeCanvas();
        drawCanvas();
    }
});

// ==========================================================================
// ZOOM CONTROLS
// ==========================================================================
zoomInBtn.addEventListener('click', () => {
    state.canvasScale = Math.min(state.canvasScale + 0.15, 3.0);
    zoomResetBtn.textContent = `${Math.round(state.canvasScale * 100)}%`;
    resizeCanvas();
    drawCanvas();
});

zoomOutBtn.addEventListener('click', () => {
    state.canvasScale = Math.max(state.canvasScale - 0.15, 0.5);
    zoomResetBtn.textContent = `${Math.round(state.canvasScale * 100)}%`;
    resizeCanvas();
    drawCanvas();
});

zoomResetBtn.addEventListener('click', () => {
    state.canvasScale = 1.0;
    zoomResetBtn.textContent = "100%";
    resizeCanvas();
    drawCanvas();
});

// ==========================================================================
// MOUSE EVENTS ON CANVAS (DRAWING BOXES)
// ==========================================================================
canvas.addEventListener('mousedown', (e) => {
    if (!state.imgElement) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    state.drawing = true;
    state.startPoint = { x, y };
    state.currentPoint = { x, y };
    
    drawCanvas();
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update footer coordinate status
    const normX = Math.min(1.0, Math.max(0.0, x / canvas.width)).toFixed(3);
    const normY = Math.min(1.0, Math.max(0.0, y / canvas.height)).toFixed(3);
    cursorCoords.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)} (Norm X: ${normX}, Y: ${normY})`;
    
    if (state.drawing) {
        state.currentPoint = { x, y };
        drawCanvas();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (!state.drawing) return;
    
    state.drawing = false;
    
    const rect = canvas.getBoundingClientRect();
    const endX = Math.min(canvas.width, Math.max(0, e.clientX - rect.left));
    const endY = Math.min(canvas.height, Math.max(0, e.clientY - rect.top));
    
    const startX = state.startPoint.x;
    const startY = state.startPoint.y;
    
    // Ignore tiny accidental clicks/drags
    const boxW = Math.abs(endX - startX);
    const boxH = Math.abs(endY - startY);
    if (boxW < 5 || boxH < 5) {
        drawCanvas();
        return;
    }
    
    // Calculate YOLO coordinates
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    
    const w = maxX - minX;
    const h = maxY - minY;
    
    const x_center = minX + w / 2;
    const y_center = minY + h / 2;
    
    // Normalize coordinates (0.0 to 1.0)
    const norm_xc = x_center / canvas.width;
    const norm_yc = y_center / canvas.height;
    const norm_w = w / canvas.width;
    const norm_h = h / canvas.height;
    
    state.boxes.push({
        class_id: state.activeClassIndex,
        x_center: parseFloat(norm_xc.toFixed(6)),
        y_center: parseFloat(norm_yc.toFixed(6)),
        width: parseFloat(norm_w.toFixed(6)),
        height: parseFloat(norm_h.toFixed(6))
    });
    
    renderBoxesList();
    drawCanvas();
});

// Cancel active draw if mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    if (state.drawing) {
        state.drawing = false;
        drawCanvas();
    }
});

// ==========================================================================
// CLASSES MANAGEMENT
// ==========================================================================
function renderClasses() {
    classListEl.innerHTML = '';
    state.classes.forEach((cls, idx) => {
        const li = document.createElement('li');
        li.className = `class-item ${idx === state.activeClassIndex ? 'active' : ''}`;
        
        const color = getClassColor(idx);
        
        li.innerHTML = `
            <div>
                <span class="class-badge" style="background-color: ${color}"></span>
                <span>${idx}: ${cls}</span>
            </div>
            <i class="fa-solid fa-trash-can class-delete-btn" data-index="${idx}" title="Delete class"></i>
        `;
        
        // Select class on click
        li.addEventListener('click', (e) => {
            if (e.target.classList.contains('class-delete-btn')) {
                deleteClass(idx);
                return;
            }
            state.activeClassIndex = idx;
            renderClasses();
        });
        
        classListEl.appendChild(li);
    });
}

// Add class toggle
addClassBtn.addEventListener('click', () => {
    classAddWrapper.classList.toggle('hidden');
    newClassInput.focus();
});

cancelNewClassBtn.addEventListener('click', () => {
    classAddWrapper.classList.add('hidden');
    newClassInput.value = '';
});

submitNewClassBtn.addEventListener('click', addNewClass);
newClassInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addNewClass();
});

async function addNewClass() {
    const val = newClassInput.value.trim();
    if (!val) return;
    
    if (state.classes.includes(val)) {
        showToast("Class name already exists", "warning");
        return;
    }
    
    state.classes.push(val);
    newClassInput.value = '';
    classAddWrapper.classList.add('hidden');
    
    // Save updated classes to server
    await saveClassesToServer();
    
    state.activeClassIndex = state.classes.length - 1;
    renderClasses();
    showToast(`Class "${val}" added!`);
}

async function deleteClass(index) {
    if (state.classes.length <= 1) {
        showToast("You must keep at least one class", "warning");
        return;
    }
    
    const deletedName = state.classes[index];
    state.classes.splice(index, 1);
    
    // Fix active index if out of bounds or matching
    if (state.activeClassIndex >= state.classes.length) {
        state.activeClassIndex = state.classes.length - 1;
    }
    
    // Re-map bounding box class ids if any existed
    state.boxes.forEach(box => {
        if (box.class_id === index) {
            box.class_id = 0; // fallback to 0
        } else if (box.class_id > index) {
            box.class_id -= 1; // shift index
        }
    });
    
    await saveClassesToServer();
    renderClasses();
    renderBoxesList();
    drawCanvas();
    showToast(`Class "${deletedName}" deleted.`);
}

async function saveClassesToServer() {
    try {
        await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classes: state.classes })
        });
    } catch (err) {
        console.error("Error saving classes:", err);
        showToast("Could not sync class changes to backend", "error");
    }
}

// ==========================================================================
// BOXES (ANNOTATIONS) LIST RENDERING
// ==========================================================================
function renderBoxesList() {
    boxesListEl.innerHTML = '';
    boxesCountBadge.textContent = state.boxes.length;
    
    if (state.boxes.length === 0) {
        boxesListEl.innerHTML = `<li class="empty-list-msg">No boxes drawn yet</li>`;
        return;
    }
    
    state.boxes.forEach((box, index) => {
        const className = state.classes[box.class_id] || `Class ${box.class_id}`;
        const color = getClassColor(box.class_id);
        const li = document.createElement('li');
        li.className = 'box-item';
        
        li.innerHTML = `
            <div class="box-info">
                <span class="box-class" style="color: ${color}">${className}</span>
                <span class="box-coords">w:${box.width.toFixed(3)} h:${box.height.toFixed(3)} c:(${box.x_center.toFixed(3)}, ${box.y_center.toFixed(3)})</span>
            </div>
            <i class="fa-solid fa-trash-can box-delete-btn" data-index="${index}" title="Remove box"></i>
        `;
        
        li.querySelector('.box-delete-btn').addEventListener('click', () => {
            state.boxes.splice(index, 1);
            renderBoxesList();
            drawCanvas();
        });
        
        boxesListEl.appendChild(li);
    });
}

// ==========================================================================
// DATA ACTIONS (SAVE, SKIP, RESET, NAV)
// ==========================================================================
async function saveAnnotation() {
    if (state.currentImageIndex === -1) return;
    
    const activeImage = state.images[state.currentImageIndex];
    
    // Save to server
    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: activeImage.filename,
                boxes: state.boxes
            })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            // Update local state record
            activeImage.annotated = state.boxes.length > 0;
            activeImage.boxes = JSON.parse(JSON.stringify(state.boxes));
            
            showToast(data.message || "Annotation saved successfully!");
            updateStats();
            renderImageList();
            
            // Advance to next image automatically
            setTimeout(() => {
                nextImage();
            }, 300);
        } else {
            showToast(data.message || "Failed to save annotation", "error");
        }
    } catch (err) {
        console.error("Save error:", err);
        showToast("Server connection error during save", "error");
    }
}

function clearBoxes() {
    if (state.boxes.length === 0) return;
    state.boxes = [];
    renderBoxesList();
    drawCanvas();
    showToast("Boxes cleared locally. Save to apply change.", "warning");
}

function nextImage() {
    if (state.currentImageIndex < state.images.length - 1) {
        selectImage(state.currentImageIndex + 1);
    } else {
        showToast("End of dataset reached!", "warning");
    }
}

function prevImage() {
    if (state.currentImageIndex > 0) {
        selectImage(state.currentImageIndex - 1);
    }
}

// Event bindings
saveBtn.addEventListener('click', saveAnnotation);
resetBtn.addEventListener('click', clearBoxes);
prevBtn.addEventListener('click', prevImage);
skipBtn.addEventListener('click', nextImage);

// ==========================================================================
// KEYBOARD SHORTCUTS
// ==========================================================================
window.addEventListener('keydown', (e) => {
    // Ignore shortcut events if focusing on text inputs
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
    }
    
    const key = e.key.toLowerCase();
    
    if (key === 's') {
        e.preventDefault();
        saveAnnotation();
    } else if (key === 'n' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextImage();
    } else if (key === 'p' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevImage();
    } else if (key === 'r') {
        e.preventDefault();
        clearBoxes();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete last box
        if (state.boxes.length > 0) {
            e.preventDefault();
            state.boxes.pop();
            renderBoxesList();
            drawCanvas();
            showToast("Last box removed", "warning");
        }
    } else if (e.key === 'Escape') {
        // Cancel active drawing
        if (state.drawing) {
            e.preventDefault();
            state.drawing = false;
            drawCanvas();
        }
    }
});

// ==========================================================================
// STARTUP INVOCATION
// ==========================================================================
loadDataset();
