# Branding assets

`rubber-duck.png` is the original image generated with the built-in image generation tool. It has a transparent background. The public favicon PNGs, multi-size ICO (16/32/48 px), and 192/512 px app icons are resized from this original with alpha preserved.

The Apple touch icon uses the site's peach background and 150 px artwork on a 180 px canvas; iOS applies its own corner mask. The separate maskable icon uses 288 px artwork centered on a 512 px peach canvas, keeping the duck inside the central safe circle.

`Fredoka-SemiBold.ttf` is a static weight-600 instance of `src/app/fonts/Fredoka.ttf` for Next.js's social image renderer, which cannot parse the variable original. It uses the same [SIL Open Font License](../../src/app/fonts/OFL.txt). The app's original font is unchanged.

Generation prompt:

```text
Use case: logo-brand
Asset type: square rubber duck favicon and app icon
Primary request: One adorable classic yellow rubber duckie, bold simple silhouette, orange rounded bill, tiny dark navy eyes, subtle molded wing, softly rounded plump body. Polished playful 3D toy illustration, restrained soft highlights and shading, readable at 16px.
Composition: centered, three-quarter view, entire duck visible and filling 85 percent of the square canvas with even clear padding.
Scene/backdrop: genuinely transparent background with alpha, no background tile, no ground plane or cast shadow outside the duck.
Constraints: exactly one duck, no text, no letters, no watermark, no extra props, no scenery. Crisp smooth edges. Square 1024 by 1024.
```
