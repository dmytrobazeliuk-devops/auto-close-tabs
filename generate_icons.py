#!/usr/bin/env python3
"""
Icon generator for the Chrome extension.
Creates PNG icons in multiple sizes.
"""

from PIL import Image, ImageDraw
import os


def create_icon(size):
    """Create an icon for the requested size."""
    # Transparent canvas
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Geometry helpers
    center_x = size // 2
    center_y = size // 2
    radius = int(size * 0.35)

    # Background gradient (simulated with simple colors)
    draw.ellipse([0, 0, size, size], fill=(102, 126, 234, 255))

    # Inner accent circle
    inner_radius = int(radius * 0.7)
    draw.ellipse([
        center_x - inner_radius,
        center_y - inner_radius,
        center_x + inner_radius,
        center_y + inner_radius,
    ], fill=(118, 75, 162, 255))

    # Draw the closing “X” symbol
    line_width = max(2, size // 16)
    x_size = int(size * 0.3)

    draw.line([
        center_x - x_size // 2,
        center_y - x_size // 2,
        center_x + x_size // 2,
        center_y + x_size // 2,
    ], fill=(255, 255, 255, 255), width=line_width)
    draw.line([
        center_x + x_size // 2,
        center_y - x_size // 2,
        center_x - x_size // 2,
        center_y + x_size // 2,
    ], fill=(255, 255, 255, 255), width=line_width)

    # Decorative dots (represent tabs)
    dot_size = max(2, size // 20)

    draw.ellipse([
        int(size * 0.7),
        int(size * 0.2),
        int(size * 0.7) + dot_size * 2,
        int(size * 0.2) + dot_size * 2,
    ], fill=(255, 255, 255, 180))

    draw.ellipse([
        int(size * 0.2),
        int(size * 0.7),
        int(size * 0.2) + dot_size * 2,
        int(size * 0.7) + dot_size * 2,
    ], fill=(255, 255, 255, 180))

    return img


def main():
    """Entry point."""
    os.makedirs('icons', exist_ok=True)

    sizes = [16, 32, 48, 128]

    for size in sizes:
        print(f"Creating icon {size}x{size}...")
        icon = create_icon(size)
        icon.save(f'icons/icon{size}.png', 'PNG')
        print(f"Saved: icons/icon{size}.png")

    print("\nAll icons generated successfully!")
    print("Files are available in the 'icons/' folder")


if __name__ == "__main__":
    main()
