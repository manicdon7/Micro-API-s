const axios = require('axios');

const POLLINATIONS_API_URL = process.env.POLLINATIONS_API_URL || 'https://text.pollinations.ai/';

// Helper function to clean Markdown code block
function cleanMarkdownResponse(responseText) {
  // Remove ```json and ``` with optional newlines
  return responseText.replace(/```json\n?|\n?```/g, '').trim();
}

// Helper function to query Pollinations.ai API
async function getLocationFromPincode(pincode) {
  try {
    const prompt = `Given the Indian pincode ${pincode}, provide the corresponding city and state in JSON format like {"city": "CityName", "state": "StateName"}, if the pincode is valid. If invalid, return {"error": "Invalid pincode"}.`;
    const response = await axios.post(POLLINATIONS_API_URL, {
      messages: [{ role: 'user', content: prompt }],
      model: 'openai-fast',
      private: true
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Log raw response for debugging
    console.log('Pollinations API response:', response.data);

    // Handle different response formats
    let result;
    if (typeof response.data === 'string') {
      // Clean Markdown code block if present
      const cleanedResponse = cleanMarkdownResponse(response.data);
      try {
        result = JSON.parse(cleanedResponse);
      } catch (parseError) {
        throw new Error('Response is not valid JSON: ' + cleanedResponse);
      }
    } else if (typeof response.data === 'object' && response.data !== null) {
      // If response is already an object, use it directly
      result = response.data;
    } else {
      throw new Error('Unexpected response format: ' + typeof response.data);
    }

    // Validate expected fields
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.city || !result.state) {
      throw new Error('Response missing city or state fields');
    }

    return result;
  } catch (error) {
    throw new Error('Failed to fetch location data: ' + error.message);
  }
}

// Controller for pincode endpoint
exports.getPincodeDetails = async (req, res) => {
  const { pincode } = req.params;

  // Validate pincode (Indian pincodes are 6 digits)
  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be a 6-digit number.' });
  }

  try {
    const location = await getLocationFromPincode(pincode);
    res.json({
      pincode,
      city: location.city,
      state: location.state,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};