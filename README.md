# Furniture Showcase

Photo gallery and catalog for 2409 Wilson furniture collection.

## Directory Structure

```
furniture-showcase/
├── images/
│   ├── originals/      # Original screenshots from iCloud
│   ├── full/           # Optimized full-size images (max 1200px, <200KB)
│   ├── thumbnails/     # Thumbnail images (400px width)
│   └── manifest.json   # Photo processing manifest
├── furniture.json      # Main furniture catalog data
├── index.html          # Preview/showcase webpage
└── process-images-v2.js # Image processing script
```

## Image Specifications

### Full-Size Images
- Max width: 1200px
- Format: JPEG, progressive
- Target size: <200KB
- Quality: Auto-adjusted (50-85%)

### Thumbnails
- Width: 400px
- Format: JPEG, progressive
- Quality: 80%

## Data Structure

See `furniture.json` for the complete catalog structure. Each item includes:
- Unique ID
- Name and description
- Category, style, materials
- Dimensions (estimated from photos)
- Photo references with descriptions
- Status and metadata

## Processing New Photos

1. Add photos to `images/originals/`
2. Run: `node process-images-v2.js`
3. Update `furniture.json` with new item data
4. Photos will be auto-cropped and optimized

## Status

**Current Progress:**
- ✅ Photo processing pipeline established
- ✅ Auto-cropping from iCloud screenshots working
- ✅ Full-size and thumbnail generation
- ✅ Initial furniture.json with gray chair
- ⏳ Waiting for additional photos from iCloud album (77+ photos mentioned)

**Next Steps:**
- Download remaining photos from album
- Categorize and organize by furniture item
- Complete furniture.json entries
- Create web showcase interface
