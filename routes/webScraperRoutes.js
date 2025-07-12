const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

// ✅ GET /api/scrape?url=https://example.com
router.get('/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing ?url query param' });

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1Tags = [];
    $('h1').each((_, el) => h1Tags.push($(el).text().trim()));
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      links.push({ text, href });
    });

    res.json({
      url,
      title,
      metaDescription,
      h1Tags,
      links,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to scrape the site' });
  }
});

module.exports = router;
