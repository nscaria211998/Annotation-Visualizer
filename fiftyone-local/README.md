# SAM Analyser Tool

> **Computer Vision Dataset Analysis and Visualization Platform**

A powerful, browser-based tool for analyzing, visualizing, and managing computer vision datasets. Built with modern web technologies, SAM Analyser provides an intuitive interface for dataset exploration, annotation management, and statistical analysis.

![SAM Analyser Tool](https://img.shields.io/badge/Computer%20Vision-Dataset%20Analysis-blue)
![Browser Based](https://img.shields.io/badge/Platform-Browser%20Based-green)
![No Server Required](https://img.shields.io/badge/Setup-No%20Server%20Required-orange)

## 🚀 Quick Start

### Prerequisites
- Any modern web browser (Chrome, Firefox, Safari, Edge)
- No additional software installation required!

### Installation & Setup

1. **Download the Project**
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/sam-analyser-tool.git
   
   # Or download ZIP and extract
   ```

2. **Run the Application**
   ```bash
   # Navigate to the project directory
   cd sam-analyser-tool
   
   # Option 1: Open directly in browser
   open index.html
   
   # Option 2: Use a local server (recommended)
   python -m http.server 8000
   # Then visit: http://localhost:8000
   
   # Option 3: Use Node.js server
   npx serve .
   ```

3. **Start Analyzing**
   - Open your browser to the application
   - Upload your images and annotation files
   - Begin exploring your dataset!

## 📋 Features Overview

### 🖼️ **Dataset Management**
- **Multi-Project Support**: Organize datasets into separate projects
- **Folder Organization**: Create custom folders to categorize images
- **Bulk Operations**: Move, organize, and delete multiple images at once
- **Smart Filtering**: Filter by filename, format, size, annotation class, or annotated status

### 🏷️ **Annotation Support**
- **Multiple Formats**: Import COCO JSON, YOLO TXT, CSV, and Pascal VOC annotations
- **Visual Overlay**: View bounding boxes and labels overlaid on images
- **Annotation Creation**: Draw new bounding boxes with custom labels
- **Toggle Visibility**: Show/hide annotations globally or per image
- **Smart Detection**: Automatically detect pre-annotated images

### 📊 **Statistical Analysis**
- **Format Distribution**: Pie charts showing image format breakdown
- **Dimension Analysis**: Scatter plots of image dimensions
- **File Size Analysis**: Histograms of file size distribution
- **Color Analysis**: Dominant color extraction and hue distribution
- **Annotation Statistics**: Track annotation counts and class distribution

### 🔍 **Data Exploration**
- **Interactive Gallery**: Grid and list view modes with smooth pagination
- **Image Details**: Comprehensive metadata display for each image
- **Search & Filter**: Real-time filtering with multiple criteria
- **Embeddings View**: Simulated t-SNE visualization for pattern discovery

## 📖 Detailed Usage Guide

### 1. Loading Your Dataset

#### **Upload Images**
1. Click the upload area or drag and drop images
2. Supported formats: JPG, PNG, GIF, BMP, WebP
3. Images are automatically added to the "Unsorted" folder

#### **Import Existing Annotations**

**COCO Format:**
```json
{
  "images": [...],
  "annotations": [...],
  "categories": [...]
}
```

**YOLO Format:**
```
# Each image needs a corresponding .txt file
# Format: class_id center_x center_y width height [confidence]
0 0.5 0.3 0.2 0.4 0.95
1 0.7 0.6 0.1 0.2 0.88
```

**CSV Format:**
```csv
filename,class,x,y,width,height,confidence
image1.jpg,person,100,50,80,150,0.95
image1.jpg,car,200,100,120,80,0.88
```

**Pascal VOC XML:**
```xml
<annotation>
  <filename>image1.jpg</filename>
  <object>
    <name>person</name>
    <bndbox>
      <xmin>100</xmin>
      <ymin>50</ymin>
      <xmax>180</xmax>
      <ymax>200</ymax>
    </bndbox>
  </object>
</annotation>
```

### 2. Project Organization

#### **Creating Projects**
1. Click the **+** button next to the project selector
2. Enter a descriptive project name
3. Switch between projects using the dropdown

#### **Managing Folders**
1. Click **"New Folder"** to create custom categories
2. Use **Select Mode** to choose multiple images
3. **Move to Folder** to organize your dataset
4. **Delete** unwanted images or empty folders

### 3. Annotation Workflow

#### **Viewing Existing Annotations**
1. Upload images with annotation files
2. Select annotation format (COCO, YOLO, CSV, Pascal VOC)
3. Click images to see annotations overlaid
4. Use **Annotations** toggle to show/hide overlays

#### **Creating New Annotations**
1. Open an image in the modal viewer
2. Click **"Add Bounding Box"** to enter drawing mode
3. Click and drag to create bounding boxes
4. Add descriptive labels for each annotation
5. Toggle annotation visibility as needed

### 4. Data Analysis

#### **Statistical Insights**
- **Statistics Tab**: View comprehensive dataset analytics
- **Format Charts**: Understand your dataset composition
- **Dimension Plots**: Identify size patterns and outliers
- **Color Analysis**: Explore visual characteristics

#### **Filtering & Search**
- **Text Search**: Find images by filename
- **Format Filter**: Show only specific file types
- **Size Filter**: Filter by file size ranges
- **Class Filter**: Show images with specific annotation classes
- **Annotated Only**: Focus on labeled data

## 🛠️ Technical Architecture

### **Frontend Technologies**
- **Pure JavaScript**: No frameworks required
- **HTML5 Canvas**: For annotation rendering
- **Plotly.js**: Interactive charts and visualizations
- **Font Awesome**: Modern iconography
- **CSS Grid/Flexbox**: Responsive layout system

### **File Processing**
- **Client-Side**: All processing happens in the browser
- **File API**: Modern browser file handling
- **Canvas API**: Image analysis and annotation rendering
- **Local Storage**: Session-based data persistence

### **Supported Browsers**
- ✅ Chrome 80+
- ✅ Firefox 75+ 
- ✅ Safari 13+
- ✅ Edge 80+

## 🔧 Configuration

### **Customization Options**

The application can be customized by modifying the JavaScript configuration:

```javascript
// In script.js - modify these values in the constructor
this.itemsPerPage = 20;        // Images per page
this.showAnnotations = true;   // Default annotation visibility
this.annotationFormat = 'coco'; // Default import format
```

### **Adding Custom Annotation Formats**

To support additional annotation formats, extend the parsing methods:

```javascript
// Add to the handleAnnotationFiles switch statement
case 'custom':
    await this.parseCustomAnnotations(files);
    break;

// Implement the parser
async parseCustomAnnotations(files) {
    // Your custom parsing logic here
}
```

## 🐛 Troubleshooting

### **Common Issues & Solutions**

**Images Not Loading:**
- Ensure browser supports File API
- Check file formats are supported
- Try using a local server instead of file:// protocol

**Annotations Not Appearing:**
- Verify annotation file format matches selected type
- Check that image filenames match annotation references
- Use browser console (F12) to see detailed error messages

**Performance Issues:**
- Reduce images per page in configuration
- Use smaller image file sizes
- Close other browser tabs to free memory

**YOLO Annotations Not Working:**
- Ensure coordinates are normalized (0.0 to 1.0)
- Check that class IDs match available classes
- Include a classes.txt file with class names

### **Debug Mode**

Enable detailed logging by opening browser console (F12):
- All operations are logged with detailed information
- Error messages include specific guidance
- Use the **Troubleshooting** button for format-specific help

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Make your changes
3. Test in multiple browsers
4. Submit a pull request

### **Code Structure**
```
sam-analyser-tool/
├── index.html          # Main application HTML
├── styles.css          # All styling and layout
├── script.js           # Core application logic
├── README.md           # This documentation
└── sample_annotations.* # Example annotation files
```

### **Adding Features**
- Follow the existing code patterns
- Add appropriate error handling
- Include console logging for debugging
- Update this README with new features

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the FiftyOne computer vision platform
- Built for the computer vision and machine learning community
- Thanks to all contributors and users

---

## 📞 Support

- **Issues**: Report bugs on GitHub Issues
- **Documentation**: Check this README for detailed usage
- **Community**: Join discussions in GitHub Discussions

**SAM Analyser Tool** - Making computer vision dataset analysis accessible to everyone! 🔍✨