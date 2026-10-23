import sys, io
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT, OUT = sys.argv[1], sys.argv[2]
INK, ACCENT = "#141414", "#F04E37"

f = instantiateVariableFont(TTFont(FONT), {"wght": 700})
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
upm = f["head"].unitsPerEm
xh = f["OS/2"].sxHeight

def word(text, size, x0, base, track=-0.02):
    """Outline `text` at `size` px, baseline `base`; returns (path d, width)."""
    s = size / upm
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
    x = 0
    for ch in text:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x0 + x, base)))
        x += hmtx[g][0] * s + track * size
    return pen.getCommands(), x - track * size

def symbol(stroke=32, dot=24, ink=INK, accent=ACCENT):
    """Radio q on a 256 grid: ring R84 at (128,110), dot, stem flush with the ring's right edge, round foot."""
    R, r = 84, 84 - stroke
    sx = 212 - stroke
    return (f'<path fill="{ink}" fill-rule="evenodd" d="M128 26 A{R} {R} 0 1 1 127.99 26 Z '
            f'M128 {110 - r} A{r} {r} 0 1 0 128.01 {110 - r} Z"/>'
            f'<path fill="{ink}" d="M{sx} 110 H212 V{230 - stroke/2} A{stroke/2} {stroke/2} 0 0 1 {sx} {230 - stroke/2} Z"/>'
            f'<circle fill="{accent}" cx="128" cy="110" r="{dot}"/>')

def svg(w, h, body, title="quikform"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-labelledby="title"><title id="title">{title}</title>{body}</svg>\n')

def save(name, s):
    open(f"{OUT}/{name}", "w").write(s)

save("quikform-symbol.svg", svg(256, 256, f'<g id="symbol">{symbol()}</g>'))
save("quikform-symbol-small.svg", svg(256, 256, f'<g id="symbol">{symbol(stroke=36, dot=22)}</g>'))
# reversed: white ring thinned to offset irradiation on dark backgrounds
save("quikform-symbol-reversed.svg", svg(256, 256, f'<g id="symbol">{symbol(stroke=30, ink="#FFFFFF")}</g>'))

# Horizontal: ring diameter (168) = 2 x x-height, ring centre on x-height middle, stem foot on descender line.
size = 168 / (2 * xh / upm)
base = 110 + (xh / upm * size) / 2
gap = 0.5 * 168 / 2
d, ww = word("quikform", size, 0, 0)
def lockup(ink, accent, sym_stroke=32, name="", ):
    tx = 212 - 44 + gap  # symbol occupies x 44..212
    W = int(round(tx + ww + 8))
    return W, (f'<g id="symbol" transform="translate(-44 0)">{symbol(stroke=sym_stroke, ink=ink, accent=accent)}</g>'
               f'<path id="wordmark" fill="{ink}" transform="translate({tx - 44 + 44:.1f} {base:.1f})" d="{d}"/>')
for name, ink, acc, st in [("horizontal", INK, ACCENT, 32), ("horizontal-reversed", "#FFFFFF", ACCENT, 30)]:
    Wd, body = lockup(ink, acc, st)
    save(f"quikform-{name}.svg", svg(Wd, 256, body))

# Stacked: symbol centred above, wordmark below (wordmark width = 2.2 x symbol width).
ssize = size * 0.62
d2, ww2 = word("quikform", ssize, 0, 0)
Wst = int(round(max(ww2, 168) + 32))
sym_x = (Wst - 168) / 2 - 44
wy = 256 + 24 + xh / upm * ssize
Hst = int(round(wy + 0.24 * ssize + 16))
save("quikform-stacked.svg", svg(Wst, Hst,
     f'<g id="symbol" transform="translate({sym_x:.1f} 0)">{symbol()}</g>'
     f'<path id="wordmark" fill="{INK}" transform="translate({(Wst - ww2)/2:.1f} {wy:.1f})" d="{d2}"/>'))
save("quikform-wordmark.svg", svg(int(ww + 16), 256, f'<path id="wordmark" fill="{INK}" transform="translate(8 {base:.1f})" d="{d}"/>'))
print("size", round(size, 1), "base", round(base, 1), "width", round(ww))
