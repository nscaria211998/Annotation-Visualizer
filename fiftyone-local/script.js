class SAMAnalyser {
    constructor() {
        this.images = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filteredImages = [];
        this.isAnnotationMode = false;
        this.currentAnnotations = {};
        this.selectedImage = null;
        this.allClasses = new Set();
        this.annotationFormat = 'coco';
        this.classColors = {};
        
        // Project and folder management
        this.projects = {
            default: {
                name: 'Default Project',
                folders: {
                    unsorted: { name: 'Unsorted', images: [] }
                }
            }
        };
        this.currentProject = 'default';
        this.currentFolder = 'all';
        this.customFolders = {};
        
        // Selection mode
        this.isSelectMode = false;
        this.selectedImages = new Set();
        
        // Annotation visibility
        this.showAnnotations = true;
        
        this.initializeEventListeners();
        this.updateProjectSelect();
        this.updateFolderList();
        this.updateDisplay();
        this.updateFolderCounts();
    }

    initializeEventListeners() {
        // File upload
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Annotation upload
        const annotationUploadArea = document.getElementById('annotationUploadArea');
        const annotationInput = document.getElementById('annotationInput');
        
        annotationUploadArea.addEventListener('click', () => annotationInput.click());
        annotationInput.addEventListener('change', this.handleAnnotationFiles.bind(this));
        
        document.getElementById('annotationFormat').addEventListener('change', this.handleFormatChange.bind(this));
        document.getElementById('troubleshootBtn').addEventListener('click', this.showTroubleshootingModal.bind(this));
        
        // Filters
        document.getElementById('searchInput').addEventListener('input', this.applyFilters.bind(this));
        document.getElementById('formatFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('sizeFilter').addEventListener('input', this.handleSizeFilter.bind(this));
        document.getElementById('classFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('annotatedOnly').addEventListener('change', this.applyFilters.bind(this));
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', this.switchTab.bind(this));
        });
        
        // View controls
        document.getElementById('gridView').addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('listView').addEventListener('click', () => this.setViewMode('list'));
        document.getElementById('selectModeBtn').addEventListener('click', this.toggleSelectMode.bind(this));
        document.getElementById('annotationVisibilityToggle').addEventListener('click', this.toggleAnnotationVisibility.bind(this));
        
        // Project and folder controls
        document.getElementById('newProjectBtn').addEventListener('click', this.createNewProject.bind(this));
        document.getElementById('newFolderBtn').addEventListener('click', this.createNewFolder.bind(this));
        document.getElementById('projectSelect').addEventListener('change', this.switchProject.bind(this));
        
        // Bulk actions
        document.getElementById('moveSelectedBtn').addEventListener('click', this.moveSelectedImages.bind(this));
        document.getElementById('deleteSelectedBtn').addEventListener('click', this.deleteSelectedImages.bind(this));
        
        // Folder selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.folder-item')) {
                const folderItem = e.target.closest('.folder-item');
                const folderId = folderItem.dataset.folder;
                this.selectFolder(folderId);
            }
        });
        
        // Annotation mode
        document.getElementById('annotationMode').addEventListener('click', this.toggleAnnotationMode.bind(this));
        
        // Modal
        document.querySelector('.close').addEventListener('click', this.closeModal.bind(this));
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
        
        // Modal annotation toggle will be set up when modal opens
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.style.borderColor = '#64b5f6';
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.style.borderColor = '#4285f4';
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Processing images...</p>';
        
        for (const file of files) {
            try {
                const imageData = await this.processImage(file);
                imageData.folder = 'unsorted'; // Assign to unsorted folder by default
                imageData.project = this.currentProject;
                this.images.push(imageData);
                
                // Add to project's unsorted folder
                if (!this.projects[this.currentProject].folders.unsorted.images) {
                    this.projects[this.currentProject].folders.unsorted.images = [];
                }
                this.projects[this.currentProject].folders.unsorted.images.push(imageData.id);
            } catch (error) {
                console.error('Error processing image:', file.name, error);
            }
        }
        
        this.updateDatasetInfo();
        this.applyFilters();
        this.updateFormatFilter();
        this.updateStatistics();
        this.updateFolderCounts();
        
        uploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="color: #4caf50;"></i>
            <p>Images loaded successfully!</p>
            <p>Click to add more images</p>
        `;
    }

    async processImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Extract basic metadata
                    const imageData = {
                        id: Date.now() + Math.random(),
                        file: file,
                        src: e.target.result,
                        filename: file.name,
                        size: file.size,
                        width: img.width,
                        height: img.height,
                        format: file.type.split('/')[1].toLowerCase(),
                        lastModified: new Date(file.lastModified),
                        aspectRatio: img.width / img.height,
                        annotations: []
                    };
                    
                    // Try to detect existing annotations in filename or metadata
                    this.detectExistingAnnotations(imageData);
                    
                    // Analyze dominant colors (simplified)
                    this.analyzeColors(img, imageData);
                    
                    resolve(imageData);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    analyzeColors(img, imageData) {
        // Create a canvas to analyze colors
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50; // Small size for performance
        canvas.height = 50;
        
        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData_pixels = ctx.getImageData(0, 0, 50, 50);
        const data = imageData_pixels.data;
        
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
        
        const pixelCount = data.length / 4;
        imageData.dominantColor = {
            r: Math.round(r / pixelCount),
            g: Math.round(g / pixelCount),
            b: Math.round(b / pixelCount)
        };
    }

    updateDatasetInfo() {
        const totalSize = this.images.reduce((sum, img) => sum + img.size, 0);
        const totalAnnotations = this.images.reduce((sum, img) => sum + (img.annotations ? img.annotations.length : 0), 0);
        
        document.getElementById('totalImages').textContent = this.images.length;
        document.getElementById('datasetSize').textContent = (totalSize / (1024 * 1024)).toFixed(2);
        document.getElementById('totalAnnotations').textContent = totalAnnotations;
        document.getElementById('totalClasses').textContent = this.allClasses.size;
        document.getElementById('datasetInfo').style.display = 'block';
    }

    handleFormatChange(e) {
        this.annotationFormat = e.target.value;
        const helpText = document.getElementById('formatHelp');
        const annotationInput = document.getElementById('annotationInput');
        
        switch(this.annotationFormat) {
            case 'coco':
                helpText.textContent = 'Select a COCO JSON file';
                annotationInput.accept = '.json';
                break;
            case 'yolo':
                helpText.textContent = 'Select YOLO txt files (one per image)';
                annotationInput.accept = '.txt';
                break;
            case 'csv':
                helpText.textContent = 'Select CSV file with columns: filename,class,x,y,width,height';
                annotationInput.accept = '.csv';
                break;
            case 'pascal':
                helpText.textContent = 'Select Pascal VOC XML files';
                annotationInput.accept = '.xml';
                break;
        }
    }

    async handleAnnotationFiles(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const annotationUploadArea = document.getElementById('annotationUploadArea');
        annotationUploadArea.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Processing annotations...</p>';

        try {
            // Validate files first
            const validationResult = this.validateAnnotationFiles(files);
            if (!validationResult.valid) {
                throw new Error(validationResult.message);
            }

            let processedCount = 0;
            switch(this.annotationFormat) {
                case 'coco':
                    processedCount = await this.parseCOCOAnnotations(files[0]);
                    break;
                case 'yolo':
                    processedCount = await this.parseYOLOAnnotations(files);
                    break;
                case 'csv':
                    processedCount = await this.parseCSVAnnotations(files[0]);
                    break;
                case 'pascal':
                    processedCount = await this.parsePascalAnnotations(files);
                    break;
            }

            this.updateDatasetInfo();
            this.updateClassFilter();
            this.applyFilters();
            
            annotationUploadArea.innerHTML = `
                <i class="fas fa-check-circle" style="color: #4caf50;"></i>
                <p>Annotations loaded successfully!</p>
                <small>Processed ${processedCount} annotations</small>
            `;
        } catch (error) {
            console.error('Error processing annotations:', error);
            annotationUploadArea.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: #f44336;"></i>
                <p>Error loading annotations</p>
                <small style="color: #ff9800; display: block; margin-top: 4px;">${error.message}</small>
                <button onclick="samAnalyser.showDebugInfo('${error.stack}')" style="margin-top: 8px; background: #37474f; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                    Show Debug Info
                </button>
            `;
        }
    }

    validateAnnotationFiles(files) {
        if (files.length === 0) {
            return { valid: false, message: 'No files selected' };
        }

        switch(this.annotationFormat) {
            case 'coco':
                if (files.length !== 1) {
                    return { valid: false, message: 'COCO format requires exactly one JSON file' };
                }
                if (!files[0].name.toLowerCase().endsWith('.json')) {
                    return { valid: false, message: 'COCO file must be a JSON file (.json)' };
                }
                break;
            
            case 'yolo':
                const hasTextFiles = files.some(f => f.name.toLowerCase().endsWith('.txt'));
                if (!hasTextFiles) {
                    return { valid: false, message: 'YOLO format requires text files (.txt)' };
                }
                break;
            
            case 'csv':
                if (files.length !== 1) {
                    return { valid: false, message: 'CSV format requires exactly one CSV file' };
                }
                if (!files[0].name.toLowerCase().endsWith('.csv')) {
                    return { valid: false, message: 'CSV file must have .csv extension' };
                }
                break;
            
            case 'pascal':
                const hasXmlFiles = files.some(f => f.name.toLowerCase().endsWith('.xml'));
                if (!hasXmlFiles) {
                    return { valid: false, message: 'Pascal VOC format requires XML files (.xml)' };
                }
                break;
        }

        return { valid: true };
    }

    showDebugInfo(stackTrace) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
            align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: #1a1f29; padding: 20px; border-radius: 8px; max-width: 80%; max-height: 80%; overflow: auto;">
                <h3 style="color: #64b5f6; margin-bottom: 10px;">Debug Information</h3>
                <pre style="color: #e1e5e9; font-size: 12px; background: #0f1419; padding: 10px; border-radius: 4px; overflow-x: auto;">${stackTrace}</pre>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 10px; background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    showTroubleshootingModal() {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
            align-items: center; justify-content: center; overflow-y: auto;
        `;
        
        modal.innerHTML = `
            <div style="background: #1a1f29; padding: 20px; border-radius: 8px; max-width: 600px; max-height: 90vh; overflow-y: auto; margin: 20px;">
                <h3 style="color: #64b5f6; margin-bottom: 15px;">
                    <i class="fas fa-tools"></i> Annotation Import Troubleshooting
                </h3>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #4caf50; margin-bottom: 10px;">✅ Quick Checklist</h4>
                    <ul style="color: #e1e5e9; line-height: 1.6; margin-left: 20px;">
                        <li>Load image files first, then upload annotation files</li>
                        <li>Ensure annotation filenames match image filenames</li>
                        <li>Select the correct annotation format from dropdown</li>
                        <li>Check browser console (F12) for detailed error messages</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #ff9800; margin-bottom: 10px;">⚠️ YOLO Format Requirements</h4>
                    <ul style="color: #e1e5e9; line-height: 1.6; margin-left: 20px;">
                        <li>One .txt file per image with same base name</li>
                        <li>Format: <code>class_id center_x center_y width height</code></li>
                        <li>Coordinates normalized (0.0 to 1.0)</li>
                        <li>Optional: include classes.txt with class names</li>
                    </ul>
                    <pre style="background: #0f1419; padding: 10px; border-radius: 4px; color: #e1e5e9; margin-top: 10px;">Example:
0 0.5 0.3 0.2 0.4
1 0.7 0.6 0.1 0.2</pre>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #2196f3; margin-bottom: 10px;">📋 CSV Format Requirements</h4>
                    <ul style="color: #e1e5e9; line-height: 1.6; margin-left: 20px;">
                        <li>Headers: filename, class, x, y, width, height</li>
                        <li>Absolute pixel coordinates</li>
                        <li>One annotation per row</li>
                    </ul>
                    <pre style="background: #0f1419; padding: 10px; border-radius: 4px; color: #e1e5e9; margin-top: 10px;">filename,class,x,y,width,height
image1.jpg,person,100,50,80,150
image1.jpg,car,200,100,120,80</pre>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #9c27b0; margin-bottom: 10px;">🏷️ COCO JSON Structure</h4>
                    <ul style="color: #e1e5e9; line-height: 1.6; margin-left: 20px;">
                        <li>Valid JSON with images, annotations, categories</li>
                        <li>bbox format: [x, y, width, height]</li>
                        <li>image_id must match images array</li>
                    </ul>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #f44336; margin-bottom: 10px;">🔧 Common Issues</h4>
                    <div style="color: #e1e5e9; line-height: 1.6;">
                        <p><strong>Error: "JSON Parse error"</strong></p>
                        <p style="margin-left: 20px; color: #ff9800;">→ You selected COCO format but uploaded a non-JSON file</p>
                        
                        <p><strong>Error: "No valid annotations found"</strong></p>
                        <p style="margin-left: 20px; color: #ff9800;">→ Image filenames don't match annotation filenames</p>
                        
                        <p><strong>Error: "Invalid YOLO coordinates"</strong></p>
                        <p style="margin-left: 20px; color: #ff9800;">→ Coordinates must be between 0.0 and 1.0</p>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                    <button onclick="console.clear(); alert('Browser console cleared. Upload annotations and check for new messages.');" 
                            style="background: #37474f; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Clear Console
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async parseCOCOAnnotations(file) {
        try {
            const text = await file.text();
            const coco = JSON.parse(text);
            let annotationCount = 0;
            
            // Validate COCO structure
            if (!coco || typeof coco !== 'object') {
                throw new Error('Invalid COCO file: Root object not found');
            }
            
            // Create category mapping
            const categories = {};
            if (coco.categories) {
                coco.categories.forEach(cat => {
                    categories[cat.id] = cat.name;
                    this.allClasses.add(cat.name);
                    this.assignClassColor(cat.name);
                });
            }
            
            // Create image mapping
            const imageMap = {};
            if (coco.images) {
                coco.images.forEach(img => {
                    imageMap[img.id] = img.file_name;
                });
            }
            
            // Process annotations
            if (coco.annotations) {
                coco.annotations.forEach(ann => {
                    try {
                        const imageName = imageMap[ann.image_id];
                        const image = this.images.find(img => 
                            img.filename === imageName || 
                            img.filename.endsWith(imageName) ||
                            imageName?.endsWith(img.filename)
                        );
                        
                        if (image) {
                            if (!image.annotations) image.annotations = [];
                            
                            const annotation = {
                                id: ann.id,
                                label: categories[ann.category_id] || `class_${ann.category_id}`,
                                bbox: ann.bbox, // [x, y, width, height]
                                area: ann.area,
                                confidence: ann.score || 1.0,
                                color: this.getClassColor(categories[ann.category_id] || `class_${ann.category_id}`)
                            };
                            
                            image.annotations.push(annotation);
                            annotationCount++;
                        }
                    } catch (err) {
                        console.warn('Skipping invalid annotation:', ann, err);
                    }
                });
            }
            
            return annotationCount;
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error(`Invalid JSON format in COCO file: ${error.message}`);
            }
            throw error;
        }
    }

    async parseYOLOAnnotations(files) {
        try {
            let annotationCount = 0;
            let classNames = [];
            
            // First, try to read a classes.txt file
            const classFile = files.find(f => 
                f.name.toLowerCase() === 'classes.txt' || 
                f.name.toLowerCase() === 'class_names.txt' ||
                f.name.toLowerCase() === 'names.txt'
            );
            
            if (classFile) {
                try {
                    const classText = await classFile.text();
                    classNames = classText.split('\n')
                        .map(name => name.trim())
                        .filter(name => name.length > 0);
                    console.log(`Found class file with ${classNames.length} classes:`, classNames);
                } catch (err) {
                    console.warn('Error reading class file:', err);
                }
            }

            // Process annotation files
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.txt') && 
                    !file.name.toLowerCase().includes('class') && 
                    !file.name.toLowerCase().includes('names')) {
                    
                    try {
                        const text = await file.text();
                        
                        // Skip empty files
                        if (!text.trim()) {
                            console.log(`Skipping empty file: ${file.name}`);
                            continue;
                        }

                        // Find matching image
                        const baseName = file.name.replace(/\.txt$/i, '');
                        const image = this.images.find(img => {
                            const imgBaseName = img.filename.replace(/\.[^/.]+$/, "");
                            return imgBaseName === baseName || 
                                   img.filename.startsWith(baseName) ||
                                   baseName.startsWith(imgBaseName);
                        });
                        
                        if (!image) {
                            console.warn(`No matching image found for annotation file: ${file.name}`);
                            continue;
                        }

                        console.log(`Processing annotations for ${image.filename} from ${file.name}`);
                        
                        const lines = text.split('\n').filter(line => line.trim());
                        
                        if (!image.annotations) image.annotations = [];
                        
                        lines.forEach((line, index) => {
                            try {
                                const parts = line.trim().split(/\s+/);
                                
                                if (parts.length < 5) {
                                    console.warn(`Invalid YOLO line in ${file.name}: ${line}`);
                                    return;
                                }

                                const classId = parseInt(parts[0]);
                                const centerX = parseFloat(parts[1]);
                                const centerY = parseFloat(parts[2]);
                                const width = parseFloat(parts[3]);
                                const height = parseFloat(parts[4]);

                                // Validate coordinates (should be between 0 and 1)
                                if (centerX < 0 || centerX > 1 || centerY < 0 || centerY > 1 ||
                                    width < 0 || width > 1 || height < 0 || height > 1) {
                                    console.warn(`Invalid YOLO coordinates in ${file.name}: ${line}`);
                                    return;
                                }

                                const className = classNames[classId] || `class_${classId}`;
                                
                                // Convert YOLO format (normalized center_x, center_y, width, height) to absolute bbox
                                const absX = (centerX - width / 2) * image.width;
                                const absY = (centerY - height / 2) * image.height;
                                const absWidth = width * image.width;
                                const absHeight = height * image.height;
                                
                                this.allClasses.add(className);
                                this.assignClassColor(className);
                                
                                const annotation = {
                                    id: `${baseName}_${index}`,
                                    label: className,
                                    bbox: [Math.max(0, absX), Math.max(0, absY), absWidth, absHeight],
                                    confidence: parts[5] ? parseFloat(parts[5]) : 1.0,
                                    color: this.getClassColor(className)
                                };
                                
                                image.annotations.push(annotation);
                                annotationCount++;
                            } catch (err) {
                                console.warn(`Error parsing line "${line}" in ${file.name}:`, err);
                            }
                        });
                    } catch (err) {
                        console.error(`Error processing YOLO file ${file.name}:`, err);
                    }
                }
            }
            
            if (annotationCount === 0) {
                throw new Error('No valid YOLO annotations found. Make sure:\n- Text files contain valid YOLO format (class_id center_x center_y width height)\n- Image files are loaded first\n- Annotation filenames match image filenames');
            }
            
            return annotationCount;
        } catch (error) {
            throw new Error(`YOLO parsing error: ${error.message}`);
        }
    }

    async parseCSVAnnotations(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                throw new Error('CSV file must have at least header and one data row');
            }
            
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            let annotationCount = 0;
            
            // Find column indices (more flexible matching)
            const filenameIdx = headers.findIndex(h => 
                h.includes('filename') || h.includes('file') || h.includes('image'));
            const classIdx = headers.findIndex(h => 
                h.includes('class') || h.includes('label') || h.includes('category'));
            const xIdx = headers.findIndex(h => h === 'x' || h === 'x1' || h === 'left');
            const yIdx = headers.findIndex(h => h === 'y' || h === 'y1' || h === 'top');
            const widthIdx = headers.findIndex(h => h.includes('width') || h === 'w');
            const heightIdx = headers.findIndex(h => h.includes('height') || h === 'h');
            
            // Validate required columns
            if (filenameIdx === -1) throw new Error('CSV must have filename/file/image column');
            if (classIdx === -1) throw new Error('CSV must have class/label/category column');
            if (xIdx === -1) throw new Error('CSV must have x/x1/left column');
            if (yIdx === -1) throw new Error('CSV must have y/y1/top column');
            if (widthIdx === -1) throw new Error('CSV must have width/w column');
            if (heightIdx === -1) throw new Error('CSV must have height/h column');
            
            console.log('CSV column mapping:', {
                filename: headers[filenameIdx],
                class: headers[classIdx],
                x: headers[xIdx],
                y: headers[yIdx],
                width: headers[widthIdx],
                height: headers[heightIdx]
            });
            
            for (let i = 1; i < lines.length; i++) {
                try {
                    const parts = lines[i].split(',').map(p => p.trim());
                    
                    if (parts.length <= Math.max(filenameIdx, classIdx, xIdx, yIdx, widthIdx, heightIdx)) {
                        console.warn(`Skipping line ${i + 1}: insufficient columns`);
                        continue;
                    }

                    const filename = parts[filenameIdx];
                    const className = parts[classIdx];
                    const x = parseFloat(parts[xIdx]);
                    const y = parseFloat(parts[yIdx]);
                    const width = parseFloat(parts[widthIdx]);
                    const height = parseFloat(parts[heightIdx]);
                    
                    // Validate values
                    if (!filename || !className) {
                        console.warn(`Skipping line ${i + 1}: missing filename or class`);
                        continue;
                    }
                    
                    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
                        console.warn(`Skipping line ${i + 1}: invalid coordinates`);
                        continue;
                    }
                    
                    const image = this.images.find(img => 
                        img.filename === filename || 
                        img.filename.endsWith(filename) ||
                        filename.endsWith(img.filename)
                    );
                    
                    if (image) {
                        if (!image.annotations) image.annotations = [];
                        
                        this.allClasses.add(className);
                        this.assignClassColor(className);
                        
                        const annotation = {
                            id: `csv_${i}`,
                            label: className,
                            bbox: [x, y, width, height],
                            confidence: 1.0,
                            color: this.getClassColor(className)
                        };
                        
                        image.annotations.push(annotation);
                        annotationCount++;
                    } else {
                        console.warn(`No matching image found for: ${filename}`);
                    }
                } catch (err) {
                    console.warn(`Error processing CSV line ${i + 1}:`, err);
                }
            }
            
            if (annotationCount === 0) {
                throw new Error('No valid annotations found in CSV. Check that filenames match loaded images.');
            }
            
            return annotationCount;
        } catch (error) {
            throw new Error(`CSV parsing error: ${error.message}`);
        }
    }

    async parsePascalAnnotations(files) {
        try {
            let annotationCount = 0;
            
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.xml')) {
                    try {
                        const text = await file.text();
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(text, 'text/xml');
                        
                        // Check for XML parsing errors
                        const parserError = xmlDoc.querySelector('parsererror');
                        if (parserError) {
                            console.warn(`XML parsing error in ${file.name}:`, parserError.textContent);
                            continue;
                        }
                        
                        const filename = xmlDoc.querySelector('filename')?.textContent;
                        if (!filename) {
                            console.warn(`No filename found in XML: ${file.name}`);
                            continue;
                        }
                        
                        const image = this.images.find(img => 
                            img.filename === filename || 
                            img.filename.endsWith(filename) ||
                            filename.endsWith(img.filename)
                        );
                        
                        if (!image) {
                            console.warn(`No matching image found for XML file ${file.name} (filename: ${filename})`);
                            continue;
                        }

                        if (!image.annotations) image.annotations = [];
                        
                        const objects = xmlDoc.querySelectorAll('object');
                        objects.forEach((obj, index) => {
                            try {
                                const className = obj.querySelector('name')?.textContent;
                                const bndbox = obj.querySelector('bndbox');
                                
                                if (!className || !bndbox) {
                                    console.warn(`Invalid object in ${file.name}: missing name or bndbox`);
                                    return;
                                }

                                const xmin = parseFloat(bndbox.querySelector('xmin')?.textContent || 0);
                                const ymin = parseFloat(bndbox.querySelector('ymin')?.textContent || 0);
                                const xmax = parseFloat(bndbox.querySelector('xmax')?.textContent || 0);
                                const ymax = parseFloat(bndbox.querySelector('ymax')?.textContent || 0);
                                
                                if (xmin >= xmax || ymin >= ymax) {
                                    console.warn(`Invalid bounding box in ${file.name}: xmin=${xmin}, ymin=${ymin}, xmax=${xmax}, ymax=${ymax}`);
                                    return;
                                }
                                
                                this.allClasses.add(className);
                                this.assignClassColor(className);
                                
                                const annotation = {
                                    id: `pascal_${file.name}_${index}`,
                                    label: className,
                                    bbox: [xmin, ymin, xmax - xmin, ymax - ymin],
                                    confidence: 1.0,
                                    color: this.getClassColor(className)
                                };
                                
                                image.annotations.push(annotation);
                                annotationCount++;
                            } catch (err) {
                                console.warn(`Error processing object in ${file.name}:`, err);
                            }
                        });
                    } catch (err) {
                        console.error(`Error processing Pascal VOC file ${file.name}:`, err);
                    }
                }
            }
            
            if (annotationCount === 0) {
                throw new Error('No valid Pascal VOC annotations found. Check that XML files are valid and filenames match loaded images.');
            }
            
            return annotationCount;
        } catch (error) {
            throw new Error(`Pascal VOC parsing error: ${error.message}`);
        }
    }

    assignClassColor(className) {
        if (!this.classColors[className]) {
            const hue = (Object.keys(this.classColors).length * 137.508) % 360; // Golden angle
            this.classColors[className] = `hsl(${hue}, 70%, 50%)`;
        }
    }

    getClassColor(className) {
        return this.classColors[className] || '#4285f4';
    }

    updateClassFilter() {
        const classFilter = document.getElementById('classFilter');
        classFilter.innerHTML = '<option value="">All classes</option>';
        
        Array.from(this.allClasses).sort().forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classFilter.appendChild(option);
        });
    }

    updateFormatFilter() {
        const formatFilter = document.getElementById('formatFilter');
        const formats = [...new Set(this.images.map(img => img.format))];
        
        // Clear existing options except the first one
        formatFilter.innerHTML = '<option value="">All formats</option>';
        
        formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            formatFilter.appendChild(option);
        });
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const formatFilter = document.getElementById('formatFilter').value;
        const sizeFilter = parseFloat(document.getElementById('sizeFilter').value) / 100;
        const classFilter = document.getElementById('classFilter').value;
        const annotatedOnly = document.getElementById('annotatedOnly').checked;
        
        // Start with images from current project
        let projectImages = this.images.filter(img => img.project === this.currentProject);
        
        // Apply folder filter
        if (this.currentFolder !== 'all') {
            if (this.currentFolder === 'unsorted') {
                projectImages = projectImages.filter(img => img.folder === 'unsorted');
            } else {
                const folderImageIds = this.projects[this.currentProject].folders[this.currentFolder]?.images || [];
                projectImages = projectImages.filter(img => folderImageIds.includes(img.id));
            }
        }
        
        this.filteredImages = projectImages.filter(img => {
            const matchesSearch = img.filename.toLowerCase().includes(searchTerm);
            const matchesFormat = !formatFilter || img.format === formatFilter;
            
            // Size filter based on file size percentile
            const maxSize = Math.max(...this.images.map(i => i.size));
            const matchesSize = img.size <= (maxSize * sizeFilter);
            
            // Class filter - check if image has annotations with the specified class
            const matchesClass = !classFilter || (img.annotations && 
                img.annotations.some(ann => ann.label === classFilter));
            
            // Annotated only filter
            const matchesAnnotated = !annotatedOnly || (img.annotations && img.annotations.length > 0);
            
            return matchesSearch && matchesFormat && matchesSize && matchesClass && matchesAnnotated;
        });
        
        this.currentPage = 1;
        this.updateDisplay();
    }

    handleSizeFilter(e) {
        const value = e.target.value;
        const maxSize = Math.max(...this.images.map(i => i.size));
        const sizeThreshold = (maxSize * value / 100) / (1024 * 1024);
        
        document.getElementById('sizeValue').textContent = 
            value == 100 ? 'All sizes' : `≤ ${sizeThreshold.toFixed(1)} MB`;
        
        this.applyFilters();
    }

    updateDisplay() {
        this.updateGallery();
        this.updatePagination();
        this.updateResultsInfo();
    }

    updateGallery() {
        const imageGrid = document.getElementById('imageGrid');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageImages = this.filteredImages.slice(startIndex, endIndex);
        
        imageGrid.innerHTML = '';
        
        pageImages.forEach(image => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.setAttribute('data-image-id', image.id);
            imageItem.onclick = (e) => {
                // Don't open modal if clicking on checkbox, button, or in select mode
                if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.tagName === 'I') return;
                if (this.isSelectMode) return;
                this.openModal(image);
            };
            
            const annotationCount = image.annotations ? image.annotations.length : 0;
            const annotationClasses = image.annotations ? 
                [...new Set(image.annotations.map(ann => ann.label))].slice(0, 3) : [];
            
            // Add selection class if in select mode
            if (this.isSelectMode) {
                imageItem.classList.add('selectable');
                if (this.selectedImages.has(image.id)) {
                    imageItem.classList.add('selected');
                }
            }

            imageItem.innerHTML = `
                <div class="image-wrapper">
                    <img src="${image.src}" alt="${image.filename}" loading="lazy">
                    ${this.isSelectMode ? `
                        <input type="checkbox" class="image-checkbox" 
                               ${this.selectedImages.has(image.id) ? 'checked' : ''}
                               onclick="event.stopPropagation();"
                               onchange="samAnalyser.toggleImageSelection('${image.id}', this.checked)">
                    ` : `
                        <button class="image-remove" onclick="event.stopPropagation(); samAnalyser.removeImage('${image.id}');" title="Remove image">
                            <i class="fas fa-times"></i>
                        </button>
                    `}
                    ${annotationCount > 0 && this.showAnnotations ? `
                        <div class="annotation-indicator">
                            <i class="fas fa-tags"></i> ${annotationCount}
                        </div>
                    ` : ''}
                </div>
                <div class="image-info">
                    <div class="image-filename">${image.filename}</div>
                    <div class="image-meta">
                        ${image.width}×${image.height} • ${image.format.toUpperCase()} • ${(image.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                    ${annotationClasses.length > 0 && this.showAnnotations ? `
                        <div class="annotation-classes">
                            ${annotationClasses.map(cls => `
                                <span class="class-tag" style="background-color: ${this.getClassColor(cls)}">
                                    ${cls}
                                </span>
                            `).join('')}
                            ${annotationClasses.length < image.annotations.length ? 
                                `<span class="class-tag">+${image.annotations.length - annotationClasses.length}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
            
            imageGrid.appendChild(imageItem);
        });
    }

    updatePagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredImages.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="samAnalyser.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const maxVisible = 5;
        let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        start = Math.max(1, end - maxVisible + 1);
        
        for (let i = start; i <= end; i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'active' : ''}" onclick="samAnalyser.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="samAnalyser.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    updateResultsInfo() {
        const resultsInfo = document.getElementById('resultsInfo');
        resultsInfo.textContent = `${this.filteredImages.length} images`;
    }

    goToPage(page) {
        this.currentPage = page;
        this.updateDisplay();
    }

    switchTab(e) {
        const tabName = e.target.closest('.tab-btn').dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        e.target.closest('.tab-btn').classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');
        
        // Load tab-specific content
        if (tabName === 'statistics') {
            this.updateStatistics();
        } else if (tabName === 'embeddings') {
            this.updateEmbeddings();
        }
    }

    setViewMode(mode) {
        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        const imageGrid = document.getElementById('imageGrid');
        
        if (mode === 'grid') {
            gridView.classList.add('active');
            listView.classList.remove('active');
            imageGrid.classList.remove('list-view');
        } else {
            listView.classList.add('active');
            gridView.classList.remove('active');
            imageGrid.classList.add('list-view');
        }
    }

    updateStatistics() {
        if (this.images.length === 0) return;
        
        this.updateFormatChart();
        this.updateDimensionsChart();
        this.updateSizeChart();
        this.updateColorChart();
    }

    updateFormatChart() {
        const formatCounts = {};
        this.images.forEach(img => {
            formatCounts[img.format] = (formatCounts[img.format] || 0) + 1;
        });
        
        const data = [{
            labels: Object.keys(formatCounts),
            values: Object.values(formatCounts),
            type: 'pie',
            hole: 0.4,
            marker: {
                colors: ['#4285f4', '#34a853', '#fbbc04', '#ea4335', '#9c27b0']
            }
        }];
        
        const layout = {
            title: '',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e1e5e9' },
            showlegend: true,
            margin: { t: 0, b: 0, l: 0, r: 0 }
        };
        
        Plotly.newPlot('formatChart', data, layout, { displayModeBar: false });
    }

    updateDimensionsChart() {
        const data = [{
            x: this.images.map(img => img.width),
            y: this.images.map(img => img.height),
            mode: 'markers',
            type: 'scatter',
            marker: { 
                color: '#4285f4',
                size: 8,
                opacity: 0.7
            }
        }];
        
        const layout = {
            title: '',
            xaxis: { title: 'Width (px)', color: '#e1e5e9' },
            yaxis: { title: 'Height (px)', color: '#e1e5e9' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e1e5e9' },
            margin: { t: 20, b: 50, l: 50, r: 20 }
        };
        
        Plotly.newPlot('dimensionsChart', data, layout, { displayModeBar: false });
    }

    updateSizeChart() {
        const fileSizesMB = this.images.map(img => img.size / (1024 * 1024));
        
        const data = [{
            x: fileSizesMB,
            type: 'histogram',
            nbinsx: 20,
            marker: { color: '#34a853' }
        }];
        
        const layout = {
            title: '',
            xaxis: { title: 'File Size (MB)', color: '#e1e5e9' },
            yaxis: { title: 'Count', color: '#e1e5e9' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e1e5e9' },
            margin: { t: 20, b: 50, l: 50, r: 20 }
        };
        
        Plotly.newPlot('sizeChart', data, layout, { displayModeBar: false });
    }

    updateColorChart() {
        const colors = this.images.map(img => {
            const color = img.dominantColor;
            return `rgb(${color.r}, ${color.g}, ${color.b})`;
        });
        
        const hues = this.images.map(img => {
            const { r, g, b } = img.dominantColor;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            if (diff === 0) return 0;
            
            let hue;
            switch (max) {
                case r: hue = (g - b) / diff; break;
                case g: hue = 2 + (b - r) / diff; break;
                case b: hue = 4 + (r - g) / diff; break;
            }
            
            hue = Math.round(hue * 60);
            if (hue < 0) hue += 360;
            return hue;
        });
        
        const data = [{
            x: hues,
            type: 'histogram',
            nbinsx: 36,
            marker: { 
                color: hues.map(h => `hsl(${h}, 70%, 50%)`),
                line: { width: 1, color: 'rgba(0,0,0,0.3)' }
            }
        }];
        
        const layout = {
            title: '',
            xaxis: { title: 'Hue (degrees)', color: '#e1e5e9' },
            yaxis: { title: 'Count', color: '#e1e5e9' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e1e5e9' },
            margin: { t: 20, b: 50, l: 50, r: 20 }
        };
        
        Plotly.newPlot('colorChart', data, layout, { displayModeBar: false });
    }

    updateEmbeddings() {
        // Simulate embeddings visualization
        const data = [{
            x: this.images.map(() => Math.random() * 100),
            y: this.images.map(() => Math.random() * 100),
            mode: 'markers',
            type: 'scatter',
            text: this.images.map(img => img.filename),
            marker: {
                size: 8,
                color: this.images.map(img => img.aspectRatio),
                colorscale: 'Viridis',
                showscale: true,
                colorbar: { title: 'Aspect Ratio' }
            }
        }];
        
        const layout = {
            title: 'Image Embeddings (Simulated t-SNE)',
            xaxis: { title: 'Component 1', color: '#e1e5e9' },
            yaxis: { title: 'Component 2', color: '#e1e5e9' },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e1e5e9' },
            margin: { t: 50, b: 50, l: 50, r: 50 }
        };
        
        Plotly.newPlot('embeddingsPlot', data, layout, { displayModeBar: false });
    }

    openModal(image) {
        this.selectedImage = image;
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('modalTitle');
        const metadataContent = document.getElementById('metadataContent');
        
        modal.style.display = 'block';
        modalImage.src = image.src;
        modalTitle.textContent = image.filename;
        
        // Update metadata
        metadataContent.innerHTML = `
            <div class="metadata-item">
                <div class="metadata-label">Filename</div>
                <div>${image.filename}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Dimensions</div>
                <div>${image.width} × ${image.height} pixels</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Format</div>
                <div>${image.format.toUpperCase()}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">File Size</div>
                <div>${(image.size / (1024 * 1024)).toFixed(2)} MB</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Aspect Ratio</div>
                <div>${image.aspectRatio.toFixed(2)}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Last Modified</div>
                <div>${image.lastModified.toLocaleDateString()}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Dominant Color</div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 20px; height: 20px; background-color: rgb(${image.dominantColor.r}, ${image.dominantColor.g}, ${image.dominantColor.b}); border-radius: 3px;"></div>
                    RGB(${image.dominantColor.r}, ${image.dominantColor.g}, ${image.dominantColor.b})
                </div>
            </div>
        `;
        
        this.setupAnnotationCanvas();
        this.setupModalAnnotationToggle();
    }

    setupAnnotationCanvas() {
        const modalImage = document.getElementById('modalImage');
        const canvas = document.getElementById('annotationCanvas');
        
        modalImage.onload = () => {
            canvas.width = modalImage.width;
            canvas.height = modalImage.height;
            canvas.style.width = modalImage.offsetWidth + 'px';
            canvas.style.height = modalImage.offsetHeight + 'px';
            
            this.drawAnnotations();
        };
        
        if (modalImage.complete) {
            modalImage.onload();
        }
        
        this.setupCanvasEvents(canvas);
    }

    setupCanvasEvents(canvas) {
        let isDrawing = false;
        let startX, startY;
        
        canvas.addEventListener('mousedown', (e) => {
            if (!this.isAnnotationMode) return;
            
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing || !this.isAnnotationMode) return;
            
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            this.drawCurrentBox(canvas, startX, startY, currentX, currentY);
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (!isDrawing || !this.isAnnotationMode) return;
            
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            
            if (width > 10 && height > 10) {
                this.addAnnotation(startX, startY, endX, endY);
            }
        });
    }

    drawCurrentBox(canvas, startX, startY, endX, endY) {
        const ctx = canvas.getContext('2d');
        this.drawAnnotations();
        
        ctx.strokeStyle = '#4285f4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
        );
        ctx.setLineDash([]);
    }

    addAnnotation(startX, startY, endX, endY) {
        const label = prompt('Enter annotation label:');
        if (!label) return;
        
        const annotation = {
            id: Date.now(),
            label: label,
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: Math.abs(endX - startX),
            height: Math.abs(endY - startY),
            color: `hsl(${Math.random() * 360}, 70%, 50%)`
        };
        
        if (!this.selectedImage.annotations) {
            this.selectedImage.annotations = [];
        }
        
        this.selectedImage.annotations.push(annotation);
        this.drawAnnotations();
        this.updateAnnotationList();
    }

    drawAnnotations() {
        const canvas = document.getElementById('annotationCanvas');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!this.selectedImage || !this.selectedImage.annotations || !this.showAnnotations) return;
        
        this.selectedImage.annotations.forEach(annotation => {
            const color = annotation.color || this.getClassColor(annotation.label);
            const [x, y, width, height] = annotation.bbox || [annotation.x, annotation.y, annotation.width, annotation.height];
            
            // Scale coordinates to canvas size
            const scaleX = canvas.width / this.selectedImage.width;
            const scaleY = canvas.height / this.selectedImage.height;
            
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;
            
            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.fillStyle = color + '20';
            ctx.lineWidth = 2;
            
            ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
            ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
            
            // Draw label background
            ctx.font = '14px Arial';
            const labelText = `${annotation.label}${annotation.confidence ? ` (${(annotation.confidence * 100).toFixed(0)}%)` : ''}`;
            const textMetrics = ctx.measureText(labelText);
            const labelPadding = 4;
            
            ctx.fillStyle = color;
            ctx.fillRect(
                scaledX, 
                scaledY - 20, 
                textMetrics.width + labelPadding * 2, 
                20
            );
            
            // Draw label text
            ctx.fillStyle = 'white';
            ctx.fillText(labelText, scaledX + labelPadding, scaledY - 6);
        });
    }

    updateAnnotationList() {
        const annotationList = document.getElementById('annotationList');
        const allAnnotations = this.images.flatMap(img => 
            (img.annotations || []).map(ann => ({ ...ann, image: img.filename }))
        );
        
        annotationList.innerHTML = allAnnotations.map(ann => `
            <div class="annotation-item">
                <strong>${ann.label}</strong><br>
                <small>${ann.image}</small>
            </div>
        `).join('');
    }

    toggleAnnotationMode() {
        this.isAnnotationMode = !this.isAnnotationMode;
        const btn = document.getElementById('annotationMode');
        
        if (this.isAnnotationMode) {
            btn.textContent = '✓ Annotation Mode ON';
            btn.style.backgroundColor = '#4caf50';
        } else {
            btn.innerHTML = '<i class="fas fa-square-plus"></i> Add Bounding Box';
            btn.style.backgroundColor = '#37474f';
        }
    }

    closeModal() {
        document.getElementById('imageModal').style.display = 'none';
        this.selectedImage = null;
    }

    // Project and Folder Management Methods
    createNewProject() {
        const projectName = prompt('Enter project name:');
        if (!projectName || !projectName.trim()) return;
        
        const projectId = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (this.projects[projectId]) {
            alert('Project with this name already exists!');
            return;
        }
        
        this.projects[projectId] = {
            name: projectName.trim(),
            folders: {
                unsorted: { name: 'Unsorted', images: [] }
            }
        };
        
        this.updateProjectSelect();
        this.switchToProject(projectId);
    }

    createNewFolder() {
        const folderName = prompt('Enter folder name:');
        if (!folderName || !folderName.trim()) return;
        
        const folderId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (this.projects[this.currentProject].folders[folderId]) {
            alert('Folder with this name already exists!');
            return;
        }
        
        this.projects[this.currentProject].folders[folderId] = {
            name: folderName.trim(),
            images: []
        };
        
        this.updateFolderList();
        this.updateFolderCounts();
    }

    switchProject(e) {
        const projectId = e.target.value;
        this.switchToProject(projectId);
    }

    switchToProject(projectId) {
        this.currentProject = projectId;
        this.currentFolder = 'all';
        this.updateFolderList();
        this.applyFilters();
        this.updateFolderCounts();
    }

    selectFolder(folderId) {
        this.currentFolder = folderId;
        
        // Update active folder
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-folder="${folderId}"]`).classList.add('active');
        
        this.applyFilters();
    }

    toggleSelectMode() {
        this.isSelectMode = !this.isSelectMode;
        this.selectedImages.clear();
        
        const selectBtn = document.getElementById('selectModeBtn');
        const bulkActions = document.getElementById('bulkActions');
        
        console.log('Toggling select mode. New state:', this.isSelectMode);
        
        if (this.isSelectMode) {
            selectBtn.classList.add('active');
            selectBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            bulkActions.style.display = 'flex';
            console.log('Entered selection mode');
        } else {
            selectBtn.classList.remove('active');
            selectBtn.innerHTML = '<i class="fas fa-check-square"></i> Select';
            bulkActions.style.display = 'none';
            console.log('Exited selection mode');
        }
        
        this.updateDisplay();
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const count = this.selectedImages.size;
        document.getElementById('selectedCount').textContent = `${count} selected`;
        console.log('Updated selected count:', count);
        
        // Show/hide bulk action buttons based on selection
        const moveBtn = document.getElementById('moveSelectedBtn');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        
        if (count > 0) {
            moveBtn.disabled = false;
            deleteBtn.disabled = false;
            moveBtn.style.opacity = '1';
            deleteBtn.style.opacity = '1';
        } else {
            moveBtn.disabled = true;
            deleteBtn.disabled = true;
            moveBtn.style.opacity = '0.5';
            deleteBtn.style.opacity = '0.5';
        }
    }

    toggleImageSelection(imageId, isSelected) {
        console.log('Toggling selection for image:', imageId, 'Selected:', isSelected);
        
        if (isSelected) {
            this.selectedImages.add(imageId);
            console.log('Added to selection. Total selected:', this.selectedImages.size);
        } else {
            this.selectedImages.delete(imageId);
            console.log('Removed from selection. Total selected:', this.selectedImages.size);
        }
        
        this.updateSelectedCount();
        
        // Update the visual selection state without full refresh
        const imageElement = document.querySelector(`[data-image-id="${imageId}"]`);
        if (imageElement) {
            if (isSelected) {
                imageElement.classList.add('selected');
            } else {
                imageElement.classList.remove('selected');
            }
        }
    }

    moveSelectedImages() {
        if (this.selectedImages.size === 0) return;
        
        const folders = Object.keys(this.projects[this.currentProject].folders);
        const folderOptions = folders.map(fId => 
            `<option value="${fId}">${this.projects[this.currentProject].folders[fId].name}</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
            align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: #1a1f29; padding: 20px; border-radius: 8px; min-width: 300px;">
                <h3 style="color: #64b5f6; margin-bottom: 15px;">Move ${this.selectedImages.size} images</h3>
                <label style="color: #e1e5e9; display: block; margin-bottom: 10px;">Select destination folder:</label>
                <select id="destinationFolder" style="width: 100%; padding: 8px; background: #2a3441; border: 1px solid #424850; border-radius: 4px; color: #e1e5e9; margin-bottom: 15px;">
                    ${folderOptions}
                </select>
                <div style="display: flex; gap: 10px;">
                    <button onclick="samAnalyser.executeMoveImages('${modal.id}'); this.parentElement.parentElement.parentElement.remove();" 
                            style="flex: 1; background: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Move
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                            style="flex: 1; background: #37474f; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        modal.id = 'moveModal_' + Date.now();
        document.body.appendChild(modal);
    }

    executeMoveImages(modalId) {
        const destinationFolder = document.getElementById('destinationFolder').value;
        
        this.selectedImages.forEach(imageId => {
            const image = this.images.find(img => img.id === imageId);
            if (image) {
                // Remove from current folder
                if (image.folder && this.projects[this.currentProject].folders[image.folder]) {
                    const currentFolderImages = this.projects[this.currentProject].folders[image.folder].images;
                    const index = currentFolderImages.indexOf(imageId);
                    if (index > -1) {
                        currentFolderImages.splice(index, 1);
                    }
                }
                
                // Add to destination folder
                image.folder = destinationFolder;
                if (!this.projects[this.currentProject].folders[destinationFolder].images) {
                    this.projects[this.currentProject].folders[destinationFolder].images = [];
                }
                this.projects[this.currentProject].folders[destinationFolder].images.push(imageId);
            }
        });
        
        this.selectedImages.clear();
        this.toggleSelectMode();
        this.updateFolderCounts();
        this.applyFilters();
    }

    deleteSelectedImages() {
        if (this.selectedImages.size === 0) {
            alert('No images selected. Please select images first.');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete ${this.selectedImages.size} images? This action cannot be undone.`)) {
            return;
        }
        
        console.log('Deleting images:', Array.from(this.selectedImages));
        
        // Convert to array to avoid modification during iteration
        const imagesToDelete = Array.from(this.selectedImages);
        
        imagesToDelete.forEach(imageId => {
            const imageIndex = this.images.findIndex(img => img.id === imageId);
            if (imageIndex > -1) {
                const image = this.images[imageIndex];
                console.log('Deleting image:', image.filename);
                
                // Remove from folder
                if (image.folder && this.projects[this.currentProject].folders[image.folder]) {
                    const folderImages = this.projects[this.currentProject].folders[image.folder].images;
                    const folderIndex = folderImages.indexOf(imageId);
                    if (folderIndex > -1) {
                        folderImages.splice(folderIndex, 1);
                        console.log('Removed from folder:', image.folder);
                    }
                }
                
                // Remove from main array
                this.images.splice(imageIndex, 1);
                console.log('Removed from main array');
            }
        });
        
        this.selectedImages.clear();
        console.log('Selection cleared');
        
        this.toggleSelectMode();
        this.updateDatasetInfo();
        this.updateClassFilter();
        this.updateFolderCounts();
        this.applyFilters();
        
        console.log('Delete operation completed');
    }

    updateProjectSelect() {
        const projectSelect = document.getElementById('projectSelect');
        projectSelect.innerHTML = '';
        
        Object.keys(this.projects).forEach(projectId => {
            const option = document.createElement('option');
            option.value = projectId;
            option.textContent = this.projects[projectId].name;
            if (projectId === this.currentProject) {
                option.selected = true;
            }
            projectSelect.appendChild(option);
        });
    }

    updateFolderList() {
        const foldersContainer = document.getElementById('projectFolders');
        foldersContainer.innerHTML = `
            <div class="folder-item ${this.currentFolder === 'all' ? 'active' : ''}" data-folder="all">
                <i class="fas fa-images"></i>
                <span>All Images</span>
                <span class="folder-count" id="allImagesCount">0</span>
            </div>
        `;
        
        Object.keys(this.projects[this.currentProject].folders).forEach(folderId => {
            const folder = this.projects[this.currentProject].folders[folderId];
            const isCustom = folderId !== 'unsorted';
            
            const folderEl = document.createElement('div');
            folderEl.className = `folder-item ${isCustom ? 'custom-folder' : ''} ${this.currentFolder === folderId ? 'active' : ''}`;
            folderEl.dataset.folder = folderId;
            
            folderEl.innerHTML = `
                <i class="fas ${folderId === 'unsorted' ? 'fa-question-circle' : 'fa-folder'}"></i>
                <span>${folder.name}</span>
                <span class="folder-count" id="${folderId}Count">0</span>
                ${isCustom ? `
                    <div class="folder-actions">
                        <button onclick="samAnalyser.deleteFolder('${folderId}')" title="Delete folder">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            `;
            
            foldersContainer.appendChild(folderEl);
        });
    }

    deleteFolder(folderId) {
        if (!confirm(`Are you sure you want to delete the folder "${this.projects[this.currentProject].folders[folderId].name}"? Images will be moved to Unsorted.`)) {
            return;
        }
        
        // Move all images to unsorted
        const folderImages = this.projects[this.currentProject].folders[folderId].images || [];
        folderImages.forEach(imageId => {
            const image = this.images.find(img => img.id === imageId);
            if (image) {
                image.folder = 'unsorted';
                this.projects[this.currentProject].folders.unsorted.images.push(imageId);
            }
        });
        
        // Delete folder
        delete this.projects[this.currentProject].folders[folderId];
        
        // Switch to all images view if current folder was deleted
        if (this.currentFolder === folderId) {
            this.currentFolder = 'all';
        }
        
        this.updateFolderList();
        this.updateFolderCounts();
        this.applyFilters();
    }

    updateFolderCounts() {
        // Count all images in current project
        const projectImages = this.images.filter(img => img.project === this.currentProject);
        document.getElementById('allImagesCount').textContent = projectImages.length;
        
        // Count images in each folder
        Object.keys(this.projects[this.currentProject].folders).forEach(folderId => {
            const folderImages = this.projects[this.currentProject].folders[folderId].images || [];
            const countEl = document.getElementById(folderId + 'Count');
            if (countEl) {
                countEl.textContent = folderImages.length;
            }
        });
    }

    removeImage(imageId) {
        console.log('Removing single image:', imageId);
        
        const imageIndex = this.images.findIndex(img => img.id === imageId);
        if (imageIndex > -1) {
            const image = this.images[imageIndex];
            console.log('Found image to remove:', image.filename);
            
            // Remove from folder
            if (image.folder && this.projects[this.currentProject].folders[image.folder]) {
                const folderImages = this.projects[this.currentProject].folders[image.folder].images;
                const folderIndex = folderImages.indexOf(imageId);
                if (folderIndex > -1) {
                    folderImages.splice(folderIndex, 1);
                    console.log('Removed from folder:', image.folder);
                }
            }
            
            // Remove from main array
            this.images.splice(imageIndex, 1);
            console.log('Removed from main array');
            
            this.updateDatasetInfo();
            this.updateClassFilter();
            this.updateFolderCounts();
            this.applyFilters();
            
            console.log('Single image removal completed');
        } else {
            console.error('Image not found for removal:', imageId);
        }
    }

    // Annotation Visibility Methods
    toggleAnnotationVisibility() {
        this.showAnnotations = !this.showAnnotations;
        
        const toggleBtn = document.getElementById('annotationVisibilityToggle');
        if (this.showAnnotations) {
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Annotations';
            toggleBtn.classList.remove('btn-secondary');
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Annotations';
            toggleBtn.classList.add('btn-secondary');
        }
        
        this.updateDisplay();
        this.drawAnnotations(); // Redraw if modal is open
    }

    setupModalAnnotationToggle() {
        const toggleBtn = document.getElementById('annotationToggle');
        const hasAnnotations = this.selectedImage && this.selectedImage.annotations && this.selectedImage.annotations.length > 0;
        
        // Show/hide the toggle button based on whether image has annotations
        if (hasAnnotations) {
            toggleBtn.style.display = 'inline-block';
            this.updateModalToggleState();
            
            // Remove existing listeners and add new one
            toggleBtn.replaceWith(toggleBtn.cloneNode(true));
            document.getElementById('annotationToggle').addEventListener('click', () => {
                this.showAnnotations = !this.showAnnotations;
                this.updateModalToggleState();
                this.drawAnnotations();
            });
        } else {
            toggleBtn.style.display = 'none';
        }
    }

    updateModalToggleState() {
        const toggleBtn = document.getElementById('annotationToggle');
        if (this.showAnnotations) {
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Hide Annotations';
            toggleBtn.classList.remove('btn-secondary');
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Show Annotations';
            toggleBtn.classList.add('btn-secondary');
        }
    }

    // Method to detect existing annotations in images
    detectExistingAnnotations(imageData) {
        // Check filename patterns that might indicate annotated images
        const filename = imageData.filename.toLowerCase();
        
        // Common patterns for annotated images
        const annotationPatterns = [
            '_annotated', '_labeled', '_bbox', '_detected', '_objects',
            '_yolo', '_coco', '_pascal', '_annotations'
        ];
        
        const hasAnnotationPattern = annotationPatterns.some(pattern => 
            filename.includes(pattern)
        );
        
        // If image seems to be annotated, add some sample annotations
        if (hasAnnotationPattern) {
            // Add demo annotations to show the capability
            this.addDemoAnnotations(imageData);
        }
        
        // Look for annotation indicators in EXIF data
        // (This is a simplified version - real implementation would parse actual EXIF data)
        if (imageData.file.name.includes('annotated') || imageData.file.name.includes('labeled')) {
            this.addDemoAnnotations(imageData);
        }
    }

    addDemoAnnotations(imageData) {
        // Add some demo annotations to show the annotation overlay capability
        const demoAnnotations = [
            {
                id: 'demo_1',
                label: 'Object',
                bbox: [imageData.width * 0.2, imageData.height * 0.2, imageData.width * 0.3, imageData.height * 0.4],
                confidence: 0.95,
                color: this.getClassColor('Object')
            },
            {
                id: 'demo_2', 
                label: 'Person',
                bbox: [imageData.width * 0.6, imageData.height * 0.1, imageData.width * 0.25, imageData.height * 0.6],
                confidence: 0.88,
                color: this.getClassColor('Person')
            }
        ];
        
        imageData.annotations = demoAnnotations;
        
        // Add classes to global class list
        demoAnnotations.forEach(ann => {
            this.allClasses.add(ann.label);
            this.assignClassColor(ann.label);
        });
    }
}

// Initialize the application
const samAnalyser = new SAMAnalyser();