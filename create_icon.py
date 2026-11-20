import os
from PIL import Image, ImageDraw, ImageFont

def generate_app_icon():
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    images = []

    for size in sizes:
        w, h = size
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Rounded rectangle background with Telegram blue gradient
        corner_radius = int(w * 0.22)
        bg_color = (36, 161, 222, 255) # Telegram blue
        
        # Outer soft glow/border
        draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=corner_radius, fill=(20, 24, 33, 255), outline=(50, 180, 240, 255), width=max(1, int(w * 0.03)))
        
        # Inner shield/bubble
        pad = int(w * 0.12)
        draw.rounded_rectangle([pad, pad, w - pad, h - pad], radius=int(corner_radius * 0.8), fill=bg_color)
        
        # Telegram paper airplane icon / Bot symbol
        # Paper airplane coordinates
        p1 = (int(w * 0.28), int(h * 0.50))
        p2 = (int(w * 0.72), int(h * 0.30))
        p3 = (int(w * 0.40), int(h * 0.72))
        p4 = (int(w * 0.48), int(h * 0.54))

        # White plane polygons
        draw.polygon([p1, p2, p4], fill=(255, 255, 255, 255))
        draw.polygon([p4, p2, p3], fill=(225, 235, 245, 255))
        draw.polygon([p1, p4, (int(w*0.35), int(h*0.58))], fill=(190, 215, 235, 255))

        images.append(img)

    icon_path = os.path.join(os.path.dirname(__file__), 'icon.ico')
    images[0].save(icon_path, format='ICO', sizes=[s for s in sizes], append_images=images[1:])
    print(f"Generated icon at {icon_path}")

if __name__ == '__main__':
    generate_app_icon()
