const express = require('express');
const chroma = require('chroma-js');

const router = express.Router();

router.get('/colors/palette', (req, res) => {
  const type = req.query.type || 'analogous';
  const seeds = (req.query.seeds || '#3498db').split(',');

  try {
    const palettes = seeds.map(seed => {
      let palette = [];

      switch (type) {
        case 'analogous':
          palette = chroma
            .scale([chroma(seed).set('hsl.h', '-30'), seed, chroma(seed).set('hsl.h', '+30')])
            .colors(5);
          break;

        case 'complementary':
          palette = [seed, chroma(seed).set('hsl.h', '+180').hex()];
          break;

        case 'monochromatic':
          palette = chroma.scale([chroma(seed).darken(), chroma(seed).brighten()]).colors(5);
          break;

        case 'triadic':
          palette = [
            seed,
            chroma(seed).set('hsl.h', '+120').hex(),
            chroma(seed).set('hsl.h', '+240').hex()
          ];
          break;

        default:
          throw new Error('Invalid type');
      }

      return { seed, palette };
    });

    res.json({ type, palettes });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      error: 'Palette generation failed. Use valid hex colors and types: analogous, complementary, monochromatic, triadic.'
    });
  }
});

module.exports = router;
