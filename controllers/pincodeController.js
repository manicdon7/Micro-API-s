const axios = require('axios');
const NodeCache = require('node-cache');

const POLLINATIONS_API_URL = process.env.POLLINATIONS_API_URL || 'https://text.pollinations.ai/';
const cache = new NodeCache({ stdTTL: 86400 }); // Cache for 24 hours

// Helper function to clean Markdown or unexpected response
function cleanMarkdownResponse(responseText) {
  if (typeof responseText !== 'string') return responseText;
  // Remove ```json, ```, or other code block markers with optional whitespace
  let cleaned = responseText.replace(/```(json)?\s*|\s*```/g, '').trim();
  // Check if response resembles JSON
  if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
    return { error: 'Invalid pincode or API response format' };
  }
  return cleaned;
}

// Helper function to query Pollinations.ai API with retry logic
async function getLocationFromPincode(pincode) {
  const cacheKey = `pincode_${pincode}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    return { ...cachedResult, cached: true };
  }

  const prompt = `Given the Indian pincode ${pincode}, provide the corresponding details in JSON format like {"city": "CityName", "state": "StateName", "district": "DistrictName", "taluk": "TalukName", "post_office": "PostOfficeName", "region": "RegionName", "division": "DivisionName", "latitude": "LatValue", "longitude": "LongValue"}, if the pincode is valid. If invalid, return {"error": "Invalid pincode"}. If latitude or longitude are unavailable, set them to null. just give the json dont need to explain anything. or dont give any other text.`;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response = await axios.post(
        POLLINATIONS_API_URL,
        {
          messages: [{ role: 'user', content: prompt }],
          model: 'openai-fast',
          private: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json', // Explicitly request JSON
          },
          timeout: 8000, // 8-second timeout for faster failure
        }
      );

      // Log raw response for debugging (disabled in production unless needed)
      console.debug(`Pollinations API response for ${pincode}:`, response.data);

      // Handle different response formats
      let result;
      if (typeof response.data === 'string') {
        const cleanedResponse = cleanMarkdownResponse(response.data);
        if (typeof cleanedResponse === 'object') {
          result = cleanedResponse;
        } else {
          try {
            result = JSON.parse(cleanedResponse);
          } catch (parseError) {
            console.error(`JSON parse error for ${pincode}:`, cleanedResponse);
            throw new Error('Invalid JSON response from API');
          }
        }
      } else if (typeof response.data === 'object' && response.data !== null) {
        result = response.data;
      } else {
        throw new Error('Unexpected API response format');
      }

      // Validate required fields
      if (result.error) {
        throw new Error(result.error);
      }
      // if (!result.city || !result.state || !result.district || !result.taluk || !result.post_office) {
      //   throw new Error('Missing required fields in API response');
      // }

      // Cache the result
      cache.set(cacheKey, result);
      return { ...result, cached: false };
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        console.error(`Failed to fetch pincode ${pincode} after ${maxRetries + 1} attempts:`, error.message);
        throw new Error(`Failed to fetch pincode details: ${error.message}`);
      }
      // Exponential backoff with jitter
      const delay = 1000 * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Controller for pincode endpoint
exports.getPincodeDetails = async (req, res) => {
  const { pincode } = req.params;

  // Validate pincode (must be a 6-digit number)
  if (!/^[0-9]{6}$/.test(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be a 6-digit number.' });
  }

  try {
    const location = await getLocationFromPincode(pincode);
    res.status(200).json({
      pincode,
      city: location.city,
      state: location.state,
      district: location.district,
      taluk: location.taluk,
      post_office: location.post_office,
      region: location.region || null,
      division: location.division || null,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      cached: location.cached || false,
    });
  } catch (error) {
    console.error(`Pincode error (${pincode}):`, error.message);
    // Standardize error for invalid pincodes
    const errorMessage = error.message.includes('Invalid pincode') ? error.message : 'Failed to fetch pincode details';
    res.status(500).json({ error: errorMessage });
  }
};