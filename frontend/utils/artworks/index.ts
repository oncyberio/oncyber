const cloudinaryUrl = "https://res.cloudinary.com/oncyber-io";

// Define URL mappings for different types
const urlMappings = [
  {
    checkField: 'dcompressed_image_url',
    primarySource: 'image_original_url',
    fallbackSource: 'image_url'
  },
  {
    checkField: 'dcompressed_animation_url',
    primarySource: 'original_animation_url',
    fallbackSource: 'animation_url'
  },
  {
    checkField: 'compressed_animation_url',
    primarySource: 'original_animation_url',
    fallbackSource: 'animation_url'
  }
];

/**
 * Updates a URL if it starts with Cloudinary URL
 * @param {Object} data - The artwork data object
 * @param {Object} mapping - The URL mapping configuration
 */
function updateUrlIfCloudinary(data, mapping) {
  const { checkField, primarySource, fallbackSource } = mapping;
  
  if (data[checkField]?.startsWith(cloudinaryUrl)) {
    data[checkField] = data?.[primarySource] || data?.[fallbackSource];
  }
}

/**
 * Processes artwork data to replace Cloudinary URLs with original URLs
 * @param {Object} processedArtworks - Object containing artwork data
 * @returns {Object} Processed artwork data
 */
export function processArtworks(processedArtworks) {
  if (!processedArtworks || typeof processedArtworks !== 'object') {
    return processedArtworks;
  }

  for (const key in processedArtworks) {
    const artwork = processedArtworks[key];
    
    if (artwork?.data) {
      urlMappings.forEach(mapping => updateUrlIfCloudinary(artwork.data, mapping));
    }
  }
  
  return processedArtworks;
}

/**
 * Formats asset URLs by replacing Cloudinary URLs with their original sources
 * @param asset - The asset object to process
 */
export const formatAssetUrls = (asset: any): void => {
    urlMappings.forEach(({ checkField, primarySource, fallbackSource }) => {
        if (asset[checkField]?.startsWith(cloudinaryUrl)) {
            asset[checkField] = asset[primarySource] || asset[fallbackSource];
        }
    });
};